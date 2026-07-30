#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
OUTPUT_FILE="${OUTPUT_FILE:-$PROJECT_DIR/nginx/cloudflare-realip.conf}"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

ipv4_ranges="$(curl -fsSL https://www.cloudflare.com/ips-v4)"
ipv6_ranges="$(curl -fsSL https://www.cloudflare.com/ips-v6)"

echo "# Generated from Cloudflare's official IP list endpoints." >"$TMP_FILE"
echo "# Last refreshed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$TMP_FILE"
echo "# Sources:" >>"$TMP_FILE"
echo "# - https://www.cloudflare.com/ips-v4" >>"$TMP_FILE"
echo "# - https://www.cloudflare.com/ips-v6" >>"$TMP_FILE"
echo >>"$TMP_FILE"

for cidr in $ipv4_ranges; do
  echo "set_real_ip_from $cidr;" >>"$TMP_FILE"
done

for cidr in $ipv6_ranges; do
  echo "set_real_ip_from $cidr;" >>"$TMP_FILE"
done

echo >>"$TMP_FILE"
echo "real_ip_header CF-Connecting-IP;" >>"$TMP_FILE"
echo "real_ip_recursive on;" >>"$TMP_FILE"

install -m 0644 "$TMP_FILE" "$OUTPUT_FILE"
echo "Updated Cloudflare real IP config at $OUTPUT_FILE"