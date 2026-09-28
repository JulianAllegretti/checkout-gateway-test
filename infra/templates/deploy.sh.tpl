#!/bin/bash
# Written to /opt/checkout/deploy.sh by Terraform (user_data on first boot).
# Idempotent by design: the same script re-runs on every deploy, triggered via
# SSM Run Command from the GitHub OIDC role (see infra/specs/SPEC.md's
# deployment flow) — no SSH, no separate "update" script.
set -euo pipefail

APP_DIR=/opt/checkout
mkdir -p "$APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  dnf install -y docker docker-compose-plugin
  systemctl enable --now docker
fi

# PAYMENT_API_URL is fetched from SSM rather than hardcoded here because its
# real value is the gateway's own domain, which must never appear in this
# repo (see CLAUDE.md) — it's not a secret, just kept out of git.
get_param() {
  aws ssm get-parameter --name "${ssm_path_prefix}/$1" --with-decryption \
    --query Parameter.Value --output text --region ${aws_region}
}
DB_PASSWORD=$(get_param db_password)
PAYMENT_API_URL=$(get_param payment_api_url)
PAYMENT_PRIVATE_KEY=$(get_param payment_private_key)
PAYMENT_PUBLIC_KEY=$(get_param payment_public_key)
PAYMENT_INTEGRITY_SECRET=$(get_param payment_integrity_secret)

cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=postgresql://postgres:$${DB_PASSWORD}@postgres:5432/checkout?schema=public
POSTGRES_PASSWORD=$${DB_PASSWORD}
PAYMENT_API_URL=$${PAYMENT_API_URL}
PAYMENT_PRIVATE_KEY=$${PAYMENT_PRIVATE_KEY}
PAYMENT_PUBLIC_KEY=$${PAYMENT_PUBLIC_KEY}
PAYMENT_INTEGRITY_SECRET=$${PAYMENT_INTEGRITY_SECRET}
BASE_FEE_AMOUNT=5000
DELIVERY_FEE_AMOUNT=8000
PORT=${backend_port}
LOG_LEVEL=info
EOF
chmod 600 "$APP_DIR/.env"

# Mirrors docker-compose.yml at the repo root (local dev), except the backend
# image comes from ECR instead of a local build, and Postgres has no
# published port — internal Docker network only, see ADR 0001.
cat > "$APP_DIR/docker-compose.yml" <<EOF
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: $${DB_PASSWORD}
      POSTGRES_DB: checkout
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    image: ${backend_image}
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${backend_port}:${backend_port}"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
EOF

aws ecr get-login-password --region ${aws_region} \
  | docker login --username AWS --password-stdin "$(echo "${backend_image}" | cut -d/ -f1)"

cd "$APP_DIR"
docker compose pull
docker compose up -d
