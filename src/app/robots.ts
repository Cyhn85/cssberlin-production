import { MetadataRoute } from 'next';

/** Private and transactional pages stay out of search results. */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/api/', '/admin', '/checkout/', '/cart', '/settings', '/inbox', '/dashboard',
                '/bestellungen', '/geldbeutel', '/purchases', '/sales', '/offers', '/notifications',
                '/favorites', '/upload', '/eco-impact', '/profile$', '/passwort-', '/verify-request',
            ],
        },
        sitemap: 'https://cssberlin.de/sitemap.xml',
    };
}
