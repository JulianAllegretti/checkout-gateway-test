# Lets GitHub Actions assume an AWS role with a short-lived token instead of
# long-lived access keys stored as repo secrets (SPEC.md's Secrets inventory).
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # AWS validates GitHub's OIDC certificate chain against its own trusted CA
  # store regardless of this value (GitHub's root CA has been in AWS's store
  # since 2023) — this is the well-known thumbprint every current Terraform
  # example for this provider uses, required by the resource schema either way.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Any ref in this exact repo (branches, tags, PRs) — deploy steps in the
    # workflows themselves (task 8) still gate on push-to-main, this just
    # keeps the role usable while iterating on the workflow files too. A
    # single-contributor repo doesn't need it narrowed to ref:refs/heads/main.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${local.name_prefix}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

# Exactly the 4 capabilities SPEC.md's secrets inventory lists — nothing
# broader. Notably absent: any Terraform/IAM/EC2-provisioning permission —
# `terraform apply` for this stack is run locally, not from CI, see
# infra/specs/SPEC.md.
data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PushBackendImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }

  statement {
    sid       = "S3SyncListBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.frontend.arn]
  }

  statement {
    sid       = "S3SyncObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
  }

  statement {
    sid       = "InvalidateFrontendDistribution"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.frontend.arn]
  }

  statement {
    sid     = "DeployBackendViaSsm"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.backend.arn,
      "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
    ]
  }

  # Not itself "send-command", but reading whether the command it just sent
  # succeeded is what lets the workflow fail the deploy step on error instead
  # of reporting green regardless.
  statement {
    sid       = "ReadBackendDeployResult"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "${local.name_prefix}-github-actions-deploy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}
