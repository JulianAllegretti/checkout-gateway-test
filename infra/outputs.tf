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
