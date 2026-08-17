import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { createMessageSchema } from '@/lib/validations';
import { CHANNELS, EVENTS, triggerEvent } from '@/lib/pusher';
import { requireManagedPersona } from '@/lib/persona-auth';

type Params = { params: Promise<{ personaId: string }> };

const messageOfferSelect = {
  id: true,
  offeredPrice: true,
  status: true,
  buyerId: true,
  sellerId: true,
  product: {
    select: {
      id: true,
      title: true,
      price: true,
      status: true,
      images: { take: 1, select: { url: true }, orderBy: { orderIndex: 'asc' } },
    },
  },
  orders: {
    select: { id: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} as const;

/**
 * GET /api/personas/[personaId]/messages - Conversations for a persona
 * (pool) seller account, viewed by its real manager. Mirrors GET
 * /api/messages, scoped to the persona's identity instead of the caller's.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { personaId } = await params;

    const persona = await requireManagedPersona(session.user.id, personaId);
    if (!persona) return ApiResponse.forbidden('Dieses Profil wird nicht von dir verwaltet.');

    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: personaId }, { receiverId: personaId }],
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, username: true } },
        receiver: { select: { id: true, name: true, avatar: true, username: true } },
        offer: { select: messageOfferSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    const conversationsMap = new Map<
      string,
      {
        partnerId: string;
        partner: { id: string; name: string | null; avatar: string | null; username: string | null };
        lastMessage: (typeof messages)[0];
        unreadCount: number;
        offer?: (typeof messages)[0]['offer'];
      }
    >();

    for (const msg of messages) {
      const partnerId = msg.senderId === personaId ? msg.receiverId : msg.senderId;

      if (!conversationsMap.has(partnerId)) {
        const partner = msg.senderId === personaId ? msg.receiver : msg.sender;
        conversationsMap.set(partnerId, {
          partnerId,
          partner,
          lastMessage: msg,
          unreadCount: 0,
          offer: msg.offer,
        });
      } else if (msg.offer) {
        const conversation = conversationsMap.get(partnerId)!;
        if (!conversation.offer) conversation.offer = msg.offer;
      }

      if (msg.receiverId === personaId && !msg.isRead) {
        const conv = conversationsMap.get(partnerId)!;
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime()
    );

    return ApiResponse.success({ persona, conversations });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * POST /api/personas/[personaId]/messages - Send a message AS the persona.
 * Only the real, authenticated manager can do this (requireManagedPersona) -
 * there is no automated/AI reply path here, this always requires a human
 * click in /admin/personas/[id]/inbox.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { personaId } = await params;

    const persona = await requireManagedPersona(session.user.id, personaId);
    if (!persona) return ApiResponse.forbidden('Dieses Profil wird nicht von dir verwaltet.');

    const body = await request.json();
    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungueltige Nachricht.');
    }

    const { receiverId, content, type, offerId } = parsed.data;

    if (receiverId === personaId) {
      return ApiResponse.error('Ungueltiger Empfaenger.');
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } });
    if (!receiver) return ApiResponse.notFound('Empfaenger nicht gefunden.');

    const message = await prisma.message.create({
      data: {
        senderId: personaId,
        receiverId,
        content,
        type: type || 'TEXT',
        offerId: offerId || null,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, username: true } },
        receiver: { select: { id: true, name: true, avatar: true, username: true } },
        offer: { select: messageOfferSelect },
      },
    });

    await Promise.all([
      triggerEvent(CHANNELS.user(receiverId), EVENTS.NEW_MESSAGE, {
        partnerId: personaId,
        partner: message.sender,
        message,
      }),
      triggerEvent(CHANNELS.user(personaId), EVENTS.NEW_MESSAGE, {
        partnerId: receiverId,
        partner: message.receiver,
        message,
      }),
    ]);

    return ApiResponse.created(message);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/personas/[personaId]/messages error:', error);
    return ApiResponse.serverError();
  }
}
