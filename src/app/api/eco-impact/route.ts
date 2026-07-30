import prisma from '@/lib/db';
import { getOptionalSession } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { calculateUserEcoImpact, getMonthlyTrend } from '@/lib/eco-calculator';

const levelEmojiByBadge: Record<string, string> = {
  champion: '🌍',
  hero: '🌿',
  pro: '♻️',
  starter: '🍃',
  explorer: '🌱',
  newbie: '✨',
};

/**
 * GET /api/eco-impact - Community-wide eco stats are public (used by the
 * homepage ticker); personal impact is included only for signed-in users.
 */
export async function GET() {
  try {
    const session = await getOptionalSession();

    const communityStats = await prisma.user.aggregate({
      _sum: { ecoCO2Saved: true, itemsRecycled: true },
      _count: true,
    });

    const community = {
      totalUsers: communityStats._count,
      totalCO2Saved: Math.round((communityStats._sum.ecoCO2Saved || 0) * 10) / 10,
      totalItemsRecycled: communityStats._sum.itemsRecycled || 0,
    };

    if (!session?.user?.id) {
      return ApiResponse.success({ personal: null, monthlyTrend: [], community });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        ecoCO2Saved: true,
        itemsRecycled: true,
      },
    });

    if (!user) return ApiResponse.notFound();

    const completedOrders = await prisma.order.findMany({
      where: {
        buyerId: session.user.id,
        status: 'COMPLETED',
      },
      select: {
        createdAt: true,
        product: { select: { ecoCO2Saved: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const impact = calculateUserEcoImpact(user.ecoCO2Saved, user.itemsRecycled);
    const monthlyTrend = getMonthlyTrend(completedOrders).map((entry) => ({
      month: entry.month,
      co2Saved: entry.co2Saved,
      items: entry.items,
    }));

    return ApiResponse.success({
      personal: {
        co2Saved: impact.co2Saved,
        waterSaved: impact.waterSaved,
        itemsRecycled: impact.itemsRecycled,
        level: impact.level,
        levelEmoji: levelEmojiByBadge[impact.badge] || '🌱',
        badge: impact.badge,
        equivalents: {
          carKm: impact.carKmEquivalent,
          flights: impact.flightsEquivalent,
          treesPerYear: impact.treesEquivalent,
          showers: Math.round(impact.waterSaved / 65),
        },
      },
      monthlyTrend,
      community,
    });
  } catch {
    return ApiResponse.serverError();
  }
}
