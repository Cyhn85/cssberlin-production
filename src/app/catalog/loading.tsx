export default function CatalogLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Bar Skeleton */}
      <div className="mb-8">
        <div
          className="h-12 w-full max-w-2xl mx-auto rounded-xl animate-pulse"
          style={{ background: 'var(--color-bg-secondary)' }}
        />
      </div>

      {/* Filter Tags Skeleton */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 rounded-full animate-pulse flex-shrink-0"
            style={{
              width: `${60 + Math.random() * 40}px`,
              background: 'var(--color-bg-secondary)',
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>

      {/* Results Count Skeleton */}
      <div
        className="h-5 w-40 rounded mb-6 animate-pulse"
        style={{ background: 'var(--color-bg-secondary)' }}
      />

      {/* Product Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden animate-pulse"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              animationDelay: `${i * 50}ms`,
            }}
          >
            {/* Image Skeleton */}
            <div className="aspect-[3/4]" style={{ background: 'var(--color-bg-tertiary, #e5e7eb)' }} />

            {/* Content Skeleton */}
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 rounded" style={{ background: 'var(--color-bg-tertiary, #e5e7eb)' }} />
              <div className="h-3 w-1/2 rounded" style={{ background: 'var(--color-bg-tertiary, #e5e7eb)' }} />
              <div className="h-5 w-1/3 rounded" style={{ background: 'var(--color-bg-tertiary, #e5e7eb)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
