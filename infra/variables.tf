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

variable "instance_type" {
  description = "EC2 instance type for the backend host."
  type        = string
  default     = "t3.micro"
}

variable "backend_port" {
  description = "Port the backend container listens on (see backend/.env.example's PORT) — also what CloudFront's custom origin (task 5) targets."
  type        = number
  default     = 3000
}

variable "payment_gateway_hostname" {
  description = "The payment gateway's API hostname (no scheme/path) — the frontend tokenizes cards by calling it directly, so it's allowed in the CloudFront response headers policy's CSP connect-src (task 5). The real value must never be committed (see CLAUDE.md); override via terraform.tfvars (gitignored) or TF_VAR_payment_gateway_hostname, matching frontend/.env.example's VITE_PAYMENT_API_URL."
  type        = string
  default     = "api-sandbox.example-gateway.dev"
}

variable "github_repository" {
  description = "\"owner/repo\" allowed to assume the GitHub Actions deploy role (task 7) via OIDC — not secret, this is a public repo, just needs to match reality."
  type        = string
  default     = "JulianAllegretti/checkout-gateway-test"
}
