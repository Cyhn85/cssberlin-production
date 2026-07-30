import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://cssberlin.de';

    const routes = [
        '',
        '/catalog',
        '/impressum',
        '/datenschutz',
        '/agb',
        '/widerruf',
        '/dac7',
        '/login',
        '/register'
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // Note: In a real app, I'd fetch all product IDs and add them here too
    // For now, these are the core architectural pages.

    return [...routes];
}
