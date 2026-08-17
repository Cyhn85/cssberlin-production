'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthBrandHeader from '@/components/auth/AuthBrandHeader';
import { Checkbox } from '@/components/ui/checkbox';

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Registrierung fehlgeschlagen.');
            }

            // Auto login after successful registration
            const loginRes = await signIn('credentials', {
                email: formData.email,
                password: formData.password,
                redirect: false,
            });

            if (loginRes?.error) {
                setError(loginRes.error);
            } else {
                router.push('/');
                router.refresh();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--gradient-hero-banner)' }}>
            <div className="max-w-sm w-full p-6 rounded-3xl shadow-xl bg-white/95 backdrop-blur" style={{ border: '1px solid var(--color-border)' }}>
                <div className="text-center mb-6">
                    <AuthBrandHeader />
                    <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>Konto erstellen</h2>
                    <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Werde Teil der nachhaltigen Mode-Community Berlins.</p>
                </div>

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
                    Mit Google registrieren
                </button>

                <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>ODER</span>
                    <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Vor- und Nachname</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border-[1.5px] outline-none focus:ring-2"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-text-muted)' }}
                            placeholder="z.B. Anna Müller"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>E-Mail Adresse</label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border-[1.5px] outline-none focus:ring-2"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-text-muted)' }}
                            placeholder="anna@beispiel.de"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Passwort</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={8}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full h-11 pl-4 pr-12 rounded-xl border-[1.5px] outline-none focus:ring-2"
                                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-text-muted)' }}
                                placeholder="Mind. 8 Zeichen"
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

                    <div className="text-xs mt-3 flex items-start gap-2" style={{ color: 'var(--color-text-muted)' }}>
                        <Checkbox required className="mt-0.5" />
                        <span>Ich stimme den <Link href="/agb" className="underline hover:text-[var(--color-primary)]">AGB</Link> und der <Link href="/datenschutz" className="underline hover:text-[var(--color-primary)]">Datenschutzerklärung</Link> zu.</span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 mt-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 btn-mars-earth"
                        style={{ background: 'var(--color-orange)' }}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <span>Kostenlos registrieren</span>}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Du hast schon ein Konto?{' '}
                    <Link href="/login" className="font-bold underline" style={{ color: 'var(--color-primary)' }}>Hier einloggen</Link>
                </p>
            </div>
        </div>
    );
}
