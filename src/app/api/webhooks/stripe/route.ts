import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { publishOrderLifecycleEvent } from '@/lib/order-events';

const FINALIZED_ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;
const UNAVAILABLE_PRODUCT_STATUSES = ['DRAFT', 'HIDDEN', 'SOLD'] as const;

function parseAmount(value: unknown, fallback: number = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPaymentReference(session: any) {
  if (typeof session?.payment_intent === 'string' && session.payment_intent) {
    return session.payment_intent;
  }
  if (typeof session?.id === 'string' && session.id) {
    return session.id;
  }
  return null;
}

async function finalizeCheckoutSession(session: any) {
  const metadata = session?.metadata;

  if (!metadata?.productId || !metadata?.buyerId || !metadata?.sellerId) {
    console.error('Missing metadata in checkout session:', session?.id);
    return;
  }

  const paymentReference = getPaymentReference(session);
  const fallbackTotalAmount =
    parseAmount(metadata.itemPrice) +
    parseAmount(metadata.shippingFee) +
    parseAmount(metadata.protectionFee);
  const totalAmount =
    typeof session?.amount_total === 'number'
      ? session.amount_total / 100
      : fallbackTotalAmount;

  const result = await prisma.$transaction(async (tx) => {
    if (paymentReference) {
      const existingByPayment = await tx.order.findFirst({
        where: { paymentIntentId: paymentReference },
        select: { id: true },
      });

      if (existingByPayment) {
        return { created: false, reason: 'duplicate-payment' };
      }
    }

    const conflictingOrder = await tx.order.findFirst({
      where: {
        productId: metadata.productId,
        status: { in: [...FINALIZED_ORDER_STATUSES] },
      },
      select: { id: true, buyerId: true },
      orderBy: { createdAt: 'desc' },
    });

    if (conflictingOrder) {
      console.error('Stripe checkout conflict: product already finalized by another order', {
        checkoutSessionId: session?.id,
        productId: metadata.productId,
        existingOrderId: conflictingOrder.id,
        existingBuyerId: conflictingOrder.buyerId,
        attemptedBuyerId: metadata.buyerId,
      });
      return { created: false, reason: 'conflicting-order' };
    }

    const currentProduct = await tx.product.findUnique({
      where: { id: metadata.productId },
      select: { status: true, title: true },
    });

    if (!currentProduct || UNAVAILABLE_PRODUCT_STATUSES.includes(currentProduct.status as (typeof UNAVAILABLE_PRODUCT_STATUSES)[number])) {
      console.error('Stripe checkout skipped because product is unavailable', {
        checkoutSessionId: session?.id,
        productId: metadata.productId,
        productStatus: currentProduct?.status,
      });
      return { created: false, reason: 'product-unavailable' };
    }

    const order = await tx.order.create({
      data: {
        productId: metadata.productId,
        buyerId: metadata.buyerId,
        sellerId: metadata.sellerId,
        offerId: metadata.offerId || null,
        itemPrice: parseAmount(metadata.itemPrice),
        shippingFee: parseAmount(metadata.shippingFee),
        protectionFee: parseAmount(metadata.protectionFee),
        totalAmount,
        status: 'PAID',
        paymentIntentId: paymentReference,
        shippingCarrier: metadata.shippingMethod || 'DHL',
      },
      include: {
        product: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    if (currentProduct.status === 'ACTIVE') {
      await tx.product.update({
        where: { id: metadata.productId },
        data: { status: 'RESERVED' },
      });
    }

    return { created: true, order };
  });

  if (!result.created || !result.order) {
    return;
  }

  await publishOrderLifecycleEvent({
    eventType: 'ORDER_PAID',
    order: result.order,
    actorId: result.order.buyer.id,
  });
}

/**
 * POST /api/webhooks/stripe - Stripe webhook handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        body,
        signature || '',
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        if (session.payment_status !== 'paid') {
          console.warn('Stripe checkout completed without settled payment yet:', {
            checkoutSessionId: session.id,
            paymentStatus: session.payment_status,
          });
          break;
        }

        await finalizeCheckoutSession(session);
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as any;
        await finalizeCheckoutSession(session);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as any;
        console.error('Async checkout payment failed:', {
          checkoutSessionId: session.id,
          productId: session.metadata?.productId,
          buyerId: session.metadata?.buyerId,
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        console.error('Payment failed:', {
          paymentIntentId: paymentIntent.id,
          message: paymentIntent.last_payment_error?.message,
          productId: paymentIntent.metadata?.productId,
          buyerId: paymentIntent.metadata?.buyerId,
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
