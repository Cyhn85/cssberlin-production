import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { createOfferSchema } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { recordAction } from '@/lib/abuse-monitor';
import { createSystemNotification } from '@/lib/notifications';
import { FINALIZED_ORDER_STATUSES, answerDeadline, minimumOffer, offerTurn } from '@/lib/offer-state';
import { offerPolicy } from '@/config/marketplace-policy';

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
  createdById: string | null;
  round: number;
  expiresAt: Date | null;
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

function serializeOffer(offer: OfferWithCardData) {
  const { pendingOn, originRole } = offerTurn(offer);
  const latestOrder = offer.orders[0] || null;

  return {
    id: offer.id,
    offeredPrice: offer.offeredPrice,
    status: offer.status,
    productId: offer.productId,
    buyerId: offer.buyerId,
    sellerId: offer.sellerId,
    round: offer.round,
    roundsLeft: Math.max(0, offerPolicy.maxRounds - offer.round),
    expiresAt: offer.expiresAt,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    product: offer.product,
    buyer: offer.buyer,
    seller: offer.seller,
    originRole,
    pendingOn,
    latestOrder,
    hasCompletedCheckout: latestOrder
      ? (FINALIZED_ORDER_STATUSES as readonly string[]).includes(latestOrder.status)
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
        `Du hast dein tägliches Angebotslimit erreicht (${rl.limit}). Versuche es morgen erneut.`,
        429
      );
    }

    // The daily limit above throttles; this ceiling suspends. It sits well
    // above 25/day so only scripted volume across many accounts reaches it.
    if (await recordAction(session.user.id, 'offer')) {
      return ApiResponse.error('Dein Konto wurde wegen ungewöhnlicher Aktivität gesperrt.', 403);
    }

    const parsed = createOfferSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return ApiResponse.validationError('Ungültiges Angebot.');
    }

    const { productId, offeredPrice, message } = parsed.data;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { seller: { select: { name: true, offerMinPercent: true } } },
    });
    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');
    if (product.status !== 'ACTIVE') {
      return ApiResponse.error('Dieser Artikel ist gerade reserviert oder verkauft.', 409);
    }
    if (product.sellerId === session.user.id) {
      return ApiResponse.error('Du kannst kein Angebot für deinen eigenen Artikel abgeben.');
    }
    if (offeredPrice >= product.price) {
      return ApiResponse.error('Dein Angebot liegt nicht unter dem Preis - kaufe den Artikel direkt.');
    }

    // Platform floor (60 %) or the seller's own higher rule. Offers below never
    // reach the seller; the buyer is told the real minimum instead of guessing.
    const floor = minimumOffer(product.price, product.seller.offerMinPercent);
    if (offeredPrice < floor.amount) {
      return ApiResponse.error(
        floor.sellerRule
          ? `Dieser Verkäufer nimmt Angebote ab ${floor.amount.toFixed(2)} EUR an.`
          : `Mindestangebot ist ${floor.amount.toFixed(2)} EUR (${offerPolicy.minPercent} % des Listenpreises).`,
        422
      );
    }

    const existingOffer = await prisma.offer.findFirst({
      where: { productId, buyerId: session.user.id, status: { in: ['PENDING', 'ACCEPTED'] } },
    });
    if (existingOffer) {
      return ApiResponse.error(
        existingOffer.status === 'ACCEPTED'
          ? 'Dein Angebot wurde bereits angenommen - du kannst den Artikel jetzt kaufen.'
          : 'Du hast bereits ein offenes Angebot für diesen Artikel.'
      );
    }

    const offer = await prisma.offer.create({
      data: {
        offeredPrice,
        productId,
        buyerId: session.user.id,
        sellerId: product.sellerId,
        createdById: session.user.id,
        round: 1,
        expiresAt: answerDeadline(),
      },
      include: {
        product: { select: { title: true, price: true } },
        buyer: { select: { name: true } },
      },
    });

    // Always leave the offer in the chat (both sides see it there, Vinted style);
    // the optional note is part of the same bubble.
    await prisma.message.create({
      data: {
        content: message?.trim()
          ? `Preisvorschlag: ${offeredPrice.toFixed(2)} EUR\n${message.trim()}`
          : `Preisvorschlag: ${offeredPrice.toFixed(2)} EUR`,
        type: 'OFFER_ACTION',
        senderId: session.user.id,
        receiverId: product.sellerId,
        offerId: offer.id,
      },
    });

    await createSystemNotification({
      senderId: session.user.id,
      receiverId: product.sellerId,
      offerId: offer.id,
      category: 'offers',
      content: `${offer.buyer.name || 'Ein Mitglied'} bietet ${offeredPrice.toFixed(2)} EUR für ${offer.product.title}. Antworte innerhalb von ${offerPolicy.answerHours} Stunden.`,
      email: {
        subject: `Neues Angebot für ${offer.product.title}`,
        title: 'Neues Angebot eingegangen',
        lines: [
          `Artikel: ${offer.product.title}`,
          `Angebot: ${offeredPrice.toFixed(2)} EUR (dein Preis: ${offer.product.price.toFixed(2)} EUR)`,
          `Ohne Antwort läuft das Angebot nach ${offerPolicy.answerHours} Stunden ab.`,
        ],
        ctaLabel: 'Angebot ansehen',
        ctaPath: '/offers',
      },
    });

    return ApiResponse.created(offer);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/offers error:', error);
    return ApiResponse.serverError();
  }
}
