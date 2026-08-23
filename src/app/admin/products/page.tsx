'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, EyeOff, Eye, AlertTriangle, CheckCircle2, Box, Filter } from 'lucide-react';
import { formatPrice } from '@/lib/utils/condition-map';

type AdminProduct = {
  id: string;
  title: string;
  price: number;
  status: string;
  moderationReason: string | null;
  createdAt: string;
  images: Array<{ url: string }>;
  seller: { id: string; name: string | null; email: string };
  category: { name: string };
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Entwurf',
  ACTIVE: 'Aktiv',
  HIDDEN: 'Ausgeblendet',
  RESERVED: 'Reserviert',
  SOLD: 'Verkauft',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  HIDDEN: 'bg-red-100 text-red-800',
  RESERVED: 'bg-blue-100 text-blue-800',
  SOLD: 'bg-indigo-100 text-indigo-800',
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async (q: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const result = await res.json();
    if (result.success) setProducts(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load('');
  }, []);

  const moderate = async (product: AdminProduct, action: 'HIDE' | 'RESTORE') => {
    const reason = reasonDraft[product.id]?.trim();
    if (action === 'HIDE' && !reason) {
      setError('Bitte gib einen Moderationsgrund für die Entfernung an.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError(null);
    setBusyId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || 'Aktion fehlgeschlagen.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setProducts((current) => current.map((p) => (p.id === product.id ? { ...p, status: result.data.status, moderationReason: result.data.moderationReason } : p)));
    } finally {
      setBusyId(null);
      if (action === 'RESTORE') {
         setReasonDraft((curr) => {
            const next = { ...curr };
            delete next[product.id];
            return next;
         });
      }
    }
  };

  return (
    <div className="pb-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Artikel-Moderation</h1>
          <p className="mt-1 text-sm text-gray-500">Überwache und moderiere Inserate auf dem cssberlin Marktplatz.</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(query)}
            placeholder="Titel, Marke oder Verkäufer suchen..."
            className="h-11 w-full rounded-xl border border-gray-300 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => load(query)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)]">
            <Search size={16} /> Suchen
          </button>
          <button className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50">
            <Filter size={16} /> Filter
          </button>
        </div>
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
            <p className="text-sm font-medium text-gray-500">Artikel werden geladen...</p>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Box size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Keine Artikel gefunden</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">Versuche einen anderen Suchbegriff oder ändere die Filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-bold">Artikel</th>
                  <th className="px-6 py-4 font-bold">Preis & Kat.</th>
                  <th className="px-6 py-4 font-bold">Verkäufer</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                          {p.images[0]?.url ? <img src={p.images[0].url} alt={p.title} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 max-w-[200px] truncate">{p.title}</p>
                          <p className="text-xs text-gray-400">ID: {p.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-gray-900">{formatPrice(p.price)}</p>
                      <p className="text-xs text-gray-500">{p.category.name}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                         <div className="h-6 w-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold">
                           {p.seller.name?.charAt(0).toUpperCase() || p.seller.email.charAt(0).toUpperCase()}
                         </div>
                         <p className="font-semibold text-gray-700">{p.seller.name || p.seller.email.split('@')[0]}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusColors[p.status] || 'bg-gray-100 text-gray-800'}`}>
                        {p.status === 'HIDDEN' ? <EyeOff size={12} /> : null}
                        {statusLabels[p.status] || p.status}
                      </span>
                      {p.moderationReason && (
                        <p className="mt-2 max-w-[150px] text-[11px] text-red-600 truncate" title={p.moderationReason}>
                          Grund: {p.moderationReason}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.status === 'HIDDEN' ? (
                        <button
                          onClick={() => moderate(p, 'RESTORE')}
                          disabled={busyId === p.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-black disabled:opacity-60"
                        >
                          {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                          Wiederherstellen
                        </button>
                      ) : p.status === 'ACTIVE' ? (
                        <div className="flex flex-col items-end gap-2">
                          <input
                            placeholder="Grund für Sperrung..."
                            value={reasonDraft[p.id] || ''}
                            onChange={(e) => setReasonDraft((current) => ({ ...current, [p.id]: e.target.value }))}
                            className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                          />
                          <button
                            onClick={() => window.confirm('Möchten Sie diesen Artikel wirklich entfernen?') && moderate(p, 'HIDE')}
                            disabled={busyId === p.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-100 text-red-700 px-3 py-2 text-xs font-bold transition-colors hover:bg-red-200 disabled:opacity-60"
                          >
                            {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
                            Sperren
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
