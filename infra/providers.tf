terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # No backend block: local state is enough for a single-contributor take-home
  # (see specs/SPEC.md's Non-functional section) — Terraform defaults to local
  # state when none is configured, and *.tfstate is gitignored.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
