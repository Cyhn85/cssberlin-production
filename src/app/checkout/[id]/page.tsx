'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Info,
  Leaf,
  Loader2,
  Lock,
  ShieldCheck,
  Tag,
  Truck,
} from 'lucide-react';
import { formatPrice, getConditionLabel } from '@/lib/utils/condition-map';

const BUYER_PROTECTION_RATE = 0.05;
const BUYER_PROTECTION_FIXED = 0.99;

const shippingMethods = [
  { id: 'DHL', name: 'DHL Paket', eta: '1-3 Werktage' },
  { id: 'HERMES', name: 'Hermes Paeckchen', eta: '2-4 Werktage' },
  { id: 'DPD', name: 'DPD Classic', eta: '1-2 Werktage' },
];

type CheckoutProduct = {
  id: string;
  title: string;
  price: number;
  shippingCost: number;
  brand: string | null;
  size: string | null;
  condition: string;
  status: string;
  images: Array<{ id: string; url: string; orderIndex: number }>;
  seller: {
    id: string;
    name: string | null;
    location: string | null;
  };
};

type CheckoutOffer = {
  id: string;
  offeredPrice: number;
  status: string;
  pendingOn: 'BUYER' | 'SELLER' | null;
  latestOrder: { id: string; status: string } | null;
  product: { id: string; title: string; status: string };
};

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams.get('offerId');
  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [offer, setOffer] = useState<CheckoutOffer | null>(null);
  const [offerNotice, setOfferNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedShipping, setSelectedShipping] = useState(shippingMethods[0].id);
  const [isFirstOrder, setIsFirstOrder] = useState(false);

  useEffect(() => {
    const productId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!productId) {
      setLoading(false);
      setError('Produkt-ID fehlt.');
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setOffer(null);
      setOfferNotice(null);

      try {
        const productRequest = fetch(`/api/products/${productId}`);
        const offerRequest: Promise<Response | null> = offerId
          ? fetch(`/api/offers/${offerId}`)
          : Promise.resolve(null);
        const firstOrderRequest = fetch('/api/checkout/first-order-status');

        const [productResponse, offerResponse, firstOrderResponse] = await Promise.all([productRequest, offerRequest, firstOrderRequest]);
        const productResult = await productResponse.json();

        if (!cancelled) {
          const firstOrderResult = await firstOrderResponse.json().catch(() => null);
          setIsFirstOrder(Boolean(firstOrderResult?.success && firstOrderResult.data?.isFirstOrder));
        }

        if (!productResponse.ok || !productResult.success) {
          throw new Error(productResult.error || 'Checkout konnte nicht geladen werden.');
        }

        if (cancelled) return;
        setProduct(productResult.data);

        if (offerResponse) {
          const offerResult = await offerResponse.json().catch(() => null);
          if (offerResponse.ok && offerResult?.success && offerResult.data?.product?.id === productId) {
            const offerData = offerResult.data as CheckoutOffer;

            if (offerData.latestOrder) {
              setOfferNotice('Zu diesem Angebot existiert bereits eine Bestellung. Bitte pruefe zuerst deine Kaeufe.');
            } else if (offerData.status === 'ACCEPTED') {
              setOffer(offerData);
            } else if (offerData.pendingOn === 'BUYER') {
              setOfferNotice('Dieses Gegenangebot muss zuerst in deiner Angebotsliste bestaetigt werden.');
            } else {
              setOfferNotice('Das uebergebene Angebot ist aktuell nicht checkout-bereit. Es wird der Listenpreis verwendet.');
            }
          } else if (!cancelled) {
            setOfferNotice(offerResult?.error || 'Das uebergebene Angebot konnte nicht geladen werden.');
          }
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError.message || 'Checkout konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [params.id, offerId]);

  const itemPrice = useMemo(() => {
    if (offer) return offer.offeredPrice;
    return product?.price || 0;
  }, [offer, product]);

  const standardShippingFee = useMemo(() => {
    if (!product) return 0;
    return product.shippingCost > 0 ? product.shippingCost : 4.99;
  }, [product]);

  const shippingFee = isFirstOrder ? 0 : standardShippingFee;

  const protectionFee = useMemo(() => {
    if (!product) return 0;
    return Math.round((itemPrice * BUYER_PROTECTION_RATE + BUYER_PROTECTION_FIXED) * 100) / 100;
  }, [itemPrice, product]);

  const totalCost = useMemo(() => {
    if (!product) return 0;
    return Math.round((itemPrice + shippingFee + protectionFee) * 100) / 100;
  }, [itemPrice, product, protectionFee, shippingFee]);

  const handleCheckout = async () => {
    if (!product || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          offerId: offer?.id,
          shippingMethod: selectedShipping,
        }),
      });

      const result = await response.json().catch(() => null);

      if (response.status === 401) {
        const callbackUrl = offer?.id
          ? `/checkout/${product.id}?offerId=${encodeURIComponent(offer.id)}`
          : `/checkout/${product.id}`;
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Checkout konnte nicht gestartet werden.');
      }

      const checkoutData = result.data || {};

      if (checkoutData.url) {
        window.location.assign(checkoutData.url);
        return;
      }

      if (checkoutData.mode === 'dev') {
        const successUrl = `/checkout/${product.id}/success?mode=dev&orderId=${encodeURIComponent(checkoutData.orderId || '')}`;
        router.push(successUrl);
        return;
      }

      throw new Error('Checkout-Antwort war unvollstaendig.');
    } catch (checkoutError: any) {
      setError(checkoutError.message || 'Checkout konnte nicht gestartet werden.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center" style={{ color: 'var(--color-primary)' }}>
          <Loader2 size={42} className="mx-auto mb-4 animate-spin" />
          <p className="text-sm font-semibold">Checkout wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!product || error) {
    return (
      <div className="container py-16">
        <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <Info size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <h1 className="mb-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Checkout nicht verfuegbar
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {error || 'Dieser Artikel kann gerade nicht gekauft werden.'}
          </p>
          <Link href="/catalog" className="rounded-full px-6 py-3 font-bold text-white btn-mars-earth" style={{ background: 'var(--color-orange)' }}>
            Zurueck zum Katalog
          </Link>
        </div>
      </div>
    );
  }

  const isUnavailable = product.status !== 'ACTIVE';
  const heroImage = product.images[0]?.url || '';
  const sellerName = product.seller.name || 'cssberlin seller';

  return (
    <div className="min-h-screen pb-20 pt-24" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
              Sicherer Checkout
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Adresse und Zahlungsart werden im geschuetzten Bezahlfenster erfasst.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-green-700" style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
            <Lock size={16} /> Verschluesselte Zahlung
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {offer ? (
          <div className="mb-6 rounded-2xl border px-4 py-3 text-sm text-emerald-800" style={{ borderColor: 'rgba(16, 185, 129, 0.28)', background: 'rgba(16, 185, 129, 0.10)' }}>
            <div className="flex items-start gap-3">
              <Tag size={18} style={{ marginTop: 2 }} />
              <div>
                <p className="font-semibold">Du kaufst mit einem akzeptierten Angebot.</p>
                <p className="mt-1">Fuer diesen Checkout wird dein verhandelter Preis von {formatPrice(offer.offeredPrice)} verwendet.</p>
              </div>
            </div>
          </div>
        ) : null}

        {offerNotice ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {offerNotice}
          </div>
        ) : null}

        {isUnavailable ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Dieser Artikel ist aktuell nicht mehr aktiv. Bitte pruefe zuerst die Produktseite.
          </div>
        ) : null}

        <div className="mb-6 rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-primary-50)' }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-primary-dark)' }}>
                Kaeuferschutz ist automatisch enthalten
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-primary)' }}>
                Deine Zahlung bleibt geschuetzt, bis der Artikel angekommen ist. Der Schutzbetrag wird im Gesamtpreis transparent ausgewiesen.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-4 flex items-center gap-3">
                <Truck size={20} />
                <h2 className="text-lg font-bold">Versandart</h2>
              </div>
              {isFirstOrder ? (
                <div className="mb-4 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-emerald-800" style={{ background: 'rgba(16, 185, 129, 0.10)' }}>
                  <Leaf size={16} /> Deine erste Bestellung ist versandkostenfrei.
                </div>
              ) : null}
              <div className="space-y-3">
                {shippingMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-colors ${selectedShipping === method.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping"
                        checked={selectedShipping === method.id}
                        onChange={() => setSelectedShipping(method.id)}
                        className="h-4 w-4"
                      />
                      <div>
                        <p className="font-bold text-sm">{method.name}</p>
                        <p className="text-xs text-gray-500">{method.eta}</p>
                      </div>
                    </div>
                    {isFirstOrder ? (
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <span className="text-xs font-normal line-through text-gray-400">{formatPrice(standardShippingFee)}</span>
                        <span className="text-emerald-700">Kostenlos</span>
                      </span>
                    ) : (
                      <span className="text-sm font-bold">{formatPrice(shippingFee)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-3 flex items-center gap-3">
                <Info size={20} />
                <h2 className="text-lg font-bold">Vor dem Bezahlen</h2>
              </div>
              <ul className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <li>Deine Lieferadresse und finale Zahlungsart werden im sicheren Checkout erfasst.</li>
                <li>Du wirst direkt zur sicheren Zahlungsabwicklung weitergeleitet.</li>
                {offer ? <li>Dein akzeptierter Verhandlungspreis wird statt des Listenpreises verwendet.</li> : null}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-lg font-bold">Bestelluebersicht</h2>

              <div className="mb-6 flex items-center gap-4 border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
                  {heroImage ? (
                    <img src={heroImage} alt={product.title} className="h-full w-full object-cover" />
                  ) : (
                    <Leaf size={28} style={{ color: 'var(--color-primary)', opacity: 0.2 }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
                    {product.brand || 'cssberlin'}
                  </p>
                  <p className="line-clamp-2 font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                    {product.title}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {sellerName} - {getConditionLabel(product.condition)}
                  </p>
                  {offer ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {formatPrice(offer.offeredPrice)}
                      </span>
                      <span className="text-xs line-through" style={{ color: 'var(--color-text-muted)' }}>
                        {formatPrice(product.price)}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {formatPrice(product.price)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 border-b pb-6 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <div className="flex justify-between">
                  <span>Artikelpreis</span>
                  <div className="text-right">
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(itemPrice)}</span>
                    {offer ? (
                      <p className="text-xs line-through" style={{ color: 'var(--color-text-muted)' }}>{formatPrice(product.price)}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Versand{isFirstOrder ? ' (1. Bestellung)' : ''}</span>
                  {isFirstOrder ? (
                    <div className="text-right">
                      <span className="font-semibold text-emerald-700">Kostenlos</span>
                      <p className="text-xs line-through" style={{ color: 'var(--color-text-muted)' }}>{formatPrice(standardShippingFee)}</p>
                    </div>
                  ) : (
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(shippingFee)}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span>Kaeuferschutz</span>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{formatPrice(protectionFee)}</span>
                </div>
              </div>

              <div className="mb-6 mt-6 flex items-end justify-between">
                <span className="font-bold">Gesamtbetrag</span>
                <span className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                  {formatPrice(totalCost)}
                </span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={submitting || isUnavailable}
                className="btn-mars-earth w-full rounded-2xl py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--color-orange)' }}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Checkout startet...
                  </span>
                ) : offer ? (
                  'Mit Angebot sicher bezahlen'
                ) : (
                  'Sicher bezahlen'
                )}
              </button>

              <div className="mt-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Mit dem Klick startest du den geschuetzten Kaufprozess fuer diesen Artikel.
              </div>

              <Link href={`/product/${product.id}`} className="mt-4 block text-center text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                Zurueck zur Produktseite
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}