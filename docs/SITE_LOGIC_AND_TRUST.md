# Site Logic and Trust Map

## Core promise

cssberlin.de should feel like a real commerce platform, not a demo. Listings, offers, order state, availability and user communication must stay synchronized across the buyer and seller experience.

## Critical flows

### 1. Listing to negotiation

- Sellers create real listings with live availability.
- Buyers can send offers or buy directly.
- Offer negotiation is two-way: buyer offer, seller counter, buyer counter, accept or reject.
- Once a listing is sold or removed, that status must remain visible in offers, inbox and notifications so users do not chase dead inventory.

### 2. Negotiation to checkout

- Accepted offers must reach checkout with the negotiated price, not the original list price.
- Checkout needs order context so both parties understand which listing and which agreed amount created the order.

### 3. Order lifecycle

- Paid, shipped, completed and disputed states must be visible in both buyer and seller areas.
- `purchases/[id]` and `sales/[id]` are the detailed order workspaces.
- The platform should tell users what changed and what action is expected next.

### 4. Communication chain

- Inbox handles direct buyer/seller communication.
- Notifications handle activity summaries and cross-product awareness.
- Realtime events keep order and messaging state current without manual refresh.
- Optional emails are used for high-signal order events when configured in production.

## Trust layers

- Accurate availability: sold or removed products stay visibly unavailable.
- Transparent negotiation state: active, accepted, rejected and expired states are visible.
- Order timelines: both sides can audit what happened and when.
- Legal clarity: impressum, datenschutz, DAC7 and AGB must match the real business.
- Business trust: public address, phone, operator name and USt-IdNr live in the legal surface; sensitive tax numbers do not.

## AI boundary

- Today the AI is a helper layer only.
- It may support explanations, status guidance or future operational automation.
- It must not pretend to take legal, financial or logistics actions on behalf of the business without the surrounding real systems being implemented.

## Launch rule

If a feature looks interactive but is still mocked, either replace it with the real flow or label it honestly before launch. Hidden fakery damages trust faster than missing polish.
