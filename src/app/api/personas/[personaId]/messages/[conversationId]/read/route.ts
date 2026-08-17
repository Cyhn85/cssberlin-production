import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { requireManagedPersona } from '@/lib/persona-auth';

type Params = { params: Promise<{ personaId: string; conversationId: string }> };

/**
 * POST /api/personas/[personaId]/messages/[conversationId]/read - Mark all
 * messages from partner as read for a persona, mirroring
 * /api/messages/[conversationId]/read.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { personaId, conversationId: partnerId } = await params;

    const persona = await requireManagedPersona(session.user.id, personaId);
    if (!persona) return ApiResponse.forbidden('Dieses Profil wird nicht von dir verwaltet.');

    const result = await prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: personaId, isRead: false },
      data: { isRead: true },
    });

    return ApiResponse.success({ markedAsRead: result.count });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
