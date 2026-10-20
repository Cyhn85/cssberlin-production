#!/usr/bin/env bash
# Sets ONE variable in .env.production and restarts the app - the value is read
# from stdin (piped) or typed hidden, so it never appears in shell history,
# process lists or chat logs.
#
#   ssh -t root@host /opt/cssberlin-v2/ops/set-env.sh SMTP_PASSWORD      (prompts, hidden)
#   <value> | ssh root@host /opt/cssberlin-v2/ops/set-env.sh GROQ_API_KEY
#   ssh -t root@host /opt/cssberlin-v2/ops/set-env.sh --smtp-ionos       (all SMTP lines, asks only the password)
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=.env.production

upsert() {
  local key="$1" value="$2"
  value=$(printf '%s' "$value" | tr -d '\r\n')
  # docker compose interpolates $ inside env files - escape it
  value=${value//\$/\$\$}
  cp "$ENV_FILE" "/root/env_production_$(date +%Y%m%d_%H%M%S).bak"
  chmod 600 /root/env_production_*.bak
  grep -v -E "^${key}=" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE.tmp"
  chmod --reference="$ENV_FILE" "$ENV_FILE.tmp" 2>/dev/null || chmod 600 "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  echo "$key gesetzt (${#value} Zeichen)."
}

read_secret() {
  local prompt="$1" v
  if [ -t 0 ]; then read -r -s -p "$prompt" v; echo >&2; else IFS= read -r v || true; fi
  printf '%s' "$v"
}

if [ "${1:-}" = "--smtp-ionos" ]; then
  upsert SMTP_HOST smtp.ionos.de
  upsert SMTP_PORT 587
  upsert SMTP_SECURE false
  upsert SMTP_USER info@cssberlin.de
  upsert SMTP_FROM info@cssberlin.de
  upsert SMTP_PASSWORD "$(read_secret 'IONOS-Passwort fuer info@cssberlin.de: ')"
else
  KEY="${1:?Variablenname fehlt, z. B. GROQ_API_KEY}"
  [[ "$KEY" =~ ^[A-Z0-9_]+$ ]] || { echo "Ungueltiger Name: $KEY" >&2; exit 1; }
  upsert "$KEY" "$(read_secret "$KEY: ")"
fi

docker compose --env-file "$ENV_FILE" up -d app >/dev/null 2>&1
echo "App neu gestartet."
