'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, MessageCircle, Package, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '@/store/useCart';
import { formatPrice, getConditionLabel } from '@/lib/utils/condition-map';

/**
 * Cart: every piece is a single second-hand item and is paid per item
 * (/checkout/[id]) - one combined payment would need order splitting and
 * per-seller payouts the Order model does not carry.
 *
 * Grouped by seller (Vinted style), so a seller's bundle discount is visible
 * and the buyer can ask for a package price in the chat.
 * Loaded in ONE request (?ids=); the old per-item /api/products/[id] calls
 * also counted as product views every time the cart was opened.
 */

type Bundle = { isActive: boolean; twoItems: number | null; threeItems: number | null; fiveItems: number | null } | null;
type CartProduct = {
  id: string;
  title: string;
  price: number;
  brand: string | null;
  size: string | null;
  condition: string;
  status: string;
  images: Array<{ url: string; thumbUrl?: string | null }>;
  seller: { id: string; name: string | null; city?: string | null; bundleDiscount?: Bundle };
};

function bundlePercent(b: Bundle | undefined, count: number) {
  if (!b?.isActive || count < 2) return 0;
  if (count >= 5 && b.fiveItems) return b.fiveItems;
  if (count >= 3 && b.threeItems) return b.threeItems;
  return b.twoItems || 0;
}

export default function CartPage() {
  const { cartItems, toggleCart, isLoaded } = useCart();
  const { data: session } = useSession();
  const [products, setProducts] = useState<CartProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      if (cartItems.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/products?ids=${encodeURIComponent(cartItems.slice(0, 50).join(','))}&limit=50`);
        const json = await res.json();
        if (!cancelled) setProducts(json?.success ? json.data.items : []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartItems, isLoaded]);

  const groups = useMemo(() => {
    const map = new Map<string, { seller: CartProduct['seller']; items: CartProduct[] }>();
    for (const p of products) {
      const g = map.get(p.seller.id) ?? { seller: p.seller, items: [] };
      g.items.push(p);
      map.set(p.seller.id, g);
    }
    return [...map.values()];
  }, [products]);

  const available = products.filter((p) => p.status === 'ACTIVE');
  const total = available.reduce((s, p) => s + p.price, 0);

  return (
    <main className="container max-w-4xl py-10">
      <h1 className="mb-2 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Warenkorb</h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Jedes Stück ist ein Einzelstück und wird einzeln bezahlt. {session ? 'Dein Warenkorb ist mit deinem Konto synchronisiert.' : 'Melde dich an, um deinen Warenkorb auf allen Geräten zu behalten.'}
      </p>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}><Loader2 size={18} className="animate-spin" /> Warenkorb wird geladen …</div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <ShoppingCart size={40} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <h2 className="text-xl font-bold">Dein Warenkorb ist leer</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Stöbere im Katalog und finde dein nächstes Lieblingsstück.</p>
          <Link href="/catalog" className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 text-sm font-bold text-white" style={{ background: 'var(--color-primary)' }}>Zum Katalog</Link>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {groups.map(({ seller, items }) => {
              const activeCount = items.filter((i) => i.status === 'ACTIVE').length;
              const pct = bundlePercent(seller.bundleDiscount, activeCount);
              return (
                <section key={seller.id} className="rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                    <Link href={`/profile/${seller.id}`} className="text-sm font-bold hover:underline">{seller.name || 'Verkäufer'}{seller.city ? <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> · {seller.city}</span> : null}</Link>
                    {seller.bundleDiscount?.isActive ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Package size={14} />
                        {pct > 0 ? `Paketrabatt ${pct} % bei ${activeCount} Artikeln möglich` : `Paketrabatt ab 2 Artikeln (${seller.bundleDiscount.twoItems || 0} %)`}
                      </span>
                    ) : null}
                  </header>
                  <ul>
                    {items.map((product) => {
                      const image = product.images?.[0];
                      const isActive = product.status === 'ACTIVE';
                      return (
                        <li key={product.id} className="flex flex-col gap-4 border-b p-4 last:border-b-0 sm:flex-row sm:items-center" style={{ borderColor: 'var(--color-border)' }}>
                          <Link href={`/product/${product.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl" style={{ background: 'var(--color-bg-secondary)' }}>
                            {image ? <img src={image.thumbUrl ?? image.url} alt={product.title} className={`h-full w-full object-cover ${isActive ? '' : 'opacity-50 grayscale'}`} loading="lazy" /> : null}
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link href={`/product/${product.id}`}><h2 className="line-clamp-1 font-semibold">{product.title}</h2></Link>
                            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{[product.brand, product.size, getConditionLabel(product.condition)].filter(Boolean).join(' · ')}</p>
                            <p className="mt-1 font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(product.price)}</p>
                            {!isActive ? (
                              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--color-orange-dark)' }}>
                                {product.status === 'SOLD' ? 'Verkauft' : 'Gerade reserviert - ist bald vielleicht wieder frei'}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {isActive ? (
                              <Link href={`/checkout/${product.id}`} className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 text-sm font-bold text-white" style={{ background: 'var(--color-primary)' }}>Kaufen</Link>
                            ) : null}
                            <button type="button" onClick={() => toggleCart(product.id)} aria-label={`${product.title} aus dem Warenkorb entfernen`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {activeCount >= 2 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                      <span>{activeCount} Artikel von {seller.name || 'diesem Verkäufer'} - zusammen versenden spart Porto.</span>
                      <Link href={session ? `/inbox?with=${seller.id}` : `/login?callbackUrl=${encodeURIComponent(`/inbox?with=${seller.id}`)}`} className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--color-primary)' }}>
                        <MessageCircle size={14} /> Paketpreis anfragen
                      </Link>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Summe der verfügbaren Artikel (ohne Versand)</span>
            <span className="text-xl font-bold">{formatPrice(total)}</span>
          </div>
        </>
      )}
    </main>
  );
}
