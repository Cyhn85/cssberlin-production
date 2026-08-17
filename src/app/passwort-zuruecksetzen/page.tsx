'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== repeat) {
      setError('Die beiden Passwoerter stimmen nicht ueberein.');
      return;
    }
    setState('saving');
    setError('');
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Passwort konnte nicht geaendert werden.');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError('Verbindung fehlgeschlagen. Bitte erneut versuchen.');
      setState('idle');
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-stone-200 p-6 dark:border-stone-700">
        <p className="text-stone-700 dark:text-stone-200">
          Dieser Link ist unvollstaendig. Fordere bitte einen neuen an.
        </p>
        <Link href="/passwort-vergessen" className="mt-4 inline-block font-medium text-[#2D6A4F] hover:underline">
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="rounded-xl border border-stone-200 p-6 dark:border-stone-700">
        <p className="text-stone-700 dark:text-stone-200">
          Passwort geaendert. Du kannst dich jetzt anmelden.
        </p>
        <Link href="/login" className="mt-4 inline-block font-medium text-[#2D6A4F] hover:underline">
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700 dark:text-stone-200">Neues Passwort</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="rounded-lg border border-stone-300 px-4 py-3 outline-none focus:border-[#2D6A4F] dark:border-stone-600 dark:bg-stone-900"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700 dark:text-stone-200">Passwort wiederholen</span>
        <input
          type="password"
          required
          minLength={8}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          autoComplete="new-password"
          className="rounded-lg border border-stone-300 px-4 py-3 outline-none focus:border-[#2D6A4F] dark:border-stone-600 dark:bg-stone-900"
        />
      </label>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={state === 'saving'}
        className="btn-mars-earth rounded-lg px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        <span>{state === 'saving' ? 'Wird gespeichert...' : 'Passwort speichern'}</span>
      </button>
    </form>
  );
}

export default function PasswortZuruecksetzenPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold text-[#1B4332] dark:text-[#D8F3DC]">Neues Passwort setzen</h1>
      <Suspense fallback={<p className="mt-6 text-stone-600 dark:text-stone-300">Wird geladen...</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
