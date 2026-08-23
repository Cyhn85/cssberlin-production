'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '@/store/useCart';
import { formatPrice, getConditionLabel } from '@/lib/utils/condition-map';

/**
 * The header's cart icon has always pointed at /cart, and /cart has never
 * existed - every click produced a 404 (visible in production logs as
 * `GET /cart?_rsc=... 404`). Checkout itself is per product (/checkout/[id]),
 * so this page is the missing shelf in between: it resolves the ids the cart
 * store keeps in localStorage into real products and hands each one to the
 * checkout it already has.
 *
 * Deliberately NOT a multi-item basket. Every item here is a single second-hand
 * piece from a different seller with its own shipping; one combined payment
 * would need order splitting, per-seller shipping and per-seller payouts that
 * the Order model does not carry. Promising "one checkout" in the UI before the
 * backend can settle it is how you end up refunding by hand.
 */

type CartProduct = {
  id: string;
  title: string;
  price: number;
  brand: string | null;
  size: string | null;
  condition: string;
  status: string;
  images: Array<{ url: string; thumbUrl?: string | null }>;
  seller?: { name?: string | null } | null;
};

export default function CartPage() {
  const { cartItems, toggleCart, isLoaded } = useCart();
  const [products, setProducts] = useState<CartProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    const load = async () => {
      if (cartItems.length === 0) {
        if (!cancelled) {
          setProducts([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      // There is no bulk `?ids=` filter on /api/products, and a cart holds a
      // handful of items, so one request each is cheaper than adding an
      // endpoint. A product that 404s (deleted or hidden meanwhile) is dropped
      // rather than shown as a broken row.
      const results = await Promise.all(
        cartItems.map(async (id) => {
          try {
            const res = await fetch(`/api/products/${id}`);
            if (!res.ok) return null;
            const json = await res.json();
            return json?.success ? (json.data as CartProduct) : null;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setProducts(results.filter((p): p is CartProduct => p !== null));
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [cartItems, isLoaded]);

  const total = products.reduce((sum, p) => sum + p.price, 0);

  return (
    <main className="container py-10">
      <h1 className="mb-2 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
        Warenkorb
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Jedes Stück ist ein Einzelstück und wird einzeln bezahlt und versendet.
      </p>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <Loader2 size={18} className="animate-spin" /> Warenkorb wird geladen …
        </div>
      ) : products.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <ShoppingCart
            size={40}
            className="mx-auto mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Dein Warenkorb ist leer
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Stöbere im Katalog und finde dein nächstes Lieblingsstück.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 text-sm font-bold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            Zum Katalog
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {products.map((product) => {
              const image = product.images?.[0];
              const available = product.status === 'ACTIVE';

              return (
                <li
                  key={product.id}
                  className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <Link
                    href={`/product/${product.id}`}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-xl"
                    style={{ background: 'var(--color-bg-secondary)' }}
                  >
                    {image ? (
                      <img
                        src={image.thumbUrl ?? image.url}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${product.id}`}>
                      <h2
                        className="line-clamp-1 font-semibold"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {product.title}
                      </h2>
                    </Link>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {[product.brand, product.size, getConditionLabel(product.condition)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="mt-1 font-bold" style={{ color: 'var(--color-primary)' }}>
                      {formatPrice(product.price)}
                    </p>
                    {!available ? (
                      <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--color-orange-dark)' }}>
                        Dieser Artikel ist nicht mehr verfügbar.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {available ? (
                      <Link
                        href={`/checkout/${product.id}`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 text-sm font-bold text-white"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        Zur Kasse
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleCart(product.id)}
                      aria-label={`${product.title} aus dem Warenkorb entfernen`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border transition-colors"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className="mt-8 flex items-center justify-between rounded-2xl border p-5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Summe aller Artikel (ohne Versand)
            </span>
            <span className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {formatPrice(total)}
            </span>
          </div>
        </>
      )}
    </main>
  );
}
