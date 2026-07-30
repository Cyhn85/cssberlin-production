#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.cloudflare.yml}"
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_DIR/logs}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUTPUT_FILE="$OUTPUT_DIR/hetzner-audit-$TIMESTAMP.txt"

mkdir -p "$OUTPUT_DIR"

have_command() {
  command -v "$1" >/dev/null 2>&1
}

write_section() {
  local title="$1"
  echo
  echo "## $title"
}

{
  echo "# Hetzner read-only audit"
  echo "generated_at=$TIMESTAMP"
  echo "project_dir=$PROJECT_DIR"
  echo "env_file=$ENV_FILE"
  echo "compose_file=$COMPOSE_FILE"
  echo "note=this script is read-only and should not change running services"

  write_section "host identity"
  hostname || true
  uname -a || true
  date -Is || true
  uptime || true

  write_section "network summary"
  if have_command ip; then
    ip -brief address || true
    echo
    ip route || true
  else
    echo "ip command not available"
  fi

  write_section "listening sockets"
  if have_command ss; then
    ss -tulpn || true
  elif have_command netstat; then
    netstat -tulpn || true
  else
    echo "Neither ss nor netstat is available"
  fi

  write_section "systemd services"
  if have_command systemctl; then
    systemctl list-units --type=service --state=running || true
  else
    echo "systemctl not available"
  fi

  write_section "docker ps"
  if have_command docker; then
    docker ps -a || true
    echo
    echo "### docker networks"
    docker network ls || true
    echo
    echo "### docker volumes"
    docker volume ls || true
  else
    echo "docker not available"
  fi

  write_section "docker compose state"
  if have_command docker && [[ -f "$COMPOSE_FILE" ]]; then
    if [[ -f "$ENV_FILE" ]]; then
      docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps || true
    else
      echo "env file missing; running compose ps without --env-file"
      docker compose -f "$COMPOSE_FILE" ps || true
    fi
  else
    echo "compose file missing or docker unavailable"
  fi

  write_section "nginx overview"
  if have_command nginx; then
    nginx -t || true
    echo
    nginx -T 2>/dev/null | sed -n '1,240p' || true
  else
    echo "nginx binary not available"
  fi

  write_section "filesystem checkpoints"
  df -h || true
  echo
  ls -la /opt || true
  echo
  ls -la /opt/cssberlin || true

  write_section "local app endpoints"
  curl -fsS http://127.0.0.1:3000/api/health || true
  echo
  echo
  curl -fsS http://127.0.0.1:3000/api/health?ready=1 || true

  write_section "safe local addresses inferred from this repo"
  echo "app_loopback=http://127.0.0.1:3000"
  echo "postgres_loopback=127.0.0.1:5432"
  echo "public_https=https://cssberlin.de"
  echo "public_https_www=https://www.cssberlin.de"
} >"$OUTPUT_FILE"

echo "Read-only Hetzner audit written to $OUTPUT_FILE"
