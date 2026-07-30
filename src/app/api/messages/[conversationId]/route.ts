import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

type Params = { params: Promise<{ conversationId: string }> };

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
 * GET /api/messages/[conversationId] - Get messages in a conversation
 * conversationId is the partner's userId
 * Supports cursor-based pagination
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { conversationId: partnerId } = await params;
    const cursor = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100);

    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, avatar: true, username: true },
    });

    if (!partner) {
      return ApiResponse.notFound('Benutzer nicht gefunden.');
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: partnerId },
          { senderId: partnerId, receiverId: session.user.id },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        offer: {
          select: messageOfferSelect,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: session.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return ApiResponse.success({
      partner,
      messages: items.reverse(),
      nextCursor,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}