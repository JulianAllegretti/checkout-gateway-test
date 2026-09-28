#!/bin/bash
# Run once, after the first `terraform apply` and the first successful
# backend/frontend deploy (see infra/specs/TASKS.md's task 9) — there's
# nothing to check before both exist. Confirms the two entry points resolve
# over HTTPS with the OWASP response headers (task 5) present.
#
# Usage:
#   ./infra/scripts/smoke-test.sh <cloudfront-domain>
#   ./infra/scripts/smoke-test.sh "$(terraform -chdir=infra output -raw cloudfront_domain_name)"
set -euo pipefail

DOMAIN="${1:?Usage: $0 <cloudfront-domain>}"
BASE_URL="https://$DOMAIN"

REQUIRED_HEADERS=(
  "strict-transport-security"
  "x-content-type-options"
  "x-frame-options"
  "content-security-policy"
  "referrer-policy"
)

check() {
  local path="$1"
  local url="$BASE_URL$path"
  echo "== $url =="

  # No -f: a 4xx/5xx must still be inspected (status line + headers) rather
  # than just failing curl outright.
  local headers status
  headers=$(curl -sS -D - -o /dev/null "$url")
  status=$(echo "$headers" | head -1 | awk '{print $2}')
  echo "$(echo "$headers" | head -1)"

  if [ "$status" -ge 400 ]; then
    echo "FAIL: unexpected status $status"
    exit 1
  fi

  for header in "${REQUIRED_HEADERS[@]}"; do
    if ! echo "$headers" | grep -qi "^$header:"; then
      echo "FAIL: missing header '$header'"
      exit 1
    fi
  done

  echo "OK"
  echo
}

check "/health"
check "/"

echo "Smoke test passed."
