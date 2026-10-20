'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, X, Info, Gauge, Clock } from 'lucide-react';
import { offerPolicy } from '@/config/marketplace-policy';

type OfferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  productPrice: number;
  productImage: string;
  onSuccess?: () => void;
};

type Chance = { probability: number; band: 'hoch' | 'mittel' | 'niedrig' };
type Advice = {
  minimum: number;
  sellerRule: boolean;
  available: boolean;
  quick: Array<{ pct: number; amount: number } & Chance>;
};

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const BAND_STYLE: Record<Chance['band'], { color: string; label: string }> = {
  hoch: { color: '#15803d', label: 'gute Chancen' },
  mittel: { color: '#b45309', label: 'mittlere Chancen' },
  niedrig: { color: '#b91c1c', label: 'geringe Chancen' },
};

/** Same formula as acceptanceChance() in src/lib/offer-state.ts, without the age/interest terms (server adds those for the quick picks). */
function roughChance(list: number, price: number): Chance {
  const p = Math.max(0.05, Math.min(0.95, 0.85 - (1 - price / list) * 1.6));
  return { probability: p, band: p >= 0.6 ? 'hoch' : p >= 0.35 ? 'mittel' : 'niedrig' };
}

export default function OfferModal({ isOpen, onClose, productId, productTitle, productPrice, productImage, onSuccess }: OfferModalProps) {
  const [customPrice, setCustomPrice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const minOffer = advice?.minimum ?? Math.ceil(productPrice * offerPolicy.minPercent) / 100;

  useEffect(() => {
    if (!isOpen) return;
    setCustomPrice('');
    setNote('');
    setError('');
    setSuccess('');
    setIsSubmitting(false);
    let cancelled = false;
    fetch(`/api/offers/advice?productId=${encodeURIComponent(productId)}`)
      .then(async (r) => {
        if (r.status === 401) {
          // not signed in: go to login and come back to this product with the offer window open
          const back = `${window.location.pathname}?angebot=1`;
          window.location.assign(`/login?callbackUrl=${encodeURIComponent(back)}`);
          return;
        }
        const j = await r.json().catch(() => null);
        if (!cancelled && j?.success) setAdvice(j.data);
      })
      .catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, productId, onClose]);

  const parsedPrice = Number(customPrice.replace(',', '.'));
  const validNumber = customPrice !== '' && !Number.isNaN(parsedPrice);
  const tooLow = validNumber && parsedPrice < minOffer;
  const tooHigh = validNumber && parsedPrice >= productPrice;
  const chance = validNumber && !tooLow && !tooHigh ? roughChance(productPrice, parsedPrice) : null;
  const isSubmitDisabled = !validNumber || tooLow || tooHigh || isSubmitting || advice?.available === false;

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, offeredPrice: Math.round(parsedPrice * 100) / 100, message: note.trim() || undefined }),
      });
      if (response.status === 401) {
        window.location.assign(`/login?callbackUrl=${encodeURIComponent(`${window.location.pathname}?angebot=1`)}`);
        return;
      }
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        setError(result?.error || 'Angebot konnte nicht gesendet werden.');
        return;
      }
      setSuccess(`Angebot gesendet. Der Verkäufer hat ${offerPolicy.answerHours} Stunden Zeit zu antworten - wir benachrichtigen dich.`);
      onSuccess?.();
      window.setTimeout(onClose, 1600);
    } catch {
      setError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const quick = advice?.quick ?? offerPolicy.quickDiscounts.map((pct) => {
    const amount = Math.max(minOffer, Math.round(productPrice * (100 - pct)) / 100);
    return { pct, amount, ...roughChance(productPrice, amount) };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-[var(--color-bg-card)] shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 id="offer-title" className="ml-6 flex-1 text-center text-lg font-bold text-[var(--color-text)]">Preis vorschlagen</h2>
          <button onClick={onClose} aria-label="Schließen" className="rounded-full p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"><X size={20} /></button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              {productImage ? <img src={productImage} alt={productTitle} className="h-full w-full object-cover" /> : null}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text)]">{productTitle}</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Preis: {eur(productPrice)}</p>
            </div>
          </div>

          {advice?.available === false ? (
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Dieser Artikel ist gerade reserviert oder verkauft - Preisvorschläge sind nicht möglich.</p>
          ) : null}

          <div className="mb-5 grid grid-cols-3 gap-3">
            {quick.map((q) => (
              <button
                key={q.pct}
                type="button"
                onClick={() => { setCustomPrice(q.amount.toFixed(2)); setError(''); }}
                className={`rounded-xl border-2 p-3 text-left transition-colors ${Math.abs(parsedPrice - q.amount) < 0.005 ? 'border-[var(--color-primary)] bg-[rgba(45,106,79,.14)]' : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}`}
              >
                <span className="block font-bold text-[var(--color-text)]">{eur(q.amount)}</span>
                <span className="text-xs text-[var(--color-primary)]">−{q.pct} %</span>
                <span className="mt-1 block text-[11px]" style={{ color: BAND_STYLE[q.band].color }}>{BAND_STYLE[q.band].label}</span>
              </button>
            ))}
          </div>

          <label htmlFor="offer-price" className="text-xs font-semibold text-[var(--color-text-secondary)]">Dein Preis in €</label>
          <div className="mb-2 border-b border-[var(--color-border)] pb-2">
            <input
              id="offer-price"
              type="text"
              inputMode="decimal"
              value={customPrice}
              onChange={(e) => { setCustomPrice(e.target.value.replace(/[^\d.,]/g, '')); setError(''); setSuccess(''); }}
              placeholder="0,00"
              className="w-full bg-transparent text-2xl font-bold outline-none text-[var(--color-text)]"
            />
          </div>
          {tooLow ? <p className="text-sm text-red-600">{advice?.sellerRule ? `Dieser Verkäufer nimmt Angebote ab ${eur(minOffer)} an.` : `Mindestangebot: ${eur(minOffer)}.`}</p> : null}
          {tooHigh ? <p className="text-sm text-red-600">Dein Angebot liegt nicht unter dem Preis - kaufe den Artikel direkt.</p> : null}
          {chance ? (
            <p className="flex items-center gap-2 text-sm" style={{ color: BAND_STYLE[chance.band].color }}>
              <Gauge size={14} /> Einschätzung: {BAND_STYLE[chance.band].label} (ca. {Math.round(chance.probability * 100)} %)
            </p>
          ) : null}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Kurze Nachricht an den Verkäufer (optional)"
            className="mt-4 min-h-[88px] w-full rounded-xl border border-[var(--color-border)] p-3 text-sm outline-none focus:border-[var(--color-primary)]"
          />

          {error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-green-700" role="status">{success}</p> : null}

          <ul className="mb-4 mt-4 space-y-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            <li className="flex items-center gap-2"><Clock size={12} /> Antwort des Verkäufers innerhalb von {offerPolicy.answerHours} Stunden, sonst läuft das Angebot ab.</li>
            <li>Angenommen? Dann ist der Artikel {offerPolicy.paymentHours} Stunden für dich zum vereinbarten Preis reserviert.</li>
            <li>Höchstens {offerPolicy.maxRounds - 1} Gegenangebote pro Verhandlung. <Link href="/hilfe/preisvorschlaege" className="underline">Regeln</Link></li>
          </ul>

          <div className="mb-6 flex items-start gap-2 rounded-lg bg-[var(--color-bg-secondary)] p-3 text-[var(--color-text-secondary)]">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span className="text-[11px] leading-tight">
              <strong>Verbindliches Angebot:</strong> Mit dem Senden eines Preisvorschlags erklärst du dich bereit, den Artikel zu diesem Preis zu kaufen. Nimmt der Verkäufer an, kommt ein rechtsverbindlicher Kaufvertrag zustande.
            </span>
          </div>

          <button
            disabled={isSubmitDisabled}
            onClick={handleSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: isSubmitDisabled ? '#9ca3af' : 'var(--color-orange)' }}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            <span>{validNumber && parsedPrice > 0 ? `${eur(parsedPrice)} bieten` : 'Bitte Preis eingeben'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
