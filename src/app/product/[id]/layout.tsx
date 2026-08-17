import type { Metadata } from 'next';
import { cache } from 'react';
import prisma from '@/lib/db';

const BASE = 'https://cssberlin.de';

// React cache: generateMetadata + layout ayni istekte tek DB sorgusu yapar.
const getProduct = cache(async (id: string) => {
  try {
    return await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        brand: true,
        condition: true,
        status: true,
        images: { select: { url: true }, orderBy: { orderIndex: 'asc' }, take: 4 },
        category: { select: { name: true } },
      },
    });
  } catch {
    return null;
  }
});

function abs(url: string): string {
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return { title: 'Artikel' };

  const title = p.brand ? `${p.title} – ${p.brand}` : p.title;
  const desc = (p.description
    || `${p.title} bei cssberlin.de – nachhaltig gebraucht kaufen mit Kaeuferschutz.`).slice(0, 160);
  const img = p.images[0]?.url ? abs(p.images[0].url) : undefined;

  return {
    title,
    description: desc,
    alternates: { canonical: `${BASE}/product/${p.id}` },
    openGraph: {
      type: 'website',
      url: `${BASE}/product/${p.id}`,
      title,
      description: desc,
      images: img ? [{ url: img }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: img ? [img] : undefined,
    },
  };
}

// Urun durumu -> schema.org itemCondition
const CONDITION_SCHEMA: Record<string, string> = {
  NEW: 'https://schema.org/NewCondition',
  LIKE_NEW: 'https://schema.org/NewCondition',
  VERY_GOOD: 'https://schema.org/UsedCondition',
  GOOD: 'https://schema.org/UsedCondition',
  FAIR: 'https://schema.org/UsedCondition',
};

export default async function ProductLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const p = await getProduct(id);

  const jsonLd = p
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.title,
        description: (p.description || p.title).slice(0, 300),
        ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
        image: p.images.map((i) => abs(i.url)),
        itemCondition: CONDITION_SCHEMA[p.condition] || 'https://schema.org/UsedCondition',
        offers: {
          '@type': 'Offer',
          url: `${BASE}/product/${p.id}`,
          priceCurrency: 'EUR',
          price: Number(p.price),
          availability:
            p.status === 'ACTIVE'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
        },
      }
    : null;

  // BreadcrumbList: Ana Sayfa > Katalog > [Kategori] > Urun
  // Google arama sonucunda kirinti (breadcrumb) gosterir, kategori baglamini verir.
  const crumbs: { name: string; url: string }[] = p
    ? [
        { name: 'Startseite', url: BASE },
        { name: 'Katalog', url: `${BASE}/catalog` },
        ...(p.category?.name
          ? [
              {
                name: p.category.name,
                url: `${BASE}/catalog?category=${encodeURIComponent(p.category.name)}`,
              },
            ]
          : []),
        { name: p.title, url: `${BASE}/product/${p.id}` },
      ]
    : [];

  const breadcrumbLd =
    crumbs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: c.url,
          })),
        }
      : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumbLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
      )}
      {children}
    </>
  );
}
