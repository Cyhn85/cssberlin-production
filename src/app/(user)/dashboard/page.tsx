'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, Euro, Package, ShieldAlert, Truck } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import { formatPrice, orderStatusToLabel } from '@/lib/utils/condition-map';

type DashboardData = {
  profile: {
    name: string | null;
    products: Array<{
      id: string;
      title: string;
      price: number;
      originalPrice: number | null;
      brand: string | null;
      size: string | null;
      condition: string;
      likes: number;
      ecoCO2Saved: number;
      images: Array<{ url: string }>;
    }>;
    _count: {
      products: number;
      ordersAsSeller: number;
      followers: number;
    };
  };
  sales: Array<{
    id: string;
    totalAmount: number;
    status: string;
    product: { title: string; images: Array<{ url: string }> };
    buyer: { name: string | null };
    createdAt: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [profileResponse, ordersResponse] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/orders'),
        ]);
        const profileResult = await profileResponse.json();
        const ordersResult = await ordersResponse.json();

        if (!profileResponse.ok || !profileResult.success) {
          throw new Error(profileResult.error || 'Profil konnte nicht geladen werden.');
        }
        if (!ordersResponse.ok || !ordersResult.success) {
          throw new Error(ordersResult.error || 'Verkaeufe konnten nicht geladen werden.');
        }

        if (!cancelled) {
          setData({
            profile: profileResult.data,
            sales: ordersResult.data.sales || [],
          });
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError.message || 'Dashboard konnte nicht geladen werden.');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const sales = data?.sales || [];
    const revenue = sales.filter((sale) => sale.status === 'COMPLETED').reduce((sum, sale) => sum + sale.totalAmount, 0);

    return {
      toShip: sales.filter((sale) => sale.status === 'PAID').length,
      disputes: sales.filter((sale) => sale.status === 'DISPUTED').length,
      revenue,
    };
  }, [data]);

  if (!data && !error) {
    return <div className="container py-16 text-center">Dashboard wird geladen...</div>;
  }

  if (error) {
    return (
      <div className="container py-16">
        <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <AlertTriangle size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <h1 className="mb-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Dashboard nicht verfuegbar</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
          <Link href="/sales" className="rounded-full px-6 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
            Zu meinen Verkaeufen
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>Verkaeufer-Dashboard</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Deine Listings, Versandaufgaben und aktuellen Verkaeufe auf einen Blick.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/offers" className="rounded-full border px-5 py-3 font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Angebote</Link>
            <Link href="/sales" className="rounded-full border px-5 py-3 font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Verkaeufe</Link>
            <Link href="/upload" className="rounded-full px-5 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>Neuen Artikel hochladen</Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Aktive Listings', value: data.profile._count.products, icon: <Package size={18} /> },
            { label: 'Versand offen', value: summary.toShip, icon: <Truck size={18} /> },
            { label: 'Follower', value: data.profile._count.followers, icon: <BarChart3 size={18} /> },
            { label: 'Umsatz', value: formatPrice(summary.revenue), icon: <Euro size={18} /> },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">{card.icon}</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{card.value}</div>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{card.label}</div>
            </div>
          ))}
        </div>

        {summary.disputes > 0 ? (
          <div className="mb-8 rounded-3xl border p-5" style={{ borderColor: 'rgba(217, 119, 6, 0.28)', background: 'rgba(251, 191, 36, 0.12)' }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} style={{ color: '#B45309', marginTop: 2 }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Offene Streitfaelle</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {summary.disputes} Bestellung{summary.disputes === 1 ? '' : 'en'} braucht gerade besondere Aufmerksamkeit.
                  </p>
                </div>
              </div>
              <Link href="/sales" className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                Verkaeufe pruefen
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Deine Listings</h2>
            <Link href="/upload" style={{ color: 'var(--color-primary)' }}>Listing hinzufuegen</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.profile.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Neueste Verkaeufe</h2>
            <Link href="/sales" style={{ color: 'var(--color-primary)' }}>Alle Verkaeufe anzeigen</Link>
          </div>
          <div className="space-y-3">
            {data.sales.length > 0 ? data.sales.slice(0, 6).map((sale) => (
              <Link key={sale.id} href={`/sales/${sale.id}`} className="block rounded-2xl border p-4 transition-colors hover:bg-[var(--color-bg-secondary)]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{sale.product.title}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Kaeufer: {sale.buyer.name || 'cssberlin member'} | Status: {orderStatusToLabel[sale.status] || sale.status}
                    </p>
                  </div>
                  <div className="text-right font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(sale.totalAmount)}</div>
                </div>
              </Link>
            )) : <p style={{ color: 'var(--color-text-secondary)' }}>Noch keine Verkaeufe vorhanden.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}