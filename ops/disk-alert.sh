#!/usr/bin/env bash
# Daily disk check with a Telegram warning.
#
# post-deploy-cleanup.sh only runs at deploy time, and this box fills between
# deploys too: three projects share it (cssberlin, Buchhalter,
# fbref-predictions), fbref writes logs every minute, and Docker regrows its
# build cache. The 100% event that aborted a deploy was found by the failure
# itself - nobody was watching. This is the watching.
#
# Reuses the Telegram credentials the TATANGA relay already has on this host.
# Nothing is hard-coded here; the token stays in that .env and out of git.
#
# Always exits 0. A monitor that fails loudly every morning gets muted, and a
# muted monitor is worse than none.

set -uo pipefail

THRESHOLD="${THRESHOLD:-85}"
RELAY_ENV="${RELAY_ENV:-/opt/tatanga-relay/.env}"

# Read one value out of an env file.
#
# Carriage returns are stripped, not only surrounding quotes: this .env was
# written on Windows, so every value carries a trailing CR. A bot token ending
# in CR builds a malformed URL and curl dies before sending - measured here as
# http=000, which reads like a network fault and is not one.
read_env() {
  local value
  value=$(grep -E "^$1=" "$2" | head -1 | cut -d= -f2- | tr -d '\r\n')
  value=${value%\"}
  value=${value#\"}
  printf '%s' "$value"
}

used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
free_h="$(df -h --output=avail / | tail -1 | tr -d ' ')"

if [ "${used:-0}" -le "$THRESHOLD" ]; then
  echo "[$(date '+%F %T')] disk ${used}% (esik ${THRESHOLD}%) - bildirim yok"
  exit 0
fi

# Name the actual consumers. A bare "disk is full" forces whoever reads it to
# ssh in and repeat this measurement by hand.
top="$(du -shx /var/lib/docker /root /usr /opt /var/log 2>/dev/null | sort -rh | head -4 | tr '\t' ' ' | paste -sd '; ' -)"

text="cssberlin sunucu diski: %${used} dolu, ${free_h} bos (esik %${THRESHOLD}).
En buyukler: ${top}
Temizlik: /opt/cssberlin-v2/ops/post-deploy-cleanup.sh"

echo "[$(date '+%F %T')] disk ${used}% - esik asildi, bildirim gonderiliyor"

if [ ! -f "$RELAY_ENV" ]; then
  echo "  UYARI: ${RELAY_ENV} yok - Telegram bildirimi GONDERILEMEDI"
  exit 0
fi

token=$(read_env TELEGRAM_BOT_TOKEN "$RELAY_ENV")
chat=$(read_env TELEGRAM_CHAT_ID "$RELAY_ENV")

if [ -z "${token:-}" ] || [ -z "${chat:-}" ]; then
  echo "  UYARI: Telegram token/chat_id bos - bildirim GONDERILEMEDI"
  exit 0
fi

code="$(curl -sS -m 30 -o /tmp/disk-alert-resp.json -w '%{http_code}' \
  --data-urlencode "chat_id=${chat}" \
  --data-urlencode "text=${text}" \
  "https://api.telegram.org/bot${token}/sendMessage" 2>/dev/null)"

if [ "$code" = "200" ]; then
  echo "  Telegram bildirimi gonderildi"
else
  echo "  UYARI: Telegram http=${code} $(head -c 200 /tmp/disk-alert-resp.json 2>/dev/null)"
fi
rm -f /tmp/disk-alert-resp.json

exit 0
