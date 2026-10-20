import prisma from '@/lib/db';
import { createSystemNotification } from '@/lib/notifications';

/** Ignore cosmetic drops (Vinted shows a price-drop notice only for a noticeable reduction). */
const MIN_DROP_EUR = 1;
const MIN_DROP_RATIO = 0.05;

/**
 * "Preis gesenkt" for everyone who saved the item. Fire-and-forget from the
 * caller's point of view: never throws, a failed notice must not fail the edit.
 */
export async function notifyPriceDrop(productId: string, oldPrice: number, newPrice: number) {
  try {
    const drop = oldPrice - newPrice;
    if (drop < MIN_DROP_EUR || drop / oldPrice < MIN_DROP_RATIO) return 0;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { title: true, sellerId: true, status: true, favorites: { select: { userId: true } } },
    });
    if (!product || product.status !== 'ACTIVE') return 0;
    const pct = Math.round((drop / oldPrice) * 100);
    let sent = 0;
    for (const f of product.favorites) {
      if (f.userId === product.sellerId) continue;
      await createSystemNotification({
        senderId: product.sellerId,
        receiverId: f.userId,
        category: 'favorites',
        content: `Preis gesenkt: ${product.title} jetzt ${newPrice.toFixed(2)} € statt ${oldPrice.toFixed(2)} € (−${pct} %).`,
        email: {
          subject: `Preis gesenkt: ${product.title}`,
          title: 'Ein gemerkter Artikel ist günstiger',
          lines: [`${product.title}`, `Jetzt ${newPrice.toFixed(2)} € statt ${oldPrice.toFixed(2)} €`],
          ctaLabel: 'Artikel ansehen',
          ctaPath: `/product/${productId}`,
        },
      });
      sent++;
    }
    return sent;
  } catch (error) {
    console.error('notifyPriceDrop failed', productId, error);
    return 0;
  }
}

/**
 * "Dein Artikel wurde gemerkt" (Vinted sends the same). At most one notice per
 * item per 24 h - a popular item must not flood the seller's inbox.
 */
const favoriteNoticeInFlight = new Set<string>();

export async function notifyItemFavorited(productId: string, sellerId: string, title: string, totalFavorites: number) {
  // two hearts in the same second both saw "no notice yet" - one per product at a time
  if (favoriteNoticeInFlight.has(productId)) return;
  favoriteNoticeInFlight.add(productId);
  try {
    const prefix = `Dein Artikel „${title}“ wurde gemerkt`;
    const recent = await prisma.message.count({
      where: { receiverId: sellerId, type: 'SYSTEM_INFO', content: { startsWith: prefix }, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    if (recent > 0) return;
    await createSystemNotification({
      senderId: sellerId,
      receiverId: sellerId,
      category: 'listingActivity',
      content: `${prefix} - jetzt ${totalFavorites}× auf Merklisten. Ein kleiner Preisnachlass macht aus Interesse oft einen Verkauf.`,
      email: {
        subject: `Dein Artikel wurde gemerkt: ${title}`,
        title: 'Jemand mag deinen Artikel',
        intro: `„${title}“ steht jetzt ${totalFavorites}× auf Merklisten.`,
        lines: ['Wer einen Artikel merkt, bekommt Bescheid, wenn du den Preis senkst.'],
        ctaLabel: 'Artikel ansehen',
        ctaPath: `/product/${productId}`,
      },
    });
  } catch (error) {
    console.error('notifyItemFavorited failed', error);
  } finally {
    favoriteNoticeInFlight.delete(productId);
  }
}

/** "X folgt dir jetzt" for the followed user. */
export async function notifyNewFollower(followerId: string, followedId: string) {
  try {
    const follower = await prisma.user.findUnique({ where: { id: followerId }, select: { name: true, username: true } });
    await createSystemNotification({
      senderId: followerId,
      receiverId: followedId,
      category: 'followers',
      content: `${follower?.name || follower?.username || 'Ein Mitglied'} folgt dir jetzt.`,
    });
  } catch (error) {
    console.error('notifyNewFollower failed', error);
  }
}
