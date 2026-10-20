import prisma from '@/lib/db';
import HomePageClient, { type HomeInitial } from './HomePageClient';

/**
 * Homepage, server-rendered with a 60 s ISR window.
 *
 * It used to be force-dynamic AND fetch its products on the client, so the HTML
 * carried no products at all (slow LCP, nothing for crawlers) while still
 * paying for a dynamic render. The original reason for force-dynamic was a
 * year-long s-maxage cache serving stale HTML; revalidate = 60 keeps the page
 * at most a minute old instead.
 */
export const revalidate = 60;

const PAGE = 12;

async function loadInitial(): Promise<HomeInitial> {
  try {
    const rows = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ likes: 'desc' }, { views: 'desc' }, { createdAt: 'desc' }],
      take: PAGE + 1,
      select: {
        id: true, title: true, price: true, originalPrice: true, brand: true, size: true, condition: true,
        likes: true, ecoCO2Saved: true, status: true,
        images: { orderBy: { orderIndex: 'asc' }, take: 1, select: { url: true, thumbUrl: true, mediumUrl: true } },
        seller: { select: { name: true, avatar: true } },
      },
    });
    const items = rows.slice(0, PAGE);
    return { items: items as any, hasMore: rows.length > PAGE, nextCursor: rows.length > PAGE ? items[items.length - 1].id : null };
  } catch (error) {
    // database blip during build or render: fall back to the client fetch
    console.error('homepage initial products failed', error);
    return null;
  }
}

export default async function HomePage() {
  return <HomePageClient initial={await loadInitial()} />;
}
