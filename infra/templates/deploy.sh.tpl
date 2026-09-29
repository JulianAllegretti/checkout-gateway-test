#!/bin/bash
# Written to /opt/checkout/deploy.sh by Terraform (user_data on first boot).
# Idempotent by design: the same script re-runs on every deploy, triggered via
# SSM Run Command from the GitHub OIDC role (see infra/specs/SPEC.md's
# deployment flow) — no SSH, no separate "update" script.
set -euo pipefail

APP_DIR=/opt/checkout
mkdir -p "$APP_DIR"

# First boot only: cloud-init always keeps the raw user_data at this path, so
# copy it to the stable location the comment above promises — subsequent
# deploys re-run this exact file via SSM Run Command (see backend.yml)
# without Terraform in the loop at all.
if [ ! -f "$APP_DIR/deploy.sh" ]; then
  cp /var/lib/cloud/instance/user-data.txt "$APP_DIR/deploy.sh"
  chmod +x "$APP_DIR/deploy.sh"
fi

if ! command -v docker >/dev/null 2>&1; then
  dnf install -y docker
  systemctl enable --now docker
fi

# AL2023's repos don't carry a `docker-compose-plugin` package — the
# Compose v2 CLI plugin has to come straight from its own GitHub releases,
# dropped where the Docker CLI looks for plugins. Checked separately from
# the docker install above so a redeploy still installs it even though
# docker itself is already present by then.
if ! docker compose version >/dev/null 2>&1; then
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
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

# Applies any migration files not yet recorded in the DB's own migrations
# table — a no-op once the schema is current, so safe to run on every
# deploy. Uses the backend image itself (it carries the Prisma CLI +
# schema/migrations at runtime for exactly this, see backend/Dockerfile) in
# a throwaway container, before the long-running one starts serving traffic.
docker compose run --rm backend npx prisma migrate deploy

docker compose up -d
