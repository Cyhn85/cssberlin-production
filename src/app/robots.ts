import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/checkout/', '/settings/'],
        },
        sitemap: 'https://cssberlin.de/sitemap.xml',
    };
}
