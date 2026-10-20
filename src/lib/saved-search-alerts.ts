import prisma from '@/lib/db';
import { buildCatalogWhere } from '@/lib/catalog-filter';
import { createSystemNotification } from '@/lib/notifications';
import { ms } from '@/config/marketplace-policy';

/** At most one alert per saved search per day. */
const ALERT_INTERVAL_MS = ms.DAY;
export const MAX_SAVED_SEARCHES = 20;

/**
 * Daily "new items for your saved search" notices (Vinted/Kleinanzeigen feature).
 * Runs from the hourly lifecycle cron; each search is only looked at once its
 * last alert is a day old, and lastNotifiedAt moves forward even when nothing
 * matched, so the next run only counts items listed after it.
 */
export async function runSavedSearchAlerts(now = new Date()) {
  const due = await prisma.savedSearch.findMany({
    where: { lastNotifiedAt: { lte: new Date(now.getTime() - ALERT_INTERVAL_MS) } },
    take: 500,
    select: { id: true, userId: true, label: true, query: true, lastNotifiedAt: true },
  });
  let alerts = 0;
  for (const s of due) {
    try {
      const where = buildCatalogWhere(new URLSearchParams(s.query));
      const count = await prisma.product.count({
        where: { ...where, status: 'ACTIVE', sellerId: { not: s.userId }, createdAt: { gt: s.lastNotifiedAt } },
      });
      await prisma.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: now } });
      if (count === 0) continue;
      alerts++;
      await createSystemNotification({
        senderId: s.userId,
        receiverId: s.userId,
        category: 'savedSearches',
        content: `${count} neue${count === 1 ? 'r' : ''} Artikel für deine Suche „${s.label}“.`,
        email: {
          subject: `${count} neue Artikel: ${s.label}`,
          title: 'Neu für deine gespeicherte Suche',
          lines: [`Suche: ${s.label}`, `${count} neue Artikel seit gestern.`],
          ctaLabel: 'Jetzt ansehen',
          ctaPath: `/catalog?${s.query}`,
        },
      });
    } catch (e) {
      console.error('saved search alert failed', s.id, e);
    }
  }
  return { checked: due.length, alerts };
}
