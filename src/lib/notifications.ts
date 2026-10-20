import prisma from '@/lib/db';
import { CHANNELS, EVENTS, triggerEvent } from '@/lib/pusher';
import { sendEmail, noticeEmail } from '@/lib/email';
import { wantsNotification, type NotificationCategory } from '@/config/notification-policy';

type NotificationInput = {
  senderId: string;
  receiverId: string;
  content: string;
  offerId?: string | null;
  /** Preference bucket; defaults to 'orders' (always delivered). */
  category?: NotificationCategory;
  /**
   * Optional e-mail twin of the in-app notice. Sent only if the receiver's
   * preferences allow e-mail for this category (locked categories always send).
   */
  email?: {
    subject: string;
    title: string;
    intro?: string;
    lines?: string[];
    ctaLabel?: string;
    ctaPath?: string;
  };
};

const notificationInclude = {
  sender: { select: { id: true, name: true, avatar: true } },
  offer: {
    select: {
      id: true,
      offeredPrice: true,
      status: true,
      product: { select: { id: true, title: true } },
    },
  },
} as const;

/**
 * In-app notification (+ optional e-mail), honouring the receiver's preferences.
 * Notifications are Message rows of type SYSTEM_INFO: they show in the bell and,
 * for the receiver only, inside the chat with the counterpart.
 */
export async function createSystemNotification(input: NotificationInput) {
  const category = input.category ?? 'orders';
  const receiver = await prisma.user.findUnique({
    where: { id: input.receiverId },
    select: { email: true, name: true, notificationPrefs: true },
  });
  if (!receiver) return null;

  let notification = null;
  if (wantsNotification(receiver.notificationPrefs, category, 'inApp')) {
    notification = await prisma.message.create({
      data: {
        content: input.content,
        type: 'SYSTEM_INFO',
        senderId: input.senderId,
        receiverId: input.receiverId,
        offerId: input.offerId || null,
      },
      include: notificationInclude,
    });

    await triggerEvent(CHANNELS.user(input.receiverId), EVENTS.NOTIFICATION, {
      id: notification.id,
      content: notification.content,
      createdAt: notification.createdAt,
      isRead: notification.isRead,
      sender: notification.sender,
      offer: notification.offer,
    });
  }

  if (input.email && receiver.email && wantsNotification(receiver.notificationPrefs, category, 'email')) {
    const greeting = receiver.name?.trim() ? `Hallo ${receiver.name.trim()},` : 'Hallo,';
    await sendEmail(
      noticeEmail({
        to: receiver.email,
        subject: input.email.subject,
        title: input.email.title,
        intro: `${greeting} ${input.email.intro || input.content}`,
        lines: input.email.lines,
        ctaLabel: input.email.ctaLabel,
        ctaPath: input.email.ctaPath,
      }),
    );
  }

  await relayToPersonaManagerIfNeeded(input);

  return notification;
}

/**
 * Persona (pool) seller accounts have no independent inbox anyone actually
 * reads. Whenever a persona receives a real notification, mirror it, in real
 * time, to the real human who manages that persona so nothing is missed -
 * see src/lib/persona-auth.ts and /admin/personas/[id]/inbox. This never
 * generates a reply on the persona's behalf, it only surfaces the event.
 *
 * The copy is a PERSONA_RELAY message: bell only, never a chat thread. It used
 * to be a SYSTEM_INFO row from the persona, so it showed up as a normal
 * conversation - a reply typed there went to the persona itself, was relayed
 * again and echoed back, while the buyer got nothing.
 */
export async function relayToPersonaManagerIfNeeded(input: NotificationInput) {
  const receiver = await prisma.user.findUnique({
    where: { id: input.receiverId },
    select: { name: true, isPersonaAccount: true, managedByUserId: true },
  });

  if (!receiver?.isPersonaAccount || !receiver.managedByUserId) return;
  if (receiver.managedByUserId === input.senderId) return; // the manager's own action

  const manager = await prisma.user.findUnique({
    where: { id: receiver.managedByUserId },
    select: { isPersonaAccount: true },
  });
  if (manager?.isPersonaAccount) return; // defensive: never relay through a persona

  const personaLabel = receiver.name || 'Persona-Konto';
  const relay = await prisma.message.create({
    data: {
      content: `[${personaLabel}] ${input.content}`,
      type: 'PERSONA_RELAY',
      senderId: input.receiverId,
      receiverId: receiver.managedByUserId,
      offerId: input.offerId || null,
    },
    include: notificationInclude,
  });

  await triggerEvent(CHANNELS.user(receiver.managedByUserId), EVENTS.NOTIFICATION, {
    id: relay.id,
    content: relay.content,
    createdAt: relay.createdAt,
    isRead: relay.isRead,
    sender: relay.sender,
    offer: relay.offer,
    personaId: input.receiverId,
  });
}

export async function createSystemNotifications(inputs: NotificationInput[]) {
  const results = [];
  for (const input of inputs) {
    try {
      results.push(await createSystemNotification(input));
    } catch (error) {
      // one failing receiver must not swallow the notices for everybody else
      console.error('createSystemNotification failed:', error);
    }
  }
  return results;
}

export type { NotificationInput };
