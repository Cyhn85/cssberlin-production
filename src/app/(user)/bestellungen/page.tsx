'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ChevronRight, Loader2, PackageSearch } from 'lucide-react';
import { formatPrice, formatRelativeTime } from '@/lib/utils/condition-map';

/**
 * "Meine Bestellungen" - bought and sold in one place (Vinted style):
 * side tabs Verkauft / Gekauft, status chips Alle / In Bearbeitung / Abgeschlossen / Storniert.
 * The detail pages stay where they are (/sales/[id], /purchases/[id]).
 */

type Order = {
  id: string;
  totalAmount: number;
  itemPrice: number;
  status: string;
  createdAt: string;
  shippingCarrier: string | null;
  cancelRequestedAt?: string | null;
  product: { title: string; images: Array<{ url: string; thumbUrl?: string | null }> };
  seller?: { name: string | null };
  buyer?: { name: string | null };
  review?: { id: string } | null;
};

type Side = 'verkauft' | 'gekauft';
type Filter = 'alle' | 'offen' | 'abgeschlossen' | 'storniert';

const OPEN = new Set(['PENDING_PAYMENT', 'PENDING_PICKUP', 'PAID', 'SHIPPED', 'DELIVERED', 'DISPUTED']);
const DONE = new Set(['COMPLETED']);
const CANCELLED = new Set(['CANCELLED', 'REFUNDED']);

/** One line that tells you what is going on - and whether YOU have to act. */
function statusLine(o: Order, side: Side): { text: string; action: boolean } {
  const pickup = o.shippingCarrier === 'PICKUP';
  switch (o.status) {
    case 'PENDING_PICKUP':
      return side === 'verkauft' ? { text: 'Abholung vereinbaren - nach Übergabe bestätigen', action: true } : { text: 'Abholung angefragt - Termin im Chat vereinbaren', action: false };
    case 'PAID':
      if (o.cancelRequestedAt) return side === 'verkauft' ? { text: 'Stornierungsanfrage beantworten', action: true } : { text: 'Stornierung angefragt', action: false };
      return side === 'verkauft' ? { text: 'Bezahlt - bitte versenden', action: true } : { text: 'Bezahlt - wartet auf Versand', action: false };
    case 'SHIPPED':
      return side === 'gekauft' ? { text: 'Unterwegs - Empfang bestätigen, wenn alles passt', action: true } : { text: 'Versendet', action: false };
    case 'DELIVERED':
      return side === 'gekauft' ? { text: 'Zugestellt - Empfang bestätigen', action: true } : { text: 'Zugestellt', action: false };
    case 'DISPUTED':
      return { text: 'Problem gemeldet - wird geprüft', action: side === 'verkauft' };
    case 'COMPLETED':
      return o.review ? { text: pickup ? 'Abgeholt & abgeschlossen' : 'Abgeschlossen', action: false } : { text: 'Abgeschlossen - jetzt bewerten', action: true };
    case 'CANCELLED':
      return { text: 'Storniert', action: false };
    case 'REFUNDED':
      return { text: 'Erstattet', action: false };
    case 'PENDING_PAYMENT':
      return { text: 'Zahlung ausstehend', action: false };
    default:
      return { text: o.status, action: false };
  }
}

function BestellungenInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [side, setSide] = useState<Side>(sp.get('tab') === 'gekauft' ? 'gekauft' : 'verkauft');
  const [filter, setFilter] = useState<Filter>((['alle', 'offen', 'abgeschlossen', 'storniert'] as Filter[]).find((f) => f === sp.get('status')) ?? 'offen');
  const [data, setData] = useState<{ purchases: Order[]; sales: Order[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((r) => (r.success ? setData(r.data) : setError(r.error || 'Bestellungen konnten nicht geladen werden.')))
      .catch(() => setError('Bestellungen konnten nicht geladen werden.'));
  }, []);

  // default side: wherever something is waiting for me
  useEffect(() => {
    if (!data || sp.get('tab')) return;
    if (data.sales.length === 0 && data.purchases.length > 0) setSide('gekauft');
  }, [data, sp]);

  const sync = (s: Side, f: Filter) => router.replace(`/bestellungen?tab=${s}&status=${f}`, { scroll: false });

  const list = useMemo(() => {
    const src = (side === 'verkauft' ? data?.sales : data?.purchases) ?? [];
    return src.filter((o) => filter === 'alle' || (filter === 'offen' ? OPEN.has(o.status) : filter === 'abgeschlossen' ? DONE.has(o.status) : CANCELLED.has(o.status)));
  }, [data, side, filter]);

  const todo = (s: Side) => ((s === 'verkauft' ? data?.sales : data?.purchases) ?? []).filter((o) => statusLine(o, s).action).length;

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'alle', label: 'Alle' },
    { id: 'offen', label: 'In Bearbeitung' },
    { id: 'abgeschlossen', label: 'Abgeschlossen' },
    { id: 'storniert', label: 'Storniert' },
  ];

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <div className="flex flex-col gap-6 md:flex-row">
          <aside className="shrink-0 md:w-56">
            <h1 className="mb-4 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Meine Bestellungen</h1>
            <nav className="flex gap-2 md:flex-col md:gap-1" aria-label="Bestellungen">
              {(['verkauft', 'gekauft'] as Side[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setSide(s); sync(s, filter); }}
                  aria-current={side === s ? 'page' : undefined}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${side === s ? 'bg-[rgba(45,106,79,.14)] text-[var(--color-text)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}`}
                >
                  {s === 'verkauft' ? 'Verkauft' : 'Gekauft'}
                  {data && todo(s) > 0 ? <span className="rounded-full bg-[var(--color-orange)] px-2 py-0.5 text-[11px] font-bold text-white">{todo(s)}</span> : null}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 rounded-3xl border bg-[var(--color-bg-card)]" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap gap-2 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
              {chips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setFilter(c.id); sync(side, c.id); }}
                  aria-pressed={filter === c.id}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${filter === c.id ? 'border-[var(--color-primary)] bg-[rgba(45,106,79,.14)] font-semibold text-[var(--color-text)]' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {error ? <p className="p-6 text-sm text-red-600">{error}</p> : !data ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
            ) : list.length === 0 ? (
              <div className="p-12 text-center">
                <PackageSearch size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {side === 'verkauft' ? 'Hier erscheinen deine Verkäufe.' : 'Hier erscheinen deine Käufe.'} {filter !== 'alle' ? 'In diesem Filter ist gerade nichts.' : ''}
                </p>
                <Link href={side === 'verkauft' ? '/upload' : '/catalog'} className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: 'var(--color-orange)' }}>
                  {side === 'verkauft' ? 'Artikel verkaufen' : 'Katalog entdecken'}
                </Link>
              </div>
            ) : (
              <ul>
                {list.map((o) => {
                  const line = statusLine(o, side);
                  const img = o.product.images[0]?.thumbUrl || o.product.images[0]?.url;
                  return (
                    <li key={o.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                      <Link href={side === 'verkauft' ? `/sales/${o.id}` : `/purchases/${o.id}`} className="flex items-center gap-4 p-4 hover:bg-[var(--color-bg-secondary)]">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-secondary)]">
                          {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
                          {line.action ? <AlertCircle size={18} className="absolute -bottom-0.5 -left-0.5 rounded-full bg-[var(--color-bg-card)] text-red-600" aria-label="Aktion nötig" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{o.product.title}</p>
                          <p className="text-sm">{formatPrice(o.totalAmount)}</p>
                          <p className={`text-xs ${line.action ? 'font-semibold text-[var(--color-orange)]' : ''}`} style={line.action ? undefined : { color: 'var(--color-text-muted)' }}>
                            {line.text} · {side === 'verkauft' ? `an ${o.buyer?.name || 'Käufer'}` : `von ${o.seller?.name || 'Verkäufer'}`} · {formatRelativeTime(o.createdAt)}
                          </p>
                        </div>
                        <ChevronRight size={18} className="shrink-0 opacity-50" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function BestellungenPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <BestellungenInner />
    </Suspense>
  );
}
