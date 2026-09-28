data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2_instance" {
  name               = "${local.name_prefix}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

# Registers the instance with SSM (Session Manager + Run Command) — this is
# what lets the GitHub OIDC deploy role (task 7) reach the instance without an
# open SSH port. It does not by itself grant reading the app's own parameters
# below, hence the separate custom policy.
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "ec2_permissions" {
  statement {
    sid       = "ReadAppSecrets"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_path_prefix}/*"]
  }

  # ECR's GetAuthorizationToken is account-wide by design (AWS doesn't
  # support scoping it to one repository) — the two actions below scope the
  # actual image pull to just the backend's repo.
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PullBackendImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = ["arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/${local.backend_repo_name}"]
  }
}

resource "aws_iam_role_policy" "ec2_permissions" {
  name   = "${local.name_prefix}-ec2-permissions"
  role   = aws_iam_role.ec2_instance.id
  policy = data.aws_iam_policy_document.ec2_permissions.json
}

resource "aws_iam_instance_profile" "ec2_instance" {
  name = "${local.name_prefix}-ec2"
  role = aws_iam_role.ec2_instance.name
}
