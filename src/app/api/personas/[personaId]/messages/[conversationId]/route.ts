import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { requireManagedPersona } from '@/lib/persona-auth';

type Params = { params: Promise<{ personaId: string; conversationId: string }> };

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
  messages: {
    select: { senderId: true },
    orderBy: { createdAt: 'asc' as const },
    take: 1,
  },
} as const;

function withPendingOn<T extends { status: string; sellerId: string; messages: Array<{ senderId: string }> }>(
  offer: T
) {
  const originRole = offer.messages[0]?.senderId === offer.sellerId ? 'SELLER_COUNTER' : 'BUYER_OFFER';
  const pendingOn = offer.status !== 'PENDING' ? null : originRole === 'SELLER_COUNTER' ? 'BUYER' : 'SELLER';
  const { messages: _messages, ...rest } = offer;
  return { ...rest, pendingOn };
}

/**
 * GET /api/personas/[personaId]/messages/[conversationId] - Message
 * history for one persona<->partner conversation, viewed by the persona's
 * real manager. Mirrors GET /api/messages/[conversationId].
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { personaId, conversationId: partnerId } = await params;

    const persona = await requireManagedPersona(session.user.id, personaId);
    if (!persona) return ApiResponse.forbidden('Dieses Profil wird nicht von dir verwaltet.');

    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, avatar: true, username: true },
    });
    if (!partner) return ApiResponse.notFound('Benutzer nicht gefunden.');

    const cursor = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100);

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: personaId, receiverId: partnerId },
          { senderId: partnerId, receiverId: personaId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        offer: { select: messageOfferSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const itemsWithOfferContext = items.map((message) => ({
      ...message,
      offer: message.offer ? withPendingOn(message.offer) : null,
    }));

    await prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: personaId, isRead: false },
      data: { isRead: true },
    });

    return ApiResponse.success({
      partner,
      persona,
      messages: itemsWithOfferContext.reverse(),
      nextCursor,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
