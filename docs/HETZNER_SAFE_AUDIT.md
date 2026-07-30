# Hetzner Safe Audit

This note exists for one purpose: inspect the Hetzner server without breaking any other system already running there.

## What is safe right now

Based on the current production compose file, the intended local-only service addresses are:

- App loopback: `http://127.0.0.1:3000`
- Postgres loopback: `127.0.0.1:5432`
- Public entrypoints: `https://cssberlin.de` and `https://www.cssberlin.de`

Why this is safe:

- the app is bound to `127.0.0.1:3000` in [docker-compose.cloudflare.yml](/C:/Users/cyhnsrgc/Desktop/websitenew/docker-compose.cloudflare.yml#L70)
- Postgres is bound to `127.0.0.1:5432` in [docker-compose.cloudflare.yml](/C:/Users/cyhnsrgc/Desktop/websitenew/docker-compose.cloudflare.yml#L13)
- only Nginx is supposed to expose `80` and `443` publicly

That means the first safe local address for inspection on the server is:

- `http://127.0.0.1:3000`

## What not to do before auditing

- Do not bind new public ports on the server.
- Do not stop Docker, Nginx, or unrelated containers.
- Do not replace the active Nginx config before inventory is captured.
- Do not assume this server is dedicated only to `cssberlin.de`.

## Read-only audit command

On the Hetzner server, run:

```bash
bash ops/audit-hetzner-readonly.sh
```

This script is read-only and writes a report into:

```bash
logs/hetzner-audit-<timestamp>.txt
```

It collects:

- host identity and uptime
- IP addresses and routes
- listening ports
- running systemd services
- Docker containers, networks, and volumes
- Docker Compose status for this repo
- Nginx config test and truncated config dump
- disk usage and `/opt/cssberlin` presence
- local app health checks on `127.0.0.1:3000`

## Decision rule after the audit

If the audit shows existing workloads on ports `80` or `443`, keep them untouched and do not deploy over them blindly.

If the audit shows `127.0.0.1:3000` is already occupied by another app, do not change anything yet. First decide a different loopback port and then update:

- [docker-compose.cloudflare.yml](/C:/Users/cyhnsrgc/Desktop/websitenew/docker-compose.cloudflare.yml)
- [nginx/nginx.cloudflare-origin.conf](/C:/Users/cyhnsrgc/Desktop/websitenew/nginx/nginx.cloudflare-origin.conf)
- [ops/verify-production.sh](/C:/Users/cyhnsrgc/Desktop/websitenew/ops/verify-production.sh)
- [ops/deploy-production.sh](/C:/Users/cyhnsrgc/Desktop/websitenew/ops/deploy-production.sh)

## Current limitation

From the current local workspace, there is no Hetzner IP, SSH alias, or server credential source checked into the repo. So the safe next step is inventory first, then any remote change.
