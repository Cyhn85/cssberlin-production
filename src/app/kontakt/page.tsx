import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { businessProfile } from '@/config/business-profile';
import ContactForm from '@/components/help/ContactForm';

export const metadata: Metadata = {
  title: 'Kontakt & Meldungen',
  description: 'Schreib dem Team von cssberlin.de oder melde rechtswidrige Inhalte und Regelverstöße.',
  alternates: { canonical: '/kontakt' },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen pb-20 pt-8" style={{ background: 'var(--color-bg)' }}>
      <div className="container grid max-w-5xl gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border bg-[var(--color-bg-card)] p-6 shadow-sm md:p-8" style={{ borderColor: 'var(--color-border)' }}>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Kontakt</h1>
          <p className="mb-6 mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Viele Antworten findest du sofort im <Link href="/hilfe" className="font-semibold underline">Hilfe-Center</Link>. Für alles andere: schreib uns, wir antworten in der Regel innerhalb von 24 Stunden.
          </p>
          <Suspense fallback={null}>
            <ContactForm />
          </Suspense>
        </div>
        <aside className="space-y-4">
          <div className="rounded-3xl border bg-[var(--color-bg-card)] p-6 text-sm" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="mb-3 font-bold">Direkt erreichen</h2>
            <p className="flex items-center gap-2"><Mail size={16} /> <a href={businessProfile.publicEmailHref} className="underline">{businessProfile.publicEmail}</a></p>
            <p className="mt-2 flex items-center gap-2"><Phone size={16} /> <a href={businessProfile.phoneHref}>{businessProfile.phoneDisplay}</a></p>
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{businessProfile.businessName} · {businessProfile.streetAddress} · {businessProfile.postalCode} {businessProfile.city}</p>
          </div>
          <div className="rounded-3xl p-6 text-sm" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-dark)' }}>
            <h2 className="mb-2 font-bold">Inhalte melden</h2>
            <p>Fälschung, Betrug oder Rechtsverletzung entdeckt? Wähle oben „Inhalt melden“ und füge den Link ein. <Link href="/hilfe/melden" className="font-semibold underline">So läuft die Prüfung ab</Link></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
