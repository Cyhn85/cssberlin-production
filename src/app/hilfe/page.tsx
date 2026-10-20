import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { FAQ, HELP_ARTICLES, HELP_CATEGORIES } from '@/content/help';
import HelpSearch from '@/components/help/HelpSearch';

export const metadata: Metadata = {
  title: 'Hilfe-Center & FAQ',
  description: 'Antworten zu Kaufen, Verkaufen, Preisvorschlägen, Zahlung, Versand, Abholung, Stornierung und Käuferschutz auf cssberlin.de.',
  alternates: { canonical: '/hilfe' },
};

export default function HelpCenterPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <div className="min-h-screen pb-20 pt-8" style={{ background: 'var(--color-bg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="container max-w-5xl">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>Wie können wir helfen?</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>Regeln, Fristen und Abläufe auf einen Blick - von Preisvorschlag bis Käuferschutz.</p>
        </header>

        <HelpSearch
          articles={HELP_ARTICLES.map((a) => ({ slug: a.slug, title: a.title, summary: a.summary, text: a.sections.map((s) => `${s.heading} ${s.paragraphs.join(' ')} ${(s.list || []).join(' ')}`).join(' ') }))}
          faq={FAQ}
        />

        <section className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Themen">
          {HELP_CATEGORIES.map((cat) => {
            const items = HELP_ARTICLES.filter((a) => a.category === cat.id);
            if (!items.length) return null;
            return (
              <div key={cat.id} className="rounded-3xl border bg-[var(--color-bg-card)] p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{cat.label}</h2>
                <p className="mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>{cat.description}</p>
                <ul className="space-y-2">
                  {items.map((a) => (
                    <li key={a.slug}>
                      <Link href={`/hilfe/${a.slug}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>{a.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="mt-14" aria-labelledby="faq-title">
          <h2 id="faq-title" className="mb-6 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>Häufige Fragen</h2>
          {HELP_CATEGORIES.map((cat) => {
            const items = FAQ.filter((f) => f.category === cat.id);
            if (!items.length) return null;
            return (
              <div key={cat.id} className="mb-8">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{cat.label}</h3>
                <div className="divide-y rounded-2xl border bg-[var(--color-bg-card)]" style={{ borderColor: 'var(--color-border)' }}>
                  {items.map((f) => (
                    <details key={f.q} className="group p-4" style={{ borderColor: 'var(--color-border)' }}>
                      <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden" style={{ color: 'var(--color-text)' }}>
                        <span className="flex items-center justify-between gap-4">{f.q}<span className="text-lg transition-transform group-open:rotate-45" aria-hidden>+</span></span>
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {f.a} {f.slug ? <Link href={`/hilfe/${f.slug}`} className="font-semibold" style={{ color: 'var(--color-primary)' }}>Mehr dazu</Link> : null}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-10 rounded-3xl p-8 text-center" style={{ background: 'var(--color-primary-50)' }}>
          <MessageCircle className="mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-primary-dark)' }}>Nichts gefunden?</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-primary)' }}>Frag unseren KI-Assistenten unten rechts oder schreib uns - wir antworten in der Regel innerhalb von 24 Stunden.</p>
          <Link href="/kontakt" className="mt-4 inline-block rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: 'var(--color-orange)' }}>Kontakt aufnehmen</Link>
        </section>
      </div>
    </div>
  );
}
