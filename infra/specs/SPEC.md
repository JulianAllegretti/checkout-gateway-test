# Infra — Spec

Scope of `infra/` (Terraform) and the CI/CD workflows. Rationale lives in
[../../specs/decisions/0001-architecture-overview.md](../../specs/decisions/0001-architecture-overview.md)
("Architecture", "EC2", "CI/CD"); this file makes it concrete enough to implement.

## AWS resources (Terraform-managed)

| Resource | Purpose |
|---|---|
| EC2 instance (t3.micro, free tier) + Elastic IP | Runs `docker compose` (backend + Postgres). Elastic IP so CloudFront's origin address survives a stop/restart |
| Security group on the instance | Inbound only from CloudFront's AWS-managed prefix list, port 443/80 only; no SSH port open (deploys go through SSM, not SSH) |
| ECR repository | Backend Docker image |
| S3 bucket (private, no public access) | Frontend static build |
| CloudFront distribution | Two origins/behaviors: `/api/*` → EC2, default (`/*`) → S3 via Origin Access Control. Response headers policy adds the OWASP headers (bonus item). Default `*.cloudfront.net` domain already serves HTTPS — no ACM cert / custom domain needed for this test |
| SSM Parameter Store (SecureString) | DB password (Terraform `random_password`), gateway private key, integrity secret. **Never** in a `.tf` file or git — gateway keys are `put-parameter`'d manually once, out of band |
| IAM: EC2 instance role | Read the SSM parameters above, pull from ECR |
| IAM: GitHub OIDC provider + role | Scoped to: push to this ECR repo, `s3 sync` to this bucket, invalidate this CloudFront distribution, `ssm send-command` to this EC2 instance. No long-lived AWS access keys in GitHub secrets |

## Deployment flow

```
git push main (backend/**)  → build image → push ECR → SSM send-command on EC2:
                                              read SSM params → write .env →
                                              docker compose pull && up -d
git push main (frontend/**) → vite build → s3 sync → CloudFront invalidation
infra/** changes             → terraform fmt/validate in CI; apply is manual (see below)
```

## CI/CD (GitHub Actions, path-filtered — ADR 0001)

| Workflow | On PR | On push to `main` |
|---|---|---|
| `backend.yml` | install, lint, `prisma migrate deploy` against a `postgres:16-alpine` service container, `jest --coverage` (fails if < 80%) | build+push image to ECR, deploy via SSM |
| `frontend.yml` | install, lint, `jest --coverage` (fails if < 80%) | `vite build`, `s3 sync`, CloudFront invalidation |
| `infra.yml` | `terraform fmt -check`, `terraform init`, `terraform validate` | *(nothing — see below)* |

**`infra.yml` never runs `terraform plan` or `apply`.** This stack deliberately
uses local state (see Non-functional below) — a CI runner has no access to
whoever's laptop last ran `terraform apply`, so any "plan" it produced would
diff against an empty state and show every resource as a false "to create",
which is actively misleading rather than a useful PR preview. Running a real
plan in CI would require either remote state (a bigger change than this
take-home's single-contributor scope justifies) or giving CI broad read
access across every service the stack touches; running `apply` in CI would
require a role that can modify IAM policies, including its own trust
policy — a privilege-escalation shape worth avoiding even at this scale (see
task 7's deploy role, which deliberately excludes anything
Terraform/IAM/EC2-provisioning). So `terraform apply` stays a manual,
human-run step: `git pull`, review the diff, `terraform apply` from whoever
holds the AWS credentials, same as every task in this file was applied while
building this stack.

### GitHub Actions repository configuration (set once, after the first `terraform apply`)

Repo variables (Settings → Secrets and variables → Actions → Variables),
each copied from `terraform output` after task 7/CloudFront/ECR/S3 exist:

| Variable | From |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `terraform output github_actions_deploy_role_arn` |
| `AWS_REGION` | `var.aws_region` (`us-east-1` by default) |
| `BACKEND_ECR_REPOSITORY_URL` | `terraform output backend_ecr_repository_url` |
| `BACKEND_INSTANCE_ID` | `terraform output backend_instance_id` |
| `FRONTEND_BUCKET_NAME` | `terraform output frontend_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `terraform output cloudfront_distribution_id` |
| `VITE_PAYMENT_PUBLIC_KEY` | The gateway's real public key — not secret (see Secrets inventory below), kept as a var rather than a secret purely by convention |

Repo secrets (same page, Secrets tab) — kept as secrets only so they never
appear in plain text in an Actions log, even though the values end up
public in the deployed bundle regardless (the browser calls the gateway
directly, see ADR 0001):

| Secret | Value |
|---|---|
| `VITE_PAYMENT_API_URL` | The gateway's real API URL — never committed (CLAUDE.md) |
| `VITE_SENTRY_DSN` | Optional — leave unset to disable Sentry in the deployed frontend |

`backend.yml`'s Postgres service is a disposable, default-credentials DB scoped to
that CI job only — it never touches the SSM-stored production DB password, and
needs no secrets. The backend's repository-layer tests run against a real Postgres
rather than a mocked Prisma client (see [SPEC.md](../../backend/specs/SPEC.md)):
mocking `$transaction(async (tx) => ...)` faithfully is fragile and wouldn't
actually verify the atomic stock-reservation query works.

Note: these workflows target `release/first-release` and `main` the same way any
other branch's CI would — the branch model (feature → release → main, see this
repo's git history) doesn't change what infra triggers on, only when merges happen.

## Secrets inventory (where each one lives)

| Secret | Lives in | Never in |
|---|---|---|
| AWS OIDC role ARN, ECR repo name, S3 bucket name, CloudFront distribution id | GitHub Actions repo variables/secrets | Terraform state committed to git, any `.tf` file |
| DB password | SSM Parameter Store (Terraform-generated) | Git, `.env` (except the runtime `.env` written on the EC2 instance itself, which is gitignored) |
| Gateway private key / integrity secret | SSM Parameter Store (manually set once) | Git, Terraform `.tf`/`.tfvars` files, this spec, any repo file |
| Gateway public key | Frontend build-time env var (`VITE_PAYMENT_PUBLIC_KEY`) — safe to expose, it can only tokenize, not charge | N/A, it's meant to be public |

## Naming conventions (fixed by task 2, must match in later tasks)

- SSM parameters live under `/${project_name}/${environment}/...`
  (`/checkout/production/...` with the defaults in `variables.tf`) — task 6
  creates `db_password`, `payment_api_url`, `payment_private_key`,
  `payment_public_key` and `payment_integrity_secret` under that path.
  `payment_api_url` is fetched from SSM rather than hardcoded anywhere in this
  repo because its real value is the gateway's own domain (see CLAUDE.md).
- The ECR repository is named `${project_name}-backend` (task 3) — the EC2
  instance role's pull permissions and the deploy script's image reference
  are already scoped to this exact name.
- `infra/templates/deploy.sh.tpl` is written to `/opt/checkout/deploy.sh` on
  the instance and is the single script both the first-boot `user_data` and
  every later SSM Run Command deploy (task 8) invoke — it's idempotent
  (install docker if missing, refresh `.env` from SSM, `docker compose pull
  && up -d`), so there's no separate "install" vs. "update" script.
- The gateway's own API hostname (`var.payment_gateway_hostname`, task 5) is
  the one exception to "never in a .tf file" above — it isn't secret, only
  forbidden from this public repo (CLAUDE.md), so it's a plain Terraform
  variable defaulted to the same placeholder as `frontend/.env.example`'s
  `VITE_PAYMENT_API_URL`, overridden locally via a gitignored
  `terraform.tfvars`. It's needed at apply time to allow it in the CSP's
  `connect-src` (the frontend tokenizes cards by calling it directly).

## Non-functional

- HTTPS end-to-end (CloudFront terminates TLS; CloudFront→EC2 can stay HTTP inside
  the AWS-managed prefix list boundary, or HTTPS with a self-signed cert if time
  allows — not required for the rubric's HTTPS item, which is about the
  customer-facing edge).
- Security headers (OWASP bonus): `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Content-Security-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, via
  the CloudFront response headers policy.
- Terraform state: local state file is enough for a single-contributor take-home
  (no locking/collaboration need) — `*.tfstate` already gitignored.
