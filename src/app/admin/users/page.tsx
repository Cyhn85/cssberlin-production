'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, ShieldCheck, ShieldOff } from 'lucide-react';

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  role: string;
  isVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  createdAt: string;
  _count: { products: number; ordersAsBuyer: number; ordersAsSeller: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async (q: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const result = await res.json();
    if (result.success) setUsers(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load('');
  }, []);

  const toggleSuspend = async (user: AdminUser) => {
    const suspend = !user.isSuspended;
    const reason = reasonDraft[user.id]?.trim();
    if (suspend && !reason) {
      setError('Bitte gib einen Grund fuer die Sperre an.');
      return;
    }
    setError(null);
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspend, reason }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || 'Aktion fehlgeschlagen.');
        return;
      }
      setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, isSuspended: result.data.isSuspended, suspendedReason: result.data.suspendedReason } : u)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Nutzer
      </h1>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(query)}
            placeholder="Name, E-Mail oder Benutzername..."
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
        <div className="overflow-x-auto rounded-3xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--color-bg-secondary)' }}>
              <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                <th className="px-4 py-3 font-semibold">Nutzer</th>
                <th className="px-4 py-3 font-semibold">Rolle</th>
                <th className="px-4 py-3 font-semibold">Aktivitaet</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{u.name || u.username || '—'}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{u.email}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{u.role}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {u._count.products} Artikel &middot; {u._count.ordersAsBuyer + u._count.ordersAsSeller} Bestellungen
                  </td>
                  <td className="px-4 py-3">
                    {u.isSuspended ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        <ShieldOff size={12} /> Gesperrt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <ShieldCheck size={12} /> Aktiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'ADMIN' ? (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                    ) : u.isSuspended ? (
                      <button
                        onClick={() => toggleSuspend(u)}
                        disabled={busyId === u.id}
                        className="rounded-full px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        Entsperren
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <input
                          placeholder="Grund..."
                          value={reasonDraft[u.id] || ''}
                          onChange={(e) => setReasonDraft((current) => ({ ...current, [u.id]: e.target.value }))}
                          className="w-32 rounded-lg px-2 py-1 text-xs"
                          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <button
                          onClick={() => toggleSuspend(u)}
                          disabled={busyId === u.id}
                          className="rounded-full px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                          style={{ background: '#dc2626' }}
                        >
                          Sperren
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
