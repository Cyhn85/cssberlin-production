import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { publishOrderLifecycleEvent } from '@/lib/order-events';

const BUYER_PROTECTION_RATE = 0.05;
const BUYER_PROTECTION_FIXED = 0.99;
const FINALIZED_ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

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
        images: { take: 1, orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!product || product.status !== 'ACTIVE') {
      return ApiResponse.error('Dieses Produkt ist nicht mehr verfuegbar.', 409);
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
    const shippingFee = isFirstOrder ? 0 : (product.shippingCost > 0 ? product.shippingCost : 4.99);
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

    if (!process.env.STRIPE_SECRET_KEY) {
      try {
        const order = await prisma.$transaction(async (tx) => {
          const freshProduct = await tx.product.findUnique({
            where: { id: productId },
            select: { status: true },
          });

          if (!freshProduct || freshProduct.status !== 'ACTIVE') {
            throw new Error('PRODUCT_UNAVAILABLE');
          }

          const blockingOrder = await tx.order.findFirst({
            where: {
              productId,
              status: { in: [...FINALIZED_ORDER_STATUSES] },
            },
            select: { id: true },
          });

          if (blockingOrder) {
            throw new Error('ORDER_EXISTS');
          }

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

          await tx.product.update({
            where: { id: productId },
            data: { status: 'RESERVED' },
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
          return ApiResponse.error('Dieses Produkt ist nicht mehr verfuegbar.', 409);
        }
        throw createError;
      }
    }

    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY);

    const checkoutSession = await stripeClient.checkout.sessions.create({
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
              description: `Verkaeufer: ${product.seller.name}`,
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
            product_data: { name: 'Kaeuferschutz' },
            unit_amount: Math.round(protectionFee * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/${productId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/product/${productId}`,
    });

    return ApiResponse.success({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/checkout/create-session error:', error);
    return ApiResponse.serverError();
  }
}
