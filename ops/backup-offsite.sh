#!/usr/bin/env bash
# Nightly backup of the database and the product photos.
#
# Why this exists even though ops/backup-postgres.sh already did:
# the only backup on the production server was
# backups/cssberlin_2026-08-12_09-14-47.dump at ZERO BYTES. That script
# defaults to docker-compose.cloudflare.yml, which is not the live stack (the
# running container's own label names docker-compose.yml), so `exec postgres`
# went nowhere and the redirect happily wrote an empty file. Nothing checked,
# so it looked like a backup for eleven days.
#
# Everything here is built around that failure: verify the dump, and say
# plainly when the copy is only local.
#
# Scope is the database AND uploads/. Product photos are NOT on Uploadthing -
# they are on this disk (107 MB, served from https://cssberlin.de/uploads/...).
# A database-only backup would restore the orders and lose every photo.

set -uo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
# The live stack. Confirmed from the running container's
# com.docker.compose.project.config_files label.
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-$PROJECT_DIR/uploads}"

# Local copies are only a staging area - keep few, the disk is the reason we
# are here. The real depth of history lives on the remote.
LOCAL_KEEP_DAYS="${LOCAL_KEEP_DAYS:-3}"
REMOTE_KEEP_DAYS="${REMOTE_KEEP_DAYS:-30}"

RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_BASE="${RCLONE_BASE:-cssberlin-backups}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

fail() {
  log "FAILED: $*"
  exit 1
}

[ -f "$ENV_FILE" ] || fail "env file not found: $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"

# Read one value out of an env file. Carriage returns are stripped, not only
# surrounding quotes: an env file written from Windows leaves a trailing CR on
# every value, and a database name ending in CR simply does not exist.
read_env() {
  local value
  value=$(grep -E "^$1=" "$2" | head -1 | cut -d= -f2- | tr -d '\r\n')
  value=${value%\"}
  value=${value#\"}
  printf '%s' "$value"
}

POSTGRES_USER=$(read_env POSTGRES_USER "$ENV_FILE")
POSTGRES_DB=$(read_env POSTGRES_DB "$ENV_FILE")
POSTGRES_USER="${POSTGRES_USER:-cssberlin}"
POSTGRES_DB="${POSTGRES_DB:-cssberlin}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DUMP_FILE="$BACKUP_DIR/${POSTGRES_DB}_${TIMESTAMP}.dump"

# ── 1. Dump ──────────────────────────────────────────────────────────────────

log "dumping ${POSTGRES_DB} via ${COMPOSE_FILE##*/}"

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
      pg_dump -Fc -Z 9 -U "$POSTGRES_USER" "$POSTGRES_DB" > "$DUMP_FILE" 2>/tmp/pgdump.err; then
  log "pg_dump stderr: $(tail -3 /tmp/pgdump.err)"
  rm -f "$DUMP_FILE"
  fail "pg_dump returned non-zero"
fi

# ── 2. Verify. This is the part that was missing. ────────────────────────────

size="$(wc -c < "$DUMP_FILE" | tr -d ' ')"
if [ "${size:-0}" -lt 1024 ]; then
  rm -f "$DUMP_FILE"
  fail "dump is ${size} bytes - refusing to keep a backup that cannot restore"
fi

# Size alone does not prove the dump is readable or complete. Listing the table
# of contents does, and it is cheap: a truncated or corrupt archive fails here.
#
# The archive has to land in a real file inside the container first. Feeding it
# to `pg_restore --list /dev/stdin` through `docker exec -T` fails with "did not
# find magic string in file header" - a custom-format archive needs seekable
# input and docker's multiplexed stdin is not one. Measured the hard way: a
# perfectly good 2.9 MB dump was rejected by that version of this check.
#
# The listing is captured into a variable rather than piped into `grep -q`.
# Under `set -o pipefail` that pipeline lies: grep -q exits the moment it finds
# a match, the reader end of the pipe closes, docker exec dies of SIGPIPE with
# 141, and pipefail reports the whole pipeline as failed even though the match
# succeeded. It fails only when grep wins the race, so it looks intermittent -
# this dump passed once and failed the next run with identical content.
toc="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'cat > /tmp/verify.dump && pg_restore --list /tmp/verify.dump; rc=$?; rm -f /tmp/verify.dump; exit $rc' \
  < "$DUMP_FILE" 2>/dev/null)"

case "$toc" in
  *"TABLE DATA public Product"*) ;;
  *)
    rm -f "$DUMP_FILE"
    fail "dump does not list the Product table data - archive is unusable"
    ;;
esac

log "dump OK: $DUMP_FILE ($(numfmt --to=iec "$size" 2>/dev/null || echo "${size}B"))"

# ── 3. Local rotation ────────────────────────────────────────────────────────

deleted="$(find "$BACKUP_DIR" -maxdepth 1 -name "${POSTGRES_DB}_*.dump" -mtime "+${LOCAL_KEEP_DAYS}" -print -delete | wc -l | tr -d ' ')"
[ "${deleted:-0}" -gt 0 ] && log "rotated out ${deleted} local dump(s) older than ${LOCAL_KEEP_DAYS} days"

# ── 4. Off-site, when rclone is configured ───────────────────────────────────

if ! command -v rclone >/dev/null 2>&1; then
  log "LOCAL ONLY - off-site backup NOT taken (rclone is not installed)"
  log "  A copy on the same disk is not disaster recovery: if this server is"
  log "  lost, the backup goes with it. See ops/restore-offsite.md to finish setup."
  exit 0
fi

if ! rclone listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:"; then
  log "LOCAL ONLY - off-site backup NOT taken (rclone remote '${RCLONE_REMOTE}' is not configured)"
  log "  See ops/restore-offsite.md for the authorisation step."
  exit 0
fi

log "uploading dump to ${RCLONE_REMOTE}:${RCLONE_BASE}/db/"
rclone copy "$DUMP_FILE" "${RCLONE_REMOTE}:${RCLONE_BASE}/db/" --no-traverse 2>&1 | tail -2 \
  || fail "rclone copy of the dump failed"

if [ -d "$UPLOAD_DIR" ]; then
  # sync, not copy: incremental, so the 107 MB of photos travels once and only
  # changes follow. --max-delete guards against a mount going missing and the
  # sync happily emptying the remote copy.
  log "syncing uploads to ${RCLONE_REMOTE}:${RCLONE_BASE}/uploads/"
  rclone sync "$UPLOAD_DIR" "${RCLONE_REMOTE}:${RCLONE_BASE}/uploads/" --max-delete 50 2>&1 | tail -2 \
    || log "WARNING: uploads sync failed - database dump is safe, photos are not"
else
  log "WARNING: ${UPLOAD_DIR} not found - product photos were not backed up"
fi

log "pruning remote dumps older than ${REMOTE_KEEP_DAYS} days"
rclone delete "${RCLONE_REMOTE}:${RCLONE_BASE}/db/" --min-age "${REMOTE_KEEP_DAYS}d" 2>&1 | tail -1

log "off-site backup complete"
exit 0
