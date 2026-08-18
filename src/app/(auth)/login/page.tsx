'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import AuthBrandHeader from '@/components/auth/AuthBrandHeader';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { status } = useSession();
    const isSuspendedRedirect = searchParams.get('suspended') === '1';

    // Giris YAPMIS kullanici bu sayfada tutulmaz.
    // Eskiden yonlendirme yoktu: Google ile giris yapip geri donen ya da
    // tarayici gerisi ile /login'e ugrayan kullanici tekrar giris formunu
    // goruyordu ve "giris yapamiyorum" hissine kapiliyordu. Oturum varsa
    // hedefe (callbackUrl veya ana sayfa) gonderilir.
    useEffect(() => {
        if (status !== 'authenticated') return;
        const hedef = searchParams.get('callbackUrl') || '/';
        // Acik yonlendirme aciklarini onlemek icin yalnizca site-ici yollar
        // kabul edilir; "//" ile baslayan protokol-bagimsiz URL'ler reddedilir.
        const guvenli = hedef.startsWith('/') && !hedef.startsWith('//') ? hedef : '/';
        router.replace(guvenli);
    }, [status, router, searchParams]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'password' | 'magic'>('password');
    const [magicLinkSending, setMagicLinkSending] = useState(false);

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMagicLinkSending(true);
        setError('');
        try {
            await signIn('email', { email, callbackUrl: '/' });
        } finally {
            setMagicLinkSending(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (res?.error) {
                setError(res.error);
            } else {
                router.push('/');
                router.refresh(); // Update session state globally
            }
        } catch (err: any) {
            setError('Ein Fehler ist aufgetreten.');
        } finally {
            setLoading(false);
        }
    };

    // Show a loading screen while session is being determined or after authentication 
    // before the redirect happens. This prevents the "empty login popup" flash.
    if (status === 'loading' || status === 'authenticated') {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero-banner)' }}>
                <div className="text-center bg-white/95 p-8 rounded-3xl shadow-xl flex flex-col items-center">
                    <Loader2 size={32} className="animate-spin mb-4" style={{ color: 'var(--color-primary)' }} />
                    <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>Bitte warten...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--gradient-hero-banner)' }}>
            <div className="max-w-sm w-full p-8 rounded-3xl shadow-xl bg-white/95 backdrop-blur-md" style={{ border: '1px solid var(--color-border)' }}>
                <div className="text-center mb-8">
                    <AuthBrandHeader />
                    <h2 className="text-2xl font-bold mt-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>Willkommen zurück</h2>
                    <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Logge dich ein, um nachhaltig zu stöbern.</p>
                </div>

                {isSuspendedRedirect && (
                    <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">
                        Dieses Konto wurde gesperrt. Kontaktiere den Support, falls du Fragen hast.
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">
                        {error}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => signIn('google', { callbackUrl: '/' })}
                    className="w-full h-11 rounded-xl border-[1.5px] font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-black/5"
                    style={{ borderColor: 'var(--color-text-muted)', color: 'var(--color-text)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.25 21.3 7.31 24 12 24z" />
                        <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 010-4.54V6.64H1.27a12 12 0 000 10.72l4-3.09z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0 7.31 0 3.25 2.7 1.27 6.64l4 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
                    </svg>
                    Mit Google fortfahren
                </button>

                <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>ODER</span>
                    <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                </div>

                {mode === 'password' ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>E-Mail Adresse</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border-[1.5px] outline-none focus:ring-2"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-text-muted)' }}
                                placeholder="z.B. anna@beispiel.de"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>Passwort</label>
                                <Link href="/passwort-vergessen" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Passwort vergessen?</Link>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-11 pl-4 pr-12 rounded-xl border-[1.5px] outline-none focus:ring-2"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-text-muted)' }}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 mt-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
                            style={{ background: 'var(--color-orange)' }}
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Einloggen'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setMode('magic'); setError(''); }}
                            className="flex w-full items-center justify-center gap-2 text-sm font-semibold hover:underline"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            <Mail size={15} /> Stattdessen per Magic Link einloggen
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleMagicLink} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>E-Mail Adresse</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border-[1.5px] outline-none focus:ring-2"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-text-muted)' }}
                                placeholder="z.B. anna@beispiel.de"
                            />
                            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Wir schicken dir einen Login-Link &ndash; kein Passwort nötig.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={magicLinkSending}
                            className="w-full h-11 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
                            style={{ background: 'var(--color-orange)' }}
                        >
                            {magicLinkSending ? <Loader2 size={20} className="animate-spin" /> : 'Login-Link senden'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setMode('password'); setError(''); }}
                            className="flex w-full items-center justify-center text-sm font-semibold hover:underline"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            Zurück zum Passwort-Login
                        </button>
                    </form>
                )}

                <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Noch kein Konto?{' '}
                    <Link href="/register" className="font-bold underline" style={{ color: 'var(--color-primary)' }}>Jetzt registrieren</Link>
                </p>
            </div>
        </div>
    );
}
