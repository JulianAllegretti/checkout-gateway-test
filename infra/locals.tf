# Naming conventions shared across resource files. Some of these (the ECR
# repo name, the SSM path prefix) are referenced here before the resources
# that actually create them exist yet (ECR: task 3, SSM parameters: task 6) —
# that's intentional: it lets this task's IAM policy and user-data script be
# written against a stable convention, and later tasks just have to match it.
locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # e.g. /checkout/production/db_password — task 6 creates the parameters,
  # this task's IAM policy only needs the path shape to scope access.
  ssm_path_prefix = "/${var.project_name}/${var.environment}"

  backend_repo_name = "${var.project_name}-backend"
  backend_image     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${local.backend_repo_name}:latest"
}
