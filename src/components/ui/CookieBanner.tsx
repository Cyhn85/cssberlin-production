'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Settings2 } from 'lucide-react';
import Link from 'next/link';
import {
    CONSENT_OPEN_SETTINGS_EVENT,
    DEFAULT_CONSENT,
    loadConsent,
    saveConsent,
    type ConsentCategory,
    type ConsentState,
} from '@/lib/consent';

const CATEGORY_LABELS: Record<Exclude<ConsentCategory, 'necessary'>, { title: string; description: string }> = {
    functional: {
        title: 'Funktional',
        description: 'Ermoeglicht Nachrichten, Angebote und Live-Updates in Echtzeit (z. B. Inbox und Pazarlik-Benachrichtigungen).',
    },
    analytics: {
        title: 'Analyse',
        description: 'Hilft uns zu verstehen, wie cssberlin.de genutzt wird, um die Seite zu verbessern.',
    },
    marketing: {
        title: 'Marketing',
        description: 'Wird fuer personalisierte Angebote und Werbung verwendet.',
    },
};

export default function CookieBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [draft, setDraft] = useState<ConsentState>(DEFAULT_CONSENT);

    useEffect(() => {
        const existing = loadConsent();
        if (existing) {
            setDraft(existing);
        } else {
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        const reopen = () => {
            setDraft(loadConsent() || DEFAULT_CONSENT);
            setShowDetails(true);
            setIsVisible(true);
        };
        window.addEventListener(CONSENT_OPEN_SETTINGS_EVENT, reopen);
        return () => window.removeEventListener(CONSENT_OPEN_SETTINGS_EVENT, reopen);
    }, []);

    const commit = (state: ConsentState) => {
        saveConsent(state);
        setIsVisible(false);
        setShowDetails(false);
    };

    const acceptAll = () => commit({ necessary: true, functional: true, analytics: true, marketing: true });
    const acceptEssentialOnly = () => commit({ necessary: true, functional: true, analytics: false, marketing: false });
    const saveSelection = () => commit(draft);

    const toggleCategory = (category: Exclude<ConsentCategory, 'necessary'>) => {
        setDraft((current) => ({ ...current, [category]: !current[category] }));
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: 380, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 380, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                    className="fixed bottom-4 right-4 z-[100] w-[92vw] max-w-[340px]"
                >
                    {/*
                      Solid, fully opaque card (not the translucent .glass-card used
                      elsewhere) - this floats over photos/dark hero sections where
                      variable backdrops made text contrast unreliable. Orange/green
                      brand accents hold contrast against both light and dark themes,
                      unlike the previously-used bg-muted/text-muted-foreground classes,
                      which had no matching --muted CSS variable anywhere and rendered
                      unstyled.
                    */}
                    <div
                        className="relative overflow-hidden rounded-2xl p-4 shadow-xl"
                        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                style={{ background: 'rgba(45,106,79,0.12)' }}
                            >
                                <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
                            </div>

                            <div className="min-w-0 flex-1 space-y-2.5">
                                <h3
                                    className="text-sm font-bold tracking-tight"
                                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}
                                >
                                    Deine Privatsphaere zaehlt
                                </h3>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                                    Wir nutzen Cookies fuer Login, Warenkorb und optional fuer Statistik/Werbung. Du entscheidest, welche Kategorien du zulaesst.{' '}
                                    <Link href="/datenschutz" className="font-semibold underline" style={{ color: 'var(--color-orange)' }}>
                                        Details
                                    </Link>
                                    .
                                </p>

                                {showDetails ? (
                                    <div className="max-h-[calc(100vh-8rem)] space-y-2 overflow-y-auto pt-1">
                                        <div
                                            className="flex items-start justify-between gap-3 rounded-xl p-3"
                                            style={{ background: 'var(--color-bg-secondary)' }}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Notwendig</p>
                                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                    Immer aktiv &ndash; erforderlich fuer Login, Warenkorb und Sicherheit.
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>An</span>
                                        </div>

                                        {(Object.keys(CATEGORY_LABELS) as Array<Exclude<ConsentCategory, 'necessary'>>).map((category) => (
                                            <label
                                                key={category}
                                                className="flex items-start justify-between gap-3 rounded-xl p-3 cursor-pointer"
                                                style={{ background: 'var(--color-bg-secondary)' }}
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                                                        {CATEGORY_LABELS[category].title}
                                                    </p>
                                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {CATEGORY_LABELS[category].description}
                                                    </p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={draft[category]}
                                                    onChange={() => toggleCategory(category)}
                                                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-orange)]"
                                                />
                                            </label>
                                        ))}

                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={saveSelection}
                                            className="btn-mars-earth w-full py-2.5 text-sm font-bold text-white"
                                            style={{ background: 'var(--color-orange)' }}
                                        >
                                            <span>Auswahl speichern</span>
                                        </motion.button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 pt-1">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={acceptAll}
                                            className="w-full cursor-pointer rounded-full py-2 text-xs font-bold text-white shadow-lg"
                                            style={{ background: 'var(--color-orange)', boxShadow: '0 8px 20px rgba(232,101,26,0.3)' }}
                                        >
                                            Alle akzeptieren
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={acceptEssentialOnly}
                                            className="w-full cursor-pointer rounded-full py-2 text-xs font-semibold transition-colors"
                                            style={{ background: 'transparent', border: '1.5px solid var(--color-primary)', color: 'var(--color-primary)' }}
                                        >
                                            Nur essenziell
                                        </motion.button>
                                    </div>
                                )}

                                {!showDetails ? (
                                    <button
                                        onClick={() => setShowDetails(true)}
                                        className="flex items-center gap-1.5 text-[11px] font-semibold hover:underline"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        <Settings2 size={12} /> Einstellungen anpassen
                                    </button>
                                ) : null}
                            </div>

                            <button
                                onClick={() => setIsVisible(false)}
                                className="absolute top-2.5 right-2.5 rounded-full p-1.5 transition-colors"
                                style={{ color: 'var(--color-text-secondary)' }}
                                aria-label="Schliessen"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div
                            className="absolute bottom-0 left-0 right-0 h-1"
                            style={{ background: 'linear-gradient(90deg, var(--color-orange) 0%, var(--color-primary-light) 100%)' }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
