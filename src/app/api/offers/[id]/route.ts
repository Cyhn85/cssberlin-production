import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { respondOfferSchema } from '@/lib/validations';
import { createSystemNotification } from '@/lib/notifications';

const FINALIZED_ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

type Params = { params: Promise<{ id: string }> };

function getOfferOriginRole(offer: {
  sellerId: string;
  messages: Array<{ senderId: string }>;
}) {
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

/**
 * GET /api/offers/[id] - Get offer details
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            images: { take: 1, orderBy: { orderIndex: 'asc' } },
          },
        },
        buyer: { select: { id: true, name: true, avatar: true } },
        seller: { select: { id: true, name: true, avatar: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        orders: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!offer) return ApiResponse.notFound('Angebot nicht gefunden.');
    if (offer.buyerId !== session.user.id && offer.sellerId !== session.user.id) {
      return ApiResponse.forbidden();
    }

    const originRole = getOfferOriginRole(offer);

    return ApiResponse.success({
      ...offer,
      originRole,
      pendingOn: getPendingOn(offer.status, originRole),
      latestOrder: offer.orders[0] || null,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * PUT /api/offers/[id] - Accept, reject, or counter an offer
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = respondOfferSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungueltige Aktion.');
    }

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        product: true,
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        messages: {
          select: { senderId: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!offer) return ApiResponse.notFound('Angebot nicht gefunden.');
    if (offer.status !== 'PENDING') return ApiResponse.error('Dieses Angebot ist nicht mehr aktiv.');

    const originRole = getOfferOriginRole(offer);
    const expectedActorId = originRole === 'SELLER_COUNTER' ? offer.buyerId : offer.sellerId;
    const actorRole = session.user.id === offer.buyerId ? 'BUYER' : 'SELLER';

    if (expectedActorId !== session.user.id) {
      return ApiResponse.forbidden('Dieses Angebot wartet aktuell auf die andere Seite.');
    }

    const { action, counterPrice } = parsed.data;
    const requiresAvailableProduct = action !== 'reject';

    if (requiresAvailableProduct && offer.product.status !== 'ACTIVE') {
      return ApiResponse.error('Dieser Artikel ist nicht mehr fuer neue Angebotsaktionen verfuegbar.', 409);
    }

    if (requiresAvailableProduct) {
      const existingFinalizedOrder = await prisma.order.findFirst({
        where: {
          productId: offer.productId,
          status: { in: [...FINALIZED_ORDER_STATUSES] },
        },
        select: { id: true },
      });

      if (existingFinalizedOrder) {
        return ApiResponse.error('Dieser Artikel wurde bereits verkauft.', 409);
      }
    }

    switch (action) {
      case 'accept': {
        const updated = await prisma.offer.update({
          where: { id },
          data: { status: 'ACCEPTED' },
        });

        if (actorRole === 'SELLER') {
          await prisma.message.create({
            data: {
              content: `Angebot von ${offer.offeredPrice.toFixed(2)} EUR wurde angenommen!`,
              type: 'OFFER_ACTION',
              senderId: session.user.id,
              receiverId: offer.buyerId,
              offerId: id,
            },
          });

          await createSystemNotification({
            senderId: session.user.id,
            receiverId: offer.buyerId,
            offerId: id,
            content: `Dein Angebot fuer ${offer.product.title} wurde angenommen. Du kannst jetzt den Checkout starten.`,
          });
        } else {
          await prisma.message.create({
            data: {
              content: `Gegenangebot von ${offer.offeredPrice.toFixed(2)} EUR wurde angenommen.`,
              type: 'OFFER_ACTION',
              senderId: session.user.id,
              receiverId: offer.sellerId,
              offerId: id,
            },
          });

          await createSystemNotification({
            senderId: session.user.id,
            receiverId: offer.sellerId,
            offerId: id,
            content: `${offer.buyer.name || 'Ein Mitglied'} hat dein Gegenangebot fuer ${offer.product.title} angenommen.`,
          });
        }

        return ApiResponse.success({ ...updated, action: 'accepted', actorRole, originRole });
      }

      case 'reject': {
        const updated = await prisma.offer.update({
          where: { id },
          data: { status: 'REJECTED' },
        });

        if (actorRole === 'SELLER') {
          await prisma.message.create({
            data: {
              content: `Angebot von ${offer.offeredPrice.toFixed(2)} EUR wurde abgelehnt.`,
              type: 'OFFER_ACTION',
              senderId: session.user.id,
              receiverId: offer.buyerId,
              offerId: id,
            },
          });

          await createSystemNotification({
            senderId: session.user.id,
            receiverId: offer.buyerId,
            offerId: id,
            content: `Dein Angebot fuer ${offer.product.title} wurde abgelehnt. Du kannst ein neues Angebot senden, solange der Artikel aktiv ist.`,
          });
        } else {
          await prisma.message.create({
            data: {
              content: `Gegenangebot von ${offer.offeredPrice.toFixed(2)} EUR wurde abgelehnt.`,
              type: 'OFFER_ACTION',
              senderId: session.user.id,
              receiverId: offer.sellerId,
              offerId: id,
            },
          });

          await createSystemNotification({
            senderId: session.user.id,
            receiverId: offer.sellerId,
            offerId: id,
            content: `${offer.buyer.name || 'Ein Mitglied'} hat dein Gegenangebot fuer ${offer.product.title} abgelehnt.`,
          });
        }

        return ApiResponse.success({ ...updated, action: 'rejected', actorRole, originRole });
      }

      case 'counter': {
        if (!counterPrice) return ApiResponse.error('Gegenangebotspreis ist erforderlich.');

        const minimumOffer = offer.product.price * 0.6;
        if (counterPrice < minimumOffer) {
          return ApiResponse.error(`Mindestangebot ist ${minimumOffer.toFixed(2)} EUR.`, 422);
        }

        if (actorRole === 'SELLER') {
          if (counterPrice <= offer.offeredPrice || counterPrice >= offer.product.price) {
            return ApiResponse.error('Gegenangebot muss zwischen dem Angebot und dem Listenpreis liegen.');
          }
        } else if (counterPrice >= offer.offeredPrice || counterPrice >= offer.product.price) {
          return ApiResponse.error('Dein neues Angebot muss unter dem Gegenangebot und unter dem Listenpreis liegen.');
        }

        await prisma.offer.update({
          where: { id },
          data: { status: 'COUNTERED' },
        });

        const counter = await prisma.offer.create({
          data: {
            offeredPrice: counterPrice,
            productId: offer.productId,
            buyerId: offer.buyerId,
            sellerId: offer.sellerId,
          },
        });

        if (actorRole === 'SELLER') {
          await prisma.message.create({
            data: {
              content: `Gegenangebot: ${counterPrice.toFixed(2)} EUR`,
              type: 'OFFER_ACTION',
              senderId: session.user.id,
              receiverId: offer.buyerId,
              offerId: counter.id,
            },
          });

          await createSystemNotification({
            senderId: session.user.id,
            receiverId: offer.buyerId,
            offerId: counter.id,
            content: `Du hast ein Gegenangebot ueber ${counterPrice.toFixed(2)} EUR fuer ${offer.product.title} erhalten.`,
          });
        } else {
          await prisma.message.create({
            data: {
              content: `Neues Angebot nach Gegenangebot: ${counterPrice.toFixed(2)} EUR`,
              type: 'OFFER_ACTION',
              senderId: session.user.id,
              receiverId: offer.sellerId,
              offerId: counter.id,
            },
          });

          await createSystemNotification({
            senderId: session.user.id,
            receiverId: offer.sellerId,
            offerId: counter.id,
            content: `${offer.buyer.name || 'Ein Mitglied'} hat ein neues Angebot ueber ${counterPrice.toFixed(2)} EUR fuer ${offer.product.title} geschickt.`,
          });
        }

        return ApiResponse.success({ ...counter, action: 'countered', actorRole, originRole });
      }

      default:
        return ApiResponse.error('Ungueltige Aktion.');
    }
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('PUT /api/offers/[id] error:', error);
    return ApiResponse.serverError();
  }
}