import prisma from '@/lib/db';

// PENDING_PICKUP and DISPUTED also own the item - never hand those back to the catalogue.
const FINALIZED_ORDER_STATUSES = ['PENDING_PICKUP', 'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'] as const;

/**
 * How often one server process will actually run the sweep, no matter how
 * often it is called.
 *
 * The sweep is cheap and idempotent, so several app instances running it at
 * once is harmless - this throttle exists only to keep a write off every single
 * catalogue request.
 */
const SWEEP_INTERVAL_MS = 60 * 1000;

let lastSweep = 0;

/**
 * Returns items whose checkout reservation ran out to the catalogue.
 *
 * Why not leave this to the nightly cron: reservations last 30 minutes, the
 * cleanup job runs once a night. An abandoned checkout at 09:00 would keep a
 * sellable item hidden until the small hours - the catalogue filters on
 * status ACTIVE, so RESERVED means invisible. Sweeping from the read path
 * bounds that to a minute without requiring anyone to configure a second cron.
 *
 * The `orders: none` guard is the important part. A paid item is also RESERVED
 * (the webhook parks it there), and reviving one of those would put something
 * that is already sold back on sale. Checkout clears reservedUntil when an
 * order is created, so a paid row should not match anyway - this guard means
 * it still cannot, even if that clearing is ever missed.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const { count } = await prisma.product.updateMany({
    where: {
      status: 'RESERVED',
      reservedUntil: { lt: new Date() },
      orders: { none: { status: { in: [...FINALIZED_ORDER_STATUSES] } } },
    },
    data: { status: 'ACTIVE', reservedUntil: null, reservedById: null },
  });

  if (count > 0) {
    console.info(`[reservations] released ${count} expired checkout reservation(s)`);
  }

  return count;
}

/**
 * Fire-and-forget variant for read paths. Never rejects and never blocks the
 * response: a failed sweep must not turn a catalogue page into an error.
 */
export function sweepExpiredReservations(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  void releaseExpiredReservations().catch((error) => {
    console.error('[reservations] sweep failed:', error);
  });
}
