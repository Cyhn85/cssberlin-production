'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

type Article = { slug: string; title: string; summary: string; text: string };
type Faq = { q: string; a: string; slug?: string };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Instant search over help articles and FAQ (all content is already on the page - no request). */
export default function HelpSearch({ articles, faq }: { articles: Article[]; faq: Faq[] }) {
  const [q, setQ] = useState('');
  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);

  const results = useMemo(() => {
    if (!words.length) return null;
    const score = (hay: string) => words.reduce((s, w) => s + (norm(hay).includes(w) ? 1 : 0), 0);
    const a = articles
      .map((x) => ({ x, s: score(x.title) * 3 + score(x.summary) * 2 + score(x.text) }))
      .filter((r) => r.s > 0)
      .sort((p, n) => n.s - p.s)
      .slice(0, 5);
    const f = faq
      .map((x) => ({ x, s: score(x.q) * 2 + score(x.a) }))
      .filter((r) => r.s > 0)
      .sort((p, n) => n.s - p.s)
      .slice(0, 5);
    return { a, f };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mx-auto max-w-2xl">
      <label htmlFor="help-search" className="sr-only">Hilfe durchsuchen</label>
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input
          id="help-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="z. B. stornieren, Abholung, Versandkosten, Käuferschutz"
          className="h-14 w-full rounded-2xl border bg-[var(--color-bg-card)] pl-11 pr-4 text-sm shadow-sm outline-none focus:border-[var(--color-primary)]"
          style={{ borderColor: 'var(--color-border)' }}
        />
      </div>
      {results ? (
        <div className="mt-3 rounded-2xl border bg-[var(--color-bg-card)] p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }} aria-live="polite">
          {results.a.length === 0 && results.f.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Keine Treffer. <Link href="/kontakt" className="font-semibold underline">Schreib uns</Link>.</p>
          ) : null}
          {results.a.map(({ x }) => (
            <Link key={x.slug} href={`/hilfe/${x.slug}`} className="block rounded-xl p-2 hover:bg-[var(--color-bg-secondary)]">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{x.title}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{x.summary}</p>
            </Link>
          ))}
          {results.f.map(({ x }) => (
            <div key={x.q} className="rounded-xl p-2">
              <p className="text-sm font-semibold">{x.q}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{x.a}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
