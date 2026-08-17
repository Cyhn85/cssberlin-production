import Link from 'next/link';
import { Heart, Leaf } from 'lucide-react';
import { formatPrice, getConditionLabel } from '@/lib/utils/condition-map';

type CardImage = {
  url: string;
};

type CardSeller = {
  name?: string | null;
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
  showSeller = false,
  href,
}: ProductCardProps) {
  const imageUrl = product.images?.[0]?.url;
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return (
    <Link href={href ?? `/product/${product.id}`}>
      <article
        className="group product-card-hover h-full overflow-hidden rounded-2xl border"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="relative aspect-[3/4] overflow-hidden" style={{ background: 'var(--color-bg-secondary)' }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Leaf size={42} style={{ color: 'var(--color-primary)', opacity: 0.18 }} />
            </div>
          )}

          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold shadow-sm">
            <Leaf size={10} style={{ color: 'var(--color-primary)' }} />
            <span style={{ color: 'var(--color-primary-dark)' }}>-{(product.ecoCO2Saved ?? 0).toFixed(1)}kg</span>
          </div>

          <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold shadow-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {getConditionLabel(product.condition)}
          </div>
        </div>

        <div className="flex h-[122px] flex-col p-2.5">
          <p className="line-clamp-1 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {product.title}
          </p>

          {subtitle ? (
            <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          ) : (
            <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {[product.brand, product.size].filter(Boolean).join(' · ') || 'Second-hand Fund'}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}
            >
              {formatPrice(product.price)}
            </span>
            {product.originalPrice ? (
              <span className="text-xs line-through" style={{ color: 'var(--color-text-muted)' }}>
                {formatPrice(product.originalPrice)}
              </span>
            ) : null}
            {discount ? (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: 'var(--color-error)' }}
              >
                -{discount}%
              </span>
            ) : null}
          </div>

          <div className="mt-auto flex items-center justify-between pt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span className="line-clamp-1">
              {showSeller ? product.seller?.name || 'cssberlin seller' : product.brand || 'cssberlin'}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Heart size={12} /> {product.likes ?? 0}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
