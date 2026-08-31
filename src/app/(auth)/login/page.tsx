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
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-muted/30">
            <div className="w-full max-w-5xl bg-card rounded-2xl shadow-xl border border-border/50 overflow-hidden flex flex-col md:flex-row min-h-[600px] relative">
                
                {/* Close/Back Button */}
                <Link href="/" className="absolute top-4 left-4 z-50 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors" aria-label="Zurück zur Startseite">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </Link>

                {/* Left Side: Editorial / Brand */}
                <div className="hidden md:flex md:w-1/2 relative p-12 flex-col items-center justify-center overflow-hidden hero-banner-gradient text-center">
                    <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                    
                    <div className="relative z-10 flex flex-col items-center justify-center w-full">
                        {/* Logo */}
                        <div className="mb-3">
                            <span className="text-[4rem] leading-none font-extrabold tracking-tight drop-shadow-lg" style={{ fontFamily: 'var(--font-display)' }}>
                                {/* White, not the brand orange/green pair. The
                                    panel behind this is the animated
                                    orange-to-green gradient: an orange "CSS"
                                    drifts over orange and a green "berlin" over
                                    green, so each word disappears for part of
                                    every 8s cycle. The gradient already carries
                                    the brand colours; the logo only has to stay
                                    readable. */}
                                <span className="text-white">CSS</span>
                                <span className="ml-2 text-white">berlin</span>
                            </span>
                        </div>
                        
                        {/* Primary English text */}
                        <h1 className="text-white/95 text-base md:text-lg font-bold tracking-[0.25em] uppercase mb-10 drop-shadow-md">
                            Climate Smart Solutions
                        </h1>

                        {/* Divider */}
                        <div className="w-16 h-[2px] bg-white/40 rounded-full mb-10"></div>

                        {/* Translations (Manifesto Style) */}
                        <div className="flex flex-col items-center space-y-7">
                            <p className="text-white/95 text-sm md:text-base font-semibold tracking-[0.1em] uppercase drop-shadow-sm text-center">
                                &quot;Klimaintelligente Lösungen&quot;
                            </p>
                            
                            <p className="text-white/95 text-sm md:text-base font-semibold tracking-[0.1em] uppercase drop-shadow-sm text-center">
                                &quot;İklim Dostu Çözümler&quot;
                            </p>
                            
                            <p className="text-white/95 text-sm md:text-base font-semibold tracking-[0.1em] uppercase drop-shadow-sm text-center">
                                &quot;Кліматично Розумні Рішення&quot;
                            </p>

                            {/* Arabic - specific font styling, increased size, correct rtl, no tracking */}
                            <p className="text-white text-2xl md:text-3xl font-bold drop-shadow-sm text-center mt-2" dir="rtl" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>
                                &quot;حلول مناخية ذكية&quot;
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Auth Form */}
                <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center bg-background">
                    <div className="w-full max-w-md mx-auto">
                        <div className="text-center mb-8">
                            <div className="md:hidden mb-6 flex justify-center"><AuthBrandHeader /></div>
                            <h2 className="text-3xl font-bold text-foreground tracking-tight">Willkommen zurück</h2>
                            <p className="mt-2 text-muted-foreground">Logge dich ein, um nachhaltig zu stöbern.</p>
                        </div>

                        {isSuspendedRedirect && (
                            <div className="mb-6 p-4 rounded-xl text-sm bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                                Dieses Konto wurde gesperrt. Kontaktiere den Support, falls du Fragen hast.
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 rounded-xl text-sm bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => signIn('google', { callbackUrl: '/' })}
                            className="w-full h-12 rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)] font-semibold flex items-center justify-center gap-3 transition-all hover:bg-black/5 focus:ring-2 focus:ring-ring focus:outline-none"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
                                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.25 21.3 7.31 24 12 24z" />
                                <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 010-4.54V6.64H1.27a12 12 0 000 10.72l4-3.09z" />
                                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0 7.31 0 3.25 2.7 1.27 6.64l4 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
                            </svg>
                            Mit Google fortfahren
                        </button>

                        <div className="my-6 flex items-center gap-4">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs font-semibold text-muted-foreground tracking-wider">ODER</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        {mode === 'password' ? (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-foreground">E-Mail Adresse</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                                        placeholder="z.B. anna@beispiel.de"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-medium text-foreground">Passwort</label>
                                        <Link href="/passwort-vergessen" className="text-sm font-semibold text-primary hover:underline hover:underline-offset-4">Passwort vergessen?</Link>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full h-12 pl-4 pr-12 rounded-xl border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 mt-2 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none shadow-sm shadow-primary/20"
                                >
                                    {loading ? <Loader2 size={20} className="animate-spin" /> : 'Einloggen'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setMode('magic'); setError(''); }}
                                    className="flex w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mt-4"
                                >
                                    <Mail size={16} /> Stattdessen per Magic Link einloggen
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleMagicLink} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-foreground">E-Mail Adresse</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                                        placeholder="z.B. anna@beispiel.de"
                                    />
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Wir schicken dir einen sicheren Login-Link &ndash; kein Passwort nötig.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={magicLinkSending}
                                    className="w-full h-12 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none shadow-sm shadow-primary/20"
                                >
                                    {magicLinkSending ? <Loader2 size={20} className="animate-spin" /> : 'Login-Link senden'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setMode('password'); setError(''); }}
                                    className="flex w-full items-center justify-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mt-4"
                                >
                                    Zurück zum Passwort-Login
                                </button>
                            </form>
                        )}

                        <p className="mt-8 text-center text-sm text-muted-foreground">
                            Noch kein Konto?{' '}
                            <Link href="/register" className="font-semibold text-primary hover:underline hover:underline-offset-4">Jetzt registrieren</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
