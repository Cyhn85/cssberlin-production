import { MetadataRoute } from 'next';
import prisma from '@/lib/db';

// Saatte bir yeniden üret (ISR) — yeni ürünler otomatik sitemap'e girer.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://cssberlin.de';

    const staticRoutes: MetadataRoute.Sitemap = [
        '',
        '/catalog',
        '/ueber-uns',
        '/eco-impact',
        '/impressum',
        '/datenschutz',
        '/agb',
        '/widerruf',
        '/dac7',
        '/login',
        '/register',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.7,
    }));

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

    return [...staticRoutes, ...productRoutes];
}
