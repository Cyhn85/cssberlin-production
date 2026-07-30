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
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-4 left-4 right-4 md:left-8 md:right-auto md:max-w-md z-[100]"
                >
                    <div className="glass-card p-6 md:p-8 relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />

                        <div className="flex items-start gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                <ShieldCheck size={28} className="text-primary" />
                            </div>

                            <div className="flex-1 space-y-3">
                                <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                                    Deine Privatsphaere zaehlt
                                </h3>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    Wir nutzen Cookies, um cssberlin.de fuer dich zu betreiben und zu verbessern. Du entscheidest, welche Kategorien du zulaesst. Details findest du in unserer{' '}
                                    <Link href="/datenschutz" className="text-primary hover:underline font-semibold">Datenschutzerklaerung</Link>.
                                </p>

                                {showDetails ? (
                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/60 p-3 opacity-70">
                                            <div>
                                                <p className="text-sm font-semibold">Notwendig</p>
                                                <p className="text-xs text-muted-foreground">Immer aktiv &ndash; erforderlich fuer Login, Warenkorb und Sicherheit.</p>
                                            </div>
                                            <span className="text-xs font-bold text-primary">An</span>
                                        </div>

                                        {(Object.keys(CATEGORY_LABELS) as Array<Exclude<ConsentCategory, 'necessary'>>).map((category) => (
                                            <label key={category} className="flex items-start justify-between gap-3 rounded-xl bg-muted/60 p-3 cursor-pointer">
                                                <div>
                                                    <p className="text-sm font-semibold">{CATEGORY_LABELS[category].title}</p>
                                                    <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[category].description}</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={draft[category]}
                                                    onChange={() => toggleCategory(category)}
                                                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                                                />
                                            </label>
                                        ))}

                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={saveSelection}
                                            className="btn-mars-earth w-full py-2.5 text-sm font-bold text-white"
                                        >
                                            Auswahl speichern
                                        </motion.button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={acceptAll}
                                            className="flex-1 bg-primary text-white py-2.5 rounded-full text-sm font-bold shadow-lg shadow-primary/20 cursor-pointer"
                                        >
                                            Alle akzeptieren
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={acceptEssentialOnly}
                                            className="flex-1 bg-muted hover:bg-muted/80 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer"
                                        >
                                            Nur essenziell
                                        </motion.button>
                                    </div>
                                )}

                                {!showDetails ? (
                                    <button
                                        onClick={() => setShowDetails(true)}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
                                    >
                                        <Settings2 size={14} /> Einstellungen anpassen
                                    </button>
                                ) : null}
                            </div>

                            <button
                                onClick={() => setIsVisible(false)}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors cursor-pointer"
                                aria-label="Schliessen"
                            >
                                <X size={16} className="text-muted-foreground" />
                            </button>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-primary opacity-30" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
