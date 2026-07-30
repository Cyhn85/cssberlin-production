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

type Viewer = {
  id: string;
};

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
  product: {
    id: string;
    title: string;
    brand: string | null;
    size: string | null;
    condition: string;
    images: Array<{ url: string }>;
  };
  buyer: {
    id: string;
    name: string | null;
    location: string | null;
  };
  seller: {
    id: string;
    name: string | null;
    location: string | null;
  };
};

const SHIPPING_CARRIERS = ['DHL', 'Hermes', 'DPD', 'GLS', 'Andere'];

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shippingCarrier, setShippingCarrier] = useState('DHL');
  const [trackingCode, setTrackingCode] = useState('');
  const [liveNotice, setLiveNotice] = useState<string | null>(null);

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
        const [orderResponse, viewerResponse] = await Promise.all([
          fetch(`/api/orders/${orderId}`),
          fetch('/api/users/me'),
        ]);

        if (orderResponse.status === 401 || viewerResponse.status === 401) {
          router.replace(`/login?callbackUrl=/sales/${orderId}`);
          return;
        }

        const orderResult = await orderResponse.json();
        const viewerResult = await viewerResponse.json();

        if (!orderResponse.ok || !orderResult.success) {
          throw new Error(orderResult.error || 'Bestellung konnte nicht geladen werden.');
        }

        if (!viewerResponse.ok || !viewerResult.success) {
          throw new Error(viewerResult.error || 'Profil konnte nicht geladen werden.');
        }

        if (!cancelled) {
          setViewer({ id: viewerResult.data.id });
          setOrder(orderResult.data);
          setShippingCarrier(orderResult.data.shippingCarrier || 'DHL');
          setTrackingCode(orderResult.data.trackingCode || '');
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

  const isSellerView = !!viewer && !!order && viewer.id === order.seller.id;

  const canManageShipment = useMemo(() => {
    return isSellerView && (order?.status === 'PAID' || order?.status === 'SHIPPED');
  }, [isSellerView, order]);

  const refreshOrder = useEffectEvent(async () => {
    if (!orderId) return;

    const response = await fetch(`/api/orders/${orderId}`);
    if (response.status === 401) {
      router.replace(`/login?callbackUrl=/sales/${orderId}`);
      return;
    }

    const result = await response.json();
    if (response.ok && result.success) {
      setOrder(result.data);
      setShippingCarrier(result.data.shippingCarrier || 'DHL');
      setTrackingCode(result.data.trackingCode || '');
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

  const handleSubmitShipment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order || !canManageShipment || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'SHIPPED',
          shippingCarrier,
          trackingCode,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Versanddaten konnten nicht gespeichert werden.');
      }
      await refreshOrder();
    } catch (actionError: any) {
      setError(actionError.message || 'Versanddaten konnten nicht gespeichert werden.');
    } finally {
      setSubmitting(false);
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
            Verkauf nicht verfuegbar
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {error || 'Dieser Verkauf konnte nicht geladen werden.'}
          </p>
          <Link href="/sales" className="rounded-full px-6 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
            Zurueck zu meinen Verkaeufen
          </Link>
        </div>
      </div>
    );
  }

  if (!isSellerView) {
    return (
      <div className="container py-16">
        <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <ShieldAlert size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <h1 className="mb-2 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Kein Seller-Zugriff
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Diese Bestellansicht ist fuer den verknuepften Verkaeufer gedacht. Als Kaeufer findest du deine Daten unter Meine Kaeufe.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/sales" className="rounded-full border px-5 py-3 font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              Zurueck zu Verkaeufen
            </Link>
            <Link href={`/purchases/${order.id}`} className="rounded-full px-5 py-3 font-bold text-white" style={{ background: 'var(--color-orange)' }}>
              Kaufansicht oeffnen
            </Link>
          </div>
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
          onClick={() => router.push('/sales')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--color-primary)' }}
        >
          <ArrowLeft size={16} /> Zurueck zu meinen Verkaeufen
        </button>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Verkauf {order.id}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Eingang {formatRelativeTime(order.createdAt)} - aktueller Status: {statusLabel}
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
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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
                Verkaufsverlauf
              </h2>
              <div className="space-y-4">
                {timeline.map((step) => (
                  <div key={step.key} className="flex items-start gap-4">
                    <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${step.completed ? 'bg-emerald-100 text-emerald-700' : step.active ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]' : 'bg-slate-100 text-slate-400'}`}>
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
                  Ein Streitfall ist offen. Halte Tracking, Nachrichten und Zustandsnachweise jetzt besonders sauber dokumentiert.
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                Kaeufer und Versandziel
              </h2>
              <div className="space-y-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Kaeufer</p>
                    <p>{order.buyer.name || 'cssberlin member'}{order.buyer.location ? ` - ${order.buyer.location}` : ''}</p>
                    <Link href={`/profile/${order.buyer.id}`} className="mt-2 inline-flex text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                      Profil ansehen
                    </Link>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Truck size={18} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Aktuelle Versanddaten</p>
                    <p>{order.shippingCarrier || 'Noch kein Versanddienst hinterlegt'}</p>
                    {order.trackingCode ? <p className="mt-1">Tracking: {order.trackingCode}</p> : <p className="mt-1">Noch kein Tracking hinterlegt</p>}
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

            {canManageShipment ? (
              <form onSubmit={handleSubmitShipment} className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mb-3 flex items-center gap-2">
                  <Truck size={18} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                    Versand verwalten
                  </h2>
                </div>
                <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Sobald du den Versanddienst und optionales Tracking speicherst, sieht der Kaeufer den aktualisierten Versandstatus sofort in seinen Kaeufen und Benachrichtigungen.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Versanddienst
                    <select
                      value={shippingCarrier}
                      onChange={(event) => setShippingCarrier(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                    >
                      {SHIPPING_CARRIERS.map((carrier) => (
                        <option key={carrier} value={carrier}>{carrier}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Tracking-Code
                    <input
                      value={trackingCode}
                      onChange={(event) => setTrackingCode(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                      placeholder="z.B. 003404341234"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={submitting || !shippingCarrier.trim()}
                  className="mt-5 rounded-full px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'var(--color-orange)' }}
                >
                  {submitting ? 'Wird gespeichert...' : order.status === 'PAID' ? 'Als versendet markieren' : 'Versanddaten aktualisieren'}
                </button>
              </form>
            ) : (
              <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mb-3 flex items-center gap-2">
                  <Truck size={18} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                    Versandstatus
                  </h2>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {order.status === 'DELIVERED' && 'Die Sendung ist zugestellt. Warte jetzt auf die finale Bestaetigung des Kaeufers.'}
                  {order.status === 'COMPLETED' && 'Diese Bestellung ist abgeschlossen. Alle relevanten Versanddaten bleiben hier dokumentiert.'}
                  {order.status === 'DISPUTED' && 'Fuer diese Bestellung ist ein Streitfall offen. Pruefe die Details und dokumentiere alle Versandinformationen.'}
                  {order.status === 'PENDING_PAYMENT' && 'Die Zahlung ist noch nicht bestaetigt. Versandaktionen werden erst nach erfolgreicher Zahlung freigeschaltet.'}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                Verkaufsuebersicht
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

              <div className="space-y-3">
                <Link href={`/inbox?with=${order.buyer.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <MessageCircle size={16} /> Kaeufer kontaktieren
                </Link>
                {order.offer ? (
                  <Link href="/offers" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    Angebotsverlauf ansehen
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <p>Status zuletzt aktualisiert {formatRelativeTime(order.updatedAt)}.</p>
                <p className="mt-2">Bestellung erstellt am {new Date(order.createdAt).toLocaleDateString('de-DE')}.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
