'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Download, Info, Landmark, Loader2, ShoppingCart } from 'lucide-react';
import { formatPrice } from '@/lib/utils/condition-map';

type Tx = { id: string; kind: 'Verkauft' | 'Gekauft'; title: string; amount: number; status: string; cash: boolean; date: string; href: string };
type Wallet = { pending: number; available: number; cash: number; payoutsEnabled: boolean; transactions: Tx[]; incomeYears: number[] };

const STATUS_NOTE: Record<string, string> = {
  CANCELLED: 'storniert',
  REFUNDED: 'erstattet',
  PENDING_PICKUP: 'Abholung offen',
  PAID: 'in Bearbeitung',
  SHIPPED: 'unterwegs',
  DELIVERED: 'zugestellt',
  DISPUTED: 'Problem gemeldet',
};

/** Geldbeutel - Guthaben, Transaktionen, Einkommensbericht (Vinted style). */
export default function WalletPage() {
  const [w, setW] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'guthaben' | 'einkommen'>('guthaben');

  useEffect(() => {
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((r) => (r.success ? setW(r.data) : setError(r.error || 'Geldbeutel konnte nicht geladen werden.')))
      .catch(() => setError('Geldbeutel konnte nicht geladen werden.'));
  }, []);

  const thisYear = new Date().getFullYear();
  const years = w ? Array.from(new Set([thisYear, ...w.incomeYears])).sort((a, b) => b - a) : [thisYear];

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <div className="flex flex-col gap-6 md:flex-row">
          <aside className="shrink-0 md:w-56">
            <h1 className="mb-4 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Geldbeutel</h1>
            <nav className="flex gap-2 md:flex-col md:gap-1">
              {([['guthaben', 'Guthaben & Transaktionen'], ['einkommen', 'Einkommen']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined}
                  className={`rounded-xl px-4 py-3 text-left text-sm font-semibold ${section === id ? 'bg-[rgba(45,106,79,.14)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}`}>
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 space-y-6">
            {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : !w ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
            ) : section === 'guthaben' ? (
              <>
                <div className="rounded-3xl border bg-[var(--color-bg-card)]" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between border-b px-6 py-4 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <span>Ausstehender Betrag</span>
                    <span className="flex items-center gap-1 font-semibold" title="Online-Verkäufe, die bezahlt, aber noch nicht abgeschlossen sind">{formatPrice(w.pending)} <Info size={14} /></span>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-3xl font-bold">{formatPrice(w.available)}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Verfügbares Guthaben</p>
                    <div className="mt-6 flex justify-center gap-10">
                      <div className="flex flex-col items-center gap-1">
                        <button disabled={!w.payoutsEnabled || w.available <= 0} className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] disabled:opacity-40" aria-label="Auszahlen"><Landmark size={20} /></button>
                        <span className="text-xs">Auszahlen</span>
                      </div>
                      <Link href="/catalog" className="flex flex-col items-center gap-1">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]"><ShoppingCart size={20} /></span>
                        <span className="text-xs">Einkaufen</span>
                      </Link>
                    </div>
                    {!w.payoutsEnabled ? (
                      <p className="mx-auto mt-5 max-w-md text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Auszahlungen werden mit dem Start der Online-Zahlung freigeschaltet. Verkäufe per Abholung bezahlt der Käufer bar bei der Übergabe{w.cash > 0 ? ` - bisher ${formatPrice(w.cash)}` : ''}.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-3xl border bg-[var(--color-bg-card)]" style={{ borderColor: 'var(--color-border)' }}>
                  <h2 className="border-b px-6 py-4 text-sm font-semibold" style={{ borderColor: 'var(--color-border)' }}>Transaktionen</h2>
                  {w.transactions.length === 0 ? (
                    <p className="p-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Noch keine Käufe oder Verkäufe.</p>
                  ) : (
                    <ul>
                      {w.transactions.map((t) => {
                        const void_ = t.status === 'CANCELLED' || t.status === 'REFUNDED';
                        return (
                          <li key={`${t.kind}-${t.id}`} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                            <Link href={t.href} className="flex items-center gap-3 px-6 py-4 hover:bg-[var(--color-bg-secondary)]">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold">{t.kind}{t.cash ? ' · bar' : ''}{STATUS_NOTE[t.status] ? <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>({STATUS_NOTE[t.status]})</span> : null}</p>
                                <p className="truncate text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t.title}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-semibold ${void_ ? 'line-through opacity-50' : t.amount < 0 ? 'text-red-600' : ''}`}>{t.amount < 0 ? '−' : ''}{formatPrice(Math.abs(t.amount))}</p>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(t.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                              </div>
                              <ChevronRight size={16} className="opacity-50" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-3xl border bg-[var(--color-bg-card)] p-6" style={{ borderColor: 'var(--color-border)' }}>
                <h2 className="mb-1 text-sm font-semibold">Einkommensbericht</h2>
                <p className="mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>Alle abgeschlossenen Verkäufe eines Jahres als CSV (Excel-kompatibel) - hilfreich für deine Unterlagen. Plattformen melden Verkäufer ab 30 Verkäufen oder 2.000 € im Jahr an das Finanzamt (DAC7).</p>
                <ul className="space-y-2">
                  {years.map((y) => (
                    <li key={y} className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                      <span className="text-sm">Jährlicher Einkommensbericht {y}</span>
                      <a href={`/api/wallet?report=income&year=${y}`} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                        <Download size={14} /> Herunterladen
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>Details zur Meldepflicht: <Link href="/dac7" className="underline">DAC7 / PStTG</Link></p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
