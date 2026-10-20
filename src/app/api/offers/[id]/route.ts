import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { respondOfferSchema } from '@/lib/validations';
import { createSystemNotification } from '@/lib/notifications';
import { resolveActingIdentity } from '@/lib/persona-auth';
import {
  FINALIZED_ORDER_STATUSES,
  answerDeadline,
  minimumOffer,
  offerAdvice,
  offerTurn,
  paymentDeadline,
} from '@/lib/offer-state';
import { offerPolicy } from '@/config/marketplace-policy';

type Params = { params: Promise<{ id: string }> };

const eur = (n: number) => `${n.toFixed(2)} EUR`;

/**
 * GET /api/offers/[id] - Get offer details (+ advice for the seller side)
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
            images: { take: 1, orderBy: { orderIndex: 'asc' }, /* embedding HARIC: 3072'lik vektor gorsel basina ~42 KB sisiriyor */ select: { id: true, url: true, thumbUrl: true, mediumUrl: true, orderIndex: true, productId: true, angle: true } },
          },
        },
        buyer: { select: { id: true, name: true, avatar: true, isPersonaAccount: true, managedByUserId: true } },
        seller: { select: { id: true, name: true, avatar: true, isPersonaAccount: true, managedByUserId: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        orders: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!offer) return ApiResponse.notFound('Angebot nicht gefunden.');
    const isDirectParty = offer.buyerId === session.user.id || offer.sellerId === session.user.id;
    const managesBuyerPersona = offer.buyer.isPersonaAccount && offer.buyer.managedByUserId === session.user.id;
    const managesSellerPersona = offer.seller.isPersonaAccount && offer.seller.managedByUserId === session.user.id;
    if (!isDirectParty && !managesBuyerPersona && !managesSellerPersona) {
      return ApiResponse.forbidden();
    }

    const turn = offerTurn(offer);
    const isSellerSide = offer.sellerId === session.user.id || managesSellerPersona;
    const advice = isSellerSide && turn.pendingOn === 'SELLER'
      ? await offerAdvice({ productId: offer.productId, offeredPrice: offer.offeredPrice })
      : null;

    return ApiResponse.success({
      ...offer,
      ...turn,
      advice,
      roundsLeft: Math.max(0, offerPolicy.maxRounds - offer.round),
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

    const parsed = respondOfferSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return ApiResponse.validationError('Ungültige Aktion.');
    }

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        product: true,
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true, email: true, offerMinPercent: true } },
        messages: { select: { senderId: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });

    if (!offer) return ApiResponse.notFound('Angebot nicht gefunden.');
    if (offer.status !== 'PENDING') return ApiResponse.error('Dieses Angebot ist nicht mehr aktiv.');
    if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
      await prisma.offer.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      return ApiResponse.error(`Dieses Angebot ist abgelaufen (keine Antwort innerhalb von ${offerPolicy.answerHours} Stunden).`, 409);
    }

    const { pendingOn, originRole } = offerTurn(offer);
    const expectedActorId = pendingOn === 'BUYER' ? offer.buyerId : offer.sellerId;
    const actorRole = pendingOn === 'BUYER' ? 'BUYER' : 'SELLER';
    const otherId = actorRole === 'SELLER' ? offer.buyerId : offer.sellerId;

    // Allows the real, authenticated manager of a persona seller/buyer account
    // to act "as" that persona - see src/lib/persona-auth.ts. Never automated:
    // this still requires a genuine, currently-authenticated human session.
    const acting = await resolveActingIdentity(session.user.id, expectedActorId);
    if (!acting.allowed) {
      return ApiResponse.forbidden('Dieses Angebot wartet aktuell auf die andere Seite.');
    }
    const actingId = acting.actingId;

    const { action, counterPrice } = parsed.data;

    if (action !== 'reject') {
      if (offer.product.status !== 'ACTIVE') {
        return ApiResponse.error('Dieser Artikel ist gerade reserviert oder verkauft - das Angebot kann nicht angenommen werden.', 409);
      }
      const existingFinalizedOrder = await prisma.order.findFirst({
        where: { productId: offer.productId, status: { in: [...FINALIZED_ORDER_STATUSES] } },
        select: { id: true },
      });
      if (existingFinalizedOrder) {
        return ApiResponse.error('Dieser Artikel wurde bereits verkauft.', 409);
      }
    }

    const chat = (content: string, offerId: string) =>
      prisma.message.create({ data: { content, type: 'OFFER_ACTION', senderId: actingId, receiverId: otherId, offerId } });

    switch (action) {
      case 'accept': {
        const due = paymentDeadline();
        // Conditional on PENDING: a double click or a race with expiry accepts once.
        const { count } = await prisma.offer.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACCEPTED', expiresAt: due } });
        if (!count) return ApiResponse.error('Dieses Angebot ist nicht mehr aktiv.', 409);

        // Reserve the item for the buyer at the agreed price; released by the
        // offer timer if the buyer does not check out in time.
        const lock = await prisma.product.updateMany({
          where: { id: offer.productId, status: 'ACTIVE' },
          data: { status: 'RESERVED', reservedById: offer.buyerId, reservedUntil: due },
        });
        if (!lock.count) {
          await prisma.offer.update({ where: { id }, data: { status: 'PENDING', expiresAt: offer.expiresAt } });
          return ApiResponse.error('Der Artikel wurde in diesem Moment von jemand anderem gekauft.', 409);
        }

        await chat(`${actorRole === 'SELLER' ? 'Angebot' : 'Gegenangebot'} über ${eur(offer.offeredPrice)} angenommen.`, id);
        await createSystemNotification(
          actorRole === 'SELLER'
            ? {
                senderId: actingId, receiverId: offer.buyerId, offerId: id, category: 'offers',
                content: `Dein Angebot für ${offer.product.title} wurde angenommen! Der Artikel ist ${offerPolicy.paymentHours} Stunden für dich zum Preis von ${eur(offer.offeredPrice)} reserviert.`,
                email: {
                  subject: `Angebot angenommen: ${offer.product.title}`, title: 'Dein Angebot wurde angenommen',
                  lines: [`Preis: ${eur(offer.offeredPrice)}`, `Schließe den Kauf innerhalb von ${offerPolicy.paymentHours} Stunden ab, sonst wird der Artikel wieder freigegeben.`],
                  ctaLabel: 'Jetzt kaufen', ctaPath: `/checkout/${offer.productId}?offerId=${id}`,
                },
              }
            : {
                senderId: actingId, receiverId: offer.sellerId, offerId: id, category: 'offers',
                content: `${offer.buyer.name || 'Ein Mitglied'} hat dein Gegenangebot für ${offer.product.title} angenommen. Der Artikel ist ${offerPolicy.paymentHours} Stunden für den Kauf reserviert.`,
              },
        );
        // when the seller's counter is accepted, the buyer still has to pay: tell the buyer too
        if (actorRole === 'BUYER') {
          await createSystemNotification({
            senderId: offer.sellerId, receiverId: offer.buyerId, offerId: id, category: 'offers',
            content: `Einigung erzielt: ${offer.product.title} für ${eur(offer.offeredPrice)}. Schließe den Kauf innerhalb von ${offerPolicy.paymentHours} Stunden ab.`,
          });
        }

        return ApiResponse.success({ id, status: 'ACCEPTED', expiresAt: due, action: 'accepted', actorRole, originRole });
      }

      case 'reject': {
        const { count } = await prisma.offer.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED' } });
        if (!count) return ApiResponse.error('Dieses Angebot ist nicht mehr aktiv.', 409);

        await chat(`${actorRole === 'SELLER' ? 'Angebot' : 'Gegenangebot'} über ${eur(offer.offeredPrice)} abgelehnt.`, id);
        await createSystemNotification({
          senderId: actingId, receiverId: otherId, offerId: id, category: 'offers',
          content: actorRole === 'SELLER'
            ? `Dein Angebot für ${offer.product.title} wurde abgelehnt. Du kannst ein neues Angebot senden, solange der Artikel aktiv ist.`
            : `${offer.buyer.name || 'Ein Mitglied'} hat dein Gegenangebot für ${offer.product.title} abgelehnt.`,
          email: {
            subject: `${actorRole === 'SELLER' ? 'Angebot' : 'Gegenangebot'} abgelehnt: ${offer.product.title}`,
            title: actorRole === 'SELLER' ? 'Dein Angebot wurde abgelehnt' : 'Gegenangebot abgelehnt',
            lines: [`Artikel: ${offer.product.title}`, `Preis: ${eur(offer.offeredPrice)}`, ...(actorRole === 'SELLER' ? ['Du kannst ein neues Angebot senden, solange der Artikel verfügbar ist.'] : [])],
            ctaLabel: actorRole === 'SELLER' ? 'Neues Angebot senden' : 'Angebote ansehen',
            ctaPath: actorRole === 'SELLER' ? `/product/${offer.productId}` : '/offers',
          },
        });

        return ApiResponse.success({ id, status: 'REJECTED', action: 'rejected', actorRole, originRole });
      }

      case 'counter': {
        if (!counterPrice) return ApiResponse.error('Gegenangebotspreis ist erforderlich.');
        if (offer.round >= offerPolicy.maxRounds) {
          return ApiResponse.error(`Maximal ${offerPolicy.maxRounds - 1} Gegenangebote pro Verhandlung. Bitte nimm an oder lehne ab.`, 422);
        }

        const floor = minimumOffer(offer.product.price, offer.seller.offerMinPercent);
        if (counterPrice < floor.amount) {
          return ApiResponse.error(`Mindestangebot ist ${eur(floor.amount)}.`, 422);
        }
        if (actorRole === 'SELLER') {
          if (counterPrice <= offer.offeredPrice || counterPrice >= offer.product.price) {
            return ApiResponse.error('Gegenangebot muss zwischen dem Angebot und dem Listenpreis liegen.');
          }
        } else if (counterPrice >= offer.offeredPrice || counterPrice >= offer.product.price) {
          return ApiResponse.error('Dein neues Angebot muss unter dem Gegenangebot und unter dem Listenpreis liegen.');
        }

        const { count } = await prisma.offer.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'COUNTERED' } });
        if (!count) return ApiResponse.error('Dieses Angebot ist nicht mehr aktiv.', 409);

        const counter = await prisma.offer.create({
          data: {
            offeredPrice: counterPrice,
            productId: offer.productId,
            buyerId: offer.buyerId,
            sellerId: offer.sellerId,
            createdById: actorRole === 'SELLER' ? offer.sellerId : offer.buyerId,
            round: offer.round + 1,
            expiresAt: answerDeadline(),
          },
        });

        await chat(`${actorRole === 'SELLER' ? 'Gegenangebot' : 'Neues Angebot'}: ${eur(counterPrice)}`, counter.id);
        const left = offerPolicy.maxRounds - counter.round;
        await createSystemNotification({
          senderId: actingId, receiverId: otherId, offerId: counter.id, category: 'offers',
          content: actorRole === 'SELLER'
            ? `Gegenangebot über ${eur(counterPrice)} für ${offer.product.title}. Antworte innerhalb von ${offerPolicy.answerHours} Stunden${left === 0 ? ' - das ist die letzte Runde' : ''}.`
            : `${offer.buyer.name || 'Ein Mitglied'} hat ein neues Angebot über ${eur(counterPrice)} für ${offer.product.title} geschickt.`,
          email: {
            subject: `${actorRole === 'SELLER' ? 'Gegenangebot' : 'Neues Angebot'}: ${offer.product.title}`,
            title: actorRole === 'SELLER' ? 'Du hast ein Gegenangebot' : 'Neues Angebot eingegangen',
            lines: [`Artikel: ${offer.product.title}`, `Preis: ${eur(counterPrice)}`, `Antwort innerhalb von ${offerPolicy.answerHours} Stunden möglich.`],
            ctaLabel: 'Angebot ansehen',
            ctaPath: '/offers',
          },
        });

        return ApiResponse.success({ ...counter, action: 'countered', actorRole, originRole, roundsLeft: left });
      }

      default:
        return ApiResponse.error('Ungültige Aktion.');
    }
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('PUT /api/offers/[id] error:', error);
    return ApiResponse.serverError();
  }
}
