import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'cssberlin.de - Nachhaltiger Marktplatz',
    short_name: 'cssberlin',
    description: 'Dein Second-Hand Marktplatz fuer Berlin.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#E8651A',
    icons: [
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}