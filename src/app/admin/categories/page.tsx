'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type AdminCategory = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/categories');
    const result = await res.json();
    if (result.success) setCategories(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const createCategory = async () => {
    if (!newName.trim()) {
      setError('Bitte gib einen Namen ein.');
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), emoji: newEmoji.trim() || undefined, parentId: newParentId || null }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || 'Kategorie konnte nicht erstellt werden.');
        return;
      }
      setNewName('');
      setNewEmoji('');
      setNewParentId('');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const removeCategory = async (category: AdminCategory) => {
    setError(null);
    setBusyId(category.id);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || 'Kategorie konnte nicht geloescht werden.');
        return;
      }
      setCategories((current) => current.filter((c) => c.id !== category.id));
    } finally {
      setBusyId(null);
    }
  };

  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Kategorien
      </h1>

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
        <input
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
          placeholder="Emoji"
          className="h-10 w-16 rounded-xl px-2 text-center text-sm"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Kategoriename"
          className="h-10 flex-1 min-w-[160px] rounded-xl px-3 text-sm"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <select
          value={newParentId}
          onChange={(e) => setNewParentId(e.target.value)}
          className="h-10 rounded-xl px-3 text-sm"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="">Keine Ueberkategorie</option>
          {topLevel.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={createCategory}
          disabled={creating}
          className="btn-mars-earth flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--color-orange)' }}
        >
          <Plus size={14} /> <span>Hinzufuegen</span>
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {c.emoji ? `${c.emoji} ` : ''}{c.name}
                </span>
                {c.parent ? (
                  <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>unter {c.parent.name}</span>
                ) : null}
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {c._count.products} Artikel &middot; {c._count.children} Unterkategorien
                </span>
              </div>
              <button
                onClick={() => removeCategory(c)}
                disabled={busyId === c.id || c._count.products > 0 || c._count.children > 0}
                title={c._count.products > 0 || c._count.children > 0 ? 'Kategorien mit Artikeln oder Unterkategorien koennen nicht geloescht werden' : 'Loeschen'}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-30"
                style={{ color: '#dc2626' }}
              >
                <Trash2 size={13} /> Loeschen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
