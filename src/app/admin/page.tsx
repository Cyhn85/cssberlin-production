'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users, Package, ShieldAlert, UserX, EyeOff } from 'lucide-react';

type OrderStatusCount = { status: string; count: number };

type AdminStats = {
  totalUsers: number;
  suspendedUsers: number;
  activeListings: number;
  hiddenListings: number;
  openDisputes: number;
  ordersByStatus: OrderStatusCount[];
};

const orderStatusLabels: Record<string, string> = {
  PENDING_PAYMENT: 'Zahlung ausstehend',
  PAID: 'Bezahlt',
  SHIPPED: 'Versendet',
  DELIVERED: 'Zugestellt',
  COMPLETED: 'Abgeschlossen',
  DISPUTED: 'Kaeuferschutz-Fall',
  CANCELLED: 'Storniert',
  REFUNDED: 'Erstattet',
};

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent?: boolean }) {
  return (
    <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ background: accent ? 'rgba(220,38,38,0.1)' : 'var(--color-primary-50)', color: accent ? '#dc2626' : 'var(--color-primary)' }}>
        <Icon size={18} />
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</div>
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled && result.success) setStats(result.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Uebersicht
      </h1>

      {loading ? (
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      ) : stats ? (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Nutzer gesamt" value={stats.totalUsers} icon={Users} />
            <StatCard label="Aktive Artikel" value={stats.activeListings} icon={Package} />
            <StatCard label="Offene Kaeuferschutz-Faelle" value={stats.openDisputes} icon={ShieldAlert} accent={stats.openDisputes > 0} />
            <StatCard label="Gesperrte Nutzer" value={stats.suspendedUsers} icon={UserX} />
          </div>

          {stats.openDisputes > 0 ? (
            <Link
              href="/admin/disputes"
              className="mb-8 flex items-center justify-between rounded-2xl border px-5 py-4 text-sm font-semibold"
              style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: '#dc2626' }}
            >
              <span>{stats.openDisputes} offene(r) Kaeuferschutz-Fall(-Faelle) wartet auf Bearbeitung.</span>
              <span>Jetzt pruefen &rarr;</span>
            </Link>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text)' }}>Bestellungen nach Status</h2>
              <div className="space-y-2 text-sm">
                {stats.ordersByStatus.length > 0 ? (
                  stats.ordersByStatus.map((row) => (
                    <div key={row.status} className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>{orderStatusLabels[row.status] || row.status}</span>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{row.count}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--color-text-secondary)' }}>Noch keine Bestellungen.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                <EyeOff size={18} /> Ausgeblendete Artikel
              </h2>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{stats.hiddenListings}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Von Admins entfernte oder verborgene Inserate.</p>
            </div>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--color-text-secondary)' }}>Statistiken konnten nicht geladen werden.</p>
      )}
    </div>
  );
}
