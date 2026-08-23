'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, AlertTriangle, ArrowRight, CheckCircle2, User, UserCheck, Search, CornerDownRight } from 'lucide-react';
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
      setError('Bitte gib für diese Entscheidung eine kurze Begründung ein (mind. 5 Zeichen).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setDisputes((current) => current.filter((d) => d.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pb-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Käuferschutz-Zentrum</h1>
        <p className="text-sm text-gray-500">Moderation von eingefrorenen Transaktionen und Konflikten zwischen Nutzern.</p>
      </div>

      {error ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <p className="font-medium">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white border-dashed">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-medium text-gray-500">Fälle werden geladen...</p>
          </div>
        </div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Alles im grünen Bereich</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">Es gibt aktuell keine offenen Käuferschutz-Fälle. Du kannst dich entspannen.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-sm font-semibold text-gray-500 px-2">
            <span>{disputes.length} offene Fälle</span>
            <span className="flex items-center gap-2"><ShieldAlert size={16} className="text-red-500" /> Hohe Priorität</span>
          </div>
          
          {disputes.map((d) => (
            <div key={d.id} className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm transition-all hover:shadow-md">
              <div className="border-b border-red-100 bg-red-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
                      {d.product.images[0] ? (
                        <img src={d.product.images[0].url} alt={d.product.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gray-100" />
                      )}
                   </div>
                   <div>
                     <h3 className="font-bold text-gray-900">{d.product.title}</h3>
                     <p className="text-xs font-medium text-gray-500">
                       Eröffnet am {new Date(d.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                     </p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-sm font-semibold text-gray-500">Eingefrorener Betrag</p>
                   <p className="text-2xl font-extrabold text-gray-900">{formatPrice(d.totalAmount)}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                <div className="p-6">
                   <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Konflikt-Details</h4>
                   
                   <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 relative">
                     <CornerDownRight size={16} className="absolute -left-2 -top-2 text-amber-400 bg-white rounded-full" />
                     <span className="block font-bold mb-1">Meldung des Käufers:</span>
                     <p className="leading-relaxed">{d.disputeReason || 'Kein detaillierter Grund angegeben.'}</p>
                   </div>
                   
                   <div className="flex flex-col gap-4">
                     <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <User size={16} /> Käufer
                        </div>
                        <span className="font-semibold text-gray-900">{d.buyer.name || d.buyer.email}</span>
                     </div>
                     <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <UserCheck size={16} /> Verkäufer
                        </div>
                        <span className="font-semibold text-gray-900">{d.seller.name || d.seller.email}</span>
                     </div>
                   </div>
                </div>

                <div className="bg-gray-50/30 p-6 flex flex-col">
                   <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Entscheidung (Admin)</h4>
                   
                   <textarea
                     placeholder="Interne Begründung für die Entscheidung (Pflichtfeld, wird nicht öffentlich gezeigt)..."
                     value={notes[d.id] || ''}
                     onChange={(e) => setNotes((current) => ({ ...current, [d.id]: e.target.value }))}
                     className="mb-4 w-full flex-1 min-h-[100px] rounded-xl border border-gray-300 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                   />

                   <div className="flex flex-col gap-3">
                     <button
                       onClick={() => window.confirm('Bist du sicher? Der Betrag wird dem Käufer zurückerstattet und der Verkäufer geht leer aus.') && resolve(d.id, 'REFUNDED')}
                       disabled={busyId === d.id}
                       className="group flex w-full items-center justify-between rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50 hover:border-red-300 disabled:opacity-60"
                     >
                       <span className="flex items-center gap-2">
                         {busyId === d.id && <Loader2 size={16} className="animate-spin" />}
                         Käufer Recht geben & Erstatten
                       </span>
                       <ArrowRight size={16} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                     </button>
                     
                     <button
                       onClick={() => window.confirm('Bist du sicher? Die Beschwerde wird abgewiesen und der Verkäufer erhält seine Auszahlung.') && resolve(d.id, 'COMPLETED')}
                       disabled={busyId === d.id}
                       className="group flex w-full items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-black disabled:opacity-60"
                     >
                       <span className="flex items-center gap-2">
                         {busyId === d.id && <Loader2 size={16} className="animate-spin" />}
                         Verkäufer Recht geben (Auszahlen)
                       </span>
                       <ArrowRight size={16} className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                     </button>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
