# Outputs are added here as each task lands (e.g. the CloudFront domain in
# task 5, which becomes the README's "deployment link" in task 10).

output "backend_public_ip" {
  description = "Elastic IP of the backend EC2 instance — CloudFront's custom origin (task 5) targets this."
  value       = aws_eip.backend.public_ip
}

output "backend_instance_id" {
  description = "EC2 instance id, used for SSM send-command deploys (tasks 7/8)."
  value       = aws_instance.backend.id
}

output "backend_ecr_repository_url" {
  description = "ECR repository URL the backend.yml CI workflow (task 8) pushes to."
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_bucket_name" {
  description = "S3 bucket the frontend.yml CI workflow (task 8) syncs the Vite build to."
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_domain_name" {
  description = "Public HTTPS entry point for both apps — becomes the README's deployment link (task 10) and what task 9's smoke test checks."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "Used by the frontend.yml CI workflow (task 8) to invalidate the cache after each deploy."
  value       = aws_cloudfront_distribution.frontend.id
}
