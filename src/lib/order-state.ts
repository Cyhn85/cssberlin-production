import prisma from '@/lib/db';
import { Prisma } from '@/generated/prisma';
import { publishOrderLifecycleEvent, type OrderCommunicationRecord } from '@/lib/order-events';
import { createSystemNotification } from '@/lib/notifications';
import { refundBuyer } from '@/lib/escrow';
import { stripeConfigured } from '@/lib/payments/methods';
import {
  cancellationPolicy,
  completionPolicy,
  ms,
  pickupPolicy,
  shippingDeadlines,
} from '@/config/marketplace-policy';
import type { OrderLifecycleEventType } from '@/lib/realtime';

/**
 * Order state machine - the ONLY place that changes Order.status.
 *
 * Every transition is a conditional UPDATE (WHERE status IN allowed-from), so two
 * racing requests (buyer confirms while the cron auto-completes, seller ships
 * while the buyer cancels) can never both win. Side effects - product status,
 * other offers, notifications, e-mails, refunds - run after the transition
 * committed, never for a write that did not happen.
 *
 *   PENDING_PICKUP --handover--> COMPLETED            (Abholung, paid in cash)
 *   PENDING_PICKUP --cancel/lapse--> CANCELLED
 *   PAID --ship--> SHIPPED --deliver--> DELIVERED
 *   PAID --cancel (buyer <60 min / seller / request accepted / 5-day lapse)--> CANCELLED (+ refund)
 *   SHIPPED|DELIVERED --confirm / auto--> COMPLETED
 *   SHIPPED|DELIVERED --problem--> DISPUTED --admin--> REFUNDED | COMPLETED
 */

export const ORDER_INCLUDE = {
  product: { select: { id: true, title: true, ecoCO2Saved: true } },
  buyer: { select: { id: true, name: true, email: true } },
  seller: { select: { id: true, name: true, email: true } },
} as const;

export type OrderWithParties = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

export class OrderTransitionError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = 'OrderTransitionError';
  }
}

/** Bits for Order.remindersSent */
export const REMINDER = {
  SHIP_1: 1,
  SHIP_2: 2,
  PICKUP_1: 4,
  REVIEW_BUYER: 8,
  REVIEW_SELLER: 16,
  CANCEL_REQUEST_LAPSED: 32,
} as const;

const OPEN_FOR_SALE_ORDER_STATUSES = ['PENDING_PICKUP', 'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'] as const;

function toRecord(order: OrderWithParties): OrderCommunicationRecord {
  return order as unknown as OrderCommunicationRecord;
}

async function transition(params: {
  orderId: string;
  from: readonly string[];
  data: Prisma.OrderUpdateManyMutationInput;
}): Promise<OrderWithParties> {
  const { count } = await prisma.order.updateMany({
    where: { id: params.orderId, status: { in: params.from as any } },
    data: params.data,
  });
  if (count === 0) {
    throw new OrderTransitionError('Der Bestellstatus hat sich inzwischen geändert. Bitte lade die Seite neu.');
  }
  return prisma.order.findUniqueOrThrow({ where: { id: params.orderId }, include: ORDER_INCLUDE });
}

async function emit(eventType: OrderLifecycleEventType, order: OrderWithParties, actorId: string, extra?: { wasAlreadyShipped?: boolean }) {
  await publishOrderLifecycleEvent({ eventType, order: toRecord(order), actorId, ...extra });
}

/**
 * The item is spoken for (paid or pickup agreed): every other open offer on it
 * is over. Their buyers hear "verkauft" instead of waiting 48 h for nothing.
 */
export async function closeCompetingOffers(productId: string, keepOfferId: string | null, sellerId: string) {
  const open = await prisma.offer.findMany({
    where: { productId, status: { in: ['PENDING', 'ACCEPTED'] }, ...(keepOfferId ? { id: { not: keepOfferId } } : {}) },
    select: { id: true, buyerId: true, product: { select: { title: true } } },
  });
  if (open.length === 0) return 0;
  await prisma.offer.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { status: 'EXPIRED' } });
  for (const o of open) {
    await createSystemNotification({
      senderId: sellerId,
      receiverId: o.buyerId,
      offerId: o.id,
      category: 'offers',
      content: `${o.product.title} wurde an jemand anderen verkauft. Dein Preisvorschlag ist damit beendet.`,
    }).catch((e) => console.error('closeCompetingOffers notify failed', e));
  }
  return open.length;
}

async function notifyFavoritersSold(productId: string, sellerId: string, buyerId: string) {
  const favs = await prisma.favorite.findMany({
    where: { productId, userId: { notIn: [buyerId, sellerId] } },
    select: { userId: true, product: { select: { title: true } } },
  });
  for (const f of favs) {
    await createSystemNotification({
      senderId: sellerId,
      receiverId: f.userId,
      category: 'favorites',
      content: `Ein Artikel auf deiner Merkliste wurde verkauft: ${f.product.title}. Ähnliche Artikel findest du im Katalog.`,
    }).catch((e) => console.error('notifyFavoritersSold failed', e));
  }
}

/** Puts the item back on sale after a cancellation/refund - unless another live order owns it. */
async function relistProduct(productId: string, exceptOrderId: string) {
  const other = await prisma.order.findFirst({
    where: { productId, id: { not: exceptOrderId }, status: { in: [...OPEN_FOR_SALE_ORDER_STATUSES] } },
    select: { id: true },
  });
  if (other) return;
  await prisma.product.updateMany({
    where: { id: productId, status: { in: ['RESERVED', 'SOLD'] } },
    data: { status: 'ACTIVE', reservedUntil: null, reservedById: null },
  });
}

/**
 * Money back for an online payment. Without Stripe there is nothing to refund
 * (pickup orders are paid in cash, and no online order can exist while Stripe
 * is off). A failed refund is surfaced to the admin, never silently "done".
 */
async function refundIfPaidOnline(order: OrderWithParties): Promise<'refunded' | 'not_applicable' | 'failed'> {
  if (order.paymentMethod === 'pickup_cash' || !order.paymentIntentId) return 'not_applicable';
  if (!stripeConfigured()) return 'failed';
  const res = await refundBuyer(order.paymentIntentId);
  if (!res.success) {
    console.error('Refund failed - needs manual action', { orderId: order.id, error: res.error });
    return 'failed';
  }
  return 'refunded';
}

// ─────────────────────────── transitions ───────────────────────────

export async function markShipped(orderId: string, sellerId: string, carrier: string, trackingCode: string | null) {
  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) throw new OrderTransitionError('Bestellung nicht gefunden.', 404);
  if (current.sellerId !== sellerId) throw new OrderTransitionError('Nur der Verkäufer kann den Versand melden.', 403);
  if (current.paymentMethod === 'pickup_cash' || current.shippingCarrier === 'PICKUP') {
    throw new OrderTransitionError('Diese Bestellung wird abgeholt, nicht versendet.');
  }
  const wasAlreadyShipped = current.status === 'SHIPPED';
  const order = await transition({
    orderId,
    from: ['PAID', 'SHIPPED'],
    data: {
      status: 'SHIPPED',
      shippingCarrier: carrier,
      trackingCode,
      ...(wasAlreadyShipped ? {} : { shippedAt: new Date() }),
      // shipping answers an open cancellation request with "no"
      cancelRequestedAt: null,
      cancelRequestReason: null,
    },
  });
  await emit('ORDER_SHIPPED', order, sellerId, { wasAlreadyShipped });
  return order;
}

export async function completeOrder(orderId: string, actor: { id: string; role: 'BUYER' | 'SELLER' | 'SYSTEM' | 'ADMIN' }) {
  const current = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!current) throw new OrderTransitionError('Bestellung nicht gefunden.', 404);

  let from: string[];
  if (actor.role === 'BUYER') {
    if (current.buyerId !== actor.id) throw new OrderTransitionError('Nur der Käufer kann den Empfang bestätigen.', 403);
    from = ['SHIPPED', 'DELIVERED'];
  } else if (actor.role === 'SELLER') {
    // Abholung: the seller confirms "handed over & paid in cash"
    if (current.sellerId !== actor.id) throw new OrderTransitionError('Nur der Verkäufer kann die Übergabe bestätigen.', 403);
    from = ['PENDING_PICKUP'];
  } else if (actor.role === 'ADMIN') {
    from = ['DISPUTED'];
  } else {
    from = ['SHIPPED', 'DELIVERED'];
  }

  const now = new Date();
  const order = await transition({ orderId, from, data: { status: 'COMPLETED', completedAt: now, pickupDeadline: null } });

  await prisma.$transaction([
    prisma.product.update({ where: { id: order.productId }, data: { status: 'SOLD', reservedUntil: null, reservedById: null } }),
    prisma.user.update({
      where: { id: order.buyerId },
      data: { ecoCO2Saved: { increment: order.product.ecoCO2Saved }, itemsRecycled: { increment: 1 } },
    }),
  ]);

  await closeCompetingOffers(order.productId, order.offerId, order.sellerId);
  await notifyFavoritersSold(order.productId, order.sellerId, order.buyerId);

  const eventType: OrderLifecycleEventType =
    actor.role === 'SYSTEM' ? 'ORDER_AUTO_COMPLETED' : actor.role === 'SELLER' ? 'ORDER_PICKUP_COMPLETED' : 'ORDER_COMPLETED';
  await emit(eventType, order, actor.role === 'SYSTEM' ? order.sellerId : actor.id);
  return order;
}

export async function openDispute(orderId: string, buyerId: string, reason: string) {
  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) throw new OrderTransitionError('Bestellung nicht gefunden.', 404);
  if (current.buyerId !== buyerId) throw new OrderTransitionError('Nur der Käufer kann ein Problem melden.', 403);
  if (current.paymentMethod === 'pickup_cash') {
    throw new OrderTransitionError('Bei Abholung mit Barzahlung gilt kein Käuferschutz. Prüfe den Artikel bei der Übergabe.');
  }
  const order = await transition({ orderId, from: ['SHIPPED', 'DELIVERED'], data: { status: 'DISPUTED', disputeReason: reason } });
  await emit('ORDER_DISPUTED', order, buyerId);
  return order;
}

export async function resolveDispute(orderId: string, adminId: string, outcome: 'REFUNDED' | 'COMPLETED', note: string) {
  if (outcome === 'COMPLETED') {
    await prisma.order.update({ where: { id: orderId }, data: { disputeResolution: 'COMPLETED', disputeResolutionNote: note, disputeResolvedAt: new Date() } });
    const order = await completeOrder(orderId, { id: adminId, role: 'ADMIN' });
    await emit('ORDER_DISPUTE_RESOLVED', order, adminId);
    return order;
  }
  const order = await transition({
    orderId,
    from: ['DISPUTED'],
    data: { status: 'REFUNDED', disputeResolution: 'REFUNDED', disputeResolutionNote: note, disputeResolvedAt: new Date() },
  });
  const refund = await refundIfPaidOnline(order);
  if (refund === 'failed') console.error('Dispute refund needs manual transfer', { orderId });
  // The buyer returns the item; it goes back on sale once the seller has it.
  await relistProduct(order.productId, order.id);
  await emit('ORDER_DISPUTE_RESOLVED', order, adminId);
  return order;
}

/**
 * Cancellation. Who may cancel what (src/config/marketplace-policy.ts):
 *  - buyer: instantly within buyerFreeCancelMinutes after payment, not shipped;
 *           Abholung: any time before the handover
 *  - seller: any time before shipping / handover, with a reason
 *  - system: shipping deadline or pickup deadline passed
 */
export async function cancelOrder(
  orderId: string,
  actor: { id: string | null; role: 'BUYER' | 'SELLER' | 'SYSTEM' | 'ADMIN' },
  reason: string,
) {
  const current = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!current) throw new OrderTransitionError('Bestellung nicht gefunden.', 404);

  if (actor.role === 'BUYER') {
    if (current.buyerId !== actor.id) throw new OrderTransitionError('Keine Berechtigung.', 403);
    if (current.status === 'PAID') {
      const since = Date.now() - (current.paidAt ?? current.createdAt).getTime();
      if (since > cancellationPolicy.buyerFreeCancelMinutes * 60 * 1000) {
        throw new OrderTransitionError('Die Sofort-Stornierung ist nur in der ersten Stunde nach dem Kauf möglich. Du kannst den Verkäufer um eine Stornierung bitten.');
      }
    } else if (current.status !== 'PENDING_PICKUP') {
      throw new OrderTransitionError('Nach dem Versand ist keine Stornierung mehr möglich. Nutze "Problem melden", falls etwas nicht stimmt.');
    }
  } else if (actor.role === 'SELLER') {
    if (current.sellerId !== actor.id) throw new OrderTransitionError('Keine Berechtigung.', 403);
  }

  const order = await transition({
    orderId,
    from: ['PAID', 'PENDING_PICKUP'],
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: actor.role,
      cancelReason: reason.slice(0, 300),
      cancelRequestedAt: null,
      pickupDeadline: null,
    },
  });

  const refund = await refundIfPaidOnline(order);
  const final = refund === 'refunded'
    ? await prisma.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' }, include: ORDER_INCLUDE })
    : order;
  if (refund === 'failed') console.error('Cancellation refund needs manual transfer', { orderId });

  await relistProduct(order.productId, order.id);
  await emit('ORDER_CANCELLED', final, actor.id ?? order.sellerId);
  return final;
}

/** Buyer asks the seller to cancel (after the free window, before shipping). */
export async function requestCancellation(orderId: string, buyerId: string, reason: string) {
  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) throw new OrderTransitionError('Bestellung nicht gefunden.', 404);
  if (current.buyerId !== buyerId) throw new OrderTransitionError('Keine Berechtigung.', 403);
  if (current.cancelRequestedAt) throw new OrderTransitionError('Du hast bereits eine Stornierung angefragt.');
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: 'PAID', cancelRequestedAt: null },
    data: { cancelRequestedAt: new Date(), cancelRequestReason: reason.slice(0, 300) },
  });
  if (count === 0) throw new OrderTransitionError('Eine Stornierungsanfrage ist nur vor dem Versand möglich.');
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
  await emit('ORDER_CANCEL_REQUESTED', order, buyerId);
  return order;
}

export async function answerCancellation(orderId: string, sellerId: string, accept: boolean) {
  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) throw new OrderTransitionError('Bestellung nicht gefunden.', 404);
  if (current.sellerId !== sellerId) throw new OrderTransitionError('Keine Berechtigung.', 403);
  if (!current.cancelRequestedAt) throw new OrderTransitionError('Es liegt keine Stornierungsanfrage vor.');
  if (accept) {
    return cancelOrder(orderId, { id: sellerId, role: 'SELLER' }, `buyer_asked: ${current.cancelRequestReason ?? ''}`.trim());
  }
  await prisma.order.update({ where: { id: orderId }, data: { cancelRequestedAt: null } });
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
  await emit('ORDER_CANCEL_DECLINED', order, sellerId);
  return order;
}

// ─────────────────────────── timers (cron) ───────────────────────────

/**
 * Hourly sweep: reminders, lapses, auto-completion, review prompts.
 * Idempotent - reminder bits in remindersSent and the conditional transitions
 * make a double run harmless.
 */
export async function runOrderTimers(now = new Date()) {
  const stats = { shipReminders: 0, autoCancelled: 0, pickupLapsed: 0, pickupReminders: 0, autoCompleted: 0, reviewPrompts: 0, cancelRequestsLapsed: 0, errors: 0 };
  const t = now.getTime();

  const paid = await prisma.order.findMany({ where: { status: 'PAID' }, include: ORDER_INCLUDE });
  for (const o of paid) {
    try {
      const age = t - (o.paidAt ?? o.createdAt).getTime();
      if (age >= shippingDeadlines.autoCancelAfterDays * ms.DAY) {
        await cancelOrder(o.id, { id: null, role: 'SYSTEM' }, 'not_shipped_in_time');
        stats.autoCancelled++;
        continue;
      }
      const [h1, h2] = shippingDeadlines.remindAfterHours;
      const bit = age >= h2 * ms.HOUR ? REMINDER.SHIP_2 : age >= h1 * ms.HOUR ? REMINDER.SHIP_1 : 0;
      if (bit && !(o.remindersSent & bit)) {
        await prisma.order.update({ where: { id: o.id }, data: { remindersSent: { set: o.remindersSent | bit | (bit === REMINDER.SHIP_2 ? REMINDER.SHIP_1 : 0) } } });
        await emit('ORDER_SHIP_REMINDER', o, o.buyerId);
        stats.shipReminders++;
      }
      if (o.cancelRequestedAt && t - o.cancelRequestedAt.getTime() >= cancellationPolicy.requestAnswerHours * ms.HOUR
          && !(o.remindersSent & REMINDER.CANCEL_REQUEST_LAPSED)) {
        // no answer: the request is noted for support, the order continues (eBay behaviour)
        await prisma.order.update({ where: { id: o.id }, data: { cancelRequestedAt: null, remindersSent: { set: o.remindersSent | REMINDER.CANCEL_REQUEST_LAPSED } } });
        await emit('ORDER_CANCEL_DECLINED', o, o.sellerId);
        stats.cancelRequestsLapsed++;
      }
    } catch (e) { stats.errors++; console.error('order timer (paid) failed', o.id, e); }
  }

  const pickups = await prisma.order.findMany({ where: { status: 'PENDING_PICKUP' }, include: ORDER_INCLUDE });
  for (const o of pickups) {
    try {
      const deadline = (o.pickupDeadline ?? new Date(o.createdAt.getTime() + pickupPolicy.holdHours * ms.HOUR)).getTime();
      if (t >= deadline) {
        await cancelOrder(o.id, { id: null, role: 'SYSTEM' }, 'pickup_not_completed');
        stats.pickupLapsed++;
      } else if (deadline - t <= 12 * ms.HOUR && !(o.remindersSent & REMINDER.PICKUP_1)) {
        await prisma.order.update({ where: { id: o.id }, data: { remindersSent: { set: o.remindersSent | REMINDER.PICKUP_1 } } });
        await emit('ORDER_PICKUP_REMINDER', o, o.sellerId);
        stats.pickupReminders++;
      }
    } catch (e) { stats.errors++; console.error('order timer (pickup) failed', o.id, e); }
  }

  const inTransit = await prisma.order.findMany({ where: { status: { in: ['SHIPPED', 'DELIVERED'] } }, select: { id: true, status: true, shippedAt: true, deliveredAt: true, updatedAt: true } });
  for (const o of inTransit) {
    try {
      const due = o.deliveredAt
        ? o.deliveredAt.getTime() + completionPolicy.autoCompleteAfterDeliveredDays * ms.DAY
        : (o.shippedAt ?? o.updatedAt).getTime() + completionPolicy.autoCompleteAfterShippedDays * ms.DAY;
      if (t >= due) {
        await completeOrder(o.id, { id: 'system', role: 'SYSTEM' });
        stats.autoCompleted++;
      }
    } catch (e) {
      if (!(e instanceof OrderTransitionError)) { stats.errors++; console.error('order timer (auto-complete) failed', o.id, e); }
    }
  }

  // Review prompts: once per side, 1 h after completion, only if not reviewed yet
  const completed = await prisma.order.findMany({
    where: { status: 'COMPLETED', completedAt: { lte: new Date(t - ms.HOUR), gte: new Date(t - completionPolicy.reviewWindowDays * ms.DAY) } },
    include: { ...ORDER_INCLUDE, reviews: { select: { authorId: true } } },
  });
  for (const o of completed) {
    try {
      const authors = new Set(o.reviews.map((r) => r.authorId));
      let bits = o.remindersSent;
      if (!authors.has(o.buyerId) && !(bits & REMINDER.REVIEW_BUYER)) {
        bits |= REMINDER.REVIEW_BUYER;
        await createSystemNotification({
          senderId: o.sellerId, receiverId: o.buyerId,
          content: `Wie war dein Kauf von ${o.product.title}? Bewerte ${o.seller.name || 'den Verkäufer'} - das hilft der ganzen Community.`,
          email: { subject: `Bewerte deinen Kauf: ${o.product.title}`, title: 'Wie war dein Kauf?', ctaLabel: 'Jetzt bewerten', ctaPath: `/purchases/${o.id}` },
        });
        stats.reviewPrompts++;
      }
      if (!authors.has(o.sellerId) && !(bits & REMINDER.REVIEW_SELLER)) {
        bits |= REMINDER.REVIEW_SELLER;
        await createSystemNotification({
          senderId: o.buyerId, receiverId: o.sellerId,
          content: `Verkauf abgeschlossen: ${o.product.title}. Bewerte ${o.buyer.name || 'den Käufer'}.`,
        });
        stats.reviewPrompts++;
      }
      if (bits !== o.remindersSent) await prisma.order.update({ where: { id: o.id }, data: { remindersSent: bits } });
    } catch (e) { stats.errors++; console.error('order timer (review) failed', o.id, e); }
  }

  return stats;
}
