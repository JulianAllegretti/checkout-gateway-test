# Shared variables, used across every *.tf file in this stack (see ADR 0001's
# Monorepo structure — no subfolders, all resources live flat in infra/).
# Resource-specific variables (instance type, bucket name suffix, etc.) are
# declared next to the resource that uses them, in later tasks.

variable "aws_region" {
  description = "AWS region all resources are created in."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short name used as a prefix/tag on every resource this stack creates."
  type        = string
  default     = "checkout"
}

variable "environment" {
  description = "Deployment environment name, used in tags and resource naming."
  type        = string
  default     = "production"
}
