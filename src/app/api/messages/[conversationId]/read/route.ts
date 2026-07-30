import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

type Params = { params: Promise<{ conversationId: string }> };

/**
 * POST /api/messages/[conversationId]/read — Mark all messages from partner as read
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { conversationId: partnerId } = await params;

    const result = await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: session.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return ApiResponse.success({ markedAsRead: result.count });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
