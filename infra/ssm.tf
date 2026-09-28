# Terraform only manages this one parameter under local.ssm_path_prefix — the
# gateway credentials next to it are never known to Terraform (or its state)
# at all, only put there manually once (see infra/specs/TASKS.md's task 6).
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "db_password" {
  name  = "${local.ssm_path_prefix}/db_password"
  type  = "SecureString"
  value = random_password.db.result
}
