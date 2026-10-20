'use client';

import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';

type Advice = { recommendation: 'accept' | 'counter' | 'decline'; counterPrice: number | null; reasons: string[]; soldMedian: number | null };

const LABEL: Record<Advice['recommendation'], { text: string; tone: string }> = {
  accept: { text: 'Empfehlung: annehmen', tone: 'text-emerald-700' },
  counter: { text: 'Empfehlung: Gegenangebot', tone: 'text-sky-700' },
  decline: { text: 'Empfehlung: ablehnen oder deutlich höher kontern', tone: 'text-rose-700' },
};

/**
 * Seller-side hint for an incoming offer (src/lib/offer-state.ts → offerAdvice).
 * Only a suggestion with its reasons - nothing is sent automatically.
 */
export default function OfferAdvice({ offerId, onUseCounter }: { offerId: string; onUseCounter: (price: number) => void }) {
  const [advice, setAdvice] = useState<Advice | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/offers/${offerId}`)
      .then((r) => r.json())
      .then((r) => { if (!cancelled && r?.success && r.data?.advice) setAdvice(r.data.advice); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [offerId]);

  if (!advice) return null;
  const l = LABEL[advice.recommendation];
  return (
    <div className="mt-3 rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--color-border)' }}>
      <p className={`flex items-center gap-2 font-semibold ${l.tone}`}><Lightbulb size={16} /> {l.text}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {advice.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {advice.counterPrice ? (
        <button type="button" onClick={() => onUseCounter(advice.counterPrice!)} className="mt-3 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
          Gegenangebot {advice.counterPrice.toFixed(2).replace('.', ',')} € vorbereiten
        </button>
      ) : null}
      <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Nur ein Vorschlag - die Entscheidung triffst du.</p>
    </div>
  );
}
