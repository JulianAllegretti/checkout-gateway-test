resource "aws_security_group" "backend" {
  name        = "${local.name_prefix}-backend"
  description = "Backend EC2 instance: inbound only from CloudFront, no SSH (deploys go through SSM, see SPEC.md)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Backend port, from CloudFront's origin-facing ranges only"
    from_port       = var.backend_port
    to_port         = var.backend_port
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  egress {
    description = "OS/Docker updates, ECR pull, SSM API calls"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-backend"
  }
}
