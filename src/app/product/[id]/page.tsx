'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  Heart,
  Info,
  Leaf,
  Loader2,
  MessageCircle,
  Share2,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import OfferModal from '@/components/product/OfferModal';
import ProductCard from '@/components/product/ProductCard';
import { formatPrice, formatRelativeTime, getConditionLabel } from '@/lib/utils/condition-map';

type ProductDetail = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  brand: string | null;
  size: string | null;
  condition: string;
  shippingCost: number;
  views: number;
  likes: number;
  ecoCO2Saved: number;
  createdAt: string;
  images: Array<{ id: string; url: string; orderIndex: number }>;
  category: {
    id: string;
    name: string;
    emoji?: string | null;
    parent?: { name: string } | null;
  };
  seller: {
    id: string;
    name: string | null;
    avatar: string | null;
    location: string | null;
    isVerified: boolean;
    createdAt: string;
    _count: {
      products: number;
      receivedReviews: number;
      followers: number;
    };
  };
  sellerRating: {
    average: number;
    count: number;
  };
  similar: Array<{
    id: string;
    title: string;
    price: number;
    originalPrice: number | null;
    condition: string;
    likes: number;
    ecoCO2Saved: number;
    images: Array<{ url: string }>;
    seller: { name: string | null };
  }>;
  isFavorited: boolean;
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  useEffect(() => {
    const productId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!productId) return;

    let cancelled = false;

    const loadProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/products/${productId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Artikel konnte nicht geladen werden.');
        }

        if (!cancelled) {
          setProduct(result.data);
          setIsLiked(Boolean(result.data.isFavorited));
          setActiveImage(0);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError.message || 'Artikel konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const breadcrumbItems = useMemo(() => {
    if (!product) return [] as string[];
    return [product.category.parent?.name, product.category.name].filter(Boolean) as string[];
  }, [product]);

  const handleFavoriteToggle = async () => {
    if (!product || favoriteBusy) return;

    setFavoriteBusy(true);
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Favorit konnte nicht aktualisiert werden.');
      }

      const nextFavorited = Boolean(result.data?.favorited);
      setIsLiked(nextFavorited);
      setProduct((current) =>
        current
          ? {
              ...current,
              likes: Math.max(0, current.likes + (nextFavorited ? 1 : -1)),
              isFavorited: nextFavorited,
            }
          : current
      );
    } catch (toggleError: any) {
      setError(toggleError.message || 'Favorit konnte nicht aktualisiert werden.');
    } finally {
      setFavoriteBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center" style={{ color: 'var(--color-primary)' }}>
          <Loader2 size={42} className="mx-auto mb-4 animate-spin" />
          <p className="text-sm font-semibold">Artikel wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!product || error) {
    return (
      <div className="container py-16">
        <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <Info size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <h1 className="mb-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Artikel nicht verfuegbar
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {error || 'Dieser Artikel konnte nicht gefunden werden.'}
          </p>
          <Link href="/catalog" className="rounded-full px-6 py-3 font-bold text-white btn-mars-earth" style={{ background: 'var(--color-orange)' }}>
            Zurueck zum Katalog
          </Link>
        </div>
      </div>
    );
  }

  const activeImageUrl = product.images[activeImage]?.url || product.images[0]?.url || '';
  const sellerName = product.seller.name || 'cssberlin seller';
  const isOwner = session?.user?.id === product.seller.id;

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-6xl">
        <nav className="mb-6 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/" className="transition-colors hover:text-[var(--color-primary)]">Startseite</Link>
          <ChevronRightIcon size={14} />
          <Link href="/catalog" className="transition-colors hover:text-[var(--color-primary)]">Katalog</Link>
          {breadcrumbItems.map((item) => (
            <span key={item} className="flex items-center gap-2">
              <ChevronRightIcon size={14} />
              <Link href={`/catalog?category=${encodeURIComponent(item)}`} className="transition-colors hover:text-[var(--color-primary)]">
                {item}
              </Link>
            </span>
          ))}
        </nav>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-4 lg:col-span-7">
            <div
              className="group relative aspect-[4/5] overflow-hidden rounded-3xl border"
              style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
            >
              {activeImageUrl ? (
                <img src={activeImageUrl} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Leaf size={64} style={{ color: 'var(--color-primary)', opacity: 0.12 }} />
                </div>
              )}

              {product.images.length > 1 ? (
                <>
                  <button
                    className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-sm transition-opacity group-hover:opacity-100"
                    onClick={() => setActiveImage((prev) => (prev > 0 ? prev - 1 : product.images.length - 1))}
                  >
                    <ChevronLeft size={20} style={{ color: 'var(--color-text)' }} />
                  </button>
                  <button
                    className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-sm transition-opacity group-hover:opacity-100"
                    onClick={() => setActiveImage((prev) => (prev < product.images.length - 1 ? prev + 1 : 0))}
                  >
                    <ChevronRight size={20} style={{ color: 'var(--color-text)' }} />
                  </button>
                </>
              ) : null}
            </div>

            {product.images.length > 1 ? (
              <div className="grid grid-cols-4 gap-3 md:grid-cols-5">
                {product.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setActiveImage(index)}
                    className="aspect-square overflow-hidden rounded-xl border-2"
                    style={{
                      borderColor: activeImage === index ? 'var(--color-primary)' : 'transparent',
                      background: 'var(--color-bg-secondary)',
                    }}
                  >
                    <img src={image.url} alt={`${product.title} ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="hidden border-t pt-8 lg:block" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                Artikelbeschreibung
              </h2>
              <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {product.description || 'Keine Beschreibung vorhanden.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {product.brand || product.category.name}
                </p>
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl" style={{ color: 'var(--color-text)' }}>
                  {product.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleFavoriteToggle}
                  disabled={favoriteBusy}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
                  style={{ background: 'var(--color-bg-secondary)', color: isLiked ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
                >
                  {favoriteBusy ? <Loader2 size={18} className="animate-spin" /> : <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />}
                </button>
                <button
                  onClick={() => navigator?.share?.({ title: product.title, url: window.location.href }).catch(() => {})}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-bg-secondary)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <Share2 size={20} />
                </button>
              </div>
            </div>

            <div className="border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice ? (
                  <span className="mb-1 text-lg line-through" style={{ color: 'var(--color-text-muted)' }}>
                    {formatPrice(product.originalPrice)}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="eco-badge">
                  <Leaf size={14} />
                  -{product.ecoCO2Saved.toFixed(1)}kg CO2 Ersparnis
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {product.views} Aufrufe - {product.likes} Likes
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-b pb-6 text-sm" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <span className="mb-1 block font-medium" style={{ color: 'var(--color-text-muted)' }}>Groesse</span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{product.size || 'Nicht angegeben'}</span>
              </div>
              <div>
                <span className="mb-1 block font-medium" style={{ color: 'var(--color-text-muted)' }}>Zustand</span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{getConditionLabel(product.condition)}</span>
              </div>
              <div>
                <span className="mb-1 block font-medium" style={{ color: 'var(--color-text-muted)' }}>Kategorie</span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{product.category.name}</span>
              </div>
              <div>
                <span className="mb-1 block font-medium" style={{ color: 'var(--color-text-muted)' }}>Hochgeladen</span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatRelativeTime(product.createdAt)}</span>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl p-4" style={{ background: 'var(--color-primary-50)' }}>
              <ShieldCheck size={28} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <div>
                <h4 className="mb-1 text-sm font-bold" style={{ color: 'var(--color-primary-dark)' }}>
                  cssberlin Kaeuferschutz
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-primary)' }}>
                  Zahlung bleibt geschuetzt, bis die Ware sicher angekommen ist. Bei Problemen greift unser Streitfall-Prozess.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'var(--color-bg-secondary)' }}>
              <Truck size={24} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              <div className="flex-1">
                <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                  Versand ab {formatPrice(product.shippingCost)}
                </h4>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  DHL, Hermes oder DPD zur Auswahl
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 py-2">
              {!isOwner ? (
                <>
                  <Link href={`/checkout/${product.id}`}>
                    <button className="btn-mars-earth w-full rounded-2xl py-4 text-lg font-bold text-white" style={{ background: 'var(--color-orange)' }}>
                      Kaufen
                    </button>
                  </Link>

                  <button
                    onClick={() => setIsOfferModalOpen(true)}
                    className="btn-mars-earth-outline w-full rounded-2xl py-4 text-lg font-bold"
                    style={{ border: '2px solid var(--color-orange)', color: 'var(--color-orange)' }}
                  >
                    Preis vorschlagen
                  </button>

                  <button
                    onClick={() => router.push(`/inbox?with=${product.seller.id}`)}
                    className="w-full rounded-2xl border py-4 text-base font-bold"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MessageCircle size={18} /> Verkaeufer kontaktieren
                    </span>
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                  Das ist dein eigener Artikel. Kauf- und Kontaktaktionen sind hier deaktiviert.
                </div>
              )}
            </div>

            <div className="mt-2 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="mb-4 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                Ueber den Verkaeufer
              </h3>
              <div className="flex items-center justify-between gap-3">
                <Link href={`/profile/${product.seller.id}`} className="group flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: 'var(--color-primary-light)', fontFamily: 'var(--font-display)' }}>
                    {sellerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold transition-colors group-hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text)' }}>
                      {sellerName}
                    </h4>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {product.sellerRating.average.toFixed(1)} Sterne - {product.sellerRating.count} Bewertungen
                    </div>
                  </div>
                </Link>
                {product.seller.isVerified ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    Verifiziert
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {product.seller.location || 'Deutschland'} - Mitglied {formatRelativeTime(product.seller.createdAt)}
              </p>
            </div>

            <div className="border-t pt-6 lg:hidden" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-3 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                Artikelbeschreibung
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {product.description || 'Keine Beschreibung vorhanden.'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 border-t pt-12" style={{ borderColor: 'var(--color-border)' }}>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Aehnliche Artikel
            </h2>
          </div>

          {product.similar.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {product.similar.map((item) => (
                <ProductCard key={item.id} product={item} showSeller />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <p style={{ color: 'var(--color-text-secondary)' }}>Noch keine aehnlichen Artikel gefunden.</p>
            </div>
          )}
        </div>
      </div>

      <OfferModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        productId={product.id}
        productTitle={product.title}
        productPrice={product.price}
        productImage={product.images[0]?.url || ''}
      />
    </div>
  );
}
