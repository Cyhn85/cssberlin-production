'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    setError('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Anfrage fehlgeschlagen.');
        setState('idle');
        return;
      }
      setState('sent');
    } catch {
      setError('Verbindung fehlgeschlagen. Bitte erneut versuchen.');
      setState('idle');
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold text-[#1B4332] dark:text-[#D8F3DC]">Passwort vergessen</h1>

      {state === 'sent' ? (
        <div className="mt-6 rounded-xl border border-stone-200 p-6 dark:border-stone-700">
          <p className="text-stone-700 dark:text-stone-200">
            Wenn ein Konto zu dieser Adresse existiert, ist die E-Mail unterwegs.
            Der Link gilt eine Stunde.
          </p>
          <Link href="/login" className="mt-4 inline-block font-medium text-[#2D6A4F] hover:underline">
            Zurueck zur Anmeldung
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-stone-600 dark:text-stone-300">
            Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein
            neues Passwort setzen kannst.
          </p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-200">E-Mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="rounded-lg border border-stone-300 px-4 py-3 outline-none focus:border-[#2D6A4F] dark:border-stone-600 dark:bg-stone-900"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={state === 'sending'}
              className="btn-mars-earth rounded-lg px-4 py-3 font-medium text-white disabled:opacity-60"
            >
              <span>{state === 'sending' ? 'Wird gesendet...' : 'Link anfordern'}</span>
            </button>
          </form>
          <Link href="/login" className="mt-6 text-sm text-[#2D6A4F] hover:underline">
            Zurueck zur Anmeldung
          </Link>
        </>
      )}
    </main>
  );
}
