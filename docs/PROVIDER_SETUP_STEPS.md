# Provider Setup Steps

This is the human walkthrough for collecting the launch-critical provider values for `cssberlin.de`.

Important:

- Do not commit real secrets into tracked repo files.
- Put real values only into `.env.production` on the server or into a local non-tracked working copy.
- For launch, test keys are not enough for Stripe.

## 1. Stripe

Current status on 11 March 2026:

- test publishable key received
- test secret key received
- test card `4242 4242 4242 4242` received
- live secret key still missing
- webhook signing secret still missing

What matters for launch in this repo:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

The current checkout flow does not need `STRIPE_PUBLISHABLE_KEY` to launch because checkout is created server-side and redirects to Stripe Checkout.

### Step-by-step

1. Log in to the Stripe dashboard.
2. Switch from test mode to live mode in the dashboard before copying launch credentials.
3. Open Developers -> API keys.
4. Copy the live Secret key into `STRIPE_SECRET_KEY`.
5. Open Developers -> Webhooks.
6. Create an endpoint for `https://cssberlin.de/api/webhooks/stripe`.
7. Subscribe at least to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
8. After saving the endpoint, copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
9. Run `ops/preflight-production.sh` again.

Launch note:

- If the key starts with `sk_test_`, strict preflight will fail on purpose.

## 2. UploadThing

What matters for launch in this repo:

- `UPLOADTHING_TOKEN`

### Step-by-step

1. Open the UploadThing dashboard.
2. Create your app if you do not already have one.
3. Open the API Keys section for the app.
4. Copy the v7 token.
5. Put that value into `UPLOADTHING_TOKEN`.
6. Save and rerun preflight.

Important note:

- The installed UploadThing runtime in this repo is v7 and expects `UPLOADTHING_TOKEN`.
- Older `UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID` assumptions are no longer the launch source of truth here.

## 3. Resend

What matters for launch in this repo:

- `RESEND_API_KEY`
- `EMAIL_FROM`

### Step-by-step

1. Create or log in to your Resend account.
2. Add and verify a sending domain.
   Recommended target: `cssberlin.de`.
3. In your DNS provider, add the DNS records Resend asks for.
   Because the domain is behind Cloudflare, add the records in Cloudflare DNS.
4. Wait until Resend shows the domain as verified.
5. Create an API key in Resend.
6. Put that key into `RESEND_API_KEY`.
7. Choose a verified sender, for example `noreply@cssberlin.de`, and put it into `EMAIL_FROM`.
8. Save and rerun preflight.

Launch note:

- `EMAIL_FROM` must be a sender address that Resend accepts for the verified domain.

## 4. Pusher

What matters for launch in this repo:

- `PUSHER_APP_ID`
- `PUSHER_KEY`
- `PUSHER_SECRET`
- `PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_KEY`
- `NEXT_PUBLIC_PUSHER_CLUSTER`

### Step-by-step

1. Create or log in to your Pusher account.
2. Create a Channels app.
3. In the app dashboard, open the app keys / credentials area.
   Inference: the exact menu wording may vary, but you are looking for the Channels app credentials screen.
4. Copy these values:
   - App ID -> `PUSHER_APP_ID`
   - Key -> `PUSHER_KEY`
   - Secret -> `PUSHER_SECRET`
   - Cluster -> `PUSHER_CLUSTER`
5. Mirror the public browser values:
   - `NEXT_PUBLIC_PUSHER_KEY` = same value as `PUSHER_KEY`
   - `NEXT_PUBLIC_PUSHER_CLUSTER` = same value as `PUSHER_CLUSTER`
6. Save and rerun preflight.

Launch note:

- Our preflight intentionally fails if the public key/cluster do not match the server-side ones.

## 5. Exact fill order for you

1. Finish UploadThing first.
2. Finish Resend second.
3. Finish Pusher third.
4. Replace Stripe test mode with live Stripe fourth.
5. Then run strict preflight.

## 6. Official references

- Stripe API keys: https://docs.stripe.com/keys
- Stripe webhooks: https://docs.stripe.com/webhooks
- UploadThing Next.js App Router setup: https://docs.uploadthing.com/getting-started/appdir
- UploadThing v7 migration / token model: https://docs.uploadthing.com/v7
- Resend domains: https://resend.com/docs/dashboard/domains/introduction
- Resend API keys: https://resend.com/docs/dashboard/api-keys/introduction
- Resend senders / from address: https://resend.com/docs/dashboard/senders/introduction
- Pusher Channels overview: https://pusher.com/channels
- Pusher signup: https://dashboard.pusher.com/accounts/sign_up