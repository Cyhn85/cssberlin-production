import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { HELP_ARTICLES, HELP_CATEGORIES, getHelpArticle } from '@/content/help';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = getHelpArticle(slug);
  if (!a) return {};
  return { title: `${a.title} - Hilfe`, description: a.summary, alternates: { canonical: `/hilfe/${a.slug}` } };
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();
  const category = HELP_CATEGORIES.find((c) => c.id === article.category);
  const related = (article.related || []).map(getHelpArticle).filter(Boolean) as NonNullable<ReturnType<typeof getHelpArticle>>[];

  return (
    <div className="min-h-screen pb-20 pt-8" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-3xl">
        <nav aria-label="Brotkrumen" className="mb-6 flex items-center gap-2 text-sm">
          <Link href="/hilfe" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--color-primary)' }}><ChevronLeft size={16} /> Hilfe-Center</Link>
          {category ? <span style={{ color: 'var(--color-text-muted)' }}>/ {category.label}</span> : null}
        </nav>

        <article className="rounded-3xl border bg-[var(--color-bg-card)] p-6 shadow-sm md:p-10" style={{ borderColor: 'var(--color-border)' }}>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>{article.title}</h1>
          <p className="mt-3 text-base" style={{ color: 'var(--color-text-secondary)' }}>{article.summary}</p>

          {article.sections.map((s) => (
            <section key={s.heading} className="mt-8">
              <h2 className="mb-3 text-lg font-bold" style={{ color: 'var(--color-text)' }}>{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="mb-3 text-sm leading-7" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
              ))}
              {s.list?.length ? (
                <ul className="list-disc space-y-2 pl-5 text-sm leading-7" style={{ color: 'var(--color-text-secondary)' }}>
                  {s.list.map((li) => <li key={li}>{li}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        {related.length ? (
          <aside className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Passend dazu</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <Link key={r.slug} href={`/hilfe/${r.slug}`} className="rounded-2xl border bg-[var(--color-bg-card)] p-4 hover:shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{r.title}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{r.summary}</p>
                </Link>
              ))}
            </div>
          </aside>
        ) : null}

        <p className="mt-10 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Noch Fragen? <Link href="/kontakt" className="font-semibold" style={{ color: 'var(--color-primary)' }}>Schreib uns</Link>
          {article.slug === 'melden' ? <> · <Link href="/kontakt?thema=melden" className="font-semibold" style={{ color: 'var(--color-primary)' }}>Zum Meldeformular</Link></> : null}
        </p>
      </div>
    </div>
  );
}
