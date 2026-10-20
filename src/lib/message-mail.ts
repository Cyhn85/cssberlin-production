import prisma from '@/lib/db';
import { sendEmail, noticeEmail } from '@/lib/email';
import { wantsNotification } from '@/config/notification-policy';

/** Online within this window = sees the message in the app, no mail needed. */
const ONLINE_MS = 5 * 60 * 1000;

/**
 * "Du hast eine neue Nachricht" - like Vinted/Kleinanzeigen, but quiet:
 * only for the FIRST unread message from that sender (a chat of ten messages is
 * one e-mail, not ten), never while the receiver is online, never to persona
 * accounts (their manager gets the relay instead), and only if the receiver
 * allows message e-mails.
 */
export async function mailFirstUnreadMessage(senderId: string, receiverId: string, content: string, senderName: string | null) {
  try {
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { email: true, name: true, notificationPrefs: true, lastSeenAt: true, isPersonaAccount: true },
    });
    if (!receiver?.email || receiver.isPersonaAccount) return;
    if (!wantsNotification(receiver.notificationPrefs, 'messages', 'email')) return;
    if (receiver.lastSeenAt && Date.now() - receiver.lastSeenAt.getTime() < ONLINE_MS) return;

    const unread = await prisma.message.count({
      where: { senderId, receiverId, isRead: false, type: { in: ['TEXT', 'IMAGE', 'OFFER_ACTION'] } },
    });
    if (unread !== 1) return;

    const preview = content.length > 140 ? `${content.slice(0, 140)}…` : content;
    await sendEmail(noticeEmail({
      to: receiver.email,
      subject: `Neue Nachricht von ${senderName || 'einem Mitglied'}`,
      title: 'Du hast eine neue Nachricht',
      intro: `${receiver.name?.trim() ? `Hallo ${receiver.name.trim()},` : 'Hallo,'} ${senderName || 'ein Mitglied'} hat dir geschrieben:`,
      lines: [`„${preview}“`, 'Antworte direkt auf cssberlin.de - so bleibt alles dokumentiert und dein Käuferschutz erhalten.'],
      ctaLabel: 'Antworten',
      ctaPath: `/inbox?with=${encodeURIComponent(senderId)}`,
    }));
  } catch (error) {
    console.error('mailFirstUnreadMessage failed', error);
  }
}
