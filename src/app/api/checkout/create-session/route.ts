import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@/generated/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { publishOrderLifecycleEvent } from '@/lib/order-events';
import { resolveShippingFee } from '@/config/shipping-policy';

const BUYER_PROTECTION_RATE = 0.05;
const BUYER_PROTECTION_FIXED = 0.99;
const FINALIZED_ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

/**
 * How long a checkout may hold an item.
 *
 * Stock is always 1 on a second-hand marketplace, so without a claim two
 * buyers who press "buy" in the same second both receive a Stripe session and
 * both can pay - we then owe one of them a refund for an item that never
 * existed twice. Claiming flips the row to RESERVED.
 *
 * The window has to expire, or the first abandoned checkout locks the item for
 * good. 30 minutes is also Stripe's own minimum for `expires_at`, so the
 * payment page and our claim die together instead of one outliving the other.
 */
const RESERVATION_MINUTES = 30;

/**
 * Claims the item for this buyer, atomically.
 *
 * The guard lives in the WHERE clause on purpose. Reading the row first and
 * updating it afterwards is not a lock: under Postgres' default READ COMMITTED
 * both requests can read ACTIVE before either writes. A conditional UPDATE is
 * settled by the database - exactly one of the two gets count === 1.
 *
 * Three shapes may be claimed: a free item, a reservation that has run out,
 * and this buyer's own reservation (so returning to your own checkout is not
 * blocked by yourself).
 */
async function claimProduct(
  tx: Prisma.TransactionClient,
  productId: string,
  buyerId: string,
  until: Date
) {
  const now = new Date();

  const blockingOrder = await tx.order.findFirst({
    where: { productId, status: { in: [...FINALIZED_ORDER_STATUSES] } },
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

function normalizeShippingCarrier(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';

  switch (normalized) {
    case 'DHL':
      return 'DHL';
    case 'HERMES':
      return 'Hermes';
    case 'DPD':
      return 'DPD';
    case 'GLS':
      return 'GLS';
    default:
      return 'DHL';
  }
}

function buildCheckoutMetadata(params: {
  productId: string;
  buyerId: string;
  sellerId: string;
  offerId?: string | null;
  itemPrice: number;
  shippingFee: number;
  protectionFee: number;
  shippingMethod: string;
}) {
  return {
    productId: params.productId,
    buyerId: params.buyerId,
    sellerId: params.sellerId,
    offerId: params.offerId || '',
    itemPrice: String(params.itemPrice),
    shippingFee: String(params.shippingFee),
    protectionFee: String(params.protectionFee),
    shippingMethod: params.shippingMethod,
  };
}

/**
 * POST /api/checkout/create-session - Create a Stripe checkout session
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { productId, offerId, shippingMethod } = body;

    if (!productId) {
      return ApiResponse.error('Produkt-ID ist erforderlich.');
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        seller: { select: { id: true, name: true } },
        images: { take: 1, orderBy: { orderIndex: 'asc' }, /* embedding HARIC: 3072'lik vektor gorsel basina ~42 KB sisiriyor */ select: { id: true, url: true, thumbUrl: true, mediumUrl: true, orderIndex: true, productId: true, angle: true } },
      },
    });

    if (!product || product.status !== 'ACTIVE') {
      return ApiResponse.error('Dieses Produkt ist nicht mehr verfügbar.', 409);
    }

    if (product.sellerId === session.user.id) {
      return ApiResponse.error('Du kannst dein eigenes Produkt nicht kaufen.');
    }

    const existingFinalizedOrder = await prisma.order.findFirst({
      where: {
        productId,
        status: { in: [...FINALIZED_ORDER_STATUSES] },
      },
      select: { id: true },
    });

    if (existingFinalizedOrder) {
      return ApiResponse.error('Dieser Artikel wurde bereits verkauft.', 409);
    }

    let itemPrice = product.price;
    if (offerId) {
      const offer = await prisma.offer.findUnique({ where: { id: offerId } });
      if (offer && offer.status === 'ACCEPTED' && offer.buyerId === session.user.id) {
        itemPrice = offer.offeredPrice;
      }
    }

    const priorFinalizedOrderCount = await prisma.order.count({
      where: { buyerId: session.user.id, status: { in: [...FINALIZED_ORDER_STATUSES] } },
    });
    const isFirstOrder = priorFinalizedOrderCount === 0;

    const resolvedShippingMethod = normalizeShippingCarrier(shippingMethod);
    // Versandkosten kommen aus EINER zentralen Regel (src/config/shipping-policy).
    // Vorher galt der Erstbestellungs-Gratisversand ohne Untergrenze: bei einem
    // 12-EUR-Artikel zahlte der Shop den Versand und machte Verlust — das betraf
    // 27 % des Katalogs.
    const { fee: shippingFee } = resolveShippingFee({
      itemPrice,
      productShippingCost: product.shippingCost,
      isFirstOrder,
    });
    const protectionFee = Math.round((itemPrice * BUYER_PROTECTION_RATE + BUYER_PROTECTION_FIXED) * 100) / 100;
    const totalAmount = Math.round((itemPrice + shippingFee + protectionFee) * 100) / 100;
    const metadata = buildCheckoutMetadata({
      productId: product.id,
      buyerId: session.user.id,
      sellerId: product.sellerId,
      offerId: offerId || null,
      itemPrice,
      shippingFee,
      protectionFee,
      shippingMethod: resolvedShippingMethod,
    });

    const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

    if (!process.env.STRIPE_SECRET_KEY) {
      try {
        const order = await prisma.$transaction(async (tx) => {
          await claimProduct(tx, productId, session.user.id, reservedUntil);

          const createdOrder = await tx.order.create({
            data: {
              productId: product.id,
              buyerId: session.user.id,
              sellerId: product.sellerId,
              offerId: offerId || null,
              itemPrice,
              shippingFee,
              protectionFee,
              totalAmount,
              status: 'PAID',
              shippingCarrier: resolvedShippingMethod,
            },
            include: {
              product: { select: { id: true, title: true } },
              buyer: { select: { id: true, name: true, email: true } },
              seller: { select: { id: true, name: true, email: true } },
            },
          });

          // The order now owns the item, so the timed window must go - a
          // leftover reservedUntil would let the cron sweep hand a paid item
          // back to the catalogue.
          await tx.product.update({
            where: { id: productId },
            data: { status: 'RESERVED', reservedUntil: null, reservedById: null },
          });

          return createdOrder;
        });

        await publishOrderLifecycleEvent({
          eventType: 'ORDER_PAID',
          order,
          actorId: session.user.id,
        });

        return ApiResponse.success({
          orderId: order.id,
          mode: 'dev',
          message: 'Bestellung erstellt.',
        });
      } catch (createError: any) {
        if (createError.message === 'PRODUCT_UNAVAILABLE' || createError.message === 'ORDER_EXISTS') {
          return ApiResponse.error('Dieses Produkt ist nicht mehr verfügbar.', 409);
        }
        throw createError;
      }
    }

    // THE oversell hole: this branch used to create a Stripe session without
    // touching the product at all. The dev branch below-the-fold had a
    // transaction, the branch that actually takes money had none, so two
    // buyers in the same second each got a payment page for the same single
    // item. Claim first, and only then ask Stripe for a page.
    await prisma.$transaction((tx) =>
      claimProduct(tx, productId, session.user.id, reservedUntil)
    );

    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

    let checkoutSession;
    try {
      checkoutSession = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card', 'sepa_debit', 'klarna', 'giropay'],
        client_reference_id: `${product.id}:${session.user.id}`,
        payment_intent_data: {
          metadata,
        },
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: product.title,
                images: product.images[0] ? [product.images[0].url] : [],
                description: `Verkäufer: ${product.seller.name}`,
              },
              unit_amount: Math.round(itemPrice * 100),
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: 'eur',
              product_data: { name: `Versand (${resolvedShippingMethod})` },
              unit_amount: Math.round(shippingFee * 100),
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: 'eur',
              product_data: { name: 'Käuferschutz' },
              unit_amount: Math.round(protectionFee * 100),
            },
            quantity: 1,
          },
        ],
        metadata,
        // Tie Stripe's own expiry to our reservation so the payment page and
        // the claim die at the same moment. Left at the default 24h, a buyer
        // could pay through a stale page long after the item went back on sale.
        expires_at: Math.floor(reservedUntil.getTime() / 1000),
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/${productId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/product/${productId}`,
      });
    } catch (stripeError) {
      // No payment page means nobody can pay for this claim. Holding it for
      // 30 minutes would take a sellable item off the market for nothing.
      await releaseClaim(productId, session.user.id);
      throw stripeError;
    }

    return ApiResponse.success({
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
