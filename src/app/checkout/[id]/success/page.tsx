import Link from 'next/link';
import { CheckCircle2, PackageCheck, ShieldCheck } from 'lucide-react';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    session_id?: string;
    orderId?: string;
    mode?: string;
  }>;
};

export default async function CheckoutSuccessPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const isDevMode = query.mode === 'dev';
  const reference = isDevMode ? query.orderId : query.session_id;

  return (
    <div className="min-h-screen py-24" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-3xl">
        <div className="rounded-[32px] border bg-white p-8 shadow-sm md:p-12" style={{ borderColor: 'var(--color-border)' }}>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 size={42} />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
              {isDevMode ? 'Bestellung bestaetigt' : 'Zahlung erfolgreich uebermittelt'}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7" style={{ color: 'var(--color-text-secondary)' }}>
              {isDevMode
                ? 'Deine Bestellung wurde aufgenommen und der Artikel fuer dich reserviert. Die Zahlungsabwicklung wird in Kuerze abgeschlossen.'
                : 'Deine Zahlung wurde an den sicheren Checkout uebergeben. Die Bestellung wird ueber den Stripe-Webhook abgeschlossen. Falls sie nicht sofort unter Einkaeufe erscheint, aktualisiere die Seite in ein paar Sekunden.'}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl p-5" style={{ background: 'var(--color-primary-50)' }}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-primary-dark)' }}>
                <ShieldCheck size={18} /> Geschuetzter Kauf
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--color-primary)' }}>
                Deine Zahlung bleibt abgesichert, bis der Versandprozess sauber gestartet ist.
              </p>
            </div>
            <div className="rounded-3xl p-5" style={{ background: 'var(--color-bg-secondary)' }}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                <PackageCheck size={18} /> Referenz
              </div>
              <p className="break-all text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                {reference || 'Noch keine Referenz verfuegbar'}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              Naechste Schritte
            </h2>
            <ul className="mt-3 space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <li>Pruefe deine Einkaeufe fuer den aktuellen Bestellstatus.</li>
              <li>Der Verkaeufer wird nach erfolgreicher Zahlungsbestaetigung benachrichtigt.</li>
              <li>Bei Rueckfragen findest du den Artikel weiter auf der Produktseite.</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/purchases" className="btn-mars-earth flex-1 rounded-2xl px-6 py-4 text-center font-bold text-white" style={{ background: 'var(--color-orange)' }}>
              Zu meinen Einkaeufen
            </Link>
            <Link href={`/product/${id}`} className="flex-1 rounded-2xl border px-6 py-4 text-center font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              Zur Produktseite
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}