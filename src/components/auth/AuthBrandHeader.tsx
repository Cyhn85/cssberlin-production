import Link from 'next/link';

/**
 * Shared wordmark for auth/checkout-style screens: "CSS" (the Climate Smart
 * Solutions acronym) rendered large, "berlin" smaller alongside it, with the
 * tagline underneath. Mirrors the same split used in Header.tsx so the brand
 * reads consistently across the site - not a separate, one-off design.
 */
export default function AuthBrandHeader() {
  return (
    <Link href="/" className="mb-5 inline-flex flex-col items-center gap-1.5 text-center">
      <span className="text-gradient-mars-earth" style={{ fontFamily: 'var(--font-display)' }}>
        <span className="text-4xl font-extrabold tracking-tight">css</span>
        <span className="text-2xl font-bold tracking-tight">berlin</span>
      </span>
      <span
        className="text-[11px] font-semibold uppercase"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.16em' }}
      >
        Climate Smart Solutions
      </span>
    </Link>
  );
}
