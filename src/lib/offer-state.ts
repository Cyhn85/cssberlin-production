import prisma from '@/lib/db';
import { createSystemNotification } from '@/lib/notifications';
import { offerPolicy, ms } from '@/config/marketplace-policy';

/**
 * Negotiation rules (src/config/offer-policy in marketplace-policy.ts):
 *  - an offer must be answered within answerHours, otherwise it EXPIRES
 *  - opening offer + counters together max maxRounds
 *  - accepting reserves the item for the buyer for paymentHours at the agreed
 *    price; nobody else can buy it in that window, afterwards it is free again
 *  - nothing is ever sent on anybody's behalf: advice is shown, never acted on
 */

export const FINALIZED_ORDER_STATUSES = ['PENDING_PICKUP', 'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'] as const;

export type OfferTurn = 'BUYER' | 'SELLER' | null;

/**
 * Whose move it is. New offers carry createdById (who named the price); older
 * rows fall back to the first chat message, which is what the code used before.
 */
export function offerTurn(offer: {
  status: string;
  sellerId: string;
  createdById?: string | null;
  messages?: Array<{ senderId: string }>;
}): { pendingOn: OfferTurn; originRole: 'BUYER_OFFER' | 'SELLER_COUNTER' } {
  const namedBySeller = offer.createdById
    ? offer.createdById === offer.sellerId
    : offer.messages?.[0]?.senderId === offer.sellerId;
  const originRole = namedBySeller ? 'SELLER_COUNTER' : 'BUYER_OFFER';
  const pendingOn: OfferTurn = offer.status !== 'PENDING' ? null : namedBySeller ? 'BUYER' : 'SELLER';
  return { pendingOn, originRole };
}

export function answerDeadline(from = new Date()) {
  return new Date(from.getTime() + offerPolicy.answerHours * ms.HOUR);
}

export function paymentDeadline(from = new Date()) {
  return new Date(from.getTime() + offerPolicy.paymentHours * ms.HOUR);
}

/** Lowest acceptable price: platform floor or the seller's own (higher) rule. */
export function minimumOffer(listPrice: number, sellerMinPercent?: number | null) {
  const pct = Math.max(offerPolicy.minPercent, Math.min(95, sellerMinPercent ?? 0));
  return { pct, amount: Math.ceil(listPrice * pct) / 100, sellerRule: (sellerMinPercent ?? 0) > offerPolicy.minPercent };
}

const round05 = (n: number) => Math.round(n * 2) / 2;

/**
 * Seller advice for an incoming price (shown on the offer card - never sent automatically).
 *
 * Signals, all from our own data: how far below list the offer is, how long the
 * item has been listed, interest (favourites, views), and what similar items in
 * the same category actually sold for. The output is a suggestion with reasons
 * the seller can read, not a black box.
 */
export async function offerAdvice(params: { productId: string; offeredPrice: number }) {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: { price: true, createdAt: true, views: true, categoryId: true, brand: true, _count: { select: { favorites: true, offers: true } } },
  });
  if (!product) return null;

  const ratio = params.offeredPrice / product.price;
  const ageDays = (Date.now() - product.createdAt.getTime()) / ms.DAY;
  const favs = product._count.favorites;

  const sold = await prisma.order.findMany({
    where: { status: 'COMPLETED', product: { categoryId: product.categoryId, ...(product.brand ? { brand: product.brand } : {}) } },
    select: { itemPrice: true },
    orderBy: { completedAt: 'desc' },
    take: 40,
  });
  const prices = sold.map((o) => o.itemPrice).sort((a, b) => a - b);
  const median = prices.length >= 3 ? prices[Math.floor(prices.length / 2)] : null;

  const reasons: string[] = [];
  let score = 0; // >0 leans accept, <0 leans counter/decline
  if (ratio >= 0.9) { score += 2; reasons.push(`Nur ${Math.round((1 - ratio) * 100)} % unter deinem Preis.`); }
  else if (ratio >= 0.8) { score += 1; reasons.push(`${Math.round((1 - ratio) * 100)} % unter deinem Preis - üblicher Verhandlungsspielraum.`); }
  else { score -= 1; reasons.push(`${Math.round((1 - ratio) * 100)} % unter deinem Preis - deutlich unter Listenpreis.`); }

  if (ageDays > 30) { score += 1; reasons.push(`Seit ${Math.round(ageDays)} Tagen online - längere Standzeit spricht für Entgegenkommen.`); }
  else if (ageDays < 3) { score -= 1; reasons.push('Erst seit wenigen Tagen online - du kannst noch auf den vollen Preis warten.'); }

  if (favs >= 5) { score -= 1; reasons.push(`${favs} Personen haben den Artikel gemerkt - es gibt Nachfrage.`); }
  else if (favs === 0 && product.views > 30) { score += 1; reasons.push('Viele Aufrufe, aber niemand hat ihn gemerkt.'); }

  if (median != null) {
    if (params.offeredPrice >= median) { score += 1; reasons.push(`Ähnliche Artikel wurden für ca. ${median.toFixed(2)} € verkauft - das Angebot liegt darüber.`); }
    else { score -= 1; reasons.push(`Ähnliche Artikel wurden für ca. ${median.toFixed(2)} € verkauft.`); }
  }

  const counterPrice = Math.min(product.price - 0.5, round05((params.offeredPrice + product.price) / 2));
  const recommendation: 'accept' | 'counter' | 'decline' =
    score >= 2 ? 'accept' : ratio < offerPolicy.minPercent / 100 + 0.05 && score < 0 ? 'decline' : 'counter';

  return {
    recommendation,
    counterPrice: recommendation === 'counter' && counterPrice > params.offeredPrice ? counterPrice : null,
    reasons,
    soldMedian: median,
  };
}

/**
 * Buyer-side hint: a rough chance an offer gets accepted. Uses only public
 * signals (discount depth, listing age, interest) - never the seller's rule or
 * private data. Returned as a band, not a promise.
 */
export function acceptanceChance(listPrice: number, offeredPrice: number, ageDays: number, favourites: number) {
  const discount = 1 - offeredPrice / listPrice;
  let p = 0.85 - discount * 1.6; // 10 % off ~ 0.69, 20 % ~ 0.53, 40 % ~ 0.21
  if (ageDays > 30) p += 0.1;
  if (ageDays < 3) p -= 0.1;
  if (favourites >= 5) p -= 0.1;
  p = Math.max(0.05, Math.min(0.95, p));
  return { probability: Math.round(p * 100) / 100, band: p >= 0.6 ? 'hoch' : p >= 0.35 ? 'mittel' : 'niedrig' } as const;
}

/** Hourly: expire unanswered offers and unpaid accepted ones (and free the item). */
export async function runOfferTimers(now = new Date()) {
  const stats = { pendingExpired: 0, acceptedExpired: 0, errors: 0 };

  const pending = await prisma.offer.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    select: { id: true, buyerId: true, sellerId: true, createdById: true, offeredPrice: true, product: { select: { title: true } } },
  });
  for (const o of pending) {
    try {
      const { count } = await prisma.offer.updateMany({ where: { id: o.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      if (!count) continue;
      stats.pendingExpired++;
      const namedBySeller = o.createdById === o.sellerId;
      const waiting = namedBySeller ? o.sellerId : o.buyerId; // the one who made the price waited
      const silent = namedBySeller ? o.buyerId : o.sellerId;
      await createSystemNotification({
        senderId: silent, receiverId: waiting, offerId: o.id, category: 'offers',
        content: `Dein Preisvorschlag über ${o.offeredPrice.toFixed(2)} € für ${o.product.title} ist abgelaufen (keine Antwort innerhalb von ${offerPolicy.answerHours} Stunden).`,
      });
    } catch (e) { stats.errors++; console.error('offer expiry failed', o.id, e); }
  }

  const accepted = await prisma.offer.findMany({
    where: { status: 'ACCEPTED', expiresAt: { lt: now }, orders: { none: { status: { in: [...FINALIZED_ORDER_STATUSES] } } } },
    select: { id: true, buyerId: true, sellerId: true, productId: true, offeredPrice: true, product: { select: { title: true } } },
  });
  for (const o of accepted) {
    try {
      const { count } = await prisma.offer.updateMany({ where: { id: o.id, status: 'ACCEPTED' }, data: { status: 'EXPIRED' } });
      if (!count) continue;
      stats.acceptedExpired++;
      await prisma.product.updateMany({
        where: { id: o.productId, status: 'RESERVED', reservedById: o.buyerId, orders: { none: { status: { in: [...FINALIZED_ORDER_STATUSES] } } } },
        data: { status: 'ACTIVE', reservedUntil: null, reservedById: null },
      });
      await createSystemNotification({
        senderId: o.sellerId, receiverId: o.buyerId, offerId: o.id, category: 'offers',
        content: `Dein angenommenes Angebot für ${o.product.title} ist abgelaufen, weil der Kauf nicht innerhalb von ${offerPolicy.paymentHours} Stunden abgeschlossen wurde.`,
      });
      await createSystemNotification({
        senderId: o.buyerId, receiverId: o.sellerId, offerId: o.id, category: 'offers',
        content: `Der Käufer hat ${o.product.title} nicht innerhalb von ${offerPolicy.paymentHours} Stunden gekauft. Der Artikel ist wieder für alle verfügbar.`,
      });
    } catch (e) { stats.errors++; console.error('accepted offer expiry failed', o.id, e); }
  }

  return stats;
}
