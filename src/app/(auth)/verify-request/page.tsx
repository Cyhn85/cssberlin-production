import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import AuthBrandHeader from '@/components/auth/AuthBrandHeader';

export default function VerifyRequestPage() {
    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8" style={{ background: 'var(--gradient-hero-banner)' }}>
            <div className="w-full max-w-md rounded-3xl border bg-white/90 p-8 text-center shadow-xl backdrop-blur" style={{ borderColor: 'var(--color-border)' }}>
                <AuthBrandHeader />
                <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: 'rgba(232,101,26,0.12)' }}
                >
                    <MailCheck size={26} style={{ color: 'var(--color-orange)' }} />
                </div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                    Pruefe dein Postfach
                </h2>
                <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Wir haben dir einen Login-Link geschickt. Klicke auf den Link in der E-Mail, um dich einzuloggen &ndash; er ist 24 Stunden gueltig.
                </p>
                <p className="mt-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Keine E-Mail erhalten? Pruefe deinen Spam-Ordner oder{' '}
                    <Link href="/login" className="font-semibold underline" style={{ color: 'var(--color-orange)' }}>
                        versuche es erneut
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
