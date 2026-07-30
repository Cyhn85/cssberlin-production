# cssberlin.de Operations and Handoff

## Documentation map

- This file remains the single handoff source.
- `docs/REPO_CONTROL_CENTER.md` explains where product, business, trust, launch and history answers live.
- `docs/SITE_LOGIC_AND_TRUST.md` captures the marketplace logic that must stay real, especially offers, availability and order communication.
- `docs/BUSINESS_PROFILE_PUBLIC.md` stores public-safe company facts and legal placement rules.
- `docs/PRODUCTION_ENV_MATRIX.md` captures the exact launch-ready `.env.production` fill order and provider/source mapping.
- `docs/PROVIDER_SETUP_STEPS.md` walks through provider onboarding for Stripe, UploadThing, Resend, and Pusher.
- `docs/HETZNER_SAFE_AUDIT.md` records the read-only Hetzner inventory path and the safe local-only service addresses.
- `docs/LAUNCH_TODO.md` tracks what is done and what still blocks launch.
- `src/config/business-profile.ts` is the shared app-level source for public business/contact data.
- `docs/private/BUSINESS_CONFIDENTIAL.md` is local-only and must never be exposed publicly.
## Latest update

- added a read-only Hetzner audit script and a safe-audit note so the current server can be inventoried without touching unrelated workloads, while keeping `127.0.0.1:3000` as the intended local-only app address and `127.0.0.1:5432` as the intended local-only database address
- corrected the UploadThing production contract to the official v7 UPLOADTHING_TOKEN model and added a step-by-step provider setup guide plus local credential status notes
- documented the exact launch-ready `.env.production` contract in `docs/PRODUCTION_ENV_MATRIX.md` and removed the unused `APP_SESSION_SALT` output from secret generators
- hardened `ops/preflight-production.sh`, `ops/deploy-production.sh`, and `ops/verify-production.sh` so launch-critical Stripe, Pusher, Resend, HTTPS URL, and local health checks fail loudly by default
- aligned rollout docs and env examples with the stricter launch contract, while keeping `STRICT_LAUNCH_MODE=0` as an explicit partial-rollout escape hatch
- centralized public business/contact data in `src/config/business-profile.ts` and replaced placeholder legal/contact information with real operator details
- added repository control docs for site logic, business profile, launch todo, and local-only confidential tax records so work is easier to resume without repetition
- centralized order lifecycle communication across checkout, Stripe webhook, shipment updates, delivery confirmation, and disputes
- added realtime private order-channel updates for `/purchases/[id]` and `/sales/[id]`, so both sides see status changes without manual refresh
- connected optional Resend transactional emails for new paid orders, shipping updates, completed orders, and disputes
- public catalog APIs now degrade to safe `200` payloads with `degraded: true` when the database is temporarily unavailable instead of bubbling a `500`
- homepage and catalog now surface a truthful syncing state during degraded public API responses instead of pretending the catalog is empty
- added protected seller-facing `/sales` and `/sales/[id]` pages for shipment management
- `/api/orders/[id]` now only accepts safe seller shipping updates instead of arbitrary order status writes
- dashboard and notification routing now point seller order activity into the sales flow
- added secure Pusher auth plus inbox realtime message delivery on the private user channel
## Current handoff snapshot

- App integration work completed before this document:
  - homepage, catalog, product detail, profile, settings, inbox, dashboard, purchases, eco-impact pages wired into live APIs
  - product, user, eco-impact API routes extended
  - offer flow posts to backend
  - production build passes
- Verified locally in a production-like run:
  - `200`: `/`, `/catalog`, `/login`, `/register`, `/impressum`, `/datenschutz`
  - `307 -> /login`: `/upload`, `/settings`, `/dashboard`, `/purchases`, `/eco-impact`, `/inbox`
- Known production blockers discovered during probing:
  - `/api/products`, `/api/categories`, `/api/products/filters`, and `/api/search/autocomplete` now return degraded `200` payloads with `degraded: true` if the database is temporarily unavailable during startup; with a healthy database they still return full live data
  - `/profile` is now treated as the authenticated self-profile route, while `/profile/[id]` stays public
  - `/favorites` and `/notifications` pages are now present and backed by their existing APIs
  - footer navigation has been reduced to real, maintained routes
  - checkout now loads live product data, creates real checkout sessions, lands on a dedicated success route, and uses a hardened Stripe webhook finalization path
  - AI assistant is still simulated

## Recommended production architecture

### Baseline choice

Use:

- Hetzner Cloud server as the single VPS
- Docker Compose for app orchestration
- PostgreSQL on the same server for the first production phase
- Nginx as reverse proxy in front of the app
- Cloudflare as DNS, CDN, SSL edge, caching, and basic protection

Avoid for now:

- multiple hosts
- Kubernetes
- custom Node server logic
- parallel SSL strategies using both Cloudflare edge assumptions and server-side certbot complexity unless strictly needed

### Why this is the right fit now

- low monthly complexity
- fast enough for the current project size
- easy to recover during tool or context handoff
- sustainable under model limits because the architecture has few moving parts
- aligned with Next.js standalone Docker deployment

### SSL and domain model

Preferred setup:

1. IONOS keeps domain ownership.
2. Nameservers point to Cloudflare.
3. `A` records for `cssberlin.de` and `www` point to the Hetzner IPv4 and stay proxied through Cloudflare.
4. Cloudflare SSL mode is `Full (strict)`.
5. Nginx serves an origin certificate on port `443`.

Recommended simplification:

- if all traffic stays behind proxied Cloudflare DNS, prefer a Cloudflare Origin CA certificate on Nginx
- this removes day-to-day certbot renewal complexity from the baseline setup

Do not use:

- Cloudflare `Flexible`

Reason:

- login, session, and user data flows should stay encrypted between Cloudflare and origin too

### App runtime model

- keep `next.config.ts` with `output: 'standalone'`
- run the built standalone server in production instead of `next start`
- keep Nginx responsible for:
  - TLS termination at origin
  - reverse proxy to app
  - upload limits
  - backup rate limits for `/api`
  - long-lived proxy support

### Data and backups

Baseline:

- PostgreSQL container with persistent volume
- nightly database dump on the server
- manual restore procedure documented in repo

Upgrade path:

- enable Hetzner backups when budget allows
- later move Postgres off-box only if growth or reliability needs justify it

### Email model

Use the 2 IONOS mailboxes for:

- `info@cssberlin.de`
- `support@cssberlin.de` or `noreply@cssberlin.de`

Operational recommendation:

- keep mailbox identities at IONOS
- keep app transactional sending optional until the core flows are stable
- if application email is needed early, Resend free tier is cleaner than self-hosted SMTP delivery

## Infra decisions

### Final recommendation

- keep Docker Compose
- keep Nginx
- keep Cloudflare proxy on
- use Cloudflare Origin CA certificate with `Full (strict)`
- open only `80`, `443`, and `22` on the server
- if possible, restrict `22` to trusted admin IPs
- do not expose Postgres publicly
- do not depend on `next start` in production

### Current repo mismatches

- `next.config.ts` is set to standalone, and `package.json` has now been aligned to the standalone server entrypoint
- `docker-compose.yml` still assumes certbot-managed Let's Encrypt flow
- current Nginx config is good structurally, but it is built around local Let's Encrypt paths
- production public API stability still depends on complete auth/environment configuration

## P0 / P1 / P2 task packages

### P0

#### P0-01 Runtime hardening

Goal:

- make public pages and public APIs survive production startup with valid environment configuration

Work:

- verify `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`
- decouple public API routes from avoidable auth failures
- confirm `/api/products`, `/api/categories`, `/api/search/autocomplete` return `200`

Done when:

- home, catalog, and search work in production mode without `500`

#### P0-02 Deployment alignment

Goal:

- make repo deployment logic match actual standalone runtime

Work:

- replace `next start` production usage
- document build and run commands
- confirm Docker image, compose, and local production run all use the same runtime model

Done when:

- one production command path exists and is documented

#### P0-03 Domain and SSL stabilization

Goal:

- make `cssberlin.de` and `www.cssberlin.de` work cleanly through Cloudflare and Hetzner

Work:

- choose origin certificate strategy
- set Cloudflare SSL to `Full (strict)`
- make apex canonical and redirect `www`
- confirm no redirect loop and no `525` or `526`

Done when:

- both hostnames load successfully over HTTPS and redirect exactly once where intended

#### P0-04 Navigation integrity

Goal:

- remove trust-breaking dead links

Work:

- add or remove `/favorites`, `/notifications`, `/disputes`
- repair footer routes or reduce footer to real pages only

Done when:

- primary navigation contains no dead routes

#### P0-05 Auth boundary consistency

Goal:

- make open pages, protected pages, and API dependencies consistent

Work:

- decide whether `/profile` is protected or has a public-safe fallback
- align middleware with actual route availability

Done when:

- no page renders a broken state because auth assumptions differ across layers

#### P0-06 Database bootstrap safety

Goal:

- make the first production database bootstrap deterministic and repeatable

Work:

- use one-shot `db-setup` before app startup
- ignore placeholder files such as `prisma/migrations/.gitkeep` when detecting real migrations
- keep seed execution controllable with `RUN_DB_SEED`
- preserve the path to switch from `db push` to `migrate deploy` once real migrations are committed

Done when:

- first deployment can create schema safely and routine deploys can skip seed re-runs

### P1

#### P1-01 Checkout completion and post-payment UX

- extend post-payment feedback with seller notifications, webhook diagnostics, and eventual order detail views around the live checkout flow

#### P1-02 Favorites and notifications

- complete the missing user surfaces already linked from header and middleware

#### P1-03 Email flow

- define password reset, offer, message, and order emails

#### P1-04 AI assistant truthfulness

- either connect it to real backend logic or relabel it clearly as beta helper

### P2

#### P2-01 Consent and compliance polish

- improve cookie consent granularity and retention logic

#### P2-02 Monitoring and alerting

- add Sentry and basic uptime checks

#### P2-03 Content trust layer

- finish help, about, contact, buyer protection, and mission pages

#### P2-04 Performance and cache tuning

- refine Cloudflare cache rules, image strategy, and static asset handling

## Exact hosting model to use

### Server

- existing Hetzner Ubuntu server
- Docker engine plus compose plugin
- single compose project

### Containers

- `postgres`
- one-shot `db-setup`
- `app`
- `nginx`

### Not in baseline

- `certbot` if Origin CA is adopted

## Operational checklist

1. Fix production runtime mismatch and public API stability.
2. Choose Origin CA and update Nginx certificate paths.
3. Set Cloudflare DNS proxy and `Full (strict)`.
4. Clean dead navigation and auth mismatches.
5. Run first real deployment with `.env.production`.
6. Add server firewall and backup routine.

## Deployment helpers added to the repo

- `ops/bootstrap-hetzner-ubuntu.sh`: installs Docker Engine from the official Docker Ubuntu repository and prepares server directories
- `ops/preflight-production.sh`: validates required env values, certificates, and Compose resolution before deploy
- `ops/deploy-production.sh`: runs preflight, starts postgres, executes one-shot db bootstrap, then starts app and nginx
- `ops/run-db-setup.sh`: decides between `prisma migrate deploy` and temporary `prisma db push`, then optionally runs the seed script
- `ops/install-origin-certificate.sh`: copies the Cloudflare Origin CA cert and key into `nginx/ssl`
- `ops/update-cloudflare-realip.sh`: refreshes trusted Cloudflare proxy CIDRs from the official IP endpoints
- `ops/verify-production.sh`: curls local and public health and HTTPS endpoints after deployment
- `ops/collect-diagnostics.sh`: captures compose status, logs, health, and disk usage into a timestamped report
- `ops/restore-postgres.sh`: restores either new `.dump` backups or older `.sql.gz` backups with an explicit `--force`
- `DEPLOY_HETZNER_CLOUDFLARE.md`: exact server, DNS, SSL, and deploy runbook

## Operational helpers added to the repo

- `src/app/api/health/route.ts`: liveness and readiness endpoint
- `ops/backup-postgres.sh`: Linux backup script for compressed custom-format Postgres dumps
- `docker-compose.cloudflare.yml`: app healthcheck waits for `/api/health?ready=1`, and a one-shot `db-setup` service bootstraps schema plus optional seed data

## Recommended files added to the repo

- `docker-compose.cloudflare.yml`: recommended Hetzner + Cloudflare production compose file
- `nginx/nginx.cloudflare-origin.conf`: Nginx config for Cloudflare Origin CA certificates
- `nginx/cloudflare-realip.conf`: trusted Cloudflare proxy ranges for real visitor IP restoration
- `.env.production.example`: production environment template for compose deployments

## First deployment command path

1. Copy `.env.production.example` to `.env.production` and fill the secrets.
2. Put the Cloudflare Origin CA certificate and key into `nginx/ssl/cloudflare-origin.pem` and `nginx/ssl/cloudflare-origin.key`.
3. Run `bash ops/update-cloudflare-realip.sh`.
4. Run `bash ops/preflight-production.sh`.
5. Run `bash ops/deploy-production.sh`.
6. Run `bash ops/verify-production.sh`.
7. Change `RUN_DB_SEED` to `0` after the baseline category seed is in place.

## Local validation note

- the current local workspace uses a remote-like `DATABASE_URL`
- in sandboxed local smoke tests, DB-backed routes can fail because the database service itself is not reachable from this environment
- public catalog endpoints now degrade to empty `200` payloads with `degraded: true` in that situation so homepage and catalog do not present a hard server error
- the recommended production path avoids that by using the local `postgres` service from `docker-compose.cloudflare.yml`

## Sources used for architecture choice

- Next.js standalone output docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Next.js custom server guidance: https://nextjs.org/docs/app/guides/custom-server
- Cloudflare `Full (strict)` docs: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/
- Cloudflare `Flexible` docs: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/flexible/
- Cloudflare Origin CA docs: https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/
- Hetzner firewall overview: https://docs.hetzner.com/cloud/firewalls/overview

## Prisma deployment note

- Prisma's official production path is `prisma migrate deploy`
- this repo currently has no committed `prisma/migrations` history
- until that migration history is created, the one-shot `db-setup` service falls back to `prisma db push --skip-generate`
- `prisma/migrations/.gitkeep` is intentionally ignored by the migration detector
- routine deploys should run with `RUN_DB_SEED=0` unless a specific idempotent seed is intentionally required
## Launch packet

- LIVE_ROLLOUT_CHECKLIST.md: concise live deploy sequence for Hetzner + Cloudflare
- ops/generate-production-secrets.sh: Linux helper for production secrets
- ops/generate-production-secrets.ps1: Windows helper for production secrets

- UploadThing is now treated as a launch requirement in production preflight because seller uploads depend on it.

## Real interactive backlog captured from the latest handoff

- "Test", "demo", and "beta-only" behavior should be treated as temporary launch compromises, not the target product state.
- The site AI must evolve from guidance-only behavior into a real commerce assistant that understands and supports listing, bargaining, checkout, shipping, returns, and dispute flows.
- Buyer offer tracking is a core differentiator: users need a dedicated view of every product they offered on, the exact amount sent, the current seller response state, and whether they are still waiting for a reply.
- Offer state must stay aligned with product availability. If an offered item is sold, hidden, reserved elsewhere, or removed from sale, the buyer should see that clearly in both messaging and the offers workspace.
- Offer notifications should lead users toward a concrete offer management surface instead of leaving that state buried inside product pages or chat.
## Offer workspace update

- Added a protected `/offers` workspace for sent and received negotiations with product availability, pending-response visibility, and direct actions.
- `/api/offers` now returns richer card data including product status, latest order, and inferred negotiation origin (`BUYER_OFFER` vs `SELLER_COUNTER`).
- `/api/offers/[id]` now supports two-way negotiation flow: sellers can answer buyer offers, and buyers can now accept, reject, or counter seller counter-offers.
- `/checkout/[id]` now accepts `?offerId=` and uses the accepted negotiated price during checkout instead of always falling back to the list price.
- Offer-related notifications now point users toward `/offers`, and the seller dashboard now exposes an offers shortcut.
- Verified locally after build in a production-like run:
  - `/offers` -> `307 /login`
  - `/api/offers` -> `401`
  - `/notifications` -> `307 /login`
  - `/checkout/test-product?offerId=test-offer` -> `307 /login`
## Inbox offer-state sync update

- `/api/messages` and `/api/messages/[conversationId]` now include richer offer context: buyer/seller ids, product availability, and the latest order linked to the negotiation.
- The inbox now surfaces offer status directly inside the conversation list, the pinned offer header, and individual offer messages.
- Buyers can now see from chat if an accepted offer is ready for checkout, and both sides can see if the item has been sold, reserved, hidden, or already converted into an order.
- The pinned inbox offer card now links users into the right next action (`/checkout`, `/offers`, `/purchases/[id]`, or `/sales/[id]`) instead of forcing them to infer the state manually.
- Verified locally after build in a production-like run:
  - `/inbox` -> `307 /login`
  - `/api/messages` -> `401`






