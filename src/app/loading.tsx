import { Leaf } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="relative mb-4">
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center animate-pulse"
            style={{ background: 'var(--gradient-mars-earth)' }}
          >
            <Leaf size={28} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Loading Text */}
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Wird geladen...
        </p>

        {/* Shimmer Bar */}
        <div
          className="mt-3 mx-auto h-1 w-32 rounded-full overflow-hidden"
          style={{ background: 'var(--color-bg-secondary)' }}
        >
          <div
            className="h-full w-1/3 rounded-full animate-shimmer"
            style={{ background: 'var(--gradient-mars-earth)' }}
          />
        </div>
      </div>
    </div>
  );
}
