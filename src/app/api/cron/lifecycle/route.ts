import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runOrderTimers } from '@/lib/order-state';
import { runOfferTimers } from '@/lib/offer-state';
import { releaseExpiredReservations } from '@/lib/reservations';
import { runSavedSearchAlerts } from '@/lib/saved-search-alerts';

export const runtime = 'nodejs';

function authorized(request: Request): boolean | null {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return null;
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const token = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(expected);
  return token.length === want.length && timingSafeEqual(token, want);
}

/**
 * GET /api/cron/lifecycle - hourly: order deadlines and reminders, offer expiry,
 * stale reservations, saved-search alerts (daily, gated inside).
 * Called by ops/cron-cleanup.sh with ENDPOINT=.../api/cron/lifecycle.
 */
export async function GET(request: Request) {
  const ok = authorized(request);
  if (ok === null) return NextResponse.json({ error: 'Cron is not configured.' }, { status: 503 });
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const started = Date.now();
  const releasedReservations = await releaseExpiredReservations();
  const offers = await runOfferTimers();
  const orders = await runOrderTimers();
  const savedSearches = await runSavedSearchAlerts();
  return NextResponse.json({ ok: true, ms: Date.now() - started, releasedReservations, offers, orders, savedSearches });
}
