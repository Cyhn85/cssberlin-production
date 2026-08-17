'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { formatPrice } from '@/lib/utils/condition-map';

type Dispute = {
  id: string;
  disputeReason: string | null;
  itemPrice: number;
  shippingFee: number;
  protectionFee: number;
  totalAmount: number;
  trackingCode: string | null;
  shippingCarrier: string | null;
  createdAt: string;
  updatedAt: string;
  product: { id: string; title: string; images: Array<{ url: string }> };
  buyer: { id: string; name: string | null; email: string };
  seller: { id: string; name: string | null; email: string };
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/disputes');
    const result = await res.json();
    if (result.success) setDisputes(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const resolve = async (id: string, outcome: 'REFUNDED' | 'COMPLETED') => {
    const note = notes[id]?.trim();
    if (!note || note.length < 5) {
      setError('Bitte gib fuer diese Entscheidung eine kurze Begruendung ein (mind. 5 Zeichen).');
      return;
    }
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/disputes/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, note }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || 'Fall konnte nicht abgeschlossen werden.');
        return;
      }
      setDisputes((current) => current.filter((d) => d.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Kaeuferschutz-Faelle
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Offene Faelle, in denen ein Kaeufer einen Kaeuferschutz-Anspruch gestellt hat.
      </p>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      ) : disputes.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <ShieldAlert size={28} className="mx-auto mb-3" style={{ color: 'var(--color-primary)', opacity: 0.4 }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Keine offenen Faelle.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold" style={{ color: 'var(--color-text)' }}>{d.product.title}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Kaeufer: {d.buyer.name || d.buyer.email} &middot; Verkaeufer: {d.seller.name || d.seller.email}
                  </p>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(d.totalAmount)}</p>
              </div>

              <div className="mb-3 rounded-xl p-3 text-sm" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>
                <span className="font-semibold">Grund des Kaeufers: </span>
                {d.disputeReason || 'Kein Grund angegeben.'}
              </div>

              <textarea
                placeholder="Begruendung fuer deine Entscheidung (wird gespeichert, nicht oeffentlich)..."
                value={notes[d.id] || ''}
                onChange={(e) => setNotes((current) => ({ ...current, [d.id]: e.target.value }))}
                className="mb-3 h-20 w-full rounded-xl p-3 text-sm"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => resolve(d.id, 'REFUNDED')}
                  disabled={busyId === d.id}
                  className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: '#dc2626' }}
                >
                  Kaeufer erstatten
                </button>
                <button
                  onClick={() => resolve(d.id, 'COMPLETED')}
                  disabled={busyId === d.id}
                  className="btn-mars-earth rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <span>Fall ablehnen, Bestellung abschliessen</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
