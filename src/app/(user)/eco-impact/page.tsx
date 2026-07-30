'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Leaf } from 'lucide-react';

type EcoData = {
  personal: {
    co2Saved: number;
    waterSaved: number;
    itemsRecycled: number;
    level: string;
    levelEmoji: string;
    equivalents: {
      carKm: number;
      flights: number;
      treesPerYear: number;
      showers: number;
    };
  } | null;
  monthlyTrend: Array<{ month: string; co2Saved: number; items: number }>;
  community: {
    totalUsers: number;
    totalCO2Saved: number;
    totalItemsRecycled: number;
  };
};

export default function EcoImpactPage() {
  const [data, setData] = useState<EcoData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const response = await fetch('/api/eco-impact');
      const result = await response.json();
      if (!cancelled && result.success) {
        setData(result.data);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return <div className="container py-16 text-center">Eco-Impact wird geladen...</div>;
  }

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        {data.personal ? (
          <div className="mb-8 rounded-3xl p-8 text-white hero-banner-gradient">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-white/80">Persönlicher Impact</p>
            <h1 className="mb-4 text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{data.personal.levelEmoji} {data.personal.level}</h1>
            <p className="max-w-2xl text-white/80">Dein Second-hand Verhalten spart messbar CO2, Wasser und neue Produktion ein. Diese Daten kommen direkt aus deinen abgeschlossenen Bestellungen.</p>
          </div>
        ) : (
          <div className="mb-8 rounded-3xl p-8 text-white hero-banner-gradient">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-white/80">Community Impact</p>
            <h1 className="mb-4 text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>🌍 Gemeinsam sparen wir echte Ressourcen</h1>
            <p className="max-w-2xl text-white/80">Diese Zahlen kommen live aus abgeschlossenen Bestellungen auf cssberlin. Melde dich an, um zu sehen, wie viel du persönlich schon gespart hast.</p>
            <Link href="/login?callbackUrl=/eco-impact" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold" style={{ color: 'var(--color-primary-dark)' }}>
              Anmelden für deinen Impact
            </Link>
          </div>
        )}

        {data.personal ? (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: 'CO2 gespart', value: `${data.personal.co2Saved.toFixed(1)} kg` },
                { label: 'Wasser gespart', value: `${data.personal.waterSaved.toLocaleString('de-DE')} L` },
                { label: 'Artikel recycelt', value: data.personal.itemsRecycled },
                { label: 'Duschen äquivalent', value: data.personal.equivalents.showers },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]"><Leaf size={18} /></div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{item.value}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{item.label}</div>
                </div>
              ))}
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Monatlicher Verlauf</h2>
                <div className="space-y-3">
                  {data.monthlyTrend.length > 0 ? data.monthlyTrend.map((entry) => (
                    <div key={entry.month}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--color-text)' }}>{entry.month}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{entry.co2Saved.toFixed(1)} kg CO2</span>
                      </div>
                      <div className="h-3 rounded-full" style={{ background: 'var(--color-bg-secondary)' }}>
                        <div className="h-3 rounded-full" style={{ width: `${Math.min(100, entry.co2Saved * 4)}%`, background: 'var(--gradient-mars-earth)' }} />
                      </div>
                    </div>
                  )) : <p style={{ color: 'var(--color-text-secondary)' }}>Noch keine abgeschlossenen Bestellungen für den Verlauf.</p>}
                </div>
              </div>

              <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Äquivalente</h2>
                <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>{data.personal.equivalents.carKm} km Autofahrt vermieden</p>
                  <p>{data.personal.equivalents.flights.toFixed(2)} Kurzstreckenflüge kompensiert</p>
                  <p>{data.personal.equivalents.treesPerYear.toFixed(2)} Bäume Jahresleistung</p>
                </div>
              </div>
            </div>
          </>
        ) : null}

        <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
          <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Community Impact</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Mitglieder</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{data.community.totalUsers}</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Gespartes CO2</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{data.community.totalCO2Saved.toFixed(1)} kg</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Wiederverwendete Artikel</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{data.community.totalItemsRecycled}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
