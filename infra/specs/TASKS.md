# Infra — Tasks

Suggested order. Infra can start in parallel with backend/frontend once their specs
are settled — Terraform doesn't need application code to exist, only to know the
container port/image name and the S3 bucket's expected contents.

1. **Terraform scaffold**: providers, local state, variables/outputs convention,
   `terraform fmt`/`validate` clean.
2. **Networking + EC2**: security group (CloudFront prefix list only), EC2 instance
   (t3.micro) + Elastic IP, instance IAM role (SSM read, ECR pull), user-data
   script that installs Docker/Compose and does the first `.env`-from-SSM +
   `docker compose up -d` on boot.
3. **ECR**: repository for the backend image.
4. **S3**: private bucket for the frontend build, bucket policy scoped to
   CloudFront's Origin Access Control only.
5. **CloudFront**: distribution with the two origins/behaviors (`/api/*` → EC2,
   default → S3), response headers policy with the OWASP headers.
6. **SSM parameters**: `random_password` for the DB, placeholders + instructions
   (in this file, not committed values) for manually setting the gateway private
   key and integrity secret once via `aws ssm put-parameter`.
7. **GitHub OIDC**: identity provider + IAM role scoped to exactly the 4 actions
   listed in [SPEC.md](SPEC.md)'s secrets inventory — nothing broader.
8. **CI workflows**: `backend.yml`, `frontend.yml`, `infra.yml` per SPEC.md's table.
9. **Smoke test**: after first apply + first deploy of each app, confirm
   `https://<cloudfront-domain>/api/health` and `https://<cloudfront-domain>/`
   both resolve over HTTPS with the expected headers present.
10. **README**: paste the final CloudFront URL as the "deployment link" required by
    the PRD's rubric.
