'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ClipboardList, Euro, Loader2, PackageCheck, ShieldAlert, Truck } from 'lucide-react';
import { formatPrice, formatRelativeTime, orderStatusToLabel } from '@/lib/utils/condition-map';

type Sale = {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  trackingCode: string | null;
  shippingCarrier: string | null;
  product: {
    id: string;
    title: string;
    images: Array<{ url: string }>;
  };
  buyer: {
    id: string;
    name: string | null;
    location?: string | null;
  };
};

function getSalesActionLabel(status: string) {
  if (status === 'PAID') return 'Versand vorbereiten';
  if (status === 'SHIPPED') return 'Tracking aktualisieren';
  if (status === 'DISPUTED') return 'Streitfall pruefen';
  return 'Details ansehen';
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/orders');
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Verkaeufe konnten nicht geladen werden.');
        }

        if (!cancelled) {
          setSales(result.data.sales || []);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError.message || 'Verkaeufe konnten nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const revenue = sales
      .filter((sale) => sale.status === 'COMPLETED')
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    return {
      total: sales.length,
      toShip: sales.filter((sale) => sale.status === 'PAID').length,
      inTransit: sales.filter((sale) => sale.status === 'SHIPPED' || sale.status === 'DELIVERED').length,
      disputes: sales.filter((sale) => sale.status === 'DISPUTED').length,
      revenue,
    };
  }, [sales]);

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Meine Verkaeufe
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Behalte Versand, Tracking und problematische Bestellungen in einem Seller-Board im Blick.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/dashboard" style={{ color: 'var(--color-primary)' }}>Zum Dashboard</Link>
            <Link href="/upload" className="rounded-full px-5 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
              Neues Listing
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Verkaeufe gesamt', value: summary.total, icon: <ClipboardList size={18} /> },
            { label: 'Versand offen', value: summary.toShip, icon: <Truck size={18} /> },
            { label: 'Unterwegs', value: summary.inTransit, icon: <PackageCheck size={18} /> },
            { label: 'Streitfaelle', value: summary.disputes, icon: <ShieldAlert size={18} /> },
            { label: 'Ausgezahlter Umsatz', value: formatPrice(summary.revenue), icon: <Euro size={18} /> },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                {card.icon}
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{card.value}</div>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{card.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <Loader2 size={30} className="mx-auto mb-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Verkaeufe werden geladen...</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : sales.length > 0 ? (
          <div className="space-y-4">
            {sales.map((sale) => {
              const imageUrl = sale.product.images[0]?.url || '';
              const statusLabel = orderStatusToLabel[sale.status] || sale.status;

              return (
                <div
                  key={sale.id}
                  className="rounded-3xl border p-5"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={sale.product.title} className="h-full w-full object-cover" />
                        ) : (
                          <PackageCheck size={24} style={{ color: 'var(--color-primary)', opacity: 0.35 }} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{sale.product.title}</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          Kaeufer: {sale.buyer.name || 'cssberlin member'}
                          {sale.buyer.location ? ` - ${sale.buyer.location}` : ''}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Erstellt {formatRelativeTime(sale.createdAt)}
                        </p>
                        {sale.shippingCarrier ? (
                          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Versand: {sale.shippingCarrier}{sale.trackingCode ? ` | Tracking: ${sale.trackingCode}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 text-left lg:items-end lg:text-right">
                      <div>
                        <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(sale.totalAmount)}</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{statusLabel}</p>
                      </div>
                      <Link
                        href={`/sales/${sale.id}`}
                        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      >
                        {getSalesActionLabel(sale.status)} <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <AlertTriangle size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Noch keine Verkaeufe</h2>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Sobald ein Kunde einen Artikel kauft, erscheint der Auftrag hier inklusive Versandstatus und Tracking.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/upload" className="rounded-full px-5 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
                Erstes Listing erstellen
              </Link>
              <Link href="/dashboard" className="rounded-full border px-5 py-3 font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                Dashboard ansehen
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}