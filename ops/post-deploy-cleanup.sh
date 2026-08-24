#!/usr/bin/env bash
# Reclaim disk after a deploy.
#
# A Docker build writes a new image layer set and a new build cache every time.
# Nothing removes the old ones, so a 38 GB root disk fills in a handful of
# deploys - measured here at 100% (163 MB free), which aborted a build with
# ENOSPC. A full disk does not only break deploys: Postgres stops being able to
# write, so this is an availability problem, not a housekeeping one.
#
# Deliberately NOT `docker system prune -af`. This host is shared - cssberlin
# runs next to Buchhalter and /opt/fbref-predictions - and `-a` deletes every
# image that no *running* container references. That includes the previous
# cssberlin image, which is the rollback path, and any image belonging to a
# temporarily stopped container from another project. The two prunes below only
# touch things nobody can claim: the build cache and untagged layers.
#
# Volumes are never pruned. The Postgres data directory is a volume.
#
# Always exits 0: a deploy that worked must not be reported as failed because
# housekeeping afterwards hit a snag.

set -uo pipefail

HIGH_WATER_PCT="${HIGH_WATER_PCT:-85}"
BUILD_CACHE_KEEP="${BUILD_CACHE_KEEP:-48h}"
JOURNAL_MAX="${JOURNAL_MAX:-200M}"

disk_pct() {
  df --output=pcent / | tail -1 | tr -dc '0-9'
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

before="$(disk_pct)"
log "disk before: ${before}%"

log "pruning build cache older than ${BUILD_CACHE_KEEP}"
docker builder prune -f --filter "until=${BUILD_CACHE_KEEP}" 2>&1 | tail -1

log "pruning dangling images"
docker image prune -f 2>&1 | tail -1

after="$(disk_pct)"
log "disk after docker prune: ${after}%"

# journald is uncapped on this host and had grown to 914 MB. Only touched when
# the docker prune was not enough, because rotating logs away costs us
# diagnostics we may want after an incident.
if [ "${after:-0}" -gt "$HIGH_WATER_PCT" ]; then
  log "still above ${HIGH_WATER_PCT}% - vacuuming journal to ${JOURNAL_MAX}"
  journalctl --vacuum-size="$JOURNAL_MAX" 2>&1 | tail -1
  after="$(disk_pct)"
  log "disk after journal vacuum: ${after}%"
fi

if [ "${after:-0}" -gt "$HIGH_WATER_PCT" ]; then
  log "WARNING: disk still at ${after}% after cleanup - needs a human look"
  log "  biggest consumers: du -sh /var/lib/docker /var/log /opt/*"
fi

log "cleanup done (${before}% -> ${after}%)"
exit 0
