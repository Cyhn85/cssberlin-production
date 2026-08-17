import type { Metadata } from 'next';
import ConditionalChrome from '@/components/layout/ConditionalChrome';
import AuthProvider from '@/components/providers/AuthProvider';
import CookieBanner from '@/components/ui/CookieBanner';
import AiAssistant from '@/components/ai/AiAssistant';
import ScrollToTop from '@/components/ui/ScrollToTop';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: 'cssberlin.de - Dein smarter Second-Hand Marktplatz',
    template: '%s | cssberlin.de',
  },
  description:
    'Nachhaltig kaufen und verkaufen in Berlin. Spare CO2, entdecke Vintage-Schaetze und profitiere von unserem sicheren Kaeuferschutz.',
  keywords: ['Second Hand Berlin', 'Vintage Kleidung', 'Nachhaltigkeit', 'Gebraucht kaufen', 'Flohmarkt online', 'Kaeuferschutz', 'CO2 sparen'],
  authors: [{ name: 'cssberlin Team' }],
  creator: 'cssberlin',
  metadataBase: new URL('https://cssberlin.de'),
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: 'https://cssberlin.de',
    siteName: 'cssberlin.de',
    title: 'cssberlin.de - Nachhaltiger Marktplatz',
    description: 'Dein smarter Second-Hand Marktplatz fuer Mode, Elektronik und mehr.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'cssberlin.de - Nachhaltig shoppen',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'cssberlin.de - Gebraucht kaufen und CO2 sparen',
    description: 'Marktplatz fuer nachhaltigen Konsum in Berlin.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: ['/favicon-32x32.png'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#E8651A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="antialiased" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Site-geneli yapisal veri: OnlineStore + arama aksiyonu (sitelinks searchbox) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'OnlineStore',
              name: 'cssberlin.de',
              url: 'https://cssberlin.de',
              logo: 'https://cssberlin.de/icon-512.png',
              description:
                'Nachhaltiger Second-Hand Marktplatz in Berlin. Gebraucht kaufen und verkaufen, CO2 sparen, mit Kaeuferschutz.',
              areaServed: { '@type': 'Country', name: 'Deutschland' },
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://cssberlin.de/catalog?search={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <AuthProvider>
          <ConditionalChrome>{children}</ConditionalChrome>
          <CookieBanner />
          <AiAssistant />
          <ScrollToTop />
        </AuthProvider>
      </body>
    </html>
  );
}