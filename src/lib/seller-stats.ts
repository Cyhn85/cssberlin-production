import prisma from '@/lib/db';
import { publicLocationLabel } from '@/lib/geocode';
import { cancellationPolicy } from '@/config/marketplace-policy';

const SELLER_FAULT_REASONS = new Set<string>(
  cancellationPolicy.sellerReasons.filter((r) => r.countsAgainstSeller).map((r) => r.id),
);

/**
 * Trust signals shown on the seller box and profile (Kleinanzeigen/Vinted style):
 * typical reply time, last active, completed sales, and the share of sales the
 * seller cancelled for reasons on their side. Computed from our own rows only.
 */
export async function sellerTrust(userId: string) {
  const [recent, completedSales, sellerOrders, user] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [{ receiverId: userId }, { senderId: userId }],
        type: { in: ['TEXT', 'IMAGE', 'OFFER_ACTION'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { senderId: true, receiverId: true, createdAt: true },
    }),
    prisma.order.count({ where: { sellerId: userId, status: 'COMPLETED' } }),
    prisma.order.findMany({
      where: { sellerId: userId, status: { in: ['COMPLETED', 'CANCELLED', 'REFUNDED', 'SHIPPED', 'DELIVERED'] } },
      select: { status: true, cancelledBy: true, cancelReason: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true } }),
  ]);

  // reply time: for each incoming message, the seller's next message to that person
  const chronological = [...recent].reverse();
  const waiting = new Map<string, Date>();
  const delays: number[] = [];
  for (const m of chronological) {
    if (m.receiverId === userId) {
      if (!waiting.has(m.senderId)) waiting.set(m.senderId, m.createdAt);
    } else if (m.senderId === userId) {
      const since = waiting.get(m.receiverId);
      if (since) {
        delays.push(m.createdAt.getTime() - since.getTime());
        waiting.delete(m.receiverId);
      }
    }
  }
  delays.sort((a, b) => a - b);
  const medianMs = delays.length >= 3 ? delays[Math.floor(delays.length / 2)] : null;

  const sellerCancels = sellerOrders.filter(
    (o) => (o.status === 'CANCELLED' || o.status === 'REFUNDED') && (o.cancelledBy === 'SELLER' || o.cancelledBy === 'SYSTEM')
      && (!o.cancelReason || SELLER_FAULT_REASONS.has(o.cancelReason.split(':')[0]) || o.cancelReason.startsWith('not_shipped')),
  ).length;

  return {
    replyTime: medianMs == null ? null : medianMs < 60 * 60 * 1000 ? 'innerhalb einer Stunde' : medianMs < 6 * 3600 * 1000 ? 'innerhalb weniger Stunden' : medianMs < 24 * 3600 * 1000 ? 'innerhalb eines Tages' : 'in mehr als einem Tag',
    lastSeenAt: user?.lastSeenAt ?? null,
    completedSales,
    cancelRate: sellerOrders.length >= 5 ? Math.round((sellerCancels / sellerOrders.length) * 100) : null,
  };
}

/**
 * Public location payload. Coordinates are rounded to 0.01° (~1 km) so the map
 * circle shows the area, never the doorstep - same idea as Kleinanzeigen.
 */
export function publicLocation(u: { postalCode?: string | null; city?: string | null; location?: string | null; lat?: number | null; lng?: number | null }) {
  const label = publicLocationLabel(u);
  return {
    label,
    postalCode: u.postalCode ?? null,
    city: u.city ?? null,
    lat: typeof u.lat === 'number' ? Math.round(u.lat * 100) / 100 : null,
    lng: typeof u.lng === 'number' ? Math.round(u.lng * 100) / 100 : null,
  };
}
