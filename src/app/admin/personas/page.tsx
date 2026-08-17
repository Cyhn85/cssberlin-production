'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Pause, Play, MessageCircle } from 'lucide-react';

type AdminPersona = {
  id: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  isSuspended: boolean;
  createdAt: string;
  _count: { products: number };
};

export default function AdminPersonasPage() {
  const [personas, setPersonas] = useState<AdminPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/personas');
    const result = await res.json();
    if (result.success) setPersonas(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const createPersona = async () => {
    if (!name.trim()) {
      setError('Bitte gib einen Namen ein.');
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          avatar: avatar.trim() || undefined,
          bio: bio.trim() || undefined,
          location: location.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || 'Verkaeufer-Profil konnte nicht erstellt werden.');
        return;
      }
      setName('');
      setAvatar('');
      setBio('');
      setLocation('');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const toggleSuspend = async (persona: AdminPersona) => {
    setError(null);
    setBusyId(persona.id);
    try {
      const res = await fetch(`/api/admin/personas/${persona.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !persona.isSuspended }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || 'Aktion fehlgeschlagen.');
        return;
      }
      setPersonas((current) => current.map((p) => (p.id === persona.id ? { ...p, isSuspended: result.data.isSuspended } : p)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Verkaeufer-Profile
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Echte Verkaeuferkonten, denen importierte Artikel automatisch zugewiesen werden. Jede Nachricht und jedes
        Angebot, das ein solches Konto erhaelt, wird dir in Echtzeit weitergeleitet - du schreibst oder bestaetigst
        jede Antwort selbst.
      </p>

      <div className="mb-6 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="h-10 rounded-xl px-3 text-sm"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Standort (z. B. Berlin)"
          className="h-10 rounded-xl px-3 text-sm"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <input
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="Avatar-URL (optional)"
          className="h-10 rounded-xl px-3 text-sm sm:col-span-2"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Kurzbeschreibung (optional)"
          rows={2}
          className="rounded-xl px-3 py-2 text-sm sm:col-span-2"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <button
          onClick={createPersona}
          disabled={creating}
          className="btn-mars-earth flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2"
          style={{ background: 'var(--color-orange)' }}
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} <span>Profil anlegen</span>
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      ) : personas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Noch keine Verkaeufer-Profile. Importierte Artikel koennen erst zugewiesen werden, wenn mindestens eines existiert.
        </p>
      ) : (
        <div className="space-y-2">
          {personas.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div className="flex items-center gap-3">
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                    {(p.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{p.name}</span>
                  {p.location ? <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.location}</span> : null}
                  <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {p._count.products} aktive Artikel {p.isSuspended ? '· pausiert' : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/personas/${p.id}/inbox`}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ color: 'var(--color-primary-dark)' }}
                >
                  <MessageCircle size={13} /> Postfach
                </Link>
                <button
                  onClick={() => toggleSuspend(p)}
                  disabled={busyId === p.id}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  style={{ color: p.isSuspended ? 'var(--color-primary-dark)' : '#dc2626' }}
                >
                  {p.isSuspended ? <Play size={13} /> : <Pause size={13} />} {p.isSuspended ? 'Aktivieren' : 'Pausieren'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
