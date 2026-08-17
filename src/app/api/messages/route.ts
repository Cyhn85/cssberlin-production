import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { createMessageSchema } from '@/lib/validations';
import { CHANNELS, EVENTS, triggerEvent } from '@/lib/pusher';
import { relayToPersonaManagerIfNeeded } from '@/lib/notifications';

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
 * GET /api/messages - Get all conversations for current user
 * Groups messages by conversation partner, returns latest message per conversation
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, username: true } },
        receiver: { select: { id: true, name: true, avatar: true, username: true } },
        offer: {
          select: messageOfferSelect,
        },
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
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;

      if (!conversationsMap.has(partnerId)) {
        const partner = msg.senderId === userId ? msg.receiver : msg.sender;
        conversationsMap.set(partnerId, {
          partnerId,
          partner,
          lastMessage: msg,
          unreadCount: 0,
          offer: msg.offer,
        });
      } else if (msg.offer) {
        const conversation = conversationsMap.get(partnerId)!;
        if (!conversation.offer) {
          conversation.offer = msg.offer;
        }
      }

      if (msg.receiverId === userId && !msg.isRead) {
        const conv = conversationsMap.get(partnerId)!;
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime()
    );

    return ApiResponse.success(conversations);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * POST /api/messages - Send a new message
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungueltige Nachricht.');
    }

    const { receiverId, content, type, offerId } = parsed.data;

    if (receiverId === session.user.id) {
      return ApiResponse.error('Du kannst dir nicht selbst schreiben.');
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true },
    });
    if (!receiver) {
      return ApiResponse.notFound('Empfaenger nicht gefunden.');
    }

    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId,
        content,
        type: type || 'TEXT',
        offerId: offerId || null,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, username: true } },
        receiver: { select: { id: true, name: true, avatar: true, username: true } },
        offer: {
          select: messageOfferSelect,
        },
      },
    });

    await Promise.all([
      triggerEvent(CHANNELS.user(receiverId), EVENTS.NEW_MESSAGE, {
        partnerId: session.user.id,
        partner: message.sender,
        message,
      }),
      triggerEvent(CHANNELS.user(session.user.id), EVENTS.NEW_MESSAGE, {
        partnerId: receiverId,
        partner: message.receiver,
        message,
      }),
    ]);

    // If this chat message went to a persona (pool) seller/buyer account,
    // mirror it to the real human who manages that persona in real time.
    await relayToPersonaManagerIfNeeded({
      senderId: session.user.id,
      receiverId,
      content: message.content,
      offerId: offerId || null,
    });

    return ApiResponse.created(message);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/messages error:', error);
    return ApiResponse.serverError();
  }
}