'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Trash2 } from 'lucide-react';

type Saved = { id: string; label: string; query: string; createdAt: string };

/** Saved catalogue searches (daily alert for new items). */
export default function SavedSearches() {
  const [items, setItems] = useState<Saved[] | null>(null);

  useEffect(() => {
    fetch('/api/saved-searches').then((r) => r.json()).then((r) => setItems(r.success ? r.data : [])).catch(() => setItems([]));
  }, []);

  const remove = async (id: string) => {
    await fetch(`/api/saved-searches?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
    setItems((cur) => cur?.filter((i) => i.id !== id) ?? null);
  };

  return (
    <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
      <h3 className="mb-1 font-bold">Gespeicherte Suchen</h3>
      <p className="mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>Wir melden uns höchstens einmal täglich, wenn neue passende Artikel eingestellt werden. Neue Suche: im Katalog filtern und „Suche speichern“ tippen.</p>
      {items === null ? null : items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Noch keine gespeicherten Suchen. <Link href="/catalog" className="font-semibold underline">Zum Katalog</Link></p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
              <Link href={`/catalog?${i.query}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold hover:underline"><Search size={14} className="shrink-0" /> <span className="truncate">{i.label}</span></Link>
              <button onClick={() => void remove(i.id)} aria-label={`Suche ${i.label} löschen`} className="rounded-full p-2 hover:bg-red-50"><Trash2 size={16} className="text-red-500" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
