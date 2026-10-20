'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MessageCircle, X } from 'lucide-react';

/**
 * Launcher only. The chat panel (and its code) is loaded on the first click,
 * so the assistant no longer adds weight to every page load - it used to ship
 * framer-motion and the whole chat UI to every visitor up front.
 */
const AiAssistantPanel = dynamic(() => import('./AiAssistantPanel'), { ssr: false });

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="fixed bottom-24 right-4 z-[90] md:right-8">
      {loaded ? <AiAssistantPanel open={isOpen} onClose={() => setIsOpen(false)} /> : null}
      <button
        type="button"
        onClick={() => { setLoaded(true); setIsOpen((v) => !v); }}
        aria-label={isOpen ? 'KI-Assistent schließen' : 'KI-Assistent öffnen'}
        aria-expanded={isOpen}
        className="group relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-xl transition-transform hover:-translate-y-0.5 active:scale-95"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
        {!isOpen ? (
          <span className="pointer-events-none absolute right-full mr-4 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
            CSS Assist · KI-Hilfe
          </span>
        ) : null}
      </button>
    </div>
  );
}
