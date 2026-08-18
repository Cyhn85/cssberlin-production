'use client';

import { Suspense, startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import { labelToCondition } from '@/lib/utils/condition-map';
import { useProgressiveLoad } from '@/lib/hooks/useProgressiveLoad';
import { Checkbox } from '@/components/ui/checkbox';

type ProductItem = {
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

type FilterOptions = {
  brands: string[];
  sizes: string[];
  categories: Array<{
    id: string;
    name: string;
    emoji?: string | null;
    _count?: { products: number };
  }>;
};

const CONDITIONS = ['Neu mit Etikett', 'Neu', 'Sehr gut', 'Gut', 'Akzeptabel'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Neu eingetroffen' },
  { value: 'popular', label: 'Beliebteste' },
  { value: 'price_asc', label: 'Preis aufsteigend' },
  { value: 'price_desc', label: 'Preis absteigend' },
] as const;

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ brands: [], sizes: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [catalogDegraded, setCatalogDegraded] = useState(false);
  const [filterDegraded, setFilterDegraded] = useState(false);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedBrand, setSelectedBrand] = useState(searchParams.get('brand') || '');
  const [selectedSize, setSelectedSize] = useState(searchParams.get('size') || '');
  const [selectedCondition, setSelectedCondition] = useState(searchParams.get('condition') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [selectedSort, setSelectedSort] = useState(searchParams.get('sort') || 'newest');

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    const loadFilters = async () => {
      try {
        const response = await fetch('/api/products/filters');
        const result = await response.json();
        if (!cancelled && result.success) {
          setFilters(result.data);
          setFilterDegraded(Boolean(result.data.degraded));
        }
      } catch {
        if (!cancelled) {
          setFilters({ brands: [], sizes: [], categories: [] });
          setFilterDegraded(true);
        }
      }
    };

    void loadFilters();

    return () => {
      cancelled = true;
    };
  }, []);

  const buildParams = (cursor?: string | null) => {
    const params = new URLSearchParams();
    if (deferredQuery.trim()) params.set('q', deferredQuery.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedBrand) params.set('brand', selectedBrand);
    if (selectedSize) params.set('size', selectedSize);
    if (selectedCondition) params.set('condition', labelToCondition[selectedCondition] || selectedCondition);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (selectedSort) params.set('sort', selectedSort);
    params.set('limit', '16');
    if (cursor) params.set('cursor', cursor);
    return params;
  };

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products?${buildParams().toString()}`);
        const result = await response.json();
        if (!cancelled && result.success) {
          setProducts(result.data.items || []);
          setHasMore(Boolean(result.data.hasMore));
          setNextCursor(result.data.nextCursor || null);
          setCatalogDegraded(Boolean(result.data.degraded));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, selectedCategory, selectedBrand, selectedSize, selectedCondition, minPrice, maxPrice, selectedSort]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedBrand) params.set('brand', selectedBrand);
    if (selectedSize) params.set('size', selectedSize);
    if (selectedCondition) params.set('condition', selectedCondition);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (selectedSort && selectedSort !== 'newest') params.set('sort', selectedSort);

    router.replace(params.size ? `?${params.toString()}` : '/catalog', { scroll: false });
  }, [query, selectedCategory, selectedBrand, selectedSize, selectedCondition, minPrice, maxPrice, selectedSort, router]);

  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await fetch(`/api/products?${buildParams(nextCursor).toString()}`);
      const result = await response.json();
      if (result.success) {
        setProducts((current) => [...current, ...(result.data.items || [])]);
        setHasMore(Boolean(result.data.hasMore));
        setNextCursor(result.data.nextCursor || null);
        setCatalogDegraded(Boolean(result.data.degraded));
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const { sentinelRef, showManualButton } = useProgressiveLoad({ hasMore, loading: loadingMore, onLoadMore: loadMore });

  const clearAllFilters = () => {
    setQuery('');
    setSelectedCategory('');
    setSelectedBrand('');
    setSelectedSize('');
    setSelectedCondition('');
    setMinPrice('');
    setMaxPrice('');
    setSelectedSort('newest');
  };

  const hasActiveFilters = Boolean(
    query || selectedCategory || selectedBrand || selectedSize || selectedCondition || minPrice || maxPrice || selectedSort !== 'newest'
  );

  const activeSortLabel = useMemo(
    () => SORT_OPTIONS.find((option) => option.value === selectedSort)?.label || 'Neu eingetroffen',
    [selectedSort]
  );

  const sidebar = (
    <>
      <FilterSection
        title="Kategorien"
        items={filters.categories.map((category) => category.name)}
        active={selectedCategory}
        onSelect={(value) => setSelectedCategory(value === selectedCategory ? '' : value)}
      />
      <FilterSection
        title="Marken"
        items={filters.brands}
        active={selectedBrand}
        onSelect={(value) => setSelectedBrand(value === selectedBrand ? '' : value)}
      />
      <FilterSection
        title="Groessen"
        items={filters.sizes}
        active={selectedSize}
        onSelect={(value) => setSelectedSize(value === selectedSize ? '' : value)}
        isGrid
      />
      <FilterSection
        title="Zustand"
        items={CONDITIONS}
        active={selectedCondition}
        onSelect={(value) => setSelectedCondition(value === selectedCondition ? '' : value)}
      />

      <div className="pb-6">
        <h3 className="mb-3 text-sm font-bold" style={{ color: 'var(--color-text)' }}>Preis (EUR)</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="Von"
            className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
          />
          <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Bis"
            className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen pb-16 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Katalog
            </h1>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              {loading
                ? 'Suche aktualisiert sich...'
                : catalogDegraded
                  ? 'Katalog synchronisiert gerade mit dem Backend.'
                  : `${products.length} Artikel geladen`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-72">
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  startTransition(() => setQuery(value));
                }}
                placeholder="Im Katalog suchen..."
                className="h-10 w-full rounded-full pl-10 pr-4 text-sm outline-none focus:ring-2"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            </div>

            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full md:hidden"
              style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
            >
              <SlidersHorizontal size={18} style={{ color: 'var(--color-text)' }} />
            </button>

            <div className="relative hidden md:block">
              <select
                value={selectedSort}
                onChange={(event) => setSelectedSort(event.target.value)}
                className="h-10 rounded-full border px-4 pr-10 text-sm font-medium outline-none"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="hidden w-64 shrink-0 space-y-6 md:block">{sidebar}</aside>

          <main className="flex-1">
            {hasActiveFilters ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {query ? <FilterTag label={`"${query}"`} onRemove={() => setQuery('')} /> : null}
                {selectedCategory ? <FilterTag label={selectedCategory} onRemove={() => setSelectedCategory('')} /> : null}
                {selectedBrand ? <FilterTag label={selectedBrand} onRemove={() => setSelectedBrand('')} /> : null}
                {selectedSize ? <FilterTag label={selectedSize} onRemove={() => setSelectedSize('')} /> : null}
                {selectedCondition ? <FilterTag label={selectedCondition} onRemove={() => setSelectedCondition('')} /> : null}
                {minPrice || maxPrice ? <FilterTag label={`${minPrice || 0} - ${maxPrice || '∞'} EUR`} onRemove={() => { setMinPrice(''); setMaxPrice(''); }} /> : null}
                {selectedSort !== 'newest' ? <FilterTag label={activeSortLabel} onRemove={() => setSelectedSort('newest')} /> : null}
                <button onClick={clearAllFilters} className="px-2 text-xs font-bold underline" style={{ color: 'var(--color-text-muted)' }}>
                  Alles loeschen
                </button>
              </div>
            ) : null}

            {catalogDegraded || filterDegraded ? (
              <div className="mb-6 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(232, 101, 26, 0.28)', background: 'rgba(232, 101, 26, 0.08)', color: 'var(--color-text)' }}>
                {catalogDegraded
                  ? 'Der Katalog wird gerade aktualisiert. Ergebnisse erscheinen automatisch in Kürze.'
                  : 'Filteroptionen werden gerade nachgeladen. Die Ergebnisliste bleibt nutzbar.'}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <div className="text-center" style={{ color: 'var(--color-primary)' }}>
                  <Loader2 size={42} className="mx-auto mb-4 animate-spin" />
                  <p className="text-sm font-semibold">Produkte werden geladen...</p>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed py-20 text-center" style={{ borderColor: 'var(--color-border)' }}>
                <Search size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
                <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Keine Treffer gefunden</h3>
                <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {catalogDegraded
                    ? 'Die Datenbank antwortet gerade noch nicht. Bitte versuche es in wenigen Sekunden erneut.'
                    : 'Versuche andere Begriffe oder entferne ein paar Filter.'}
                </p>
                <button onClick={clearAllFilters} className="rounded-full px-6 py-2 font-bold text-white btn-mars-earth" style={{ background: 'var(--color-orange)' }}>
                  <span>{catalogDegraded ? 'Erneut versuchen' : 'Filter zuruecksetzen'}</span>
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} showSeller />
                  ))}
                </div>

                {hasMore ? <div ref={sentinelRef} aria-hidden className="h-1" /> : null}

                {showManualButton ? (
                  <div className="mt-8 text-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-full px-6 py-3 font-bold text-white btn-mars-earth"
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
              </>
            )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {isMobileFilterOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/40"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="flex h-full w-4/5 max-w-sm flex-col"
              style={{ background: 'var(--color-bg)' }}
            >
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
                <h2 className="font-bold" style={{ color: 'var(--color-text)' }}>Filter & Sortieren</h2>
                <button onClick={() => setIsMobileFilterOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-4">
                <div>
                  <h3 className="mb-3 text-sm font-bold" style={{ color: 'var(--color-text)' }}>Sortieren nach</h3>
                  <select
                    className="w-full rounded-xl border p-3"
                    value={selectedSort}
                    onChange={(event) => setSelectedSort(event.target.value)}
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {sidebar}
              </div>

              <div className="border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="w-full rounded-xl py-4 font-bold text-white btn-mars-earth"
                  style={{ background: 'var(--color-orange)' }}
                >
                  <span>Ergebnisse anzeigen</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={42} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-100)' }}>
      {label}
      <button onClick={onRemove} className="rounded-full p-0.5 hover:bg-black/10">
        <X size={12} />
      </button>
    </span>
  );
}

function FilterSection({
  title,
  items,
  active,
  onSelect,
  isGrid = false,
}: {
  title: string;
  items: string[];
  active: string;
  onSelect: (value: string) => void;
  isGrid?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  // Auto-collapse logic when an item is selected could go here, 
  // but keeping it user-controlled with default open is less jarring.
  // We highlight the active selection even if collapsed.

  return (
    <div className="border-b pb-4 last:border-0" style={{ borderColor: 'var(--color-border)' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{title}</h3>
          {active && (
            <span className="flex h-2 w-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
          )}
        </div>
        <ChevronDown 
          size={16} 
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          style={{ color: 'var(--color-text-muted)' }} 
        />
      </button>

      {/* When closed, if there is an active selection, show it briefly */}
      {!isOpen && active && (
        <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
          Gewählt: {active}
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`mt-3 ${isGrid ? 'grid grid-cols-3 gap-2' : 'max-h-64 space-y-2.5 overflow-y-auto pr-1'}`}>
              {items.map((entry) => {
                const isActive = active === entry;
                if (isGrid) {
                  return (
                    <button
                      key={entry}
                      onClick={() => onSelect(entry)}
                      className={`rounded-xl py-2 text-xs transition-all ${isActive ? 'font-bold shadow-sm' : 'font-medium hover:bg-[var(--color-bg-secondary)]'}`}
                      style={{
                        background: isActive ? 'var(--color-primary-50)' : 'transparent',
                        color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text)',
                        border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      }}
                    >
                      {entry}
                    </button>
                  );
                }

                return (
                  <label key={entry} className="group flex cursor-pointer items-center gap-3">
                    <Checkbox checked={isActive} onCheckedChange={() => onSelect(entry)} />
                    <span className="text-sm font-medium transition-colors group-hover:text-[var(--color-primary)]" style={{ color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                      {entry}
                    </span>
                  </label>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
