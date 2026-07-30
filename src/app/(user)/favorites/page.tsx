'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Loader2, Search, Tag } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';

const ACTIVE_OFFER_STATUSES = new Set(['PENDING', 'COUNTERED']);

type FavoriteProduct = {
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
  seller?: { name?: string | null };
};

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [negotiatingProductIds, setNegotiatingProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [favoritesResponse, offersResponse] = await Promise.all([
          fetch('/api/favorites'),
          fetch('/api/offers'),
        ]);

        if (favoritesResponse.status === 401) {
          router.replace('/login?callbackUrl=/favorites');
          return;
        }

        const result = await favoritesResponse.json();
        if (!cancelled && result.success) {
          setFavorites(result.data || []);
        }

        if (!cancelled && offersResponse.ok) {
          const offersResult = await offersResponse.json();
          if (offersResult.success) {
            const allOffers = [...(offersResult.data.sent || []), ...(offersResult.data.received || [])];
            const activeProductIds = allOffers
              .filter((offer: { status: string }) => ACTIVE_OFFER_STATUSES.has(offer.status))
              .map((offer: { productId: string }) => offer.productId);
            setNegotiatingProductIds(new Set(activeProductIds));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-6xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>Meine Favoriten</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Deine gemerkten Artikel auf einen Blick.
            </p>
          </div>
          <Link href="/catalog" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
            Weiter stoebern
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {favorites.map((product) => (
              <div key={product.id} className="relative">
                {negotiatingProductIds.has(product.id) ? (
                  <Link
                    href="/offers"
                    className="btn-mars-earth absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                  >
                    <Tag size={12} /> Pazarlık sürüyor
                  </Link>
                ) : null}
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
              <Heart size={24} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Noch keine Favoriten</h2>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Speichere interessante Artikel mit dem Herz, damit du sie spaeter schnell wiederfindest.
            </p>
            <Link href="/catalog" className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white" style={{ background: 'var(--color-primary)' }}>
              <Search size={16} /> Zum Katalog
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
