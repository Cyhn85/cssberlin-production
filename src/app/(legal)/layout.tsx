import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Server component: the legal pages are static text. This layout used to be a
 * client component only to fade the article in with framer-motion, which made
 * every legal page ship and hydrate the animation library. A CSS fade is enough.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white pb-16 pt-24 dark:bg-[#0D1117]">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft size={16} />
            Zurück zur Startseite
          </Link>
        </div>
        <article className="prose prose-slate max-w-none animate-[fadeUp_.45s_ease-out_both] dark:prose-invert">{children}</article>
      </div>
    </div>
  );
}
