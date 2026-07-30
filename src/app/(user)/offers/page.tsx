'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  PackageSearch,
  RefreshCcw,
  SendHorizontal,
  Tag,
  XCircle,
} from 'lucide-react';
import {
  formatPrice,
  formatRelativeTime,
  offerStatusToLabel,
  orderStatusToLabel,
  productStatusToLabel,
} from '@/lib/utils/condition-map';

type OfferParty = {
  id: string;
  name: string | null;
  avatar: string | null;
};

type OfferProduct = {
  id: string;
  title: string;
  price: number;
  status: string;
  shippingCost: number;
  images: Array<{ id: string; url: string; orderIndex: number }>;
};

type OfferOrder = {
  id: string;
  status: string;
  createdAt: string;
};

type OfferItem = {
  id: string;
  offeredPrice: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  originRole: 'BUYER_OFFER' | 'SELLER_COUNTER';
  pendingOn: 'BUYER' | 'SELLER' | null;
  hasCompletedCheckout: boolean;
  latestOrder: OfferOrder | null;
  product: OfferProduct;
  buyer: OfferParty;
  seller: OfferParty;
};

type OffersPayload = {
  sent: OfferItem[];
  received: OfferItem[];
};

type FeedbackState = {
  offerId: string | null;
  type: 'success' | 'error';
  message: string;
} | null;

function getAvailabilityMeta(status: string) {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Aktiv',
        tone: 'bg-emerald-100 text-emerald-700',
        message: 'Der Artikel ist weiterhin aktiv und kann noch verhandelt oder gekauft werden.',
      };
    case 'RESERVED':
      return {
        label: 'Reserviert',
        tone: 'bg-amber-100 text-amber-800',
        message: 'Der Artikel ist aktuell reserviert. Neue Abschluesse sind vorerst blockiert.',
      };
    case 'SOLD':
      return {
        label: 'Verkauft',
        tone: 'bg-rose-100 text-rose-700',
        message: 'Der Artikel wurde bereits verkauft.',
      };
    case 'HIDDEN':
      return {
        label: 'Offline',
        tone: 'bg-slate-200 text-slate-700',
        message: 'Das Listing ist nicht mehr oeffentlich verfuegbar.',
      };
    default:
      return {
        label: productStatusToLabel[status] || status,
        tone: 'bg-slate-200 text-slate-700',
        message: 'Das Listing steht derzeit nicht fuer den normalen Kaufprozess bereit.',
      };
  }
}

function isSellerActionable(offer: OfferItem) {
  return offer.pendingOn === 'SELLER' && offer.originRole === 'BUYER_OFFER' && offer.product.status === 'ACTIVE' && !offer.latestOrder;
}

function isBuyerCounterActionable(offer: OfferItem) {
  return offer.pendingOn === 'BUYER' && offer.originRole === 'SELLER_COUNTER' && offer.product.status === 'ACTIVE' && !offer.latestOrder;
}

function getSentOfferMessage(offer: OfferItem) {
  const availability = getAvailabilityMeta(offer.product.status);

  if (offer.latestOrder) {
    return `Aus diesem Verhandlungspfad wurde bereits eine Bestellung mit Status ${orderStatusToLabel[offer.latestOrder.status] || offer.latestOrder.status} erzeugt.`;
  }
  if (offer.status === 'ACCEPTED' && offer.product.status === 'ACTIVE') {
    return 'Dein Preis wurde akzeptiert. Du kannst jetzt mit diesem Angebot in den Checkout gehen.';
  }
  if (isBuyerCounterActionable(offer)) {
    return 'Der Verkaeufer hat ein Gegenangebot geschickt. Du kannst es annehmen, ablehnen oder erneut verhandeln.';
  }
  if (offer.pendingOn === 'SELLER' && offer.product.status === 'ACTIVE') {
    return 'Dein Angebot ist offen. Du wartest gerade auf die Rueckmeldung des Verkaeufers.';
  }
  if (offer.product.status !== 'ACTIVE' && offer.status === 'PENDING') {
    return availability.message;
  }
  if (offer.status === 'REJECTED') {
    return 'Dieses Angebot wurde beendet. Du kannst bei einem aktiven Listing ein neues Angebot senden.';
  }
  if (offer.status === 'COUNTERED') {
    return 'Dieser Angebotsstand wurde von einer neueren Verhandlungsrunde abgeloest.';
  }
  return availability.message;
}

function getReceivedOfferMessage(offer: OfferItem) {
  const availability = getAvailabilityMeta(offer.product.status);

  if (offer.latestOrder) {
    return `Aus diesem Angebotsverlauf existiert bereits eine Bestellung mit Status ${orderStatusToLabel[offer.latestOrder.status] || offer.latestOrder.status}.`;
  }
  if (isSellerActionable(offer)) {
    return 'Dieses Angebot wartet auf deine Entscheidung. Du kannst annehmen, ablehnen oder ein Gegenangebot senden.';
  }
  if (offer.pendingOn === 'BUYER' && offer.originRole === 'SELLER_COUNTER') {
    return 'Dein Gegenangebot ist offen. Jetzt wartest du auf die Rueckmeldung des Kaeufers.';
  }
  if (offer.product.status !== 'ACTIVE' && offer.status === 'PENDING') {
    return availability.message;
  }
  if (offer.status === 'ACCEPTED') {
    return 'Das Angebot wurde angenommen. Der Kaeufer kann nun in den Checkout gehen.';
  }
  if (offer.status === 'REJECTED') {
    return 'Diese Verhandlungsrunde wurde abgelehnt.';
  }
  return availability.message;
}

function getOfferTone(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return 'bg-emerald-100 text-emerald-700';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-700';
    case 'COUNTERED':
      return 'bg-sky-100 text-sky-700';
    case 'PENDING':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-200 text-slate-700';
  }
}

export default function OffersPage() {
  const router = useRouter();
  const [data, setData] = useState<OffersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'sent' | 'received'>('sent');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [counterTargetId, setCounterTargetId] = useState<string | null>(null);
  const [counterValue, setCounterValue] = useState('');

  const loadOffers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/offers');
      if (response.status === 401) {
        router.replace('/login?callbackUrl=/offers');
        return;
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Angebote konnten nicht geladen werden.');
      }

      setData(result.data);
    } catch (loadError: any) {
      setError(loadError.message || 'Angebote konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOffers();
  }, []);

  const activeOffers = view === 'sent' ? data?.sent || [] : data?.received || [];

  const summary = useMemo(() => {
    const sent = data?.sent || [];
    const received = data?.received || [];

    return {
      waitingForSeller: sent.filter((offer) => offer.pendingOn === 'SELLER' && offer.product.status === 'ACTIVE').length,
      waitingForBuyer: sent.filter((offer) => offer.pendingOn === 'BUYER' && offer.product.status === 'ACTIVE').length,
      incomingForSeller: received.filter((offer) => isSellerActionable(offer)).length,
      unavailable: [...sent, ...received].filter((offer) => offer.product.status !== 'ACTIVE').length,
    };
  }, [data]);

  const resetCounterForm = () => {
    setCounterTargetId(null);
    setCounterValue('');
  };

  const openCounterForm = (offer: OfferItem) => {
    setFeedback(null);
    setCounterTargetId(offer.id);

    const midpoint = offer.originRole === 'SELLER_COUNTER'
      ? Math.max(offer.product.price * 0.6, offer.offeredPrice - Math.max(1, offer.product.price * 0.05))
      : Math.min(offer.product.price - 1, offer.offeredPrice + Math.max(1, offer.product.price * 0.05));

    setCounterValue(midpoint.toFixed(2));
  };

  const submitOfferAction = async (offer: OfferItem, action: 'accept' | 'reject' | 'counter') => {
    if (action === 'counter' && !counterValue.trim()) {
      setFeedback({ offerId: offer.id, type: 'error', message: 'Bitte gib zuerst einen Preis fuer das Gegenangebot ein.' });
      return;
    }

    setActioningId(offer.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          counterPrice: action === 'counter' ? Number(counterValue.replace(',', '.')) : undefined,
        }),
      });

      const result = await response.json().catch(() => null);
      if (response.status === 401) {
        router.replace('/login?callbackUrl=/offers');
        return;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Die Aktion konnte nicht abgeschlossen werden.');
      }

      setFeedback({
        offerId: offer.id,
        type: 'success',
        message:
          action === 'accept'
            ? 'Angebot erfolgreich bestaetigt.'
            : action === 'reject'
              ? 'Angebot erfolgreich beendet.'
              : 'Neues Gegenangebot erfolgreich gesendet.',
      });
      resetCounterForm();
      await loadOffers();
    } catch (actionError: any) {
      setFeedback({
        offerId: offer.id,
        type: 'error',
        message: actionError.message || 'Die Aktion konnte nicht abgeschlossen werden.',
      });
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Angebote und Verhandlungen
            </h1>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Hier siehst du alle laufenden, akzeptierten, beendeten und nicht mehr verfuegbaren Preisverhandlungen an einem Ort.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void loadOffers()}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <RefreshCcw size={16} /> Aktualisieren
            </button>
            <Link href="/inbox" className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              Zur Inbox
            </Link>
            <Link href="/catalog" className="rounded-full px-5 py-3 text-sm font-bold text-white" style={{ background: 'var(--color-orange)' }}>
              Weiter stoebern
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Warte auf Verkaeufer',
              value: summary.waitingForSeller,
              icon: <Clock3 size={18} />,
            },
            {
              label: 'Deine Entscheidungen',
              value: summary.waitingForBuyer,
              icon: <Tag size={18} />,
            },
            {
              label: 'Neue eingehende Angebote',
              value: summary.incomingForSeller,
              icon: <SendHorizontal size={18} />,
            },
            {
              label: 'Nicht mehr verfuegbar',
              value: summary.unavailable,
              icon: <XCircle size={18} />,
            },
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

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setView('sent')}
            className={`rounded-full px-5 py-3 text-sm font-bold ${view === 'sent' ? 'text-white' : ''}`}
            style={{
              background: view === 'sent' ? 'var(--color-primary)' : 'var(--color-bg-card)',
              color: view === 'sent' ? '#fff' : 'var(--color-text)',
              border: `1px solid ${view === 'sent' ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            Gesendet ({data?.sent.length || 0})
          </button>
          <button
            onClick={() => setView('received')}
            className={`rounded-full px-5 py-3 text-sm font-bold ${view === 'received' ? 'text-white' : ''}`}
            style={{
              background: view === 'received' ? 'var(--color-primary)' : 'var(--color-bg-card)',
              color: view === 'received' ? '#fff' : 'var(--color-text)',
              border: `1px solid ${view === 'received' ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            Erhalten ({data?.received.length || 0})
          </button>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <Loader2 size={30} className="mx-auto mb-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Angebote werden geladen...</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : activeOffers.length > 0 ? (
          <div className="space-y-4">
            {activeOffers.map((offer) => {
              const availability = getAvailabilityMeta(offer.product.status);
              const offerMessage = view === 'sent' ? getSentOfferMessage(offer) : getReceivedOfferMessage(offer);
              const imageUrl = offer.product.images[0]?.url || '';
              const isActioning = actioningId === offer.id;
              const canSellerAct = isSellerActionable(offer);
              const canBuyerAct = isBuyerCounterActionable(offer);
              const counterpart = view === 'sent' ? offer.seller : offer.buyer;
              const counterpartLabel = view === 'sent' ? 'Verkaeufer' : 'Kaeufer';
              const feedbackForCard = feedback?.offerId === offer.id ? feedback : null;
              const checkoutHref = `/checkout/${offer.product.id}?offerId=${encodeURIComponent(offer.id)}`;
              const orderHref = view === 'sent' ? `/purchases/${offer.latestOrder?.id}` : `/sales/${offer.latestOrder?.id}`;

              return (
                <div key={offer.id} className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={offer.product.title} className="h-full w-full object-cover" />
                        ) : (
                          <PackageSearch size={28} style={{ color: 'var(--color-primary)', opacity: 0.35 }} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getOfferTone(offer.status)}`}>
                            {offerStatusToLabel[offer.status] || offer.status}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${availability.tone}`}>
                            {availability.label}
                          </span>
                          {offer.originRole === 'SELLER_COUNTER' ? (
                            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                              Gegenangebot
                            </span>
                          ) : null}
                        </div>

                        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{offer.product.title}</p>
                        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {counterpartLabel}: {counterpart.name || 'cssberlin member'}
                        </p>

                        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2" style={{ color: 'var(--color-text-secondary)' }}>
                          <p>Dein Verhandlungspreis: <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(offer.offeredPrice)}</span></p>
                          <p>Listenpreis: <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(offer.product.price)}</span></p>
                          <p>Erstellt: <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatRelativeTime(offer.createdAt)}</span></p>
                          <p>Zuletzt aktualisiert: <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatRelativeTime(offer.updatedAt)}</span></p>
                        </div>

                        <div className="mt-4 rounded-2xl p-4 text-sm" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                          {offerMessage}
                        </div>

                        {feedbackForCard ? (
                          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${feedbackForCard.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {feedbackForCard.message}
                          </div>
                        ) : null}

                        {counterTargetId === offer.id ? (
                          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                              Neuer Preisvorschlag
                            </label>
                            <div className="flex flex-col gap-3 md:flex-row">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={counterValue}
                                onChange={(event) => setCounterValue(event.target.value)}
                                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                              />
                              <button
                                onClick={() => void submitOfferAction(offer, 'counter')}
                                disabled={isActioning}
                                className="rounded-2xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                style={{ background: 'var(--color-primary)' }}
                              >
                                {isActioning ? 'Sende...' : 'Senden'}
                              </button>
                              <button
                                onClick={resetCounterForm}
                                disabled={isActioning}
                                className="rounded-2xl border px-5 py-3 text-sm font-bold"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:w-[260px]">
                      {offer.latestOrder ? (
                        <Link href={orderHref} className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                          Bestellung ansehen <ArrowRight size={16} />
                        </Link>
                      ) : null}

                      {view === 'sent' && offer.status === 'ACCEPTED' && offer.product.status === 'ACTIVE' && !offer.latestOrder ? (
                        <Link href={checkoutHref} className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                          Mit Angebot kaufen <ArrowRight size={16} />
                        </Link>
                      ) : null}

                      {view === 'received' && canSellerAct ? (
                        <>
                          <button
                            onClick={() => void submitOfferAction(offer, 'accept')}
                            disabled={isActioning}
                            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ background: 'var(--color-primary)' }}
                          >
                            {isActioning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Annehmen
                          </button>
                          <button
                            onClick={() => openCounterForm(offer)}
                            disabled={isActioning}
                            className="rounded-full border px-4 py-3 text-sm font-bold"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                          >
                            Gegenangebot
                          </button>
                          <button
                            onClick={() => void submitOfferAction(offer, 'reject')}
                            disabled={isActioning}
                            className="rounded-full border px-4 py-3 text-sm font-bold text-red-600"
                            style={{ borderColor: 'rgba(220, 38, 38, 0.24)' }}
                          >
                            Ablehnen
                          </button>
                        </>
                      ) : null}

                      {view === 'sent' && canBuyerAct ? (
                        <>
                          <button
                            onClick={() => void submitOfferAction(offer, 'accept')}
                            disabled={isActioning}
                            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ background: 'var(--color-primary)' }}
                          >
                            {isActioning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Gegenangebot annehmen
                          </button>
                          <button
                            onClick={() => openCounterForm(offer)}
                            disabled={isActioning}
                            className="rounded-full border px-4 py-3 text-sm font-bold"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                          >
                            Neu verhandeln
                          </button>
                          <button
                            onClick={() => void submitOfferAction(offer, 'reject')}
                            disabled={isActioning}
                            className="rounded-full border px-4 py-3 text-sm font-bold text-red-600"
                            style={{ borderColor: 'rgba(220, 38, 38, 0.24)' }}
                          >
                            Gegenangebot ablehnen
                          </button>
                        </>
                      ) : null}

                      <Link href={`/product/${offer.product.id}`} className="rounded-full border px-4 py-3 text-center text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                        Produkt ansehen
                      </Link>
                      <Link href="/inbox" className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                        <MessageCircle size={16} /> Zur Inbox
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <PackageSearch size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {view === 'sent' ? 'Noch keine gesendeten Angebote' : 'Noch keine eingegangenen Angebote'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {view === 'sent'
                ? 'Sobald du fuer einen Artikel einen Preis vorschlaegst, erscheint die gesamte Verhandlung hier.'
                : 'Wenn Kaeufer auf deine Listings bieten, kannst du alle Entscheidungen hier zentral steuern.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/catalog" className="rounded-full px-5 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
                Produkte entdecken
              </Link>
              <Link href="/upload" className="rounded-full border px-5 py-3 font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                Neues Listing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}