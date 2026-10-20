import Link from 'next/link';
import { CheckCircle2, PackageCheck, ShieldCheck } from 'lucide-react';
import { cancellationPolicy, pickupPolicy, shippingDeadlines } from '@/config/marketplace-policy';

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
  // 'pickup' = Abholung requested (no online payment). The old 'dev' mode (paid
  // order without payment) no longer exists.
  const isPickup = query.mode === 'pickup';
  const reference = isPickup ? query.orderId : query.session_id;

  return (
    <div className="min-h-screen py-24" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-3xl">
        <div className="rounded-[32px] border bg-white p-8 shadow-sm md:p-12" style={{ borderColor: 'var(--color-border)' }}>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 size={42} />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
              {isPickup ? 'Abholung angefragt' : 'Zahlung erfolgreich übermittelt'}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7" style={{ color: 'var(--color-text-secondary)' }}>
              {isPickup
                ? `Der Artikel ist jetzt ${pickupPolicy.holdHours} Stunden für dich reserviert. Der Verkäufer wurde benachrichtigt - vereinbart Ort und Zeit im Chat. Bezahlt wird bar bei der Übergabe.`
                : 'Deine Zahlung wird bestätigt. Sobald sie eingegangen ist, erscheint die Bestellung unter „Meine Einkäufe“ und der Verkäufer wird benachrichtigt - meist innerhalb weniger Sekunden.'}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl p-5" style={{ background: 'var(--color-primary-50)' }}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-primary-dark)' }}>
                <ShieldCheck size={18} /> {isPickup ? 'Bei der Übergabe' : 'Geschützter Kauf'}
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--color-primary)' }}>
                {isPickup
                  ? 'Prüfe den Artikel vor Ort, bevor du bezahlst. Bei Abholung gilt kein Käuferschutz.'
                  : 'Dein Geld wird erst nach Abschluss der Bestellung an den Verkäufer ausgezahlt.'}
              </p>
            </div>
            <div className="rounded-3xl p-5" style={{ background: 'var(--color-bg-secondary)' }}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                <PackageCheck size={18} /> Referenz
              </div>
              <p className="break-all text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                {reference || 'Noch keine Referenz verfügbar'}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              Nächste Schritte
            </h2>
            <ul className="mt-3 space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {isPickup ? (
                <>
                  <li>Öffne den Chat mit dem Verkäufer und vereinbart einen Termin.</li>
                  <li>Nach der Übergabe bestätigt der Verkäufer „Übergeben & bezahlt“.</li>
                  <li>Kein Termin möglich? Du kannst in deiner Bestellung bis zur Übergabe kostenlos stornieren.</li>
                </>
              ) : (
                <>
                  <li>Den Status und später die Sendungsnummer findest du unter „Meine Einkäufe“.</li>
                  <li>Innerhalb der ersten {cancellationPolicy.buyerFreeCancelMinutes} Minuten kannst du dort noch kostenlos stornieren.</li>
                  <li>Der Verkäufer hat {shippingDeadlines.autoCancelAfterDays} Tage Zeit zu versenden.</li>
                </>
              )}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={isPickup && query.orderId ? `/purchases/${query.orderId}` : '/purchases'} className="btn-mars-earth flex-1 rounded-2xl px-6 py-4 text-center font-bold text-white" style={{ background: 'var(--color-orange)' }}>
              <span>{isPickup ? 'Zur Bestellung & zum Chat' : 'Zu meinen Einkäufen'}</span>
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