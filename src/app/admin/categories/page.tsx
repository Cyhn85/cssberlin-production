'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, AlertTriangle, FolderTree, Tag, Info } from 'lucide-react';

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
        setError(result.error || 'Kategorie konnte nicht gelöscht werden.');
        return;
      }
      setCategories((current) => current.filter((c) => c.id !== category.id));
    } finally {
      setBusyId(null);
    }
  };

  const topLevel = categories.filter((c) => !c.parentId);

  return (
    <div className="pb-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Kategorien</h1>
        <p className="text-sm text-gray-500">Strukturiere den Marktplatz und ordne Artikel logisch ein.</p>
      </div>

      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Neue Kategorie erstellen</h2>
        <div className="flex flex-col sm:flex-row flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 w-full sm:w-20">
            <label className="text-xs font-semibold text-gray-600">Icon</label>
            <input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="✨"
              className="h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-2 text-center text-sm text-gray-900 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600">Bezeichnung</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Z. B. Oberteile..."
              className="h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600">Überkategorie (Optional)</label>
            <select
              value={newParentId}
              onChange={(e) => setNewParentId(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-colors"
            >
              <option value="">Keine Überkategorie (Hauptkategorie)</option>
              {topLevel.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={createCategory}
            disabled={creating}
            className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} 
            Hinzufügen
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
            <p className="text-sm font-medium text-gray-500">Kategorien werden geladen...</p>
          </div>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <FolderTree size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Keine Kategorien vorhanden</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">Lege oben die erste Kategorie an, um zu starten.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Info size={14} /> Kategorien mit verknüpften Artikeln oder Unterkategorien können nicht gelöscht werden.
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-2xl border border-gray-100">
                    {c.emoji || '📁'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      {c.name}
                      {c.parent && (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-500">
                          {c.parent.name}
                        </span>
                      )}
                    </h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Tag size={12} /> {c._count.products} Artikel</span>
                      <span className="flex items-center gap-1"><FolderTree size={12} /> {c._count.children} Unterkategorien</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeCategory(c)}
                  disabled={busyId === c.id || c._count.products > 0 || c._count.children > 0}
                  title={c._count.products > 0 || c._count.children > 0 ? 'Kategorien mit Artikeln oder Unterkategorien können nicht gelöscht werden' : 'Löschen'}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
