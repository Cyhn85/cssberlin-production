'use client';

import { Leaf, Search, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Large 404 */}
        <div className="relative mb-8">
          <span
            className="text-[120px] sm:text-[160px] font-black leading-none opacity-10"
            style={{ color: 'var(--color-orange)', fontFamily: 'var(--font-display)' }}
          >
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'var(--gradient-mars-earth)' }}
            >
              <Leaf size={36} className="text-white" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1
          className="text-3xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}
        >
          Seite nicht gefunden
        </h1>
        <p className="mb-8 text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Die Seite, die du suchst, existiert nicht oder wurde verschoben.
          Vielleicht findest du, was du suchst, im Katalog?
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/catalog"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] btn-mars-earth"
          >
            <Search size={18} />
            Katalog durchsuchen
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-transform hover:scale-[1.02]"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <Home size={18} />
            Zur Startseite
          </Link>
        </div>

        {/* Back Link */}
        <button
          onClick={() => typeof window !== 'undefined' && window.history.back()}
          className="mt-6 inline-flex items-center gap-1 text-sm font-medium transition-colors"
          style={{ color: 'var(--color-primary)' }}
        >
          <ArrowLeft size={14} />
          Zurück zur vorherigen Seite
        </button>
      </div>
    </div>
  );
}
