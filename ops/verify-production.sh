#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-cssberlin.de}"
WWW_DOMAIN="${WWW_DOMAIN:-www.cssberlin.de}"
LOCAL_APP="${LOCAL_APP:-http://127.0.0.1:3000}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

check_status() {
  local label="$1"
  local url="$2"
  local expected_status="$3"
  local status

  status="$(curl -ksS -o /dev/null -w '%{http_code}' "$url")"
  echo "$label -> $status ($url)"

  if [[ "$status" != "$expected_status" ]]; then
    fail "$label expected HTTP $expected_status but got $status."
  fi
}

check_redirect_to_apex() {
  local label="$1"
  local url="$2"
  local headers
  local status
  local location

  headers="$(curl -ksS -o /dev/null -D - "$url" | tr -d '\r')"
  status="$(printf '%s\n' "$headers" | awk 'toupper($1) ~ /^HTTP/ { code=$2 } END { print code }')"
  location="$(printf '%s\n' "$headers" | awk 'tolower($1) == "location:" { print $2 }' | tail -n 1)"

  echo "$label -> $status (${location:-no-location})"

  case "$status" in
    301|302|307|308)
      ;;
    *)
      fail "$label expected an HTTP redirect but got $status."
      ;;
  esac

  case "$location" in
    "https://$DOMAIN"|"https://$DOMAIN/"|"https://$DOMAIN"\?*)
      ;;
    *)
      fail "$label should redirect to https://$DOMAIN but redirected to '${location:-missing}'."
      ;;
  esac
}

check_status "Local liveness" "$LOCAL_APP/api/health" "200"
check_status "Local readiness" "$LOCAL_APP/api/health?ready=1" "200"
check_status "Apex HTTPS" "https://$DOMAIN" "200"
check_redirect_to_apex "WWW HTTPS redirect" "https://$WWW_DOMAIN"

echo "Production verification checks passed."