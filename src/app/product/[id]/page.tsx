'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ChevronDown,
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
import { PRODUCT_ANGLES, PRODUCT_ANGLE_LABELS, hasFullAngleSet, type ProductAngle } from '@/lib/product-angles';
import { useFavorites } from '@/store/useFavorites';
import { useCart } from '@/store/useCart';
import { Copy, Mail, Share, ShoppingCart } from 'lucide-react';
import { priceDisclosure } from '@/config/business-profile';
import { resolveShippingFee, SHIPPING_CARRIERS, FREE_SHIPPING_THRESHOLD_EUR } from '@/config/shipping-policy';
import SellerLocationMap from '@/components/profile/SellerLocationMap';

const DETAIL_TABS = [
  { id: 'description', label: 'Beschreibung' },
  { id: 'details', label: 'Details' },
  { id: 'shipping', label: 'Versand & Rückgabe' },
] as const;

type DetailTabId = (typeof DETAIL_TABS)[number]['id'];

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
  status: string;
  views: number;
  likes: number;
  ecoCO2Saved: number;
  createdAt: string;
  images: Array<{ id: string; url: string; thumbUrl?: string | null; mediumUrl?: string | null; orderIndex: number; angle?: string | null }>;
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
    publicLocation?: { label: string | null; lat: number | null; lng: number | null } | null;
    trust?: { replyTime: string | null; lastSeenAt: string | null; completedSales: number; cancelRate: number | null } | null;
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
  const [detailTab, setDetailTab] = useState<DetailTabId>('description');
  const [isLiked, setIsLiked] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isShippingOpen, setIsShippingOpen] = useState(false);
  const { isFavorited: isLocalFavorited, toggleFavorite } = useFavorites();
  const { isInCart, toggleCart } = useCart();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (session && searchParams.get('angebot') === '1') setIsOfferModalOpen(true);
  }, [session, searchParams]);

  const requireLogin = (action: 'nachricht' | 'angebot') => {
    const back = `/product/${Array.isArray(params.id) ? params.id[0] : params.id}${action === 'angebot' ? '?angebot=1' : ''}`;
    router.push(`/login?callbackUrl=${encodeURIComponent(back)}`);
  };

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

    if (!session) {
      // Unauthenticated users fallback to local storage
      toggleFavorite(product.id);
      return;
    }

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

  const activeLikedState = session ? isLiked : (product ? isLocalFavorited(product.id) : false);

  const handleShareCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link in Zwischenablage kopiert!');
    } catch (err) {
      console.error(err);
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
            Artikel nicht verfügbar
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {error || 'Dieser Artikel konnte nicht gefunden werden.'}
          </p>
          <Link href="/catalog" className="rounded-full px-6 py-3 font-bold text-white btn-mars-earth" style={{ background: 'var(--color-orange)' }}>
            <span>Zurück zum Katalog</span>
          </Link>
        </div>
      </div>
    );
  }

  const activeImageUrl = product.images[activeImage]?.mediumUrl || product.images[activeImage]?.url || product.images[0]?.mediumUrl || product.images[0]?.url || '';
  const sellerName = product.seller.name || 'cssberlin seller';
  const isOwner = session?.user?.id === product.seller.id;
  // the same rule the checkout charges (first-order discount is shown in the checkout itself)
  const shippingQuote = resolveShippingFee({ itemPrice: product.price, productShippingCost: product.shippingCost });

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

            {hasFullAngleSet(product.images) ? (
              <div className="flex flex-wrap gap-2">
                {PRODUCT_ANGLES.map((angle) => {
                  const index = product.images.findIndex((img) => img.angle === angle);
                  const isActive = index === activeImage;
                  return (
                    <button
                      key={angle}
                      onClick={() => setActiveImage(index)}
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        borderColor: isActive ? 'var(--color-orange)' : 'var(--color-border)',
                        background: isActive ? 'var(--color-orange)' : 'transparent',
                        color: isActive ? '#fff' : 'var(--color-text-secondary)',
                      }}
                    >
                      {PRODUCT_ANGLE_LABELS[angle as ProductAngle]}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {product.images.length > 1 ? (
              <div className="grid grid-cols-4 gap-3">
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
                    <img src={image.thumbUrl ?? image.url} alt={`${product.title} ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}

            {/* Was `hidden lg:block`, so a phone visitor saw no description at
                all - on a second-hand item the description IS the product. Now
                it is a tabbed panel that renders at every width, and the facts
                a buyer actually checks (size, condition, brand) get their own
                pane instead of being buried in prose. */}
            <div className="border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <div
                className="mb-5 flex items-center gap-6 border-b"
                style={{ borderColor: 'var(--color-border)' }}
                role="tablist"
              >
                {DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={detailTab === tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className="relative min-h-[44px] text-sm font-bold"
                    style={{
                      color: detailTab === tab.id ? 'var(--color-text)' : 'var(--color-text-muted)',
                    }}
                  >
                    {tab.label}
                    {detailTab === tab.id ? (
                      <span
                        className="absolute -bottom-px left-0 right-0 h-0.5"
                        style={{ background: 'var(--color-primary)' }}
                      />
                    ) : null}
                  </button>
                ))}
              </div>

              {detailTab === 'description' ? (
                <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {product.description || 'Keine Beschreibung vorhanden.'}
                </p>
              ) : null}

              {detailTab === 'details' ? (
                <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {[
                    ['Marke', product.brand],
                    ['Größe', product.size],
                    ['Zustand', getConditionLabel(product.condition)],
                    ['Kategorie', product.category?.name],
                  ]
                    .filter(([, value]) => Boolean(value))
                    .map(([label, value]) => (
                      <div
                        key={label as string}
                        className="flex justify-between border-b pb-2 text-sm"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <dt style={{ color: 'var(--color-text-secondary)' }}>{label}</dt>
                        <dd className="font-semibold" style={{ color: 'var(--color-text)' }}>
                          {value}
                        </dd>
                      </div>
                    ))}
                </dl>
              ) : null}

              {detailTab === 'shipping' ? (
                <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    Versandkosten für diesen Artikel:{' '}
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {shippingQuote.free ? 'kostenlos' : formatPrice(shippingQuote.fee)}
                    </span>
                  </p>
                  <p>
                    Online-Käufe mit Versand sind über den Käuferschutz abgesichert: Der Betrag wird erst an den
                    Verkäufer ausgezahlt, wenn die Bestellung abgeschlossen ist. Bei Abholung mit Barzahlung gilt kein Käuferschutz.
                  </p>
                  <p>
                    Zu deinem Widerrufsrecht und den vollständigen Bedingungen:{' '}
                    <Link href="/widerruf" className="underline underline-offset-2">
                      Widerruf
                    </Link>{' '}
                    ·{' '}
                    <Link href="/agb" className="underline underline-offset-2">
                      AGB
                    </Link>
                  </p>
                </div>
              ) : null}
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

              <div className="flex items-center gap-2 relative">
                <button
                  onClick={handleFavoriteToggle}
                  disabled={favoriteBusy}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:scale-105"
                  style={{ background: 'var(--color-bg-secondary)', color: activeLikedState ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
                >
                  {favoriteBusy ? <Loader2 size={18} className="animate-spin" /> : <Heart size={20} fill={activeLikedState ? 'currentColor' : 'none'} />}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsShareOpen(!isShareOpen)}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-bg-secondary)]"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Share2 size={20} />
                  </button>
                  
                  {isShareOpen && (
                    <div className="absolute right-0 top-12 z-50 flex w-48 flex-col rounded-xl border bg-white p-2 shadow-lg dark:bg-[#161b22]" style={{ borderColor: 'var(--color-border)' }}>
                      <button onClick={handleShareCopy} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--color-text)' }}>
                        <Copy size={16} /> Link kopieren
                      </button>
                      <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(product.title + ' ' + window.location.href)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--color-text)' }}>
                        <MessageCircle size={16} /> WhatsApp
                      </a>
                      <a href={`mailto:?subject=${encodeURIComponent(product.title)}&body=${encodeURIComponent(window.location.href)}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--color-text)' }}>
                        <Mail size={16} /> E-Mail
                      </a>
                    </div>
                  )}
                </div>
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

              {/* PAngV: the VAT statement and the shipping-cost reference have
                  to sit on the same screen as the price. The link is the
                  "reachable without effort" half of that requirement - AGB is
                  where our shipping terms actually live. */}
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {priceDisclosure.isKleinunternehmer ? (
                  <>
                    {priceDisclosure.kleinunternehmerNotice} zzgl.{' '}
                    <Link href="/hilfe/versand" className="underline underline-offset-2">
                      Versandkosten
                    </Link>
                  </>
                ) : (
                  <>
                    {priceDisclosure.long}{' '}
                    <Link href="/agb" className="underline underline-offset-2">
                      Versandkosten
                    </Link>
                  </>
                )}
              </p>

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
                <span className="mb-1 block font-medium" style={{ color: 'var(--color-text-muted)' }}>Größe</span>
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
                  cssberlin Käuferschutz
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-primary)' }}>
                  Zahlung bleibt geschützt, bis die Ware sicher angekommen ist. Bei Problemen greift unser Streitfall-Prozess.
                </p>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border transition-all" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              <button
                onClick={() => setIsShippingOpen(!isShippingOpen)}
                className="flex items-center justify-between p-4"
                aria-expanded={isShippingOpen}
              >
                <div className="flex items-center gap-3">
                  <Truck size={24} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                  <div className="text-left">
                    <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                      {shippingQuote.free ? 'Kostenloser Versand' : `Versand ${formatPrice(shippingQuote.fee)}`}
                    </h4>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      oder Abholung{product.seller.publicLocation?.label ? ` in ${product.seller.publicLocation.label}` : ''}
                    </p>
                  </div>
                </div>
                <ChevronDown size={18} className={`transition-transform ${isShippingOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }} />
              </button>

              {isShippingOpen && (
                <div className="space-y-2 border-t p-4 pt-3 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <p>{SHIPPING_CARRIERS.map((c) => c.name).join(', ')} - {shippingQuote.free ? 'kostenlos' : formatPrice(shippingQuote.fee)}.</p>
                  {!shippingQuote.free ? <p>Ab {FREE_SHIPPING_THRESHOLD_EUR} € Warenwert ist der Versand kostenlos, bei deiner ersten Bestellung schon ab 30 €.</p> : null}
                  <p>Selbstabholung mit Barzahlung: kostenlos, ohne Käuferschutz.</p>
                  <Link href="/hilfe/versand" className="inline-block text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Alles zu Versand & Abholung</Link>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 py-2">
              {!isOwner && product.status !== 'ACTIVE' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  {product.status === 'SOLD' ? 'Dieser Artikel wurde verkauft.' : 'Dieser Artikel ist gerade reserviert. Merke ihn dir - wird der Kauf nicht abgeschlossen, ist er bald wieder verfügbar.'}
                </div>
              ) : null}
              {!isOwner && product.status === 'ACTIVE' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => toggleCart(product.id)}
                      className={`btn-mars-earth w-full rounded-2xl py-3.5 text-base font-bold transition-all ${isInCart(product.id) ? 'opacity-80' : ''}`} 
                      style={{ background: 'var(--color-orange)', color: '#1A4D2E' }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <ShoppingCart size={18} /> {isInCart(product.id) ? 'Im Warenkorb' : 'In den Warenkorb'}
                      </span>
                    </button>

                    <Link href={`/checkout/${product.id}`}>
                      <button className="btn-mars-earth w-full h-full rounded-2xl py-3.5 text-base font-bold transition-all" style={{ background: 'var(--color-orange)', color: '#1A4D2E' }}>
                        <span>Direkt kaufen</span>
                      </button>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => (session ? setIsOfferModalOpen(true) : requireLogin('angebot'))}
                      className="btn-mars-earth-outline w-full rounded-2xl py-3.5 text-base font-bold transition-all"
                      style={{ border: '2px solid var(--color-orange)', color: '#1A4D2E' }}
                    >
                      Preis vorschlagen
                    </button>

                    <button
                      onClick={() => (session ? router.push(`/inbox?with=${product.seller.id}`) : requireLogin('nachricht'))}
                      className="w-full rounded-2xl border py-3.5 text-base font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ borderColor: 'var(--color-border)', color: '#1A4D2E' }}
                    >
                      <span className="inline-flex items-center gap-2 justify-center w-full">
                        <MessageCircle size={18} /> Nachricht
                      </span>
                    </button>
                  </div>
                </>
              ) : null}
              {isOwner ? (
                <div className="rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                  Das ist dein eigener Artikel. Kauf- und Kontaktaktionen sind hier deaktiviert.
                </div>
              ) : null}
            </div>

            <div className="mt-2 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="mb-4 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                Über den Verkäufer
              </h3>
              <div className="flex items-center justify-between gap-3">
                <Link href={`/profile/${product.seller.id}`} className="group flex items-center gap-3">
                  {product.seller.avatar ? (
                    <img src={product.seller.avatar} alt="" className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: 'var(--color-primary-light)', fontFamily: 'var(--font-display)' }}>
                      {sellerName.charAt(0).toUpperCase()}
                    </div>
                  )}
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
              <ul className="mt-3 space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <li>Mitglied seit {new Date(product.seller.createdAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} · {product.seller._count.products} Artikel</li>
                {product.seller.trust?.completedSales ? <li>{product.seller.trust.completedSales} erfolgreiche Verkäufe{product.seller.trust.cancelRate != null ? ` · Stornoquote ${product.seller.trust.cancelRate} %` : ''}</li> : null}
                {product.seller.trust?.replyTime ? <li>Antwortet meist {product.seller.trust.replyTime}</li> : null}
                {product.seller.trust?.lastSeenAt ? <li>Zuletzt online {formatRelativeTime(product.seller.trust.lastSeenAt)}</li> : null}
              </ul>
              <SellerLocationMap
                label={product.seller.publicLocation?.label ?? null}
                lat={product.seller.publicLocation?.lat ?? null}
                lng={product.seller.publicLocation?.lng ?? null}
                compact
              />
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
              Ähnliche Artikel
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
              <p style={{ color: 'var(--color-text-secondary)' }}>Noch keine ähnlichen Artikel gefunden.</p>
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
