import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { Prisma } from '@/generated/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { publishOrderLifecycleEvent, type OrderCommunicationRecord } from '@/lib/order-events';
import { ORDER_INCLUDE } from '@/lib/order-state';
import { normalizeCarrier, carrierLabel } from '@/config/shipping-policy';
import { checkoutPolicy, pickupPolicy, ms } from '@/config/marketplace-policy';
import { getPaymentMethod } from '@/lib/payments/methods';
import { quoteCheckout } from '@/lib/payments/pricing';
import { rateLimit } from '@/lib/rate-limit';

/** Orders that own the item: a new checkout for it must fail. */
const BLOCKING_ORDER_STATUSES = ['PENDING_PICKUP', 'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED'] as const;
const FINALIZED_ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

const addressSchema = z.object({
  name: z.string().trim().min(3, 'Bitte gib Vor- und Nachnamen an.').max(80),
  street: z.string().trim().min(3, 'Bitte gib Straße und Hausnummer an.').max(120),
  extra: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'Bitte gib eine gültige deutsche Postleitzahl an.'),
  city: z.string().trim().min(2, 'Bitte gib den Ort an.').max(80),
  country: z.literal('DE').default('DE'),
});

const bodySchema = z.object({
  productId: z.string().min(1),
  offerId: z.string().min(1).nullish(),
  carrier: z.string().optional(),
  /** legacy field name used by older clients */
  shippingMethod: z.string().optional(),
  paymentMethod: z.string().optional(),
  shippingAddress: addressSchema.optional(),
});

/**
 * Claims the item for this buyer, atomically.
 *
 * The guard lives in the WHERE clause on purpose. Reading the row first and
 * updating it afterwards is not a lock: under Postgres' default READ COMMITTED
 * both requests can read ACTIVE before either writes. A conditional UPDATE is
 * settled by the database - exactly one of the two gets count === 1.
 *
 * Three shapes may be claimed: a free item, a reservation that has run out,
 * and this buyer's own reservation (returning to your own checkout, or paying
 * an accepted offer that locked the item for you).
 */
async function claimProduct(tx: Prisma.TransactionClient, productId: string, buyerId: string, until: Date | null) {
  const now = new Date();

  const blockingOrder = await tx.order.findFirst({
    where: { productId, status: { in: [...BLOCKING_ORDER_STATUSES] } },
    select: { id: true },
  });
  if (blockingOrder) throw new Error('ORDER_EXISTS');

  const claimed = await tx.product.updateMany({
    where: {
      id: productId,
      OR: [
        { status: 'ACTIVE' },
        { status: 'RESERVED', reservedUntil: { lte: now } },
        { status: 'RESERVED', reservedById: buyerId },
      ],
    },
    data: { status: 'RESERVED', reservedUntil: until, reservedById: buyerId },
  });

  if (claimed.count === 0) throw new Error('PRODUCT_UNAVAILABLE');
}

/**
 * Gives the item back when the payment page could not be created. Scoped to
 * our own claim so a slow failure here cannot free someone else's reservation.
 */
async function releaseClaim(productId: string, buyerId: string) {
  try {
    await prisma.product.updateMany({
      where: { id: productId, status: 'RESERVED', reservedById: buyerId },
      data: { status: 'ACTIVE', reservedUntil: null, reservedById: null },
    });
  } catch (error) {
    console.error('Failed to release checkout reservation:', error);
  }
}

/**
 * POST /api/checkout/create-session
 *
 *  - pickup_cash  -> Order PENDING_PICKUP, item held for pickupPolicy.holdHours, no money moves online
 *  - card/klarna/sepa_debit -> Stripe Checkout (only when Stripe is configured; otherwise 503, nothing created)
 *  - paypal       -> 503 until the PayPal adapter exists
 *
 * The old "no Stripe key -> create a PAID order" shortcut is gone: on the live
 * site it let anyone take any item for free.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const buyerId = session.user.id;

    const rl = await rateLimit(`checkout:${buyerId}`, 'API');
    if (!rl.success) return ApiResponse.error('Zu viele Versuche. Bitte warte einen Moment.', 429);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Ungültige Checkout-Daten.');
    }
    const { productId, offerId, shippingAddress } = parsed.data;

    const carrier = normalizeCarrier(parsed.data.carrier ?? parsed.data.shippingMethod ?? '');
    if (!carrier) return ApiResponse.validationError('Bitte wähle eine Versandart oder Abholung.');
    const isPickup = carrier === 'PICKUP';

    const method = getPaymentMethod(parsed.data.paymentMethod ?? (isPickup ? 'pickup_cash' : 'card'));
    if (!method) return ApiResponse.validationError('Unbekannte Zahlungsart.');
    if (isPickup !== (method.id === 'pickup_cash')) {
      return ApiResponse.validationError(
        isPickup ? 'Bei Abholung wird bar bei der Übergabe bezahlt.' : 'Abholung & Barzahlung geht nur zusammen mit Selbstabholung.',
      );
    }
    if (!method.enabled) {
      return ApiResponse.error(
        `${method.label} ist derzeit noch nicht verfügbar. Die Online-Zahlung wird gerade eingerichtet - du kannst den Artikel per Abholung & Barzahlung kaufen.`,
        503,
      );
    }
    if (!isPickup && !shippingAddress) {
      return ApiResponse.validationError('Bitte gib deine Lieferadresse an.');
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      // reservedById is omitted globally (public JSON must not say who is buying what); needed here internally
      omit: { reservedById: false },
      include: {
        seller: { select: { id: true, name: true, isSuspended: true } },
        images: { take: 1, orderBy: { orderIndex: 'asc' }, select: { id: true, url: true } },
      },
    });

    const reservedForMe = product?.status === 'RESERVED' && product.reservedById === buyerId;
    if (!product || (product.status !== 'ACTIVE' && !reservedForMe)) {
      return ApiResponse.error('Dieses Produkt ist nicht mehr verfügbar.', 409);
    }
    if (product.sellerId === buyerId) {
      return ApiResponse.error('Du kannst dein eigenes Produkt nicht kaufen.');
    }
    if (product.seller.isSuspended) {
      return ApiResponse.error('Dieser Verkäufer ist derzeit gesperrt. Der Artikel kann nicht gekauft werden.', 409);
    }

    // Accepted offer: must be THIS product, THIS buyer, accepted and not expired.
    // Before, only buyer + ACCEPTED were checked - an accepted 10 € offer could be
    // used to buy any other item for 10 €.
    let itemPrice = product.price;
    let usedOfferId: string | null = null;
    if (offerId) {
      const offer = await prisma.offer.findUnique({ where: { id: offerId } });
      const valid = offer
        && offer.productId === product.id
        && offer.buyerId === buyerId
        && offer.status === 'ACCEPTED'
        && (!offer.expiresAt || offer.expiresAt.getTime() > Date.now());
      if (!offer || !valid) {
        return ApiResponse.error('Dieses Angebot gilt nicht (mehr) für diesen Artikel.', 400);
      }
      itemPrice = offer.offeredPrice;
      usedOfferId = offer.id;
    }

    const priorFinalizedOrderCount = await prisma.order.count({
      where: { buyerId, status: { in: [...FINALIZED_ORDER_STATUSES] } },
    });
    const quote = quoteCheckout({
      itemPrice,
      productShippingCost: product.shippingCost,
      isFirstOrder: priorFinalizedOrderCount === 0,
      carrier,
    });

    // ───── Abholung & Barzahlung ─────
    if (isPickup) {
      const deadline = new Date(Date.now() + pickupPolicy.holdHours * ms.HOUR);
      try {
        const order = await prisma.$transaction(async (tx) => {
          // The order owns the hold; reservedUntil stays null so the catalogue
          // sweep never hands a pending pickup back. The lifecycle cron cancels
          // it at pickupDeadline instead.
          await claimProduct(tx, product.id, buyerId, null);
          return tx.order.create({
            data: {
              productId: product.id,
              buyerId,
              sellerId: product.sellerId,
              offerId: usedOfferId,
              itemPrice: quote.itemPrice,
              shippingFee: 0,
              protectionFee: 0,
              totalAmount: quote.totalAmount,
              status: 'PENDING_PICKUP',
              paymentMethod: 'pickup_cash',
              shippingCarrier: 'PICKUP',
              pickupDeadline: deadline,
            },
            include: ORDER_INCLUDE,
          });
        });

        await publishOrderLifecycleEvent({
          eventType: 'ORDER_PICKUP_REQUESTED',
          order: order as unknown as OrderCommunicationRecord,
          actorId: buyerId,
        });

        return ApiResponse.success({ mode: 'pickup', orderId: order.id, pickupDeadline: deadline.toISOString() });
      } catch (createError: any) {
        if (createError.message === 'PRODUCT_UNAVAILABLE' || createError.message === 'ORDER_EXISTS') {
          return ApiResponse.error('Dieser Artikel wird gerade von jemand anderem gekauft.', 409);
        }
        throw createError;
      }
    }

    // ───── Online-Zahlung über Stripe ─────
    const reservedUntil = new Date(Date.now() + checkoutPolicy.reservationMinutes * 60 * 1000);
    await prisma.$transaction((tx) => claimProduct(tx, product.id, buyerId, reservedUntil));

    const metadata = {
      productId: product.id,
      buyerId,
      sellerId: product.sellerId,
      offerId: usedOfferId || '',
      itemPrice: String(quote.itemPrice),
      shippingFee: String(quote.shippingFee),
      protectionFee: String(quote.protectionFee),
      shippingMethod: carrier,
      paymentMethod: method.id,
      shippingAddress: JSON.stringify(shippingAddress).slice(0, 480),
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let checkoutSession;
    try {
      const stripe = (await import('stripe')).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY as string);
      checkoutSession = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: [method.id as 'card' | 'klarna' | 'sepa_debit'],
        client_reference_id: `${product.id}:${buyerId}`,
        customer_email: session.user.email || undefined,
        payment_intent_data: { metadata },
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: product.title,
                images: product.images[0]?.url?.startsWith('http') ? [product.images[0].url] : [],
                description: `Verkäufer: ${product.seller.name || 'cssberlin'}`,
              },
              unit_amount: Math.round(quote.itemPrice * 100),
            },
            quantity: 1,
          },
          ...(quote.shippingFee > 0
            ? [{
                price_data: { currency: 'eur', product_data: { name: `Versand (${carrierLabel(carrier)})` }, unit_amount: Math.round(quote.shippingFee * 100) },
                quantity: 1,
              }]
            : []),
          {
            price_data: { currency: 'eur', product_data: { name: 'Käuferschutz' }, unit_amount: Math.round(quote.protectionFee * 100) },
            quantity: 1,
          },
        ],
        metadata,
        // Payment page and claim die at the same moment.
        expires_at: Math.floor(reservedUntil.getTime() / 1000),
        success_url: `${appUrl}/checkout/${product.id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/checkout/${product.id}${usedOfferId ? `?offerId=${encodeURIComponent(usedOfferId)}` : ''}`,
      });
    } catch (stripeError) {
      await releaseClaim(product.id, buyerId);
      throw stripeError;
    }

    return ApiResponse.success({
      mode: 'stripe',
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      reservedUntil: reservedUntil.toISOString(),
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    if (error.message === 'PRODUCT_UNAVAILABLE' || error.message === 'ORDER_EXISTS') {
      return ApiResponse.error('Dieser Artikel wird gerade von jemand anderem gekauft.', 409);
    }
    console.error('POST /api/checkout/create-session error:', error);
    return ApiResponse.serverError();
  }
}
