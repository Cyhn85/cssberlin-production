import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { getPusher } from '@/lib/pusher';
import {
  getOrderIdFromChannel,
  isAuthorizedConversationChannel,
  isAuthorizedUserChannel,
} from '@/lib/realtime';

async function canAccessOrderChannel(channelName: string, userId: string) {
  const orderId = getOrderIdFromChannel(channelName);
  if (!orderId) {
    return false;
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    select: { id: true },
  });

  return !!order;
}

// Lets a persona's real manager subscribe to that persona's own private
// channel, so relayed messages/offers reach /admin/personas/[id]/inbox live.
async function canAccessPersonaChannel(channelName: string, userId: string) {
  const prefix = 'private-user-';
  if (!channelName.startsWith(prefix)) return false;

  const targetId = channelName.slice(prefix.length);
  if (targetId === userId) return false; // already covered by isAuthorizedUserChannel

  const persona = await prisma.user.findUnique({
    where: { id: targetId },
    select: { isPersonaAccount: true, managedByUserId: true },
  });

  return !!persona?.isPersonaAccount && persona.managedByUserId === userId;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const formData = await request.formData();

    const socketId = formData.get('socket_id');
    const channelName = formData.get('channel_name');

    if (typeof socketId !== 'string' || typeof channelName !== 'string') {
      return ApiResponse.validationError('Ungueltige Realtime-Anfrage.');
    }

    const isAuthorized =
      isAuthorizedUserChannel(channelName, session.user.id) ||
      isAuthorizedConversationChannel(channelName, session.user.id) ||
      (await canAccessOrderChannel(channelName, session.user.id)) ||
      (await canAccessPersonaChannel(channelName, session.user.id));

    if (!isAuthorized) {
      return ApiResponse.forbidden('Dieser Realtime-Kanal ist nicht fuer dich freigegeben.');
    }

    const pusher = await getPusher();
    if (!pusher) {
      return ApiResponse.error('Realtime ist aktuell nicht konfiguriert.', 503);
    }

    const authResponse = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/pusher/auth error:', error);
    return ApiResponse.serverError();
  }
}