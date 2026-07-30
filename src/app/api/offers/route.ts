import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { createOfferSchema } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { createSystemNotification } from '@/lib/notifications';

const FINALIZED_ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

const offerCardInclude = {
  product: {
    select: {
      id: true,
      title: true,
      price: true,
      status: true,
      shippingCost: true,
      images: {
        select: { id: true, url: true, orderIndex: true },
        take: 1,
        orderBy: { orderIndex: 'asc' },
      },
    },
  },
  buyer: { select: { id: true, name: true, avatar: true } },
  seller: { select: { id: true, name: true, avatar: true } },
  orders: {
    select: { id: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  messages: {
    select: { senderId: true },
    orderBy: { createdAt: 'asc' },
    take: 1,
  },
} as const;

type OfferWithCardData = {
  id: string;
  offeredPrice: number;
  status: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    title: string;
    price: number;
    status: string;
    shippingCost: number;
    images: Array<{ id: string; url: string; orderIndex: number }>;
  };
  buyer: { id: string; name: string | null; avatar: string | null };
  seller: { id: string; name: string | null; avatar: string | null };
  orders: Array<{ id: string; status: string; createdAt: Date }>;
  messages: Array<{ senderId: string }>;
};

function getOfferOriginRole(offer: OfferWithCardData) {
  const firstMessageSenderId = offer.messages[0]?.senderId;
  if (firstMessageSenderId && firstMessageSenderId === offer.sellerId) {
    return 'SELLER_COUNTER' as const;
  }
  return 'BUYER_OFFER' as const;
}

function getPendingOn(status: string, originRole: 'BUYER_OFFER' | 'SELLER_COUNTER') {
  if (status !== 'PENDING') return null;
  return originRole === 'SELLER_COUNTER' ? 'BUYER' : 'SELLER';
}

function serializeOffer(offer: OfferWithCardData) {
  const originRole = getOfferOriginRole(offer);
  const latestOrder = offer.orders[0] || null;

  return {
    id: offer.id,
    offeredPrice: offer.offeredPrice,
    status: offer.status,
    productId: offer.productId,
    buyerId: offer.buyerId,
    sellerId: offer.sellerId,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    product: offer.product,
    buyer: offer.buyer,
    seller: offer.seller,
    originRole,
    pendingOn: getPendingOn(offer.status, originRole),
    latestOrder,
    hasCompletedCheckout: latestOrder
      ? FINALIZED_ORDER_STATUSES.includes(latestOrder.status as (typeof FINALIZED_ORDER_STATUSES)[number])
      : false,
  };
}

/**
 * GET /api/offers - Get user's offers (sent & received)
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const [sent, received] = await Promise.all([
      prisma.offer.findMany({
        where: { buyerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: offerCardInclude,
      }),
      prisma.offer.findMany({
        where: { sellerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: offerCardInclude,
      }),
    ]);

    return ApiResponse.success({
      sent: sent.map((offer) => serializeOffer(offer as OfferWithCardData)),
      received: received.map((offer) => serializeOffer(offer as OfferWithCardData)),
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * POST /api/offers - Make a price offer
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const rl = await rateLimit(session.user.id, 'OFFER');
    if (!rl.success) {
      return ApiResponse.error(
        `Du hast dein taegliches Angebotslimit erreicht (${rl.limit}). Versuche es morgen erneut.`,
        429
      );
    }

    const body = await request.json();
    const parsed = createOfferSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungueltiges Angebot.');
    }

    const { productId, offeredPrice, message } = parsed.data;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');
    if (product.status !== 'ACTIVE') {
      return ApiResponse.error('Dieser Artikel ist nicht mehr verfuegbar.', 409);
    }
    if (product.sellerId === session.user.id) {
      return ApiResponse.error('Du kannst kein Angebot fuer deinen eigenen Artikel abgeben.');
    }

    const minPrice = product.price * 0.6;
    if (offeredPrice < minPrice) {
      return ApiResponse.error(
        `Mindestangebot ist ${minPrice.toFixed(2)} EUR (60% des Listenpreises).`
      );
    }

    const existingOffer = await prisma.offer.findFirst({
      where: {
        productId,
        buyerId: session.user.id,
        status: 'PENDING',
      },
    });
    if (existingOffer) {
      return ApiResponse.error('Du hast bereits ein offenes Angebot fuer diesen Artikel.');
    }

    const offer = await prisma.offer.create({
      data: {
        offeredPrice,
        productId,
        buyerId: session.user.id,
        sellerId: product.sellerId,
      },
      include: {
        product: { select: { title: true, price: true } },
        buyer: { select: { name: true } },
      },
    });

    if (message) {
      await prisma.message.create({
        data: {
          content: message,
          type: 'OFFER_ACTION',
          senderId: session.user.id,
          receiverId: product.sellerId,
          offerId: offer.id,
        },
      });
    }

    await createSystemNotification({
      senderId: session.user.id,
      receiverId: product.sellerId,
      offerId: offer.id,
      content: `${offer.buyer.name || 'Ein Mitglied'} hat dir ein neues Angebot ueber ${offeredPrice.toFixed(2)} EUR fuer ${offer.product.title} geschickt.`,
    });

    return ApiResponse.created(offer);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/offers error:', error);
    return ApiResponse.serverError();
  }
}