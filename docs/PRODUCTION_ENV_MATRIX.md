# Production Env Matrix

This document turns `.env.production` into a launch checklist for `cssberlin.de`.

Use this together with:

- `ops/preflight-production.sh`
- `.env.production.example`
- `docker-compose.cloudflare.yml`

## 1. Fill first: generated locally or fixed by the project

| Variable | Launch status | Where it comes from | Required value / format | Notes |
| --- | --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | Required | Generate locally | long random secret | Use `ops/generate-production-secrets.sh` or `.ps1`. |
| `NEXTAUTH_SECRET` | Required | Generate locally | long random secret | Must not stay placeholder. |
| `NEXTAUTH_URL` | Required | Manual fixed value | `https://cssberlin.de` | Strict preflight expects the canonical production URL. |
| `NEXT_PUBLIC_APP_URL` | Required | Manual fixed value | `https://cssberlin.de` | Must exactly match `NEXTAUTH_URL`. |
| `RUN_DB_SEED` | Required | Manual fixed value | `1` on first deploy, then `0` | Switch to `0` after baseline data exists. |

## 2. Launch-critical provider values

| Variable | Launch status | Source | Required value / format | Notes |
| --- | --- | --- | --- | --- |
| `UPLOADTHING_TOKEN` | Required | UploadThing dashboard, API Keys, v7 token | token string | UploadThing v7 merged app id, region, and key into one token. |
| `STRIPE_SECRET_KEY` | Required in strict launch mode | Stripe live dashboard | `sk_live_...` | `sk_test_...` fails strict preflight. |
| `STRIPE_WEBHOOK_SECRET` | Required in strict launch mode | Stripe webhook endpoint config | `whsec_...` | Create after wiring `https://cssberlin.de/api/webhooks/stripe`. |
| `RESEND_API_KEY` | Required in strict launch mode | Resend dashboard | live API key | Needed for transactional order emails. |
| `EMAIL_FROM` | Required in strict launch mode | Verified sender/domain in Resend | e.g. `noreply@cssberlin.de` | Must be a real verified sender address. |
| `PUSHER_APP_ID` | Required in strict launch mode | Pusher dashboard | app id | Needed for realtime order and inbox visibility. |
| `PUSHER_KEY` | Required in strict launch mode | Pusher dashboard | key | Browser key must mirror this. |
| `PUSHER_SECRET` | Required in strict launch mode | Pusher dashboard | secret | Server-side only. |
| `PUSHER_CLUSTER` | Required in strict launch mode | Pusher dashboard | e.g. `eu` | Browser cluster must match this. |
| `NEXT_PUBLIC_PUSHER_KEY` | Required in strict launch mode | mirror from `PUSHER_KEY` | same as `PUSHER_KEY` | Preflight checks equality. |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Required in strict launch mode | mirror from `PUSHER_CLUSTER` | same as `PUSHER_CLUSTER` | Preflight checks equality. |

## 3. Optional later

| Variable | Launch status | Source | Notes |
| --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash dashboard | Only useful if you want Redis-backed rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash dashboard | Must be paired with the URL. |
| `GROQ_API_KEY` | Optional | Groq dashboard | AI helper only; not launch-critical. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Google AI Studio | AI helper only; not launch-critical. |
| `SENTRY_DSN` | Optional but recommended after launch | Sentry project settings | Good for post-launch monitoring. |

## 4. Do not fill manually for the Docker Compose production path

These are injected by Compose/runtime and are not part of the human-filled `.env.production` checklist:

- `DATABASE_URL`
- `DIRECT_URL`
- `NODE_ENV`
- `PORT`

## 5. Values that currently do not need to be in `.env.production`

- `APP_SESSION_SALT` is not used by the current codebase and was removed from the secret generator output.
- `STRIPE_PUBLISHABLE_KEY` exists in `src/lib/env.ts`, but the current server-driven checkout flow does not require it for launch.
- `UPLOADTHING_SECRET` and `UPLOADTHING_APP_ID` were older-style assumptions; the installed UploadThing v7 runtime expects `UPLOADTHING_TOKEN`.

## 6. Recommended fill order

1. Generate `NEXTAUTH_SECRET` and `POSTGRES_PASSWORD` with `ops/generate-production-secrets.sh` or `ops/generate-production-secrets.ps1`.
2. Set `NEXTAUTH_URL=https://cssberlin.de` and `NEXT_PUBLIC_APP_URL=https://cssberlin.de`.
3. Set `RUN_DB_SEED=1` for the first production deploy.
4. Paste the UploadThing v7 token.
5. Paste live Stripe credentials and create the live webhook secret.
6. Paste Resend API key and a verified `EMAIL_FROM` sender.
7. Paste Pusher server values, then mirror `PUSHER_KEY` and `PUSHER_CLUSTER` into the `NEXT_PUBLIC_*` fields.
8. Leave Upstash, AI, and Sentry empty unless you are explicitly enabling them now.
9. Run `bash ops/preflight-production.sh` and do not deploy until strict mode passes.

## 7. Launch-ready definition for `.env.production`

`.env.production` is ready when all of the following are true:

- no placeholder values remain
- `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` are both `https://cssberlin.de`
- UploadThing is configured with the v7 token
- Stripe uses live credentials and the real webhook secret
- Resend and Pusher are fully configured
- `STRICT_LAUNCH_MODE=0` is not needed
- `ops/preflight-production.sh` passes without warnings that matter for launch