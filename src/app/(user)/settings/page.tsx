'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { Bell, CreditCard, Loader2, LogOut, Package, Save, ShieldCheck, User } from 'lucide-react';

type ProfilePayload = {
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  isVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  rating: number;
  _count: {
    ordersAsSeller: number;
    ordersAsBuyer: number;
  };
};

type BundleDiscount = {
  isActive: boolean;
  twoItems?: number | null;
  threeItems?: number | null;
  fiveItems?: number | null;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBundle, setSavingBundle] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [bundle, setBundle] = useState<BundleDiscount>({ isActive: false, twoItems: 5, threeItems: 10, fiveItems: 15 });
  const [formData, setFormData] = useState({ name: '', username: '', location: '', bio: '' });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [profileResponse, bundleResponse] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/users/me/bundle-discount'),
        ]);
        const profileResult = await profileResponse.json();
        const bundleResult = await bundleResponse.json();

        if (!cancelled) {
          if (profileResult.success) {
            setProfile(profileResult.data);
            setFormData({
              name: profileResult.data.name || '',
              username: profileResult.data.username || '',
              location: profileResult.data.location || '',
              bio: profileResult.data.bio || '',
            });
          }
          if (bundleResult.success) {
            setBundle(bundleResult.data);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setMessage(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Profil konnte nicht gespeichert werden.');
      }

      setProfile((current) => (current ? { ...current, ...result.data } : current));
      setMessage('Profil erfolgreich gespeichert.');
    } catch (error: any) {
      setMessage(error.message || 'Profil konnte nicht gespeichert werden.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBundleSave = async () => {
    setSavingBundle(true);
    setMessage(null);
    try {
      const response = await fetch('/api/users/me/bundle-discount', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Rabatte konnten nicht gespeichert werden.');
      }
      setBundle(result.data);
      setMessage('Paket-Rabatte gespeichert.');
    } catch (error: any) {
      setMessage(error.message || 'Rabatte konnten nicht gespeichert werden.');
    } finally {
      setSavingBundle(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <h1 className="mb-8 text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
          Einstellungen
        </h1>

        {message ? (
          <div className="mb-6 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}>
            {message}
          </div>
        ) : null}

        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="md:w-64 shrink-0 space-y-1">
            {[
              { id: 'profile', icon: User, label: 'Profil bearbeiten' },
              { id: 'verification', icon: ShieldCheck, label: 'Verifizierung & Trust' },
              { id: 'payment', icon: CreditCard, label: 'Zahlung & Auszahlung' },
              { id: 'bundle', icon: Package, label: 'Rabatte fuer Pakete' },
              { id: 'notifications', icon: Bell, label: 'Benachrichtigungen' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}

            <div className="mt-8 border-t pt-8" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50"
              >
                <LogOut size={18} />
                Abmelden
              </button>
            </div>
          </aside>

          <main className="flex-1">
            {activeTab === 'profile' ? (
              <div className="rounded-3xl p-6 md:p-8" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <h2 className="mb-6 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Oeffentliches Profil</h2>
                <form onSubmit={handleProfileSave} className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-sm" style={{ background: 'var(--color-primary-light)' }}>
                      {(formData.name || profile?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{profile?.email}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Avatar-Upload kann spaeter an Uploadthing angebunden werden.</p>
                    </div>
                  </div>

                  <Field label="Name">
                    <input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="h-12 w-full rounded-xl border px-4 outline-none focus:ring-2" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </Field>
                  <Field label="Benutzername">
                    <input value={formData.username} onChange={(event) => setFormData({ ...formData, username: event.target.value })} className="h-12 w-full rounded-xl border px-4 outline-none focus:ring-2" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </Field>
                  <Field label="Standort">
                    <input value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} className="h-12 w-full rounded-xl border px-4 outline-none focus:ring-2" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </Field>
                  <Field label="Bio">
                    <textarea value={formData.bio} onChange={(event) => setFormData({ ...formData, bio: event.target.value })} className="min-h-[120px] w-full rounded-xl border p-4 outline-none focus:ring-2" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </Field>

                  <button type="submit" disabled={savingProfile} className="ml-auto flex h-12 items-center gap-2 rounded-xl px-8 font-bold text-white btn-mars-earth" style={{ background: 'var(--color-orange)' }}>
                    {savingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} <span>Speichern</span>
                  </button>
                </form>
              </div>
            ) : null}

            {activeTab === 'verification' && profile ? (
              <div className="space-y-6">
                <div className="rounded-3xl p-6 md:p-8" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <h2 className="mb-2 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Trust Badges & Verifizierung</h2>
                  <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Der aktuelle Status kommt direkt aus deinem Nutzerkonto.</p>

                  <StatusRow title="E-Mail-Adresse" description={profile.email} status={profile.isVerified ? 'Verifiziert' : 'Offen'} />
                  <StatusRow title="Telefonnummer" description={profile.phoneVerified ? 'Telefon bestaetigt' : 'Noch nicht verifiziert'} status={profile.phoneVerified ? 'Aktiv' : 'Offen'} />
                  <StatusRow title="Identitaetspruefung" description={profile.idVerified ? 'Identitaet bestaetigt' : 'Noch nicht hinterlegt'} status={profile.idVerified ? 'Aktiv' : 'Optional'} />
                </div>

                <div className="rounded-3xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-6">
                  <h3 className="mb-2 flex items-center gap-2 font-bold text-[var(--color-primary-dark)]"><ShieldCheck size={20} /> DAC7 & Vertrauen</h3>
                  <p className="text-sm text-[var(--color-primary)]">
                    Verkäufe: {profile._count.ordersAsSeller} · Käufe: {profile._count.ordersAsBuyer}. Diese Kennzahlen laufen jetzt aus dem echten Account-Backend ein.
                  </p>
                </div>
              </div>
            ) : null}

            {activeTab === 'payment' && profile ? (
              <div className="rounded-3xl p-6 md:p-8" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <h2 className="mb-6 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Guthaben & Auszahlung</h2>
                <div className="mb-6 flex items-center justify-between rounded-2xl p-6" style={{ background: 'var(--color-bg-secondary)' }}>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Verkaeufe mit abgeschlossenem Status</p>
                    <p className="mt-1 text-4xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>{profile._count.ordersAsSeller}</p>
                  </div>
                  <div className="text-right text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <p>Kaeufe insgesamt: {profile._count.ordersAsBuyer}</p>
                    <p>Stripe-Auszahlung folgt im naechsten Sprint.</p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'bundle' ? (
              <div className="rounded-3xl p-6 md:p-8" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Paket-Rabatte aktivieren</h2>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={bundle.isActive} onChange={(event) => setBundle({ ...bundle, isActive: event.target.checked })} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-[var(--color-primary)] peer-checked:after:translate-x-full" />
                  </label>
                </div>
                <p className="mb-8 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Diese Werte werden direkt gegen /api/users/me/bundle-discount gespeichert.
                </p>

                {[
                  { key: 'twoItems', label: '2 Artikel' },
                  { key: 'threeItems', label: '3 Artikel' },
                  { key: 'fiveItems', label: '5 Artikel' },
                ].map((entry) => (
                  <div key={entry.key} className="mb-4 flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                    <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{entry.label}</h4>
                    <select
                      value={String(bundle[entry.key as keyof BundleDiscount] ?? 0)}
                      onChange={(event) => setBundle({ ...bundle, [entry.key]: Number(event.target.value) })}
                      className="cursor-pointer bg-transparent p-1 text-sm font-semibold outline-none"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {[0, 5, 10, 15, 20, 25, 30].map((option) => (
                        <option key={option} value={option}>{option}%</option>
                      ))}
                    </select>
                  </div>
                ))}

                <button onClick={handleBundleSave} disabled={savingBundle} className="mt-6 h-12 w-full rounded-xl font-bold text-white btn-mars-earth" style={{ background: 'var(--color-orange)' }}>
                  <span>{savingBundle ? 'Speichert...' : 'Rabatte speichern'}</span>
                </button>
              </div>
            ) : null}

            {activeTab === 'notifications' ? (
              <div className="rounded-3xl p-6 md:p-8" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <h2 className="mb-2 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Benachrichtigungen</h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Das Notification-Center arbeitet bereits ueber /api/notifications. Eine eigene Einstellungsmaske folgt als naechster Feinschliff.
                </p>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</label>
      {children}
    </div>
  );
}

function StatusRow({ title, description, status }: { title: string; description: string; status: string }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div>
        <h4 className="font-bold" style={{ color: 'var(--color-text)' }}>{title}</h4>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
      </div>
      <span className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-700">{status}</span>
    </div>
  );
}

