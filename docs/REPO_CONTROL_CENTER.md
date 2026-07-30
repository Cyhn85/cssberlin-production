# Repo Control Center

This document is the durable map for the repository. `OPERATIONS_AND_HANDOFF.md` remains the single handoff source; this file tells you where answers live so work does not get repeated.

## What cssberlin.de is

- A Berlin-based second-hand marketplace with real listings, real offers and real post-order communication.
- The negotiation system is critical. Buyers must be able to track offers, counters, accepts, rejects and product availability without guessing.
- AI is currently beta/helper level. It may assist workflows later, but today it must not be presented as a fully autonomous commerce operator.

## Current verified product state

- Real `/offers` workspace exists.
- Offer APIs support two-way negotiation.
- Accepted offers carry the negotiated price into checkout via `offerId`.
- Inbox surfaces offer status, product availability and order context.
- Notifications page listens for realtime events.
- Header shows unread activity badges for messages and notifications.
- `purchases/[id]` and `sales/[id]` show timelines and counterpart actions.
- Order lifecycle communication is centralized across checkout, Stripe webhook, shipment updates, delivery confirmation and disputes.
- Public catalog APIs degrade safely when the database is temporarily unavailable.
- Production build has passed locally.

## Where to find answers

- Handoff / latest operational truth: `OPERATIONS_AND_HANDOFF.md`
- Launch sequence and rollout status: `docs/LAUNCH_TODO.md`
- Exact launch-ready `.env.production` fill order: `docs/PRODUCTION_ENV_MATRIX.md`
- Click-by-click provider setup: `docs/PROVIDER_SETUP_STEPS.md`
- Safe Hetzner inventory and local-address rule: `docs/HETZNER_SAFE_AUDIT.md`
- Site logic, trust model and critical flows: `docs/SITE_LOGIC_AND_TRUST.md`
- Public-safe company profile and legal placement map: `docs/BUSINESS_PROFILE_PUBLIC.md`
- Historical implementation log: `implementations.md`
- Shared public business constants used by the app: `src/config/business-profile.ts`
- Local-only sensitive tax/admin notes: `docs/private/BUSINESS_CONFIDENTIAL.md`
- Local-only provider credential status: `docs/private/PROVIDER_CREDENTIAL_STATUS.md`
- Local-only provider collection worksheet: `docs/private/PROVIDER_COLLECTION_WORKSHEET.md`

## Public vs private rule

- Public pages may show operator name, business address, phone, public email, website and USt-IdNr.
- Public pages must not show `Steuernummer` or any internal tax workflow notes.
- Sensitive tax or identity data belong in `docs/private/BUSINESS_CONFIDENTIAL.md`, which is gitignored on purpose.

## Update discipline

1. Update `src/config/business-profile.ts` first when public company/contact data changes.
2. Update `docs/BUSINESS_PROFILE_PUBLIC.md` if legal placement or trust copy changes.
3. Update `docs/PRODUCTION_ENV_MATRIX.md` if the real production env contract changes.
4. Update `docs/PROVIDER_SETUP_STEPS.md` if provider onboarding steps or provider expectations change.
5. Update `docs/HETZNER_SAFE_AUDIT.md` if the safe local-address rule or audit path changes.
6. Update `docs/LAUNCH_TODO.md` whenever a launch blocker is closed or a new blocker appears.
7. Update `OPERATIONS_AND_HANDOFF.md` after every meaningful infrastructure, production or workflow milestone.
8. Keep public legal text aligned with the actual product behavior. No placeholder names, addresses or fake support channels.
