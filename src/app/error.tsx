'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service (Sentry in production)
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div
        className="max-w-md w-full text-center p-8 rounded-3xl"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Error Icon */}
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--color-error-light, #FEE2E2)' }}
        >
          <AlertTriangle size={32} style={{ color: 'var(--color-error)' }} />
        </div>

        {/* Error Message */}
        <h2
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}
        >
          Etwas ist schiefgelaufen
        </h2>
        <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder kehre zur Startseite zurück.
        </p>

        {/* Error Details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div
            className="mb-6 p-3 rounded-xl text-left text-xs font-mono overflow-auto max-h-32"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-error)',
            }}
          >
            {error.message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ background: 'var(--color-orange)' }}
          >
            <RefreshCw size={16} />
            Erneut versuchen
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-transform hover:scale-[1.02]"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <Home size={16} />
            Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
