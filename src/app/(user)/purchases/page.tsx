'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PackageSearch, RefreshCcw } from 'lucide-react';
import { formatPrice, orderStatusToLabel } from '@/lib/utils/condition-map';

type Purchase = {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  product: { title: string; images: Array<{ url: string }> };
  seller: { name: string | null };
  review?: { id: string } | null;
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/orders');
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Bestellungen konnten nicht geladen werden.');
        }

        if (!cancelled) {
          setPurchases(result.data.purchases || []);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError.message || 'Bestellungen konnten nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Meine Kaeufe
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Alle Bestellungen aus deinem Kaufkonto auf einen Blick.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <RefreshCcw size={16} /> Aktualisieren
            </button>
            <Link href="/catalog" style={{ color: 'var(--color-primary)' }}>Weiter stoebern</Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <Loader2 size={30} className="mx-auto mb-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Bestellungen werden geladen...</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : purchases.length > 0 ? (
          <div className="space-y-4">
            {purchases.map((purchase) => {
              const imageUrl = purchase.product.images[0]?.url || '';
              const statusLabel = orderStatusToLabel[purchase.status] || purchase.status;

              return (
                <div
                  key={purchase.id}
                  className="flex flex-col gap-4 rounded-3xl border p-5 md:flex-row md:items-center md:justify-between"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
                      {imageUrl ? (
                        <img src={imageUrl} alt={purchase.product.title} className="h-full w-full object-cover" />
                      ) : (
                        <PackageSearch size={24} style={{ color: 'var(--color-primary)', opacity: 0.3 }} />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{purchase.product.title}</p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Verkaeufer: {purchase.seller.name || 'cssberlin member'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(purchase.createdAt).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(purchase.totalAmount)}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{statusLabel}</p>
                    <Link href={`/purchases/${purchase.id}`} className="mt-3 inline-flex rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                      Details ansehen
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <PackageSearch size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Noch keine Kaeufe vorhanden.</p>
          </div>
        )}
      </div>
    </div>
  );
}