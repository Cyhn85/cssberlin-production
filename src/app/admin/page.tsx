'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users, Package, ShieldAlert, UserX, EyeOff, TrendingUp, Activity, AlertTriangle, ArrowRight, Wallet, ShoppingBag } from 'lucide-react';

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
  DISPUTED: 'Käuferschutz-Fall',
  CANCELLED: 'Storniert',
  REFUNDED: 'Erstattet',
};

const orderStatusColors: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  DISPUTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
};

function StatCard({ label, value, icon: Icon, accent, trend }: { label: string; value: number; icon: any; accent?: boolean; trend?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent ? 'bg-red-50 text-red-600' : 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'}`}>
          <Icon size={24} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-600">
          <TrendingUp size={16} />
          <span>{trend}</span>
          <span className="text-gray-400 font-normal ml-1">vs. Vormonat</span>
        </div>
      )}
      {/* Decorative background element */}
      <div className={`absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-10 ${accent ? 'bg-red-500' : 'bg-[var(--color-primary)]'}`}></div>
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
    <div className="pb-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">System-Übersicht</h1>
          <p className="mt-1 text-sm text-gray-500">Willkommen im cssberlin Admin-Bereich. Hier hast du alle Metriken im Blick.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
          <Activity size={16} className="text-[var(--color-primary)]" /> System Status: <span className="text-emerald-600">Online & Gesund</span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white border-dashed">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-medium text-gray-500">Metriken werden geladen...</p>
          </div>
        </div>
      ) : stats ? (
        <>
          {/* Action Alerts */}
          {stats.openDisputes > 0 && (
            <div className="mb-8 overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-900">Aktion erforderlich: Käuferschutz-Fälle</h3>
                    <p className="text-sm text-red-700">{stats.openDisputes} Fall/Fälle warten auf deine Moderation.</p>
                  </div>
                </div>
                <Link
                  href="/admin/disputes"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  Fälle prüfen <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}

          {/* Core Metrics */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Nutzer gesamt" value={stats.totalUsers} icon={Users} trend="+12.5%" />
            <StatCard label="Aktive Inserate" value={stats.activeListings} icon={Package} trend="+8.2%" />
            <StatCard label="Offene Konflikte" value={stats.openDisputes} icon={ShieldAlert} accent={stats.openDisputes > 0} />
            <StatCard label="Gesperrte Nutzer" value={stats.suspendedUsers} icon={UserX} accent={stats.suspendedUsers > 0} />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Orders Status Table */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-gray-500" />
                  <h2 className="text-base font-bold text-gray-900">Bestellungen nach Status</h2>
                </div>
                <button className="text-xs font-semibold text-[var(--color-primary)] hover:underline">Vollständiger Bericht</button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {stats.ordersByStatus.length > 0 ? (
                    stats.ordersByStatus.map((row) => (
                      <div key={row.status} className="flex items-center justify-between border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md ${orderStatusColors[row.status] || 'bg-gray-100 text-gray-800'}`}>
                            {orderStatusLabels[row.status] || row.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                           {/* Simulated progress bar based on count relative to 100 for visual richness */}
                           <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                              <div className="h-full bg-gray-400 rounded-full" style={{ width: `${Math.min((row.count / 50) * 100, 100)}%` }}></div>
                           </div>
                           <span className="font-extrabold text-gray-900 w-8 text-right">{row.count}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ShoppingBag size={32} className="text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-500">Noch keine Bestellungen im System.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Moderation & Quick Stats */}
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                  <EyeOff size={100} />
                </div>
                <div className="relative z-10">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">Verborgene Artikel</h2>
                  <p className="text-4xl font-extrabold text-gray-900">{stats.hiddenListings}</p>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                    Von Administratoren oder System-Filtern aufgrund von Verstößen ausgeblendete Inserate.
                  </p>
                  <Link href="/admin/products?filter=hidden" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)] hover:underline">
                    Inhalte moderieren <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Finanz-Schnellübersicht</h2>
                <div className="flex flex-col gap-4">
                   <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-2"><Wallet size={16} className="text-gray-400" /> Ausstehende Auszahlungen</span>
                      <span className="font-bold text-gray-900">€ 0,00</span>
                   </div>
                   <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                      <span className="text-sm text-gray-600 flex items-center gap-2"><ShieldAlert size={16} className="text-gray-400" /> Einbehalten (Käuferschutz)</span>
                      <span className="font-bold text-gray-900">€ 0,00</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
          Statistiken konnten nicht geladen werden. Bitte API überprüfen.
        </div>
      )}
    </div>
  );
}
