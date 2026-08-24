#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
# The live stack. Confirmed from the running container's own label:
#   com.docker.compose.project.config_files=/opt/cssberlin-v2/docker-compose.yml
# This used to default to docker-compose.cloudflare.yml, which nothing runs -
# that is why the only backup on the server was a zero-byte file.
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

set -a
source "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-cssberlin}"
POSTGRES_DB="${POSTGRES_DB:-cssberlin}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUTPUT_FILE="$BACKUP_DIR/${POSTGRES_DB}_$TIMESTAMP.dump"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -Fc -Z 9 -U "$POSTGRES_USER" "$POSTGRES_DB" > "$OUTPUT_FILE"

echo "Backup written to $OUTPUT_FILE"