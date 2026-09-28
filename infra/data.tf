data "aws_caller_identity" "current" {}

# No custom VPC — the default VPC's subnets already have an internet gateway
# route, which is all a single EC2 instance behind CloudFront needs (SPEC.md
# doesn't call for one, and a take-home doesn't need the isolation).
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# AWS-managed prefix list covering CloudFront's origin-facing IP ranges —
# the only inbound source the backend's security group allows (SPEC.md).
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
