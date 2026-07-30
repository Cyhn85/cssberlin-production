export default function ProductDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb Skeleton */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded animate-pulse"
            style={{
              width: `${40 + i * 20}px`,
              background: 'var(--color-bg-secondary)',
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery Skeleton */}
        <div>
          <div
            className="aspect-square rounded-2xl animate-pulse mb-3"
            style={{ background: 'var(--color-bg-secondary)' }}
          />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-20 h-20 rounded-xl animate-pulse"
                style={{
                  background: 'var(--color-bg-secondary)',
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Product Info Skeleton */}
        <div className="space-y-4">
          {/* Title */}
          <div className="h-8 w-3/4 rounded animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
          {/* Price */}
          <div className="h-10 w-1/4 rounded animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
          {/* Eco Badge */}
          <div className="h-8 w-48 rounded-full animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />

          {/* Attributes */}
          <div className="grid grid-cols-2 gap-3 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 rounded animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
                <div className="h-5 w-24 rounded animate-pulse" style={{ background: 'var(--color-bg-secondary)', animationDelay: `${i * 80}ms` }} />
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="space-y-2 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="h-4 w-full rounded animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
            <div className="h-4 w-5/6 rounded animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
            <div className="h-4 w-2/3 rounded animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <div className="h-12 flex-1 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
            <div className="h-12 flex-1 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-secondary)' }} />
          </div>

          {/* Seller Card */}
          <div
            className="p-4 rounded-2xl animate-pulse mt-4"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full" style={{ background: 'var(--color-bg-tertiary, #e5e7eb)' }} />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 rounded" style={{ background: 'var(--color-bg-tertiary, #e5e7eb)' }} />
                <div className="h-3 w-24 rounded" style={{ background: 'var(--color-bg-tertiary, #e5e7eb)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
