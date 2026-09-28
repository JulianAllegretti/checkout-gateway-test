# Name matches local.backend_repo_name, already relied on by the EC2
# instance role's pull policy and the deploy script's image reference (task
# 2) — see infra/specs/SPEC.md's naming conventions.
resource "aws_ecr_repository" "backend" {
  name                 = local.backend_repo_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# CI always builds and pushes the single mutable "latest" tag (see SPEC.md's
# deployment flow) — there's no per-commit tagging scheme, so the only
# cleanup needed is sweeping the previous image once "latest" moves to a new
# one and it falls untagged.
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      }
    ]
  })
}
