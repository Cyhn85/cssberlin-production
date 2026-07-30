# Launch Todo

## Already done

- Production build passes locally.
- Offer workspace and two-way negotiation are implemented.
- Accepted offers reach checkout with the negotiated price.
- Inbox shows offer state, availability and order context.
- Notifications listen to realtime events.
- Header activity badges for unread messages and notifications are in place.
- Buyer and seller order detail pages include timelines and counterpart actions.
- Order lifecycle notifications, realtime events and optional transactional emails are centralized.
- Public catalog APIs degrade safely instead of failing hard during temporary database startup issues.
- Hetzner / Cloudflare / Nginx / Docker Compose deployment documents exist.
- Production preflight now enforces the launch contract for Stripe, UploadThing, Pusher, Resend, HTTPS URLs, and local health readiness by default.

## Before launch

- Create the real `.env.production` with live secrets.
- Generate and install the Cloudflare Origin CA certificate on the Hetzner server.
- Configure Cloudflare DNS, proxying and `Full (strict)`.
- Prepare the Hetzner server bootstrap, Docker runtime and project sync.

## Launch-day commands

- `bash ops/update-cloudflare-realip.sh`
- `bash ops/preflight-production.sh`
- `bash ops/deploy-production.sh`
- `bash ops/verify-production.sh`
- Connect the live Stripe webhook to `https://cssberlin.de/api/webhooks/stripe`

## Production validation after deploy

- Test register, login, logout and session handling on the real domain.
- Test homepage, catalog, search, filters, categories and product detail on the real domain.
- Test seller upload with real image upload.
- Test full offer flow from buyer offer through seller counter or accept.
- Verify accepted-offer checkout price in Stripe.
- Verify full order lifecycle: paid, shipped, completed and disputed.
- Verify inbox, notifications, purchases and sales realtime behavior.
- Verify transactional emails for payment, shipping, completion and dispute.
- Verify sold / reserved / unavailable visibility across offers, inbox, notifications and order views.

## After first stable launch

- Turn off one-time seed behavior with `RUN_DB_SEED=0`.
- Enable nightly backups.
- Tighten Hetzner firewall rules.
- Capture the first production diagnostics snapshot.
- Add Sentry and basic uptime monitoring.
- Move toward Prisma migration history instead of relying on `db push` fallback.

## Definition of done

The first production launch is truly done when the real domain is live behind HTTPS, payments work, negotiation works, availability stays truthful, order communication works in realtime, legal pages show the real business and backups/basic monitoring are active.