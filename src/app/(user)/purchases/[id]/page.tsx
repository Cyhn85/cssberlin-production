'use client';

import { FormEvent, useEffect, useEffectEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageCircle,
  PackageCheck,
  ShieldAlert,
  Star,
  Truck,
} from 'lucide-react';
import {
  formatPrice,
  formatRelativeTime,
  getConditionLabel,
  getOrderTimeline,
  orderStatusToLabel,
} from '@/lib/utils/condition-map';
import { getPusherClient } from '@/lib/pusher-client';
import { CHANNELS, EVENTS, type OrderStatusEvent } from '@/lib/realtime';

type OrderDetail = {
  id: string;
  totalAmount: number;
  itemPrice: number;
  shippingFee: number;
  protectionFee: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  trackingCode: string | null;
  shippingCarrier: string | null;
  disputeReason: string | null;
  offer?: {
    id: string;
    offeredPrice: number;
  } | null;
  review?: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
  } | null;
  product: {
    id: string;
    title: string;
    brand: string | null;
    size: string | null;
    condition: string;
    images: Array<{ url: string }>;
  };
  seller: {
    id: string;
    name: string | null;
    location: string | null;
  };
};

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('Bestell-ID fehlt.');
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/orders/${orderId}`);
        const result = await response.json();

        if (response.status === 401) {
          router.replace(`/login?callbackUrl=/purchases/${orderId}`);
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Bestellung konnte nicht geladen werden.');
        }

        if (!cancelled) {
          setOrder(result.data);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError.message || 'Bestellung konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  const canConfirmDelivery = useMemo(() => {
    return order?.status === 'SHIPPED' || order?.status === 'DELIVERED';
  }, [order]);

  const canOpenDispute = useMemo(() => {
    return order?.status === 'SHIPPED' || order?.status === 'DELIVERED';
  }, [order]);

  const refreshOrder = useEffectEvent(async () => {
    if (!orderId) return;

    const response = await fetch(`/api/orders/${orderId}`);
    if (response.status === 401) {
      router.replace(`/login?callbackUrl=/purchases/${orderId}`);
      return;
    }

    const result = await response.json();
    if (response.ok && result.success) {
      setOrder(result.data);
    }
  });

  const handleRealtimeOrderStatus = useEffectEvent(async (event: OrderStatusEvent) => {
    if (event.orderId !== orderId) return;
    setLiveNotice(event.summary);
    await refreshOrder();
  });

  useEffect(() => {
    if (!orderId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = CHANNELS.order(orderId);
    const channel = pusher.subscribe(channelName);

    channel.bind(EVENTS.ORDER_STATUS, handleRealtimeOrderStatus);

    return () => {
      channel.unbind(EVENTS.ORDER_STATUS, handleRealtimeOrderStatus);
      pusher.unsubscribe(channelName);
    };
  }, [handleRealtimeOrderStatus, orderId]);

  const handleConfirmDelivery = async () => {
    if (!order || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/confirm-delivery`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Empfang konnte nicht bestaetigt werden.');
      }
      await refreshOrder();
    } catch (actionError: any) {
      setError(actionError.message || 'Empfang konnte nicht bestaetigt werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Streitfall konnte nicht erstellt werden.');
      }
      setDisputeReason('');
      await refreshOrder();
    } catch (actionError: any) {
      setError(actionError.message || 'Streitfall konnte nicht erstellt werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order || reviewSubmitting) return;

    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, rating: reviewRating, comment: reviewComment }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Bewertung konnte nicht gespeichert werden.');
      }
      setReviewComment('');
      await refreshOrder();
    } catch (reviewSubmitError: any) {
      setReviewError(reviewSubmitError.message || 'Bewertung konnte nicht gespeichert werden.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={34} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (!order || error) {
    return (
      <div className="container py-16">
        <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <AlertTriangle size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <h1 className="mb-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Bestellung nicht verfuegbar
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {error || 'Diese Bestellung konnte nicht geladen werden.'}
          </p>
          <Link href="/purchases" className="rounded-full px-6 py-3 font-bold text-white btn-mars-earth" style={{ background: 'var(--color-orange)' }}>
            <span>Zurueck zu meinen Kaeufen</span>
          </Link>
        </div>
      </div>
    );
  }

  const heroImage = order.product.images[0]?.url || '';
  const statusLabel = orderStatusToLabel[order.status] || order.status;
  const timeline = getOrderTimeline(order.status);

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <button
          onClick={() => router.push('/purchases')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--color-primary)' }}
        >
          <ArrowLeft size={16} /> Zurueck zu meinen Kaeufen
        </button>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Bestellung {order.id}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Angelegt {formatRelativeTime(order.createdAt)} - aktueller Status: {statusLabel}
            </p>
          </div>
          <div className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-dark)' }}>
            {statusLabel}
          </div>
        </div>

        {liveNotice ? (
          <div className="mb-6 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(232, 101, 26, 0.28)', background: 'rgba(232, 101, 26, 0.08)', color: 'var(--color-text)' }}>
            {liveNotice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
                  {heroImage ? (
                    <img src={heroImage} alt={order.product.title} className="h-full w-full object-cover" />
                  ) : (
                    <PackageCheck size={26} style={{ color: 'var(--color-primary)', opacity: 0.3 }} />
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
                    {order.product.brand || 'cssberlin'}
                  </p>
                  <h2 className="mt-1 text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {order.product.title}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Zustand: {getConditionLabel(order.product.condition)}
                    {order.product.size ? ` - Groesse ${order.product.size}` : ''}
                  </p>
                  <Link href={`/product/${order.product.id}`} className="mt-3 inline-flex text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                    Produktseite ansehen
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                Bestellverlauf
              </h2>
              <div className="space-y-4">
                {timeline.map((step) => (
                  <div key={step.key} className="flex items-start gap-4">
                    <div
                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${step.completed ? 'bg-emerald-100 text-emerald-700' : step.active ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]' : 'bg-slate-100 text-slate-400'}`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{step.label}</p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              {order.status === 'DISPUTED' ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Ein Streitfall ist offen. Halte alle Nachrichten und Nachweise in der Inbox und in dieser Bestellung sauber dokumentiert.
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                Versand und Schutz
              </h2>
              <div className="space-y-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="flex items-start gap-3">
                  <Truck size={18} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Versanddienst</p>
                    <p>{order.shippingCarrier || 'Noch nicht hinterlegt'}</p>
                    {order.trackingCode ? <p className="mt-1">Tracking: {order.trackingCode}</p> : null}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Verkaeufer</p>
                    <p>{order.seller.name || 'cssberlin member'}{order.seller.location ? ` - ${order.seller.location}` : ''}</p>
                  </div>
                </div>
                {order.disputeReason ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                    <p className="font-semibold">Streitfall aktiv</p>
                    <p className="mt-1 text-sm">{order.disputeReason}</p>
                  </div>
                ) : null}
              </div>
            </div>

            {canOpenDispute && !order.disputeReason ? (
              <form onSubmit={handleOpenDispute} className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert size={18} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                    Streitfall eroeffnen
                  </h2>
                </div>
                <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Nutze diese Option nur, wenn es ein echtes Problem mit Versand oder Artikelzustand gibt.
                </p>
                <textarea
                  value={disputeReason}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'var(--color-bg)' }}
                  placeholder="Beschreibe das Problem moeglichst konkret..."
                />
                <button
                  type="submit"
                  disabled={submitting || disputeReason.trim().length < 10}
                  className="mt-4 rounded-full px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {submitting ? 'Wird gesendet...' : 'Streitfall senden'}
                </button>
              </form>
            ) : null}

            {order.status === 'COMPLETED' ? (
              <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mb-3 flex items-center gap-2">
                  <Star size={18} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                    Bewertung
                  </h2>
                </div>

                {order.review ? (
                  <div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={18}
                          fill={star <= order.review!.rating ? 'var(--color-orange)' : 'none'}
                          style={{ color: 'var(--color-orange)' }}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {order.review.comment}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Bewertet {formatRelativeTime(order.review.createdAt)}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview}>
                    <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Wie war dein Kauf bei {order.seller.name || 'diesem Verkaeufer'}?
                    </p>
                    <div className="mb-4 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          aria-label={`${star} Sterne`}
                          className="p-0.5"
                        >
                          <Star
                            size={26}
                            fill={star <= reviewRating ? 'var(--color-orange)' : 'none'}
                            style={{ color: 'var(--color-orange)' }}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      required
                      minLength={3}
                      className="min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'var(--color-bg)' }}
                      placeholder="Erzaehl anderen von deiner Erfahrung..."
                    />
                    {reviewError ? (
                      <p className="mt-2 text-sm text-red-600">{reviewError}</p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={reviewSubmitting || reviewComment.trim().length < 3}
                      className="btn-mars-earth mt-4 rounded-full px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>{reviewSubmitting ? 'Wird gesendet...' : 'Bewertung abschicken'}</span>
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                Kostenuebersicht
              </h2>
              <div className="space-y-3 border-b pb-6 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <div className="flex justify-between">
                  <span>Artikelpreis</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(order.itemPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Versand</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPrice(order.shippingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kaeuferschutz</span>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{formatPrice(order.protectionFee)}</span>
                </div>
                {order.offer ? (
                  <div className="flex justify-between">
                    <span>Verhandelter Preis</span>
                    <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{formatPrice(order.offer.offeredPrice)}</span>
                  </div>
                ) : null}
              </div>
              <div className="mb-6 mt-6 flex items-end justify-between">
                <span className="font-bold">Gesamtbetrag</span>
                <span className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                  {formatPrice(order.totalAmount)}
                </span>
              </div>

              {canConfirmDelivery ? (
                <button
                  onClick={handleConfirmDelivery}
                  disabled={submitting}
                  className="w-full rounded-2xl py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'var(--color-orange)' }}
                >
                  {submitting ? 'Wird verarbeitet...' : 'Erhalt bestaetigen'}
                </button>
              ) : null}

              <div className="mt-4 space-y-3">
                <Link href={`/inbox?with=${order.seller.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <MessageCircle size={16} /> Verkaeufer kontaktieren
                </Link>
                {order.offer ? (
                  <Link href="/offers" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    Angebotsverlauf ansehen
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                Status zuletzt aktualisiert {formatRelativeTime(order.updatedAt)}.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
