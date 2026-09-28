resource "aws_instance" "backend" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.backend.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2_instance.name
  associate_public_ip_address = true

  # Re-running deploy.sh.tpl's content (e.g. after `terraform apply` picks up
  # a template edit) replaces user_data and forces a reboot, which re-runs it
  # — day-to-day deploys instead go through SSM Run Command without touching
  # Terraform, see SPEC.md.
  user_data = templatefile("${path.module}/templates/deploy.sh.tpl", {
    ssm_path_prefix = local.ssm_path_prefix
    backend_image   = local.backend_image
    aws_region      = var.aws_region
    backend_port    = var.backend_port
  })
  user_data_replace_on_change = true

  tags = {
    Name = "${local.name_prefix}-backend"
  }
}

# Elastic IP so CloudFront's custom origin (task 5) survives an instance
# stop/restart without a Terraform/manual update.
resource "aws_eip" "backend" {
  domain   = "vpc"
  instance = aws_instance.backend.id

  tags = {
    Name = "${local.name_prefix}-backend"
  }
}
