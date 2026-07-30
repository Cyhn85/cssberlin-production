#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-}"
PROJECT_DIR="${PROJECT_DIR:-/opt/cssberlin}"

apt-get update
apt-get install -y ca-certificates curl git jq
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

install -d -m 0755 "$PROJECT_DIR"
install -d -m 0755 "$PROJECT_DIR/backups"
install -d -m 0700 "$PROJECT_DIR/nginx/ssl"

if [[ -n "$DEPLOY_USER" ]] && id "$DEPLOY_USER" >/dev/null 2>&1; then
  usermod -aG docker "$DEPLOY_USER"
  chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$PROJECT_DIR"
fi

echo "Docker and base directories are ready in $PROJECT_DIR"
echo "Next: copy the repo, .env.production, and Cloudflare Origin CA files to the server."
