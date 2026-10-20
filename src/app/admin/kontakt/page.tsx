'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, Flag, Check, RotateCcw } from 'lucide-react';

type Item = { id: string; topic: string; name: string; email: string; subject: string; message: string; url: string | null; status: string; createdAt: string };

export default function AdminContactPage() {
  const [status, setStatus] = useState<'OPEN' | 'DONE'>('OPEN');
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (s = status) => {
    setItems(null);
    const r = await fetch(`/api/admin/contact?status=${s}`).then((x) => x.json()).catch(() => null);
    if (r?.success) setItems(r.data);
    else setError(r?.error || 'Laden fehlgeschlagen.');
  };

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const mark = async (id: string, next: 'OPEN' | 'DONE') => {
    await fetch('/api/admin/contact', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: next }) });
    setItems((cur) => cur?.filter((i) => i.id !== id) ?? null);
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Kontakt & Meldungen</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">Anfragen aus /kontakt. Meldungen (DSA) bitte zeitnah prüfen und dem Melder antworten.</p>
      <div className="mb-4 flex gap-2">
        {(['OPEN', 'DONE'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-4 py-1.5 text-sm ${status === s ? 'border-[var(--color-primary)] bg-[rgba(45,106,79,.14)]' : 'border-[var(--color-border)]'}`}>
            {s === 'OPEN' ? 'Offen' : 'Erledigt'}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!items ? <Loader2 className="animate-spin" /> : items.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Keine Einträge.</p> : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="rounded-2xl border bg-[var(--color-bg-card)] p-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  {i.topic === 'melden' ? <Flag size={16} className="text-red-600" /> : <Mail size={16} />} {i.subject}
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">#{i.id.slice(-8).toUpperCase()} · {i.topic} · {new Date(i.createdAt).toLocaleString('de-DE')}</span>
                </p>
                {i.status === 'OPEN' ? (
                  <button onClick={() => mark(i.id, 'DONE')} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"><Check size={14} /> Erledigt</button>
                ) : (
                  <button onClick={() => mark(i.id, 'OPEN')} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"><RotateCcw size={14} /> Wieder öffnen</button>
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{i.name} · <a href={`mailto:${i.email}?subject=${encodeURIComponent(`Re: ${i.subject} (#${i.id.slice(-8).toUpperCase()})`)}`} className="underline">{i.email}</a></p>
              {i.url ? <p className="mt-1 break-all text-sm"><a href={i.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">{i.url}</a></p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm">{i.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
