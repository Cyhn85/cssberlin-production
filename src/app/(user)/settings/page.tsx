'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Bell, Camera, CreditCard, Loader2, LogOut, MapPin, Package, Save, ShieldCheck, User } from 'lucide-react';
import { NOTIFICATION_CATEGORIES, wantsNotification, type NotificationCategory, type NotificationChannel, type NotificationPrefs } from '@/config/notification-policy';
import { offerPolicy } from '@/config/marketplace-policy';
import SellerLocationMap from '@/components/profile/SellerLocationMap';
import SavedSearches from '@/components/settings/SavedSearches';

type ProfilePayload = {
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  avatar: string | null;
  notificationPrefs: NotificationPrefs | null;
  offerMinPercent: number | null;
  isVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  _count: { ordersAsSeller: number; ordersAsBuyer: number };
};

type PaymentMethod = { id: string; label: string; description: string; enabled: boolean };
type BundleDiscount = { isActive: boolean; twoItems?: number | null; threeItems?: number | null; fiveItems?: number | null };

const TABS = [
  { id: 'profile', icon: User, label: 'Profil bearbeiten' },
  { id: 'verification', icon: ShieldCheck, label: 'Verifizierung & Vertrauen' },
  { id: 'payment', icon: CreditCard, label: 'Zahlung & Verkauf' },
  { id: 'bundle', icon: Package, label: 'Rabatte für Pakete' },
  { id: 'notifications', icon: Bell, label: 'Benachrichtigungen' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const BIO_MAX = 300;
const card = { background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' };
const inputCls = 'h-12 w-full rounded-xl border px-4 outline-none focus:ring-2';
const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)' };

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const initialTab = (TABS.find((t) => t.id === searchParams.get('tab'))?.id ?? 'profile') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [bundle, setBundle] = useState<BundleDiscount>({ isActive: false, twoItems: 5, threeItems: 10, fiveItems: 15 });
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [formData, setFormData] = useState({ name: '', username: '', postalCode: '', city: '', bio: '' });
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [minPercent, setMinPercent] = useState<number | ''>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selectTab = (id: TabId) => {
    setActiveTab(id);
    setMessage(null);
    router.replace(`/settings?tab=${id}`, { scroll: false });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, b, m] = await Promise.all([
          fetch('/api/users/me').then((r) => r.json()),
          fetch('/api/users/me/bundle-discount').then((r) => r.json()).catch(() => null),
          fetch('/api/checkout/methods').then((r) => r.json()).catch(() => null),
        ]);
        if (cancelled) return;
        if (p?.success) {
          const d: ProfilePayload = p.data;
          setProfile(d);
          setFormData({ name: d.name || '', username: d.username || '', postalCode: d.postalCode || '', city: d.city || '', bio: d.bio || '' });
          setPrefs(d.notificationPrefs || {});
          setMinPercent(d.offerMinPercent ?? '');
        }
        if (b?.success) setBundle(b.data);
        if (m?.success) setMethods(m.data.methods);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const putMe = async (key: string, body: Record<string, unknown>, okText: string) => {
    setSaving(key);
    setMessage(null);
    try {
      const res = await fetch('/api/users/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r?.success) throw new Error(r?.error || 'Speichern fehlgeschlagen.');
      setProfile((cur) => (cur ? { ...cur, ...r.data } : cur));
      if (r.data.postalCode !== undefined) setFormData((f) => ({ ...f, postalCode: r.data.postalCode || '', city: r.data.city || '' }));
      setMessage({ ok: true, text: okText });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    } finally {
      setSaving(null);
    }
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.postalCode && !/^\d{5}$/.test(formData.postalCode)) {
      setMessage({ ok: false, text: 'Bitte gib eine 5-stellige Postleitzahl an.' });
      return;
    }
    void putMe('profile', {
      name: formData.name.trim() || undefined,
      username: formData.username.trim() || undefined,
      bio: formData.bio,
      postalCode: formData.postalCode.trim(),
      city: formData.city.trim(),
    }, 'Profil gespeichert.');
  };

  const uploadAvatar = async (file: File) => {
    setSaving('avatar');
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/users/me/avatar', { method: 'POST', body: fd });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r?.success) throw new Error(r?.error || 'Upload fehlgeschlagen.');
      setProfile((cur) => (cur ? { ...cur, avatar: r.data.avatar } : cur));
      await update?.().catch(() => undefined);
      setMessage({ ok: true, text: 'Profilbild aktualisiert.' });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    } finally {
      setSaving(null);
    }
  };

  const saveBundle = async () => {
    setSaving('bundle');
    setMessage(null);
    try {
      const res = await fetch('/api/users/me/bundle-discount', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bundle) });
      const r = await res.json();
      if (!res.ok || !r.success) throw new Error(r.error || 'Rabatte konnten nicht gespeichert werden.');
      setBundle(r.data);
      setMessage({ ok: true, text: 'Paket-Rabatte gespeichert.' });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    } finally {
      setSaving(null);
    }
  };

  const togglePref = (cat: NotificationCategory, ch: NotificationChannel) => {
    const current = wantsNotification(prefs, cat, ch);
    setPrefs((p) => ({ ...p, [cat]: { ...(p[cat] || {}), [ch]: !current } }));
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>;
  }

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <h1 className="mb-8 text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>Einstellungen</h1>

        {message ? (
          <div role="status" className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${message.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>
        ) : null}

        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="shrink-0 space-y-1 md:w-64">
            <nav className="flex gap-1 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0" aria-label="Einstellungen">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium md:w-full ${isActive ? 'bg-[rgba(45,106,79,.14)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}`}
                  >
                    <Icon size={18} /> {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-8 hidden border-t pt-8 md:block" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50">
                <LogOut size={18} /> Abmelden
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {activeTab === 'profile' ? (
              <div className="rounded-3xl p-6 md:p-8" style={card}>
                <h2 className="mb-6 text-xl font-bold">Öffentliches Profil</h2>
                <form onSubmit={saveProfile} className="space-y-6">
                  <div className="flex items-center gap-6">
                    <button type="button" onClick={() => fileRef.current?.click()} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full shadow-sm" aria-label="Profilbild ändern">
                      {profile?.avatar ? (
                        <img src={profile.avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white" style={{ background: 'var(--color-primary-light)' }}>
                          {(formData.name || profile?.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {saving === 'avatar' ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                      </span>
                    </button>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ''; }} />
                    <div>
                      <p className="text-sm font-semibold">{profile?.email}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Klicke auf das Bild, um ein neues hochzuladen (JPG, PNG oder WebP, max. 3 MB). Standortdaten im Foto werden entfernt.</p>
                    </div>
                  </div>

                  <Field label="Name">
                    <input value={formData.name} maxLength={50} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} style={inputStyle} />
                  </Field>
                  <Field label="Benutzername">
                    <input value={formData.username} maxLength={30} onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} className={inputCls} style={inputStyle} />
                  </Field>

                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium"><MapPin size={16} /> Standort</p>
                    <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                      <input aria-label="Postleitzahl" placeholder="PLZ" inputMode="numeric" maxLength={5} value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value.replace(/\D/g, '') })} className={inputCls} style={inputStyle} />
                      <input aria-label="Ort" placeholder="Ort (wird aus der PLZ ergänzt)" maxLength={60} value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputCls} style={inputStyle} />
                    </div>
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Öffentlich sichtbar sind nur PLZ und Ort - auf der Karte als ungefährer Bereich (ca. 1 km), nie deine Adresse. Wird für Abholung und die Umkreissuche genutzt.
                    </p>
                    {profile?.postalCode ? <SellerLocationMap label={`${profile.postalCode} ${profile.city ?? ''}`.trim()} lat={profile.lat} lng={profile.lng} compact /> : null}
                  </div>

                  <Field label={`Über mich (${formData.bio.length}/${BIO_MAX})`}>
                    <textarea value={formData.bio} maxLength={BIO_MAX} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="min-h-[120px] w-full rounded-xl border p-4 outline-none focus:ring-2" style={inputStyle} />
                  </Field>

                  <button type="submit" disabled={saving === 'profile'} className="ml-auto flex h-12 items-center gap-2 rounded-xl px-8 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
                    {saving === 'profile' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Speichern
                  </button>
                </form>
              </div>
            ) : null}

            {activeTab === 'verification' && profile ? (
              <div className="space-y-6">
                <div className="rounded-3xl p-6 md:p-8" style={card}>
                  <h2 className="mb-2 text-xl font-bold">Verifizierung & Vertrauen</h2>
                  <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Bestätigte Angaben erscheinen als Abzeichen in deinem Profil.</p>
                  <StatusRow title="E-Mail-Adresse" description={profile.email} done={profile.isVerified} doneText="Bestätigt" openText="Nicht bestätigt" />
                  <StatusRow title="Telefonnummer" description={profile.phoneVerified ? 'Telefon bestätigt' : 'Telefonbestätigung ist in Vorbereitung.'} done={profile.phoneVerified} doneText="Bestätigt" openText="Bald verfügbar" />
                  <StatusRow title="Identität" description={profile.idVerified ? 'Identität bestätigt' : 'Wird für Auszahlungen bei Online-Zahlung nötig (gesetzliche Pflicht, DAC7).'} done={profile.idVerified} doneText="Bestätigt" openText="Optional" />
                </div>
                <div className="rounded-3xl border border-[var(--color-primary-100)] bg-[rgba(45,106,79,.14)] p-6">
                  <h3 className="mb-2 flex items-center gap-2 font-bold text-[var(--color-text)]"><ShieldCheck size={20} /> Deine Bilanz</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">Verkäufe: {profile._count.ordersAsSeller} · Käufe: {profile._count.ordersAsBuyer}. Abgeschlossene Bestellungen und gute Bewertungen stärken dein Profil.</p>
                </div>
              </div>
            ) : null}

            {activeTab === 'payment' && profile ? (
              <div className="space-y-6">
                <div className="rounded-3xl p-6 md:p-8" style={card}>
                  <h2 className="mb-2 text-xl font-bold">Zahlungsarten auf cssberlin.de</h2>
                  <p className="mb-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>So können Käufer aktuell bei dir bezahlen.</p>
                  <ul className="space-y-2">
                    {methods.map((m) => (
                      <li key={m.id} className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                        <div>
                          <p className="text-sm font-bold">{m.label}</p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.description}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.enabled ? 'bg-green-100 text-green-700' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}>{m.enabled ? 'Aktiv' : 'In Vorbereitung'}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Auszahlungen für Online-Verkäufe werden mit dem Start der Online-Zahlung freigeschaltet. Bei Abholung erhältst du das Geld direkt bei der Übergabe. <Link href="/hilfe/bezahlen" className="underline">Mehr erfahren</Link>
                  </p>
                </div>

                <div className="rounded-3xl p-6 md:p-8" style={card}>
                  <h2 className="mb-2 text-xl font-bold">Preisvorschläge</h2>
                  <p className="mb-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Lege fest, ab welchem Anteil deines Preises Angebote bei dir ankommen. Niedrigere Vorschläge werden gar nicht erst gesendet - der Käufer sieht stattdessen deine Untergrenze. Plattform-Minimum: {offerPolicy.minPercent} %.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={minPercent === '' ? '' : String(minPercent)}
                      onChange={(e) => setMinPercent(e.target.value === '' ? '' : Number(e.target.value))}
                      className="h-12 rounded-xl border px-4 text-sm"
                      style={inputStyle}
                      aria-label="Untergrenze für Angebote"
                    >
                      <option value="">Standard ({offerPolicy.minPercent} %)</option>
                      {[65, 70, 75, 80, 85, 90].map((v) => <option key={v} value={v}>mindestens {v} % des Preises</option>)}
                    </select>
                    <button
                      onClick={() => void putMe('offers', { offerMinPercent: minPercent === '' ? null : minPercent }, 'Angebotsregel gespeichert.')}
                      disabled={saving === 'offers'}
                      className="flex h-12 items-center gap-2 rounded-xl px-6 font-bold text-white"
                      style={{ background: 'var(--color-orange)' }}
                    >
                      {saving === 'offers' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Speichern
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'bundle' ? (
              <div className="rounded-3xl p-6 md:p-8" style={card}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Paket-Rabatte</h2>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <span className="sr-only">Paket-Rabatte aktivieren</span>
                    <input type="checkbox" className="peer sr-only" checked={bundle.isActive} onChange={(e) => setBundle({ ...bundle, isActive: e.target.checked })} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-[var(--color-bg-card)] after:transition-all peer-checked:bg-[var(--color-primary)] peer-checked:after:translate-x-full" />
                  </label>
                </div>
                <p className="mb-8 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Käufer, die mehrere Artikel von dir in den Warenkorb legen, sehen den Rabatt und können ein Paket anfragen.
                </p>
                {[
                  { key: 'twoItems', label: 'ab 2 Artikeln' },
                  { key: 'threeItems', label: 'ab 3 Artikeln' },
                  { key: 'fiveItems', label: 'ab 5 Artikeln' },
                ].map((entry) => (
                  <div key={entry.key} className="mb-4 flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                    <h4 className="text-sm font-bold">{entry.label}</h4>
                    <select
                      value={String(bundle[entry.key as keyof BundleDiscount] ?? 0)}
                      onChange={(e) => setBundle({ ...bundle, [entry.key]: Number(e.target.value) })}
                      className="cursor-pointer bg-transparent p-1 text-sm font-semibold outline-none"
                      aria-label={`Rabatt ${entry.label}`}
                    >
                      {[0, 5, 10, 15, 20, 25, 30].map((o) => <option key={o} value={o}>{o} %</option>)}
                    </select>
                  </div>
                ))}
                <button onClick={saveBundle} disabled={saving === 'bundle'} className="mt-6 h-12 w-full rounded-xl font-bold text-white" style={{ background: 'var(--color-orange)' }}>
                  {saving === 'bundle' ? 'Speichert…' : 'Rabatte speichern'}
                </button>
              </div>
            ) : null}

            {activeTab === 'notifications' ? (
              <div className="rounded-3xl p-6 md:p-8" style={card}>
                <h2 className="mb-2 text-xl font-bold">Benachrichtigungen</h2>
                <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Wähle, worüber wir dich in der App und per E-Mail informieren.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                        <th className="pb-3 font-semibold">Thema</th>
                        <th className="pb-3 text-center font-semibold">In der App</th>
                        <th className="pb-3 text-center font-semibold">E-Mail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NOTIFICATION_CATEGORIES.map((c) => (
                        <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="py-3 pr-4">
                            <p className="font-semibold">{c.label}{c.locked ? <span className="ml-2 rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">immer aktiv</span> : null}</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.description}</p>
                          </td>
                          {(['inApp', 'email'] as NotificationChannel[]).map((ch) => (
                            <td key={ch} className="py-3 text-center">
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-[var(--color-primary)]"
                                checked={wantsNotification(prefs, c.id, ch)}
                                disabled={c.locked}
                                onChange={() => togglePref(c.id, ch)}
                                aria-label={`${c.label} - ${ch === 'inApp' ? 'In der App' : 'E-Mail'}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>Nachrichten zu Käufen, Verkäufen und Fristen gehören zum Vertrag und lassen sich nicht abschalten.</p>
                <button onClick={() => void putMe('prefs', { notificationPrefs: prefs }, 'Benachrichtigungen gespeichert.')} disabled={saving === 'prefs'} className="mt-6 flex h-12 items-center gap-2 rounded-xl px-8 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
                  {saving === 'prefs' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Speichern
                </button>
                <SavedSearches />
              </div>
            ) : null}

            <button onClick={() => signOut({ callbackUrl: '/' })} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 md:hidden">
              <LogOut size={18} /> Abmelden
            </button>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={32} className="animate-spin" /></div>}>
      <SettingsInner />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function StatusRow({ title, description, done, doneText, openText }: { title: string; description: string; done: boolean; doneText: string; openText: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="min-w-0">
        <h4 className="font-bold">{title}</h4>
        <p className="mt-1 break-words text-xs" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
      </div>
      <span className={`shrink-0 rounded px-2 py-1 text-xs font-bold ${done ? 'bg-green-100 text-green-700' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}>{done ? doneText : openText}</span>
    </div>
  );
}
