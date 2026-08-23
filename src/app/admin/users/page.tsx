'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, ShieldCheck, ShieldOff, AlertTriangle, Users, Lock, Unlock, Mail, ShoppingCart, Tag } from 'lucide-react';

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
      setError('Bitte gib einen Grund für die Sperre an.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, isSuspended: result.data.isSuspended, suspendedReason: result.data.suspendedReason } : u)));
    } finally {
      setBusyId(null);
      if (!suspend) {
         setReasonDraft((curr) => {
            const next = { ...curr };
            delete next[user.id];
            return next;
         });
      }
    }
  };

  return (
    <div className="pb-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Nutzerverwaltung</h1>
          <p className="mt-1 text-sm text-gray-500">Überwache die Nutzeraktivitäten und verwalte Kontosperrungen.</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(query)}
            placeholder="Name, E-Mail oder Benutzername..."
            className="h-11 w-full rounded-xl border border-gray-300 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <button onClick={() => load(query)} className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)]">
          <Search size={16} /> Suchen
        </button>
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
            <p className="text-sm font-medium text-gray-500">Nutzer werden geladen...</p>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Keine Nutzer gefunden</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">Versuche einen anderen Suchbegriff.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-bold">Nutzer</th>
                  <th className="px-6 py-4 font-bold">Rolle</th>
                  <th className="px-6 py-4 font-bold">Aktivität</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 font-bold">
                          {u.name?.charAt(0).toUpperCase() || u.username?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{u.name || u.username || 'Unbekannt'}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail size={12} /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Tag size={12} /> {u._count.products} Inserate</span>
                        <span className="flex items-center gap-1"><ShoppingCart size={12} /> {u._count.ordersAsBuyer + u._count.ordersAsSeller} Bestellungen</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.isSuspended ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                            <ShieldOff size={14} /> Gesperrt
                          </span>
                          {u.suspendedReason && (
                            <p className="mt-1 max-w-[150px] text-[11px] text-red-600 truncate" title={u.suspendedReason}>
                              Grund: {u.suspendedReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <ShieldCheck size={14} /> Aktiv
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.role === 'ADMIN' ? (
                        <span className="text-xs font-semibold text-gray-400">—</span>
                      ) : u.isSuspended ? (
                        <button
                          onClick={() => window.confirm('Möchten Sie diesen Benutzer wirklich entsperren?') && toggleSuspend(u)}
                          disabled={busyId === u.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-black disabled:opacity-60"
                        >
                          {busyId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                          Entsperren
                        </button>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          <input
                            placeholder="Grund für Sperrung..."
                            value={reasonDraft[u.id] || ''}
                            onChange={(e) => setReasonDraft((current) => ({ ...current, [u.id]: e.target.value }))}
                            className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                          />
                          <button
                            onClick={() => window.confirm('Möchten Sie diesen Benutzer wirklich sperren?') && toggleSuspend(u)}
                            disabled={busyId === u.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-100 text-red-700 px-3 py-2 text-xs font-bold transition-colors hover:bg-red-200 disabled:opacity-60"
                          >
                            {busyId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
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
        </div>
      )}
    </div>
  );
}
