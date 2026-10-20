'use client';

import dynamic from 'next/dynamic';

/**
 * Page chrome that is not needed for the first paint: the cookie banner and the
 * scroll-to-top button pull in framer-motion. Loading them after hydration keeps
 * that code out of the critical bundle of every page.
 */
const CookieBanner = dynamic(() => import('@/components/ui/CookieBanner'), { ssr: false });
const ScrollToTop = dynamic(() => import('@/components/ui/ScrollToTop'), { ssr: false });

export default function DeferredChrome() {
  return (
    <>
      <CookieBanner />
      <ScrollToTop />
    </>
  );
}
