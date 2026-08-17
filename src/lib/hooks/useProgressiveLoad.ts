'use client';

import { useEffect, useRef, useState } from 'react';

const AUTO_LOAD_LIMIT = 3;

/**
 * Auto-loads the next page via scroll for the first AUTO_LOAD_LIMIT loads,
 * then requires an explicit "Weitere laden" click. Deliberate friction so a
 * page can't be trivially scraped by an infinite auto-scroll bot, without
 * ever hiding real content behind a login wall.
 */
export function useProgressiveLoad(options: { hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  const { hasMore, loading, onLoadMore } = options;
  const [autoLoadCount, setAutoLoadCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canAutoLoad = autoLoadCount < AUTO_LOAD_LIMIT;

  useEffect(() => {
    if (!hasMore || !canAutoLoad) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          setAutoLoadCount((count) => count + 1);
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, canAutoLoad, loading, onLoadMore]);

  return { sentinelRef, showManualButton: hasMore && !canAutoLoad };
}
