#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <origin-cert.pem> <origin-key.key>" >&2
  exit 1
fi

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEST_DIR="${DEST_DIR:-$PROJECT_DIR/nginx/ssl}"
CERT_SOURCE="$1"
KEY_SOURCE="$2"

if [[ ! -f "$CERT_SOURCE" ]]; then
  echo "Certificate file not found: $CERT_SOURCE" >&2
  exit 1
fi

if [[ ! -f "$KEY_SOURCE" ]]; then
  echo "Key file not found: $KEY_SOURCE" >&2
  exit 1
fi

install -d -m 0700 "$DEST_DIR"
install -m 0600 "$CERT_SOURCE" "$DEST_DIR/cloudflare-origin.pem"
install -m 0600 "$KEY_SOURCE" "$DEST_DIR/cloudflare-origin.key"

echo "Installed Cloudflare Origin CA files into $DEST_DIR"
