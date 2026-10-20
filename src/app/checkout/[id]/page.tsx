'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft, CreditCard, Handshake, Info, Leaf, Loader2, Lock, MapPin, ShieldCheck, Truck } from 'lucide-react';
import { formatPrice, getConditionLabel } from '@/lib/utils/condition-map';
import { SHIPPING_CARRIERS, FREE_SHIPPING_THRESHOLD_EUR, amountToFreeShipping } from '@/config/shipping-policy';
import { quoteCheckout } from '@/lib/payments/pricing';
import { priceDisclosure } from '@/config/business-profile';
import { pickupPolicy, checkoutPolicy, cancellationPolicy } from '@/config/marketplace-policy';

type PaymentMethod = {
  id: 'card' | 'klarna' | 'sepa_debit' | 'paypal' | 'pickup_cash';
  label: string;
  description: string;
  requiresShipping: boolean;
  buyerProtection: boolean;
  enabled: boolean;
};

type CheckoutProduct = {
  id: string;
  title: string;
  price: number;
  shippingCost: number;
  brand: string | null;
  size: string | null;
  condition: string;
  status: string;
  images: Array<{ id: string; url: string; thumbUrl?: string | null; orderIndex: number }>;
  seller: { id: string; name: string | null; publicLocation?: { label: string | null } | null };
};

type CheckoutOffer = {
  id: string;
  offeredPrice: number;
  status: string;
  pendingOn: 'BUYER' | 'SELLER' | null;
  expiresAt?: string | null;
  latestOrder: { id: string; status: string } | null;
  product: { id: string };
};

type Address = { name: string; street: string; extra: string; postalCode: string; city: string };

const ADDRESS_KEY = 'cssberlin_last_address';

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams.get('offerId');
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      const back = `/checkout/${productId}${offerId ? `?offerId=${encodeURIComponent(offerId)}` : ''}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(back)}`);
    },
  });

  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [offer, setOffer] = useState<CheckoutOffer | null>(null);
  const [offerNotice, setOfferNotice] = useState<string | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<'ship' | 'pickup'>('ship');
  const [carrier, setCarrier] = useState<string>(SHIPPING_CARRIERS[0].id);
  const [method, setMethod] = useState<PaymentMethod['id']>('card');
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [address, setAddress] = useState<Address>({ name: '', street: '', extra: '', postalCode: '', city: '' });
  const [agb, setAgb] = useState(false);
  const [widerruf, setWiderruf] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADDRESS_KEY);
      if (saved) setAddress((a) => ({ ...a, ...JSON.parse(saved) }));
    } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    if (status === 'loading' || !productId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [pRes, mRes, fRes, oRes] = await Promise.all([
          fetch(`/api/products/${productId}`),
          fetch('/api/checkout/methods'),
          fetch('/api/checkout/first-order-status'),
          offerId ? fetch(`/api/offers/${offerId}`) : Promise.resolve(null),
        ]);
        const p = await pRes.json();
        if (!pRes.ok || !p.success) throw new Error(p.error || 'Checkout konnte nicht geladen werden.');
        const m = await mRes.json().catch(() => null);
        const f = await fRes.json().catch(() => null);
        if (cancelled) return;

        setProduct(p.data);
        const list: PaymentMethod[] = m?.data?.methods || [];
        setMethods(list);
        setIsFirstOrder(Boolean(f?.success && f.data?.isFirstOrder));

        // no online method live yet -> start on pickup so the page is usable immediately
        if (!list.some((x) => x.requiresShipping && x.enabled)) {
          setDelivery('pickup');
          setMethod('pickup_cash');
        } else {
          const firstOnline = list.find((x) => x.requiresShipping && x.enabled);
          if (firstOnline) setMethod(firstOnline.id);
        }

        if (oRes) {
          const o = await oRes.json().catch(() => null);
          if (oRes.ok && o?.success && o.data?.product?.id === productId) {
            const data = o.data as CheckoutOffer;
            if (data.latestOrder) setOfferNotice('Zu diesem Angebot existiert bereits eine Bestellung. Bitte prüfe deine Käufe.');
            else if (data.status === 'ACCEPTED') setOffer(data);
            else if (data.pendingOn === 'BUYER') setOfferNotice('Dieses Gegenangebot musst du zuerst unter „Angebote“ annehmen.');
            else setOfferNotice('Das Angebot ist nicht (mehr) angenommen. Es gilt der Listenpreis.');
          } else {
            setOfferNotice(o?.error || 'Das Angebot konnte nicht geladen werden. Es gilt der Listenpreis.');
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Checkout konnte nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, offerId, status]);

  const itemPrice = offer ? offer.offeredPrice : product?.price || 0;
  const quote = useMemo(
    () => quoteCheckout({ itemPrice, productShippingCost: product?.shippingCost, isFirstOrder, carrier: delivery === 'pickup' ? 'PICKUP' : carrier }),
    [itemPrice, product, isFirstOrder, carrier, delivery],
  );
  const missingForFree = delivery === 'ship' ? amountToFreeShipping(itemPrice) : 0;

  const onlineMethods = methods.filter((m) => m.requiresShipping);
  const pickupMethod = methods.find((m) => m.id === 'pickup_cash');
  const selected = methods.find((m) => m.id === method);
  const addressValid = /^\d{5}$/.test(address.postalCode.trim()) && address.name.trim().length >= 3 && address.street.trim().length >= 3 && address.city.trim().length >= 2;
  const canSubmit = Boolean(product && product.status === 'ACTIVE' && selected?.enabled && agb && widerruf && (delivery === 'pickup' || addressValid));

  const chooseDelivery = (d: 'ship' | 'pickup') => {
    setDelivery(d);
    if (d === 'pickup') setMethod('pickup_cash');
    else {
      const first = onlineMethods.find((m) => m.enabled) || onlineMethods[0];
      if (first) setMethod(first.id);
    }
  };

  const submit = async () => {
    if (!product || !canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (delivery === 'ship') {
        try { localStorage.setItem(ADDRESS_KEY, JSON.stringify(address)); } catch { /* ignore */ }
      }
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          offerId: offer?.id,
          carrier: delivery === 'pickup' ? 'PICKUP' : carrier,
          paymentMethod: method,
          shippingAddress: delivery === 'ship'
            ? { name: address.name, street: address.street, extra: address.extra || undefined, postalCode: address.postalCode, city: address.city, country: 'DE' }
            : undefined,
        }),
      });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r?.success) throw new Error(r?.error || 'Checkout konnte nicht gestartet werden.');
      if (r.data?.mode === 'stripe' && r.data.url) {
        window.location.assign(r.data.url);
        return;
      }
      if (r.data?.mode === 'pickup') {
        router.push(`/checkout/${product.id}/success?mode=pickup&orderId=${encodeURIComponent(r.data.orderId)}`);
        return;
      }
      throw new Error('Checkout-Antwort war unvollständig.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" style={{ color: 'var(--color-primary)' }}>
        <Loader2 size={42} className="animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-16">
        <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <Info size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <h1 className="mb-2 text-2xl font-bold">Checkout nicht verfügbar</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error || 'Dieser Artikel kann gerade nicht gekauft werden.'}</p>
          <Link href="/catalog" className="rounded-full px-6 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>Zurück zum Katalog</Link>
        </div>
      </div>
    );
  }

  const unavailable = product.status !== 'ACTIVE';
  const hero = product.images[0]?.thumbUrl || product.images[0]?.url || '';
  const card = 'rounded-3xl border bg-[var(--color-bg-card)] p-6 shadow-sm';
  const optionCls = (active: boolean, disabled = false) =>
    `flex w-full items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-colors ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'} ${active ? 'border-[var(--color-primary)] bg-[rgba(45,106,79,.14)]' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'}`;
  const input = 'w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]';

  return (
    <div className="min-h-screen pb-20 pt-24" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <button onClick={() => router.back()} aria-label="Zurück" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)]">
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Kasse</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Versand oder Abholung wählen, Zahlungsart festlegen, fertig.</p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-green-700" style={{ background: 'rgba(34,197,94,.12)' }}>
            <Lock size={16} /> Sichere Verbindung
          </div>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div> : null}
        {offer ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-emerald-800" style={{ borderColor: 'rgba(16,185,129,.28)', background: 'rgba(16,185,129,.10)' }}>
            <Handshake size={18} className="mt-0.5" />
            <div>
              <p className="font-semibold">Du kaufst zum vereinbarten Preis von {formatPrice(offer.offeredPrice)}.</p>
              {offer.expiresAt ? <p className="mt-1">Reserviert für dich bis {new Date(offer.expiresAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.</p> : null}
            </div>
          </div>
        ) : null}
        {offerNotice ? <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{offerNotice}</div> : null}
        {unavailable ? <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Dieser Artikel ist gerade reserviert oder verkauft.</div> : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            {/* 1. Lieferung */}
            <section className={card} style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 flex items-center gap-3 text-lg font-bold"><Truck size={20} /> 1. Lieferung</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" className={optionCls(delivery === 'ship')} onClick={() => chooseDelivery('ship')}>
                  <div>
                    <p className="text-sm font-bold">Versand</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Mit Käuferschutz, Sendungsverfolgung</p>
                  </div>
                  <Truck size={18} />
                </button>
                <button type="button" className={optionCls(delivery === 'pickup')} onClick={() => chooseDelivery('pickup')}>
                  <div>
                    <p className="text-sm font-bold">Selbstabholung</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{product.seller.publicLocation?.label || 'Ort nach Absprache'} · bar bei Übergabe</p>
                  </div>
                  <Handshake size={18} />
                </button>
              </div>

              {delivery === 'ship' ? (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-semibold">Versanddienst</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SHIPPING_CARRIERS.map((c) => (
                      <button key={c.id} type="button" className={optionCls(carrier === c.id)} onClick={() => setCarrier(c.id)}>
                        <div>
                          <p className="text-sm font-bold">{c.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{c.eta}</p>
                        </div>
                        <span className="text-sm font-bold">{quote.shipping.free ? <span className="text-emerald-700">Kostenlos</span> : formatPrice(quote.shippingFee)}</span>
                      </button>
                    ))}
                  </div>
                  {quote.shipping.free ? (
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Leaf size={14} /> {quote.shipping.reason === 'first_order' ? 'Deine erste Bestellung ist versandkostenfrei.' : `Versandkostenfrei ab ${FREE_SHIPPING_THRESHOLD_EUR} €.`}</p>
                  ) : missingForFree > 0 ? (
                    <p className="text-xs text-emerald-700">Noch {formatPrice(missingForFree)} bis zum Gratisversand.</p>
                  ) : null}

                  <p className="pt-2 text-sm font-semibold">Lieferadresse</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className={`${input} sm:col-span-2`} placeholder="Vor- und Nachname" autoComplete="name" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} />
                    <input className={`${input} sm:col-span-2`} placeholder="Straße und Hausnummer" autoComplete="street-address" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
                    <input className={`${input} sm:col-span-2`} placeholder="Adresszusatz (optional)" value={address.extra} onChange={(e) => setAddress({ ...address, extra: e.target.value })} />
                    <input className={input} placeholder="PLZ" inputMode="numeric" maxLength={5} autoComplete="postal-code" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value.replace(/\D/g, '') })} />
                    <input className={input} placeholder="Ort" autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">Versand innerhalb Deutschlands. Die Adresse sieht nur der Verkäufer dieser Bestellung.</p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl p-4 text-sm" style={{ background: 'var(--color-bg-secondary)' }}>
                  <p className="flex items-center gap-2 font-semibold"><MapPin size={16} /> So läuft die Abholung</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: 'var(--color-text-secondary)' }}>
                    <li>Der Artikel ist {pickupPolicy.holdHours} Stunden für dich reserviert.</li>
                    <li>Ort und Zeit vereinbart ihr im Chat; die genaue Adresse teilt der Verkäufer dort mit.</li>
                    <li>Prüfe den Artikel vor Ort und zahle bar. Bei Abholung gilt kein Käuferschutz.</li>
                    <li>Du kannst bis zur Übergabe kostenlos stornieren.</li>
                  </ul>
                  <Link href="/hilfe/abholung" className="mt-2 inline-block text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Mehr zur Abholung</Link>
                </div>
              )}
            </section>

            {/* 2. Zahlung */}
            <section className={card} style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 flex items-center gap-3 text-lg font-bold"><CreditCard size={20} /> 2. Zahlungsart</h2>
              <div className="space-y-2" role="radiogroup" aria-label="Zahlungsart">
                {(delivery === 'pickup' ? (pickupMethod ? [pickupMethod] : []) : onlineMethods).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={method === m.id}
                    disabled={!m.enabled}
                    className={optionCls(method === m.id, !m.enabled)}
                    onClick={() => m.enabled && setMethod(m.id)}
                  >
                    <div>
                      <p className="text-sm font-bold">{m.label}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{m.description}</p>
                    </div>
                    {!m.enabled ? <span className="whitespace-nowrap rounded-full bg-[var(--color-bg-secondary)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">derzeit nicht verfügbar</span> : null}
                  </button>
                ))}
              </div>
              {delivery === 'ship' && !onlineMethods.some((m) => m.enabled) ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Die Online-Zahlung wird gerade eingerichtet. Du kannst diesen Artikel schon jetzt per <button type="button" className="font-bold underline" onClick={() => chooseDelivery('pickup')}>Abholung & Barzahlung</button> kaufen.
                </div>
              ) : null}
            </section>
          </div>

          {/* Übersicht */}
          <aside className="lg:col-span-5">
            <div className={`${card} sticky top-24`} style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-lg font-bold">Bestellübersicht</h2>
              <div className="mb-6 flex items-center gap-4 border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
                  {hero ? <img src={hero} alt={product.title} className="h-full w-full object-cover" /> : <Leaf size={28} style={{ opacity: 0.2 }} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>{product.brand || 'cssberlin'}</p>
                  <p className="line-clamp-2 text-sm font-bold">{product.title}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{product.seller.name || 'Verkäufer'} · {getConditionLabel(product.condition)}{product.size ? ` · Gr. ${product.size}` : ''}</p>
                </div>
              </div>

              <dl className="space-y-3 border-b pb-6 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <div className="flex justify-between"><dt>Artikelpreis</dt><dd className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(quote.itemPrice)}{offer ? <span className="ml-2 text-xs line-through" style={{ color: 'var(--color-text-muted)' }}>{formatPrice(product.price)}</span> : null}</dd></div>
                <div className="flex justify-between"><dt>{delivery === 'pickup' ? 'Abholung' : 'Versand'}</dt><dd className="font-semibold">{quote.shippingFee === 0 ? <span className="text-emerald-700">Kostenlos</span> : formatPrice(quote.shippingFee)}</dd></div>
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1"><ShieldCheck size={14} /> Käuferschutz</dt>
                  <dd className="font-semibold">{quote.pickup ? <span className="text-xs">entfällt bei Abholung</span> : formatPrice(quote.protectionFee)}</dd>
                </div>
              </dl>

              <div className="mb-1 mt-6 flex items-end justify-between">
                <span className="font-bold">{quote.pickup ? 'Bei Übergabe zu zahlen' : 'Gesamtbetrag'}</span>
                <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(quote.totalAmount)}</span>
              </div>
              <p className="mb-6 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {priceDisclosure.isKleinunternehmer ? priceDisclosure.kleinunternehmerNotice : 'inkl. gesetzlicher MwSt.'}
              </p>

              <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                <input type="checkbox" checked={agb} onChange={(e) => setAgb(e.target.checked)} className="mt-1 h-4 w-4" />
                <span className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Ich habe die <Link href="/agb" target="_blank" className="font-bold" style={{ color: 'var(--color-primary)' }}>AGB</Link> gelesen und erkläre mich mit diesen einverstanden. Die <Link href="/datenschutz" target="_blank" className="font-bold" style={{ color: 'var(--color-primary)' }}>Datenschutzerklärung</Link> habe ich zur Kenntnis genommen.
                </span>
              </label>
              {/* Rechtstext unverändert übernommen - Formulierung entscheidet der Betreiber */}
              <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                <input type="checkbox" checked={widerruf} onChange={(e) => setWiderruf(e.target.checked)} className="mt-1 h-4 w-4" />
                <span className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  Ich stimme ausdrücklich zu, dass cssberlin vor Ablauf der Widerrufsfrist mit der Ausführung des Vertrags beginnt. Mir ist bekannt, dass ich dadurch mein <Link href="/widerruf" target="_blank" className="font-bold" style={{ color: 'var(--color-primary)' }}>Widerrufsrecht</Link> verliere. (Gemäß § 356 Abs. 4 BGB)
                </span>
              </label>
              <p className="mb-4 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Hinweis zum Privatverkauf:</strong> Sofern der Verkäufer nicht explizit als gewerblich gekennzeichnet ist, kaufst du von einer Privatperson (C2C). Die EU-Verbraucherrechte (Widerrufsrecht, Gewährleistung) gelten in diesem Fall nicht für den Kaufvertrag zwischen dir und dem Verkäufer. Dein Käuferschutz durch cssberlin bleibt davon unberührt.{' '}
                  <Link href="/hilfe/stornierung" className="underline">Stornierung</Link> · <Link href="/hilfe/kaeuferschutz" className="underline">Käuferschutz</Link>
                </span>
              </p>

              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="w-full rounded-2xl py-4 text-lg font-bold text-white transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--color-orange)' }}
              >
                {submitting ? <span className="inline-flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Wird gestartet…</span>
                  : quote.pickup ? 'Abholung verbindlich anfragen' : 'Kaufen und bezahlen'}
              </button>
              {!canSubmit && !submitting ? (
                <p className="mt-2 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {unavailable ? 'Artikel nicht verfügbar.' : !selected?.enabled ? 'Diese Zahlungsart ist noch nicht verfügbar.' : delivery === 'ship' && !addressValid ? 'Bitte Lieferadresse vollständig ausfüllen.' : !agb || !widerruf ? 'Bitte beide Bestätigungen anhaken.' : ''}
                </p>
              ) : null}
              {!quote.pickup ? <p className="mt-3 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>Der Artikel ist während der Zahlung {checkoutPolicy.reservationMinutes} Minuten für dich reserviert.</p> : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
