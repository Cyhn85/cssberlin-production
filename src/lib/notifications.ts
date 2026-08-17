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

  await relayToPersonaManagerIfNeeded(input);

  return notification;
}

/**
 * Persona (pool) seller accounts have no independent inbox anyone actually
 * reads. Whenever a persona receives a real notification, mirror it, in real
 * time, to the real human who manages that persona so nothing is missed —
 * see src/lib/persona-auth.ts and /admin/personas/[id]/inbox. This never
 * generates a reply on the persona's behalf, it only surfaces the event.
 */
export async function relayToPersonaManagerIfNeeded(input: NotificationInput) {
  const receiver = await prisma.user.findUnique({
    where: { id: input.receiverId },
    select: { name: true, isPersonaAccount: true, managedByUserId: true },
  });

  if (!receiver?.isPersonaAccount || !receiver.managedByUserId) return;

  const manager = await prisma.user.findUnique({
    where: { id: receiver.managedByUserId },
    select: { isPersonaAccount: true },
  });
  if (manager?.isPersonaAccount) return; // defensive: never relay through a persona

  const personaLabel = receiver.name || 'Persona-Konto';
  const relay = await prisma.message.create({
    data: {
      content: `[${personaLabel}] ${input.content}`,
      type: 'SYSTEM_INFO',
      senderId: input.receiverId,
      receiverId: receiver.managedByUserId,
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

  await triggerEvent(CHANNELS.user(receiver.managedByUserId), EVENTS.NOTIFICATION, {
    id: relay.id,
    content: relay.content,
    createdAt: relay.createdAt,
    isRead: relay.isRead,
    sender: relay.sender,
    offer: relay.offer,
  });
}

export async function createSystemNotifications(inputs: NotificationInput[]) {
  const results = [];
  for (const input of inputs) {
    results.push(await createSystemNotification(input));
  }
  return results;
}