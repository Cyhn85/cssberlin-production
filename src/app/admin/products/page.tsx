'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, EyeOff, Eye } from 'lucide-react';
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
      setError('Bitte gib einen Grund fuer die Entfernung an.');
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
        return;
      }
      setProducts((current) => current.map((p) => (p.id === product.id ? { ...p, status: result.data.status, moderationReason: result.data.moderationReason } : p)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Artikel
      </h1>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(query)}
            placeholder="Titel oder Marke..."
            className="h-10 w-full rounded-full pl-9 pr-4 text-sm"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <button onClick={() => load(query)} className="nav-mars-earth rounded-full px-4 text-sm font-semibold">Suchen</button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl" style={{ background: 'var(--color-bg-secondary)' }}>
                {p.images[0]?.url ? <img src={p.images[0].url} alt={p.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" style={{ color: 'var(--color-text)' }}>{p.title}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatPrice(p.price)} &middot; {p.category.name} &middot; {p.seller.name || p.seller.email} &middot; {statusLabels[p.status] || p.status}
                </p>
                {p.moderationReason ? (
                  <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>Grund: {p.moderationReason}</p>
                ) : null}
              </div>
              {p.status === 'HIDDEN' ? (
                <button
                  onClick={() => moderate(p, 'RESTORE')}
                  disabled={busyId === p.id}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Eye size={13} /> Wiederherstellen
                </button>
              ) : p.status === 'ACTIVE' ? (
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Grund..."
                    value={reasonDraft[p.id] || ''}
                    onChange={(e) => setReasonDraft((current) => ({ ...current, [p.id]: e.target.value }))}
                    className="w-32 rounded-lg px-2 py-1.5 text-xs"
                    style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  />
                  <button
                    onClick={() => moderate(p, 'HIDE')}
                    disabled={busyId === p.id}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                    style={{ background: '#dc2626' }}
                  >
                    <EyeOff size={13} /> Entfernen
                  </button>
                </div>
              ) : (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
