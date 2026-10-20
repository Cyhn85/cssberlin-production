'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, Handshake, Loader2, MessageCircle, Timer, XCircle } from 'lucide-react';
import { cancellationPolicy, shippingDeadlines } from '@/config/marketplace-policy';
import { formatPrice } from '@/lib/utils/condition-map';

export type ActionOrder = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  shippingCarrier?: string | null;
  pickupDeadline?: string | null;
  cancelRequestedAt?: string | null;
  cancelRequestReason?: string | null;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  buyerId?: string;
  sellerId?: string;
  shippingAddress?: { name?: string; street?: string; extra?: string; postalCode?: string; city?: string } | null;
};

const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

function reasonLabel(reason: string | null | undefined) {
  if (!reason) return '';
  const id = reason.split(':')[0].trim();
  if (id === 'not_shipped_in_time') return `nicht innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen versendet`;
  if (id === 'pickup_not_completed') return 'Abholung nicht rechtzeitig bestätigt';
  const all = [...cancellationPolicy.sellerReasons, ...cancellationPolicy.buyerReasons] as ReadonlyArray<{ id: string; label: string }>;
  const note = reason.includes(':') ? reason.slice(reason.indexOf(':') + 1).trim() : '';
  return `${all.find((r) => r.id === id)?.label ?? reason}${note && all.some((r) => r.id === id) ? ` - ${note}` : ''}`;
}

/**
 * Every cancellation / pickup action for one order, for both sides.
 * The rules are enforced server side (src/lib/order-state.ts); this component
 * only shows what is currently allowed and explains why something is not.
 */
export default function OrderActions({ order, role, partnerId, onChanged }: {
  order: ActionOrder;
  role: 'buyer' | 'seller';
  partnerId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'cancel' | 'request'>('none');
  const reasons = role === 'seller' ? cancellationPolicy.sellerReasons : cancellationPolicy.buyerReasons;
  const [reason, setReason] = useState<string>(reasons[0].id);
  const [note, setNote] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const pickup = order.paymentMethod === 'pickup_cash' || order.shippingCarrier === 'PICKUP';
  const paidAt = new Date(order.paidAt || order.createdAt).getTime();
  const freeUntil = paidAt + cancellationPolicy.buyerFreeCancelMinutes * 60 * 1000;
  const freeLeftMin = Math.max(0, Math.ceil((freeUntil - now) / 60000));

  const call = async (key: string, body: Record<string, unknown>, path = 'cancel') => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r?.success) throw new Error(r?.error || 'Aktion fehlgeschlagen.');
      setMode('none');
      setNote('');
      await onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const box = 'rounded-3xl border bg-[var(--color-bg-card)] p-6 shadow-sm';
  const btn = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60';
  const chat = (
    <Link href={`/inbox?with=${encodeURIComponent(partnerId)}`} className={`${btn} border`} style={{ borderColor: 'var(--color-border)' }}>
      <MessageCircle size={16} /> Chat öffnen
    </Link>
  );

  // ───────── finished states: explain what happened ─────────
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return (
      <div className={box} style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><XCircle size={18} /> {order.status === 'REFUNDED' ? 'Storniert & erstattet' : 'Storniert'}</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {order.cancelledBy === 'BUYER' ? 'Vom Käufer storniert' : order.cancelledBy === 'SELLER' ? 'Vom Verkäufer storniert' : order.cancelledBy === 'SYSTEM' ? 'Automatisch storniert' : 'Storniert'}
          {order.cancelReason ? `: ${reasonLabel(order.cancelReason)}` : ''}.
          {!pickup && role === 'buyer' ? ' Der gezahlte Betrag wird vollständig erstattet.' : ''}
        </p>
        <Link href="/hilfe/stornierung" className="mt-3 inline-block text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Wie Stornierungen funktionieren</Link>
      </div>
    );
  }

  const content: React.ReactNode[] = [];

  // ───────── Abholung ─────────
  if (order.status === 'PENDING_PICKUP') {
    content.push(
      <div key="pickup" className="space-y-3">
        <p className="flex items-center gap-2 text-sm"><Timer size={16} /> Reserviert bis <strong>{order.pickupDeadline ? fmt(order.pickupDeadline) : '-'}</strong>. Bezahlt wird bar bei der Übergabe ({formatPrice(order.totalAmount)}).</p>
        {role === 'seller' ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Vereinbart Ort und Zeit im Chat. Erst nach der Übergabe und dem Erhalt des Geldes bestätigen.</p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Prüfe den Artikel vor Ort, bevor du bezahlst. Bei Abholung gilt kein Käuferschutz.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {role === 'seller' ? (
            <button className={`${btn} text-white`} style={{ background: 'var(--color-primary)' }} disabled={!!busy}
              onClick={() => { if (confirm('Artikel übergeben und Geld erhalten? Danach ist der Verkauf abgeschlossen.')) call('handover', {}, 'handover'); }}>
              {busy === 'handover' ? <Loader2 size={16} className="animate-spin" /> : <Handshake size={16} />} Übergeben & bezahlt
            </button>
          ) : null}
          {chat}
          <button className={`${btn} border`} style={{ borderColor: 'var(--color-border)' }} onClick={() => setMode(mode === 'cancel' ? 'none' : 'cancel')}>
            <Ban size={16} /> Abholung stornieren
          </button>
        </div>
      </div>,
    );
  }

  // ───────── bezahlt, noch nicht versendet ─────────
  if (order.status === 'PAID') {
    if (role === 'buyer') {
      if (order.cancelRequestedAt) {
        content.push(<p key="req" className="text-sm">Deine Stornierungsanfrage vom {fmt(order.cancelRequestedAt)} liegt beim Verkäufer (Antwort innerhalb von {cancellationPolicy.requestAnswerHours} Stunden).</p>);
      } else if (freeLeftMin > 0) {
        content.push(
          <div key="free" className="space-y-3">
            <p className="text-sm">Du kannst noch <strong>{freeLeftMin} Minute{freeLeftMin === 1 ? '' : 'n'}</strong> kostenlos stornieren - der Betrag wird vollständig erstattet.</p>
            <button className={`${btn} border`} style={{ borderColor: 'var(--color-border)' }} onClick={() => setMode(mode === 'cancel' ? 'none' : 'cancel')}><Ban size={16} /> Kauf stornieren</button>
          </div>,
        );
      } else {
        content.push(
          <div key="ask" className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Die Sofort-Stornierung ist abgelaufen. Solange nicht versendet wurde, kannst du den Verkäufer um eine Stornierung bitten.</p>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} border`} style={{ borderColor: 'var(--color-border)' }} onClick={() => setMode(mode === 'request' ? 'none' : 'request')}><Ban size={16} /> Stornierung anfragen</button>
              {chat}
            </div>
          </div>,
        );
      }
    } else {
      if (order.cancelRequestedAt) {
        content.push(
          <div key="answer" className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p><strong>Der Käufer bittet um Stornierung</strong>{order.cancelRequestReason ? ` - ${reasonLabel(order.cancelRequestReason)}` : ''}.</p>
            <p>Annehmen: der Käufer erhält den vollen Betrag zurück, der Artikel ist wieder im Verkauf (zählt nicht gegen deine Stornoquote). Ablehnen oder versenden: die Bestellung läuft weiter.</p>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} text-white`} style={{ background: 'var(--color-primary)' }} disabled={!!busy} onClick={() => call('accept', { action: 'accept' })}>
                {busy === 'accept' ? <Loader2 size={16} className="animate-spin" /> : null} Stornierung annehmen
              </button>
              <button className={`${btn} border bg-[var(--color-bg-card)]`} style={{ borderColor: 'var(--color-border)' }} disabled={!!busy} onClick={() => call('decline', { action: 'decline' })}>
                {busy === 'decline' ? <Loader2 size={16} className="animate-spin" /> : null} Ablehnen
              </button>
            </div>
          </div>,
        );
      }
      content.push(
        <div key="sell" className="flex flex-wrap items-center gap-2">
          <p className="w-full text-sm" style={{ color: 'var(--color-text-secondary)' }}>Bitte versende bis {fmt(new Date(paidAt + shippingDeadlines.autoCancelAfterDays * 86400000).toISOString())} - danach wird automatisch storniert.</p>
          {chat}
          <button className={`${btn} border`} style={{ borderColor: 'var(--color-border)' }} onClick={() => setMode(mode === 'cancel' ? 'none' : 'cancel')}><Ban size={16} /> Verkauf stornieren</button>
        </div>,
      );
      if (order.shippingAddress?.street) {
        const a = order.shippingAddress;
        content.push(
          <div key="addr" className="rounded-2xl p-4 text-sm" style={{ background: 'var(--color-bg-secondary)' }}>
            <p className="font-semibold">Lieferadresse</p>
            <p className="mt-1 whitespace-pre-line">{[a.name, a.street, a.extra, `${a.postalCode ?? ''} ${a.city ?? ''}`.trim()].filter(Boolean).join('\n')}</p>
          </div>,
        );
      }
    }
  }

  if (content.length === 0) return null;

  return (
    <div className={box} style={{ borderColor: 'var(--color-border)' }}>
      <h2 className="mb-4 text-lg font-bold">{order.status === 'PENDING_PICKUP' ? 'Abholung' : role === 'seller' ? 'Nächster Schritt' : 'Stornierung'}</h2>
      <div className="space-y-4">{content}</div>

      {mode !== 'none' ? (
        <div className="mt-5 space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
          <label className="block text-sm font-semibold" htmlFor={`reason-${order.id}`}>Grund</label>
          <select id={`reason-${order.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
            {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Optionale Nachricht (max. 200 Zeichen)" className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }} />
          {role === 'seller' && (reasons as ReadonlyArray<{ id: string; countsAgainstSeller?: boolean }>).find((r) => r.id === reason)?.countsAgainstSeller ? (
            <p className="text-xs text-amber-800">Dieser Grund zählt zu deiner Stornoquote, die Käufer in deinem Profil sehen.</p>
          ) : null}
          <div className="flex gap-2">
            <button className={`${btn} text-white`} style={{ background: '#b91c1c' }} disabled={!!busy}
              onClick={() => call(mode, { action: mode === 'request' ? 'request' : 'cancel', reason, note: note || undefined })}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} {mode === 'request' ? 'Anfrage senden' : 'Verbindlich stornieren'}
            </button>
            <button className={`${btn} border`} style={{ borderColor: 'var(--color-border)' }} onClick={() => setMode('none')}>Abbrechen</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
