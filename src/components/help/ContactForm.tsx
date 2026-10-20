'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Loader2 } from 'lucide-react';

const TOPICS = [
  { id: 'allgemein', label: 'Allgemeine Frage' },
  { id: 'bestellung', label: 'Frage zu einer Bestellung' },
  { id: 'konto', label: 'Konto & Daten' },
  { id: 'melden', label: 'Inhalt melden (Artikel, Nutzer, Nachricht)' },
  { id: 'presse', label: 'Presse & Kooperation' },
] as const;

export default function ContactForm() {
  const sp = useSearchParams();
  const { data: session } = useSession();
  const initialTopic = TOPICS.find((t) => t.id === sp.get('thema'))?.id ?? 'allgemein';
  const [f, setF] = useState({
    topic: initialTopic as string,
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    subject: '',
    message: '',
    url: sp.get('url') || '',
    website: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const input = 'w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, url: f.url || undefined, website: f.website || undefined }),
      });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r?.success) throw new Error(r?.error || 'Senden fehlgeschlagen.');
      setTicket(r.data.ticket);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <div className="rounded-2xl bg-green-50 p-6 text-center text-green-800" role="status">
        <CheckCircle2 className="mx-auto mb-2" />
        <p className="font-bold">Danke, deine Nachricht ist angekommen.</p>
        <p className="mt-1 text-sm">Vorgangsnummer: <strong>{ticket}</strong>. Wir antworten an {f.email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="c-topic" className="mb-1 block text-sm font-semibold">Thema</label>
        <select id="c-topic" className={input} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
          {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="mb-1 block text-sm font-semibold">Name</label>
          <input id="c-name" className={input} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="c-email" className="mb-1 block text-sm font-semibold">E-Mail</label>
          <input id="c-email" type="email" className={input} autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </div>
      </div>
      {f.topic === 'melden' ? (
        <div>
          <label htmlFor="c-url" className="mb-1 block text-sm font-semibold">Link zum Inhalt</label>
          <input id="c-url" className={input} placeholder="https://cssberlin.de/product/…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} required />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Bitte begründe unten, warum der Inhalt rechtswidrig ist oder gegen unsere Regeln verstößt.</p>
        </div>
      ) : null}
      <div>
        <label htmlFor="c-subject" className="mb-1 block text-sm font-semibold">Betreff</label>
        <input id="c-subject" className={input} value={f.subject} maxLength={120} onChange={(e) => setF({ ...f, subject: e.target.value })} required />
      </div>
      <div>
        <label htmlFor="c-message" className="mb-1 block text-sm font-semibold">Nachricht</label>
        <textarea id="c-message" className={`${input} min-h-36`} value={f.message} maxLength={4000} onChange={(e) => setF({ ...f, message: e.target.value })} required />
      </div>
      {/* honeypot */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <p className="text-xs text-[var(--color-text-muted)]">Wir verwenden deine Angaben nur zur Bearbeitung deiner Anfrage (siehe <a href="/datenschutz" className="underline">Datenschutz</a>).</p>
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: 'var(--color-orange)' }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Absenden
      </button>
    </form>
  );
}
