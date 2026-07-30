# cssberlin.de Live Rollout Checklist

## 1. DNS and Cloudflare

- keep the domain at IONOS
- point nameservers to Cloudflare
- create proxied `A` record for `cssberlin.de` to the Hetzner IPv4
- create proxied `A` record for `www` to the same Hetzner IPv4
- set SSL/TLS mode to `Full (strict)`
- keep Cloudflare proxy enabled during launch

## 2. Hetzner firewall

Allow inbound:

- `22/tcp` from your admin IP only
- `80/tcp` from anywhere
- `443/tcp` from anywhere

Do not expose:

- `5432/tcp`

## 3. Project files on server

Target directory:

```bash
/opt/cssberlin
```

Must exist on server:

- repository contents
- `.env.production`
- `docker-compose.cloudflare.yml`
- `nginx/nginx.cloudflare-origin.conf`
- `nginx/cloudflare-realip.conf`
- `nginx/ssl/cloudflare-origin.pem`
- `nginx/ssl/cloudflare-origin.key`

## 4. Required env values

Fill at least:

- `POSTGRES_PASSWORD`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL=https://cssberlin.de`
- `NEXT_PUBLIC_APP_URL=https://cssberlin.de`
- `RUN_DB_SEED=1` for the first deploy only

When enabling services, fill the full set:

- strict preflight mode now treats Stripe + Pusher + Email as launch-critical by default
- use `STRICT_LAUNCH_MODE=0 bash ops/preflight-production.sh` only if you are deliberately doing a partial rollout and accept degraded buyer/seller communication

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- UploadThing: `UPLOADTHING_TOKEN`
- Email: `RESEND_API_KEY`, `EMAIL_FROM`
- Pusher: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## 5. Secret generation

On Linux:

```bash
bash ops/generate-production-secrets.sh
```

On Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\generate-production-secrets.ps1
```

Use the generated values in `.env.production`.

## 6. Server command sequence

Bootstrap the server:

```bash
sudo bash ops/bootstrap-hetzner-ubuntu.sh
```

Refresh Cloudflare trusted IPs:

```bash
bash ops/update-cloudflare-realip.sh
```

Run preflight:

```bash
bash ops/preflight-production.sh
```

If you intentionally need a partial rollout:

```bash
STRICT_LAUNCH_MODE=0 bash ops/preflight-production.sh
```

Deploy:

```bash
bash ops/deploy-production.sh
```

Verify:

```bash
bash ops/verify-production.sh
```

## 7. First launch checks

Expected results:

- `https://cssberlin.de` loads with valid HTTPS
- `https://www.cssberlin.de` redirects once to `https://cssberlin.de`
- `/api/health` returns `200`
- `/api/health?ready=1` returns `200`
- preflight fails if launch-critical payment or communication env values are missing
- homepage, catalog, login, register load without `500`
- protected pages redirect to login when signed out
- favicon, Apple icon, manifest, and social image no longer 404

## 8. Immediate post-launch

- switch `RUN_DB_SEED=0` after baseline data is present
- configure Stripe webhook to `https://cssberlin.de/api/webhooks/stripe` if Stripe is active
- set up nightly backup cron with `ops/backup-postgres.sh`
- collect one diagnostic snapshot with `ops/collect-diagnostics.sh`

## 9. Launch owner notes

Current repo already includes:

- standalone Next.js runtime
- Cloudflare Origin CA Nginx config
- health checks
- seller sales flow
- hardened checkout and Stripe webhook path
- realtime inbox via Pusher auth and private user channels
- generated production icons and OG image assets