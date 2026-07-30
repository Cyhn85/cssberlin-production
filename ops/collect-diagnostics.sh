#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.cloudflare.yml}"
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_DIR/logs}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUTPUT_FILE="$OUTPUT_DIR/production-diagnostics-$TIMESTAMP.txt"

mkdir -p "$OUTPUT_DIR"

{
  echo "# cssberlin production diagnostics"
  echo "generated_at=$TIMESTAMP"
  echo
  echo "## docker compose ps"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps || true
  echo
  echo "## app health"
  curl -fsS http://127.0.0.1:3000/api/health || true
  echo
  echo
  echo "## app readiness"
  curl -fsS http://127.0.0.1:3000/api/health?ready=1 || true
  echo
  echo
  echo "## docker compose logs --tail 80 app"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 80 app || true
  echo
  echo "## docker compose logs --tail 80 nginx"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 80 nginx || true
  echo
  echo "## docker compose logs --tail 80 postgres"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 80 postgres || true
  echo
  echo "## disk usage"
  df -h || true
} >"$OUTPUT_FILE"

echo "Diagnostics written to $OUTPUT_FILE"