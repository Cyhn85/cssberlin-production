'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Leaf, Loader2 } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import { useProgressiveLoad } from '@/lib/hooks/useProgressiveLoad';

type ProductCardData = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  brand: string | null;
  size: string | null;
  condition: string;
  likes: number;
  ecoCO2Saved: number;
  images: Array<{ url: string }>;
  seller: { name: string | null };
};

export type HomeInitial = { items: ProductCardData[]; hasMore: boolean; nextCursor: string | null } | null;

/**
 * The first 12 products now arrive in the server-rendered HTML (see page.tsx):
 * no client fetch waterfall before anything is visible, and crawlers see real
 * products. Further pages still load on scroll. The framer-motion stagger is
 * gone - a CSS fade does the same without shipping the library on the homepage.
 */
export default function HomePageClient({ initial = null }: { initial?: HomeInitial }) {
  const [featuredProducts, setFeaturedProducts] = useState<ProductCardData[]>(initial?.items ?? []);
  const [isDegraded, setIsDegraded] = useState(false);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [nextCursor, setNextCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;

    const load = async () => {
      try {
        const productsResponse = await fetch('/api/products?sort=popular&limit=12');
        const productsResult = await productsResponse.json();

        if (cancelled) return;

        if (productsResult.success) {
          setFeaturedProducts(productsResult.data.items || []);
          setHasMore(Boolean(productsResult.data.hasMore));
          setNextCursor(productsResult.data.nextCursor || null);
        }

        setIsDegraded(Boolean(productsResult.data?.degraded));
      } catch {
        // network errors leave featuredProducts empty; the empty-state below covers this
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [initial]);

  const loadMoreFeatured = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/products?sort=popular&limit=12&cursor=${encodeURIComponent(nextCursor)}`);
      const result = await response.json();
      if (result.success) {
        setFeaturedProducts((current) => [...current, ...(result.data.items || [])]);
        setHasMore(Boolean(result.data.hasMore));
        setNextCursor(result.data.nextCursor || null);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const { sentinelRef, showManualButton } = useProgressiveLoad({ hasMore, loading: loadingMore, onLoadMore: loadMoreFeatured });

  return (
    <div className="pt-0">
      <section className="py-12" style={{ background: 'var(--color-bg-secondary)' }}>
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                Neu im Feed
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Frisch eingestellt von Verkäufern aus deiner Stadt.
              </p>
            </div>
            <Link href="/catalog" className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {featuredProducts.map((product, i) => (
                <div key={product.id} className="animate-[fadeUp_.45s_ease-out_both]" style={{ animationDelay: `${Math.min(i, 11) * 40}ms` }}>
                  <ProductCard product={product} showSeller />
                </div>
              ))}
            </div>
          ) : null}

          {featuredProducts.length > 0 && hasMore ? <div ref={sentinelRef} aria-hidden className="h-1" /> : null}

          {showManualButton ? (
            <div className="mt-8 text-center">
              <button
                onClick={loadMoreFeatured}
                disabled={loadingMore}
                className="btn-mars-earth rounded-full px-6 py-3 font-bold text-white"
                style={{ background: 'var(--color-orange)' }}
              >
                <span>{loadingMore ? 'Mehr wird geladen...' : 'Weitere Artikel laden'}</span>
              </button>
            </div>
          ) : hasMore && loadingMore ? (
            <div className="mt-8 text-center">
              <Loader2 size={22} className="mx-auto animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : null}

          {featuredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <Leaf size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {isDegraded
                  ? 'Der Live-Katalog synchronisiert gerade. Bitte lade die Seite in ein paar Sekunden erneut.'
                  : 'Noch keine aktiven Produkte vorhanden.'}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="hero-banner-gradient py-16">
        <div className="container text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
            Bereit für deinen ersten Verkauf?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-lg text-white/80">
            Lade Fotos hoch, beschreibe deinen Artikel und dein Inserat ist in wenigen Minuten live.
          </p>
          {/* Not the `glow` Button variant: that variant paints
              bg-background, which would turn the page's single conversion CTA
              into a pale ghost on a coloured band. It keeps its solid fill and
              takes only the halo, from the same token the variant uses. */}
          <Link
            href="/upload"
            className="inline-flex min-h-[44px] items-center rounded-full bg-white px-8 py-4 text-lg font-bold transition-shadow hover:shadow-[0_0_24px_var(--color-orange-glow)]"
            style={{ color: 'var(--color-orange-dark)' }}
          >
            Jetzt verkaufen
          </Link>
        </div>
      </section>
    </div>
  );
}
