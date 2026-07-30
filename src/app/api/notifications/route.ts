import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/notifications — Get current user's notifications
 * Uses Message model with SYSTEM_INFO type as lightweight notification
 * (No separate Notification model needed - reuses existing schema)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const cursor = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 50);

    // Get system notifications + unread messages count
    const [notifications, unreadCount, unreadMessages] = await Promise.all([
      prisma.message.findMany({
        where: {
          receiverId: session.user.id,
          type: 'SYSTEM_INFO',
        },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
          offer: {
            select: {
              id: true,
              offeredPrice: true,
              status: true,
              product: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.message.count({
        where: {
          receiverId: session.user.id,
          type: 'SYSTEM_INFO',
          isRead: false,
        },
      }),
      prisma.message.count({
        where: {
          receiverId: session.user.id,
          isRead: false,
          type: { not: 'SYSTEM_INFO' },
        },
      }),
    ]);

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return ApiResponse.success({
      notifications: items,
      nextCursor,
      unreadNotifications: unreadCount,
      unreadMessages,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * PUT /api/notifications — Mark notifications as read
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    if (body.markAllRead) {
      // Mark all system notifications as read
      const result = await prisma.message.updateMany({
        where: {
          receiverId: session.user.id,
          type: 'SYSTEM_INFO',
          isRead: false,
        },
        data: { isRead: true },
      });

      return ApiResponse.success({ markedAsRead: result.count });
    }

    if (body.ids && Array.isArray(body.ids)) {
      // Mark specific notifications as read
      const result = await prisma.message.updateMany({
        where: {
          id: { in: body.ids },
          receiverId: session.user.id,
          type: 'SYSTEM_INFO',
        },
        data: { isRead: true },
      });

      return ApiResponse.success({ markedAsRead: result.count });
    }

    return ApiResponse.error('Ungültige Anfrage.');
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
