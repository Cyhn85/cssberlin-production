#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.cloudflare.yml}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing required command: $cmd"
  fi
}

wait_for_http_ok() {
  local label="$1"
  local url="$2"
  local attempts="${3:-40}"
  local sleep_seconds="${4:-3}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl -fsS "$url" >/dev/null; then
      echo "$label is ready: $url"
      return 0
    fi

    echo "Waiting for $label ($attempt/$attempts): $url"
    sleep "$sleep_seconds"
  done

  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=80 app nginx postgres || true
  fail "$label did not become ready in time."
}

require_command docker
require_command curl

if [[ ! -f "$ENV_FILE" ]]; then
  fail "Missing env file: $ENV_FILE"
fi

bash "$PROJECT_DIR/ops/preflight-production.sh"

cd "$PROJECT_DIR"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm db-setup
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build app nginx --remove-orphans
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo
wait_for_http_ok "Local liveness check" "http://127.0.0.1:3000/api/health"
wait_for_http_ok "Local readiness check" "http://127.0.0.1:3000/api/health?ready=1"

echo
echo "Deployment completed successfully."