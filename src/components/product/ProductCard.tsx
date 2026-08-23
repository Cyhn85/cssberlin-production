'use client';

import Link from 'next/link';
import { Heart, Leaf, ShoppingCart, Check } from 'lucide-react';
import { formatPrice, getConditionLabel } from '@/lib/utils/condition-map';
import { useCart } from '@/store/useCart';
import { useFavorites } from '@/store/useFavorites';

type CardImage = {
  url: string;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
};

type CardSeller = {
  name?: string | null;
  avatar?: string | null;
};

type ProductCardProps = {
  product: {
    id: string;
    title: string;
    price: number;
    originalPrice?: number | null;
    brand?: string | null;
    size?: string | null;
    condition: string;
    likes?: number;
    ecoCO2Saved?: number;
    images?: CardImage[];
    seller?: CardSeller;
  };
  subtitle?: string;
  showSeller?: boolean;
  href?: string;
};

export default function ProductCard({
  product,
  subtitle,
  showSeller = true,
  href,
}: ProductCardProps) {
  const { toggleCart, isInCart } = useCart();
  const { toggleFavorite, isFavorited } = useFavorites();

  const image = product.images?.[0];
  const thumb = image?.thumbUrl ?? image?.url;
  const medium = image?.mediumUrl ?? image?.url;

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  const productHref = href ?? `/product/${product.id}`;
  const inCart = isInCart(product.id);
  const favorited = isFavorited(product.id);

  // The whole card used to navigate through an onClick on <article>, which left
  // it invisible to crawlers and unreachable by keyboard, and killed
  // middle-click / ctrl-click / "open in new tab". A real <a> fixes all four.
  // The favourite and cart buttons stay OUTSIDE that anchor: a <button> nested
  // inside an <a> is invalid HTML and screen readers announce it inconsistently.
  return (
    <article className="group relative flex h-full flex-col">
      {showSeller && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <div
            className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-border"
            style={{ background: 'var(--color-bg-secondary)' }}
          >
            {product.seller?.avatar ? (
              <img
                src={product.seller.avatar}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-bold" style={{ color: 'var(--color-primary)' }}>
                {(product.seller?.name || 'C').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span
            className="line-clamp-1 text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {product.seller?.name || 'cssberlin'}
          </span>
        </div>
      )}

      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border/50 shadow-sm transition-shadow group-hover:shadow-md"
        style={{ background: 'var(--color-bg-secondary)' }}
      >
        <Link href={productHref} className="block h-full w-full" aria-label={product.title}>
          {thumb ? (
            <img
              src={thumb}
              srcSet={[thumb && `${thumb} 320w`, medium && `${medium} 800w`]
                .filter(Boolean)
                .join(', ')}
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 22vw"
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Leaf size={42} style={{ color: 'var(--color-primary)', opacity: 0.18 }} />
            </div>
          )}
        </Link>

        <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1.5">
          {product.ecoCO2Saved && product.ecoCO2Saved > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md">
              <Leaf size={10} style={{ color: 'var(--color-primary)' }} />
              <span style={{ color: 'var(--color-primary-dark)' }}>
                -{product.ecoCO2Saved.toFixed(1)}kg CO₂
              </span>
            </div>
          ) : null}
          {discount ? (
            <div
              className="inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-sm"
              style={{ background: 'var(--color-orange)' }}
            >
              -{discount}%
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          aria-pressed={favorited}
          aria-label={favorited ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-md transition-transform hover:scale-110"
        >
          <Heart
            size={18}
            style={{ color: favorited ? 'var(--color-orange)' : 'var(--color-text-secondary)' }}
            fill={favorited ? 'var(--color-orange)' : 'none'}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <Link href={productHref} className="block">
          <h3
            className="line-clamp-1 text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            {product.title}
          </h3>

          <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle ||
              [product.brand, product.size].filter(Boolean).join(' · ') ||
              getConditionLabel(product.condition)}
          </p>

          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className="text-base font-bold"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}
            >
              {formatPrice(product.price)}
            </span>
            {product.originalPrice ? (
              <span className="text-xs line-through" style={{ color: 'var(--color-text-muted)' }}>
                {formatPrice(product.originalPrice)}
              </span>
            ) : null}
          </div>
        </Link>

        <button
          type="button"
          onClick={() => toggleCart(product.id)}
          aria-pressed={inCart}
          className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors"
          style={
            inCart
              ? {
                  background: 'var(--color-primary-100)',
                  color: 'var(--color-primary-dark)',
                }
              : // Orange background fails WCAG AA with any text colour we have
                // (white 3.3:1, dark green 2.9:1 - both under 4.5:1). Brand
                // green with white is 6.4:1 and is the "Climate Smart" primary
                // anyway; orange stays for the discount badge, which is a
                // graphic label, not body text.
                { background: 'var(--color-primary)', color: '#FFFFFF' }
          }
        >
          {inCart ? <Check size={14} /> : <ShoppingCart size={14} />}
          {inCart ? 'Im Warenkorb' : 'In den Warenkorb'}
        </button>
      </div>
    </article>
  );
}
