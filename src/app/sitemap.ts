import { MetadataRoute } from 'next';
import prisma from '@/lib/db';
import { HELP_ARTICLES } from '@/content/help';

// Saatte bir yeniden üret (ISR) — yeni ürünler otomatik sitemap'e girer.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://cssberlin.de';

    // Only public, indexable pages. /eco-impact (login) and /login, /register are out.
    const LEGAL = ['/impressum', '/datenschutz', '/agb', '/widerruf', '/dac7'];
    const staticRoutes: MetadataRoute.Sitemap = [
        { route: '', freq: 'daily' as const, priority: 1 },
        { route: '/catalog', freq: 'daily' as const, priority: 0.9 },
        { route: '/sale', freq: 'daily' as const, priority: 0.8 },
        { route: '/ueber-uns', freq: 'monthly' as const, priority: 0.5 },
        { route: '/hilfe', freq: 'weekly' as const, priority: 0.6 },
        { route: '/kontakt', freq: 'yearly' as const, priority: 0.3 },
        ...HELP_ARTICLES.map((a) => ({ route: `/hilfe/${a.slug}`, freq: 'monthly' as const, priority: 0.5 })),
        ...LEGAL.map((route) => ({ route, freq: 'yearly' as const, priority: 0.2 })),
    ].map(({ route, freq, priority }) => ({ url: `${baseUrl}${route}`, changeFrequency: freq, priority }));

    // Tüm AKTİF ürünler sitemap'e girer -> Google ürün sayfalarını keşfeder.
    // DB build sırasında erişilemezse (try/catch) en azından statik rotalar döner,
    // sitemap/build kırılmaz.
    let productRoutes: MetadataRoute.Sitemap = [];
    try {
        const products = await prisma.product.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 5000,
        });
        productRoutes = products.map((p) => ({
            url: `${baseUrl}/product/${p.id}`,
            lastModified: p.updatedAt.toISOString(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        }));
    } catch {
        // sessiz düş: statik rotalar yeterli, build/SEO kırılmasın
    }

    // Public seller pages with at least one active listing
    let sellerRoutes: MetadataRoute.Sitemap = [];
    try {
        const sellers = await prisma.user.findMany({
            where: { isSuspended: false, products: { some: { status: 'ACTIVE' } } },
            select: { id: true, updatedAt: true },
            take: 2000,
        });
        sellerRoutes = sellers.map((u) => ({ url: `${baseUrl}/profile/${u.id}`, lastModified: u.updatedAt.toISOString(), changeFrequency: 'weekly' as const, priority: 0.4 }));
    } catch {
        // build without database
    }

    return [...staticRoutes, ...productRoutes, ...sellerRoutes];
}
