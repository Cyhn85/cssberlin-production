import HomePageClient from './HomePageClient';

// The homepage's own tagline promises "live, not a static placeholder" - but
// this route was being served from Next.js's static Full Route Cache
// (x-nextjs-cache: HIT, Cache-Control: s-maxage=31536000), so every visitor
// and Cloudflare kept reusing whatever HTML shell/JS bundle was cached at
// build time, sometimes stale for hours regardless of a hard refresh.
// force-dynamic disables that caching for this route entirely.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <HomePageClient />;
}
