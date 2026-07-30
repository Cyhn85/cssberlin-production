#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.cloudflare.yml}"
STRICT_LAUNCH_MODE="${STRICT_LAUNCH_MODE:-1}"
EXPECTED_CANONICAL_URL="${EXPECTED_CANONICAL_URL:-https://cssberlin.de}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

warn() {
  echo "WARN: $*" >&2
}

pass() {
  echo "OK: $*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing required command: $cmd"
  fi
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    fail "Missing required file: $path"
  fi
}

require_nonempty_file() {
  local path="$1"
  require_file "$path"
  if [[ ! -s "$path" ]]; then
    fail "Required file is empty: $path"
  fi
}

get_env() {
  local key="$1"
  local raw_value

  raw_value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f2- || true)"
  raw_value="${raw_value%$'\r'}"

  case "$raw_value" in
    \"*\") raw_value="${raw_value:1:-1}" ;;
    \'*\') raw_value="${raw_value:1:-1}" ;;
  esac

  printf '%s' "$raw_value"
}

normalize_url() {
  local value="$1"
  value="${value%/}"
  printf '%s' "$value"
}

require_env() {
  local key="$1"
  local value

  value="$(get_env "$key")"
  if [[ -z "$value" ]]; then
    fail "Missing required env value: $key"
  fi

  if [[ "$value" == *change-this* || "$value" == *generate-a-long-random-secret* ]]; then
    fail "Placeholder value still present for: $key"
  fi
}

require_complete_group() {
  local label="$1"
  shift
  local missing=()
  local key

  for key in "$@"; do
    if [[ -z "$(get_env "$key")" ]]; then
      missing+=("$key")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    fail "$label is missing required env values: ${missing[*]}"
  fi

  pass "$label is configured"
}

any_env_set() {
  local key

  for key in "$@"; do
    if [[ -n "$(get_env "$key")" ]]; then
      return 0
    fi
  done

  return 1
}

require_https_url() {
  local key="$1"
  local value

  value="$(normalize_url "$(get_env "$key")")"
  if [[ -z "$value" ]]; then
    fail "Missing required env value: $key"
  fi

  if [[ "$value" != https://* ]]; then
    fail "$key must start with https:// for production"
  fi

  if [[ "$value" == *localhost* || "$value" == *127.0.0.1* ]]; then
    fail "$key must not point to localhost in production"
  fi
}

require_matching_env_values() {
  local left_key="$1"
  local right_key="$2"
  local left_value
  local right_value

  left_value="$(normalize_url "$(get_env "$left_key")")"
  right_value="$(normalize_url "$(get_env "$right_key")")"

  if [[ "$left_value" != "$right_value" ]]; then
    fail "$left_key and $right_key must match. Found '$left_value' vs '$right_value'."
  fi
}

require_env_pair() {
  local primary_key="$1"
  local dependent_key="$2"
  local primary_value
  local dependent_value

  primary_value="$(get_env "$primary_key")"
  dependent_value="$(get_env "$dependent_key")"

  if [[ -n "$primary_value" && -z "$dependent_value" ]]; then
    fail "$dependent_key is required when $primary_key is set."
  fi
}

EXPECTED_CANONICAL_URL="$(normalize_url "$EXPECTED_CANONICAL_URL")"

require_command docker
require_command curl
require_nonempty_file "$ENV_FILE"
require_nonempty_file "$COMPOSE_FILE"
require_nonempty_file "$PROJECT_DIR/nginx/nginx.cloudflare-origin.conf"
require_nonempty_file "$PROJECT_DIR/nginx/cloudflare-realip.conf"
require_nonempty_file "$PROJECT_DIR/nginx/ssl/cloudflare-origin.pem"
require_nonempty_file "$PROJECT_DIR/nginx/ssl/cloudflare-origin.key"
pass "Required commands and files exist"

require_env POSTGRES_PASSWORD
require_env NEXTAUTH_SECRET
require_env NEXTAUTH_URL
require_env NEXT_PUBLIC_APP_URL
pass "Core auth and app URL exist"

if [[ "$STRICT_LAUNCH_MODE" == "1" ]]; then
  require_env UPLOADTHING_TOKEN
  pass "UploadThing v7 token exists"
else
  if [[ -z "$(get_env UPLOADTHING_TOKEN)" ]]; then
    warn "UPLOADTHING_TOKEN is missing; seller photo upload stays disabled until it is set."
  else
    pass "UploadThing v7 token exists"
  fi
fi

require_https_url NEXTAUTH_URL
require_https_url NEXT_PUBLIC_APP_URL
require_matching_env_values NEXTAUTH_URL NEXT_PUBLIC_APP_URL
pass "App URLs are HTTPS and consistent"

if [[ "$(normalize_url "$(get_env NEXTAUTH_URL)")" != "$EXPECTED_CANONICAL_URL" ]]; then
  if [[ "$STRICT_LAUNCH_MODE" == "1" ]]; then
    fail "NEXTAUTH_URL/NEXT_PUBLIC_APP_URL must match $EXPECTED_CANONICAL_URL in strict launch mode."
  fi
  warn "Canonical URL differs from $EXPECTED_CANONICAL_URL."
fi

case "$(get_env RUN_DB_SEED)" in
  ""|0|1)
    pass "RUN_DB_SEED is valid"
    ;;
  *)
    fail "RUN_DB_SEED must be 0 or 1 when set."
    ;;
esac

require_env_pair UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN
require_env_pair UPSTASH_REDIS_REST_TOKEN UPSTASH_REDIS_REST_URL

if [[ "$STRICT_LAUNCH_MODE" == "1" ]]; then
  require_complete_group "Stripe payments" STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
  require_complete_group "Transactional email" RESEND_API_KEY EMAIL_FROM
  require_complete_group "Realtime order visibility" \
    PUSHER_APP_ID \
    PUSHER_KEY \
    PUSHER_SECRET \
    PUSHER_CLUSTER \
    NEXT_PUBLIC_PUSHER_KEY \
    NEXT_PUBLIC_PUSHER_CLUSTER
else
  warn "STRICT_LAUNCH_MODE=0 set; Stripe, Pusher, and Resend may remain partial for a non-final rollout."
  if any_env_set STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; then
    require_complete_group "Stripe payments" STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
  else
    warn "Stripe env values are missing."
  fi
  if any_env_set RESEND_API_KEY EMAIL_FROM; then
    require_complete_group "Transactional email" RESEND_API_KEY EMAIL_FROM
  else
    warn "Resend/email env values are missing."
  fi
  if any_env_set PUSHER_APP_ID PUSHER_KEY PUSHER_SECRET PUSHER_CLUSTER NEXT_PUBLIC_PUSHER_KEY NEXT_PUBLIC_PUSHER_CLUSTER; then
    require_complete_group "Realtime order visibility" \
      PUSHER_APP_ID \
      PUSHER_KEY \
      PUSHER_SECRET \
      PUSHER_CLUSTER \
      NEXT_PUBLIC_PUSHER_KEY \
      NEXT_PUBLIC_PUSHER_CLUSTER
  else
    warn "Pusher env values are missing."
  fi
fi

if [[ -n "$(get_env STRIPE_SECRET_KEY)" ]]; then
  if [[ "$(get_env STRIPE_SECRET_KEY)" == sk_test_* && "$STRICT_LAUNCH_MODE" == "1" ]]; then
    fail "STRIPE_SECRET_KEY is a test key. Use live Stripe credentials in strict launch mode."
  fi

  if [[ "$(get_env STRIPE_WEBHOOK_SECRET)" != whsec_* ]]; then
    warn "STRIPE_WEBHOOK_SECRET does not start with whsec_. Double-check the live webhook secret."
  fi
fi

if [[ -n "$(get_env EMAIL_FROM)" && "$(get_env EMAIL_FROM)" != *@* ]]; then
  fail "EMAIL_FROM must look like a real email address."
fi

if [[ -n "$(get_env PUSHER_APP_ID)" ]]; then
  if [[ "$(get_env NEXT_PUBLIC_PUSHER_KEY)" != "$(get_env PUSHER_KEY)" ]]; then
    fail "NEXT_PUBLIC_PUSHER_KEY must match PUSHER_KEY."
  fi

  if [[ "$(get_env NEXT_PUBLIC_PUSHER_CLUSTER)" != "$(get_env PUSHER_CLUSTER)" ]]; then
    fail "NEXT_PUBLIC_PUSHER_CLUSTER must match PUSHER_CLUSTER."
  fi
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null
pass "docker compose config resolves cleanly"

echo "Preflight checks passed."