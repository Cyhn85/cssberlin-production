#!/usr/bin/env bash
# Nightly call into /api/cron/cleanup.
#
# Replaces a hand-written copy on the server whose curl line had lost its
# quoting: no secret was interpolated, the URL was never closed, and -s hid the
# failure. /var/log/cssberlin-cleanup.log had never been created, which is how
# we know it had not run once since it was installed. Versioned here so the
# working copy is the one in git, not one typed into a terminal.
#
# The endpoint reclaims disk from settled listings AND releases expired checkout
# reservations, so a silent failure quietly costs both space and sellable stock.

set -uo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
ENDPOINT="${ENDPOINT:-http://localhost:3000/api/cron/cleanup}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: env file not found: $ENV_FILE"
  exit 1
fi

# Read one value out of an env file.
#
# Carriage returns are stripped, not only surrounding quotes: env files here can
# be written from Windows, and then every value carries a trailing CR. A secret
# ending in CR is silently the wrong secret, and a token ending in CR builds a
# malformed URL that curl refuses to send at all - measured on this host as
# http=000, which reads like a network fault and is not one.
read_env() {
  local value
  value=$(grep -E "^$1=" "$2" | head -1 | cut -d= -f2- | tr -d '\r\n')
  value=${value%\"}
  value=${value#\"}
  printf '%s' "$value"
}

CRON_SECRET=$(read_env CRON_SECRET "$ENV_FILE")

if [ -z "${CRON_SECRET:-}" ]; then
  log "ERROR: CRON_SECRET is empty - the endpoint answers 503 without it"
  exit 1
fi

response="$(curl -sS -m 120 -w '\n%{http_code}' \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "$ENDPOINT" 2>&1)"

status="$(printf '%s' "$response" | tail -1)"
body="$(printf '%s' "$response" | sed '$d')"

if [ "$status" = "200" ]; then
  log "OK ${status}: ${body}"
  exit 0
fi

# Loud on purpose. The previous version's whole failure mode was being quiet.
log "FAILED http=${status} body=${body}"
exit 1
