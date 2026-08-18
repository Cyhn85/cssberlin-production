import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Leaf, ShoppingCart } from 'lucide-react';
import { formatPrice, getConditionLabel } from '@/lib/utils/condition-map';
import { useCart } from '@/store/useCart';

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
  const router = useRouter();
  const imageUrl = product.images?.[0]?.url;
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;
    
  const { toggleCart, isInCart } = useCart();
  const productHref = href ?? `/product/${product.id}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // If user clicked a button or link inside, don't trigger the card click
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    router.push(productHref);
  };

  return (
      <article
        onClick={handleCardClick}
        className="group product-card-hover h-full overflow-hidden rounded-lg border flex flex-col cursor-pointer"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="relative aspect-[4/5] overflow-hidden" style={{ background: 'var(--color-bg-secondary)' }}>
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

        <div className="flex flex-col p-2.5">
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

          {/* Action Buttons */}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => toggleCart(product.id)}
              className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold transition-all ${isInCart(product.id) ? 'opacity-80' : ''}`}
              style={{ background: 'var(--color-orange)', color: '#1A4D2E' }}
            >
              <ShoppingCart size={12} />
              {isInCart(product.id) ? 'Im Warenkorb' : 'In den Warenkorb'}
            </button>
            <Link href={`/checkout/${product.id}`} className="w-full">
              <button
                className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold transition-all"
                style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-dark)' }}
              >
                Direkt kaufen
              </button>
            </Link>
          </div>
        </div>
      </article>
  );
}
