# Hetzner + Cloudflare Deployment Guide

This guide turns the current repository into a production deployment for `cssberlin.de` on a Hetzner Ubuntu server behind Cloudflare.

## Target layout

- Hetzner Cloud server runs Docker Engine and Docker Compose
- `docker-compose.cloudflare.yml` runs `postgres`, one-shot `db-setup`, `app`, and `nginx`
- Cloudflare proxies `cssberlin.de` and `www.cssberlin.de`
- Nginx serves the Cloudflare Origin CA certificate
- Nginx trusts the official Cloudflare edge CIDRs from `nginx/cloudflare-realip.conf`
- Cloudflare SSL/TLS mode is `Full (strict)`

## 1. Cloudflare setup

### DNS

Create or update these proxied DNS records in Cloudflare:

- `A` `cssberlin.de` -> Hetzner IPv4
- `A` `www` -> Hetzner IPv4
- optional: add matching proxied `AAAA` records if you want IPv6 enabled end-to-end

### SSL/TLS

In Cloudflare:

1. Open `SSL/TLS`.
2. Set encryption mode to `Full (strict)`.
3. Create an Origin CA certificate for:
   - `cssberlin.de`
   - `*.cssberlin.de`
4. Save the certificate and private key locally.

Important:

- Origin CA certificates are only trusted by Cloudflare, not by browsers.
- If you pause Cloudflare proxying later, direct browser access to the origin certificate will look untrusted.

## 2. Hetzner firewall

Use a Hetzner Cloud Firewall instead of relying on local UFW rules.

Recommended inbound rules:

- `22/tcp` from your admin IP only
- `80/tcp` from `0.0.0.0/0` and `::/0`
- `443/tcp` from `0.0.0.0/0` and `::/0`

Recommended outbound rules:

- leave default allow

Reason:

- Hetzner Cloud Firewalls are free and apply before traffic reaches the VM
- Docker documents caveats around UFW and iptables handling on Ubuntu

## 3. Server bootstrap

On the Hetzner server, run:

```bash
sudo bash ops/bootstrap-hetzner-ubuntu.sh
```

Optional:

```bash
sudo DEPLOY_USER=<your-linux-user> PROJECT_DIR=/opt/cssberlin bash ops/bootstrap-hetzner-ubuntu.sh
```

This script:

- installs Docker from Docker's official Ubuntu repository
- enables the Docker service
- prepares `/opt/cssberlin`, `/opt/cssberlin/backups`, and `/opt/cssberlin/nginx/ssl`

## 4. Copy project files to the server

Recommended target:

```bash
/opt/cssberlin
```

The server should contain at least:

- repository files
- `.env.production`
- `docker-compose.cloudflare.yml`
- `nginx/nginx.cloudflare-origin.conf`
- `nginx/cloudflare-realip.conf`

## 5. Production environment file

Create `.env.production` from `.env.production.example` and set at least:

- `POSTGRES_PASSWORD`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL=https://cssberlin.de`
- `NEXT_PUBLIC_APP_URL=https://cssberlin.de`
- `RUN_DB_SEED=1` for first deployment, then switch to `RUN_DB_SEED=0` after the baseline categories exist

If you already know the launch services you want to use, also fill in:

- strict preflight mode now assumes a real launch and hard-fails if Stripe, Pusher, or Resend are missing
- for the current live order flow, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUSHER_*`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `RESEND_API_KEY`, and `EMAIL_FROM` are treated as launch-critical by default
- use `STRICT_LAUNCH_MODE=0 bash ops/preflight-production.sh` only for an intentionally partial rollout

- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY` plus `STRIPE_WEBHOOK_SECRET`
- `UPLOADTHING_TOKEN`
- `PUSHER_*` plus `NEXT_PUBLIC_PUSHER_KEY` and `NEXT_PUBLIC_PUSHER_CLUSTER`
- configure the Stripe webhook endpoint to `https://cssberlin.de/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `payment_intent.payment_failed`
- `SENTRY_DSN`

## 6. Install the Cloudflare Origin CA files

Copy the certificate and key onto the server, then run:

```bash
bash ops/install-origin-certificate.sh /path/to/origin-cert.pem /path/to/origin-key.key
```

The files will be installed as:

- `nginx/ssl/cloudflare-origin.pem`
- `nginx/ssl/cloudflare-origin.key`

Before running the scripts on Linux, make them executable:

```bash
chmod +x ops/*.sh
```

Refresh the trusted Cloudflare proxy ranges before the first start and whenever you want to update them:

```bash
bash ops/update-cloudflare-realip.sh
```

## Prisma schema bootstrap note

Prisma's production guidance recommends `prisma migrate deploy` for production environments. This repo currently has no committed `prisma/migrations` history, so the first deployment uses an interim fallback:

- if committed migration files exist, `db-setup` runs `npx prisma migrate deploy`
- if no committed migration files exist yet, `db-setup` runs `npx prisma db push --skip-generate`
- the presence of `prisma/migrations/.gitkeep` does not trigger the migration path; only real `migration.sql` files do
- seeding is controlled with `RUN_DB_SEED`

This fallback is an inference based on Prisma's docs: `migrate deploy` is the right long-term production path, while `db push` is only a temporary bootstrap path until versioned migrations are added.

## 7. Preflight checks

Run before every real deployment:

```bash
bash ops/preflight-production.sh
```

This verifies:

- Docker is installed
- `curl` is installed
- the required env file exists
- the required certificate files exist and are non-empty
- the required env variables are not empty or placeholder values
- required UploadThing v7 token exists for seller image uploads
- `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` are HTTPS, match each other, and point to the expected canonical production URL in strict launch mode
- strict launch mode requires live Stripe, Pusher, and Resend coverage for the real buyer/seller flow unless explicitly relaxed
- Pusher browser/server keys and clusters are internally consistent
- the Compose file resolves cleanly

## 8. Start production

Run:

```bash
bash ops/deploy-production.sh
```

This will:

- run the preflight checks
- start `postgres` first
- run the one-shot `db-setup` service to apply schema and optionally seed data
- start `app` and `nginx`
- print container status
- wait for `/api/health`
- wait for `/api/health?ready=1`
- fail loudly with recent container logs if local health does not come up

After deployment, run:

```bash
bash ops/verify-production.sh
```

## 9. Verify deployment

Check locally on the server:

```bash
curl -I http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/api/health?ready=1
curl -I https://cssberlin.de
curl -I https://www.cssberlin.de
```

Expected behavior:

- `/api/health` returns `200`
- `/api/health?ready=1` returns `200` only when app + database are ready
- `https://cssberlin.de` returns `200`
- `https://www.cssberlin.de` redirects to `https://cssberlin.de`

## 10. Backups

Nightly database backup command:

```bash
bash ops/backup-postgres.sh
```

Current backup format:

- `pg_dump -Fc -Z 9`
- output file extension: `.dump`
- older `.sql.gz` backups can still be restored by the restore helper

Suggested cron entry:

```cron
15 3 * * * /opt/cssberlin/ops/backup-postgres.sh >> /var/log/cssberlin-backup.log 2>&1
```

## 11. Restore procedure

Restore command:

```bash
bash ops/restore-postgres.sh /opt/cssberlin/backups/<backup-file>.dump --force
```

Behavior:

- refuses to run without `--force`
- resets the `public` schema before restore
- supports both `.dump` and older `.sql.gz` backups
- runs a final `SELECT 1` check after restore

Warning:

- restore is destructive for the target database schema
- keep a fresh backup before restoring over live data

## 12. Diagnostics

Collect a snapshot with health checks, container status, logs, and disk usage:

```bash
bash ops/collect-diagnostics.sh
```

The report is written into `logs/production-diagnostics-<timestamp>.txt`.