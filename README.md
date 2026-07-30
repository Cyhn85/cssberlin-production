# cssberlin.de

Berlin-based second-hand marketplace with real offers, order status visibility and a launch target based on Hetzner + Cloudflare + Nginx + Docker Compose + Next.js standalone.

## Start here

- `OPERATIONS_AND_HANDOFF.md`: single handoff source and latest verified operational status
- `docs/REPO_CONTROL_CENTER.md`: where to find product logic, legal/business facts, rollout status and site trust rules
- `docs/SITE_LOGIC_AND_TRUST.md`: critical user flows, negotiation logic and trust design
- `docs/BUSINESS_PROFILE_PUBLIC.md`: public-safe business facts and where they appear on the site
- `docs/PRODUCTION_ENV_MATRIX.md`: exact launch-ready `.env.production` fill order and provider/source mapping
- `docs/PROVIDER_SETUP_STEPS.md`: click-by-click provider onboarding order for Stripe, UploadThing, Resend, and Pusher
- `docs/LAUNCH_TODO.md`: done, remaining and launch-day checklist
- `docs/private/BUSINESS_CONFIDENTIAL.md`: local-only tax/admin notes, intentionally gitignored
- `docs/private/PROVIDER_CREDENTIAL_STATUS.md`: local-only provider readiness status
- `docs/private/PROVIDER_COLLECTION_WORKSHEET.md`: local-only step-by-step provider collection sheet
- `implementations.md`: historical implementation log

## Product snapshot

- offers are first-class and support two-way negotiation
- accepted offers flow into checkout with the negotiated price
- inbox, notifications, purchases and sales show availability and order context
- order lifecycle events now fan out to realtime updates, notifications and optional emails
- public catalog APIs degrade safely during temporary database unavailability
- AI is still in beta/helper mode and should not be presented as a fully autonomous commerce operator yet

## Deployment model

- Hetzner Ubuntu VPS
- Cloudflare proxy with Full (strict)
- Nginx reverse proxy with Cloudflare Origin CA
- Docker Compose runtime
- Next.js standalone build output

## Working rule

When updating business/legal/contact data, change `src/config/business-profile.ts` first and then update the linked docs if policy or tax treatment changes. Never place a German `Steuernummer` on public pages.