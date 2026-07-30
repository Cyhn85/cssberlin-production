import prisma from '@/lib/db';
import { CHANNELS, EVENTS, triggerEvent } from '@/lib/pusher';

type NotificationInput = {
  senderId: string;
  receiverId: string;
  content: string;
  offerId?: string | null;
};

export async function createSystemNotification(input: NotificationInput) {
  const notification = await prisma.message.create({
    data: {
      content: input.content,
      type: 'SYSTEM_INFO',
      senderId: input.senderId,
      receiverId: input.receiverId,
      offerId: input.offerId || null,
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
  });

  await triggerEvent(CHANNELS.user(input.receiverId), EVENTS.NOTIFICATION, {
    id: notification.id,
    content: notification.content,
    createdAt: notification.createdAt,
    isRead: notification.isRead,
    sender: notification.sender,
    offer: notification.offer,
  });

  return notification;
}

export async function createSystemNotifications(inputs: NotificationInput[]) {
  const results = [];
  for (const input of inputs) {
    results.push(await createSystemNotification(input));
  }
  return results;
}