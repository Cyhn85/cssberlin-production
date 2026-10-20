import { createSystemNotifications, type NotificationInput } from '@/lib/notifications';
import { CHANNELS, EVENTS, triggerEvent } from '@/lib/pusher';
import { type OrderLifecycleEventType, type OrderStatusEvent } from '@/lib/realtime';
import { orderStatusToLabel } from '@/lib/utils/condition-map';
import { carrierLabel } from '@/config/shipping-policy';
import { cancellationPolicy, completionPolicy, pickupPolicy, shippingDeadlines } from '@/config/marketplace-policy';

type OrderParty = {
  id: string;
  name: string | null;
  email: string | null;
};

type OrderProduct = {
  id: string;
  title: string;
};

export type OrderCommunicationRecord = {
  id: string;
  status: string;
  totalAmount: number;
  trackingCode: string | null;
  shippingCarrier: string | null;
  disputeReason: string | null;
  updatedAt: Date | string;
  buyer: OrderParty;
  seller: OrderParty;
  product: OrderProduct;
  paymentMethod?: string | null;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  cancelRequestReason?: string | null;
  disputeResolution?: string | null;
  disputeResolutionNote?: string | null;
};

type PublishOrderLifecycleEventInput = {
  eventType: OrderLifecycleEventType;
  order: OrderCommunicationRecord;
  actorId: string;
  wasAlreadyShipped?: boolean;
};

function displayName(name: string | null | undefined, fallback: string) {
  return name?.trim() || fallback;
}

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

function buildOrderPaths(orderId: string) {
  return { buyerPath: `/purchases/${orderId}`, sellerPath: `/sales/${orderId}` };
}

export function cancelReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '';
  const id = reason.split(':')[0].trim();
  if (id === 'not_shipped_in_time') return `nicht innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen versendet`;
  if (id === 'pickup_not_completed') return `Abholung nicht innerhalb von ${pickupPolicy.holdHours} Stunden bestätigt`;
  const all = [...cancellationPolicy.sellerReasons, ...cancellationPolicy.buyerReasons] as ReadonlyArray<{ id: string; label: string }>;
  return all.find((r) => r.id === id)?.label ?? reason;
}

function buildSummary(input: PublishOrderLifecycleEventInput) {
  const { order, eventType } = input;
  const t = order.product.title;
  switch (eventType) {
    case 'ORDER_PAID': return `${t}: Zahlung bestätigt. Versand kann jetzt vorbereitet werden.`;
    case 'ORDER_PICKUP_REQUESTED': return `${t}: Abholung angefragt.`;
    case 'ORDER_PICKUP_REMINDER': return `${t}: Reservierung läuft bald ab.`;
    case 'ORDER_PICKUP_COMPLETED': return `${t}: Übergabe bestätigt, Kauf abgeschlossen.`;
    case 'ORDER_SHIP_REMINDER': return `${t}: Versand ausstehend.`;
    case 'ORDER_SHIPPED': return order.trackingCode ? `${t}: versendet (${order.trackingCode}).` : `${t}: versendet.`;
    case 'ORDER_COMPLETED':
    case 'ORDER_AUTO_COMPLETED': return `${t}: Bestellung abgeschlossen.`;
    case 'ORDER_DISPUTED': return `${t}: Ein Problem wurde gemeldet.`;
    case 'ORDER_DISPUTE_RESOLVED': return `${t}: Käuferschutz-Fall entschieden.`;
    case 'ORDER_CANCEL_REQUESTED': return `${t}: Stornierung angefragt.`;
    case 'ORDER_CANCEL_DECLINED': return `${t}: Stornierungsanfrage beendet, Bestellung läuft weiter.`;
    case 'ORDER_CANCELLED': return `${t}: Bestellung storniert.`;
    default: return `${t}: Status ist jetzt ${orderStatusToLabel[order.status] || order.status}.`;
  }
}

/**
 * Who hears what. One entry per receiver; an e-mail twin only where somebody has
 * to act or money moves - the same moments Vinted and eBay send mail for.
 */
function buildNotifications(input: PublishOrderLifecycleEventInput): NotificationInput[] {
  const { order, eventType, wasAlreadyShipped } = input;
  const b = order.buyer;
  const s = order.seller;
  const buyerName = displayName(b.name, 'Der Käufer');
  const sellerName = displayName(s.name, 'Der Verkäufer');
  const t = order.product.title;
  const { buyerPath, sellerPath } = buildOrderPaths(order.id);
  const tracking = order.trackingCode ? ` Sendungsnummer: ${order.trackingCode}.` : '';
  const pickup = order.paymentMethod === 'pickup_cash' || order.shippingCarrier === 'PICKUP';
  const toBuyer = (content: string, email?: NotificationInput['email']): NotificationInput => ({ senderId: s.id, receiverId: b.id, content, email });
  const toSeller = (content: string, email?: NotificationInput['email']): NotificationInput => ({ senderId: b.id, receiverId: s.id, content, email });

  switch (eventType) {
    case 'ORDER_PAID':
      return [
        toSeller(`Verkauft! ${buyerName} hat ${t} für ${eur(order.totalAmount)} gekauft. Bitte versende innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen.`, {
          subject: `Verkauft: ${t}`,
          title: 'Glückwunsch, verkauft!',
          lines: [
            `Artikel: ${t}`,
            'Bitte verpacke den Artikel sicher und trage danach die Sendungsnummer ein.',
            `Ohne Versand innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen wird die Bestellung automatisch storniert.`,
          ],
          ctaLabel: 'Versand vorbereiten',
          ctaPath: sellerPath,
        }),
        toBuyer(`Zahlung für ${t} bestätigt (${eur(order.totalAmount)}). Innerhalb von ${cancellationPolicy.buyerFreeCancelMinutes} Minuten kannst du noch kostenlos stornieren.`, {
          subject: `Bestellbestätigung: ${t}`,
          title: 'Danke für deinen Kauf!',
          lines: [
            `Artikel: ${t}`,
            `Gesamt: ${eur(order.totalAmount)}`,
            'Wir benachrichtigen dich, sobald der Artikel versendet wurde. Dein Geld bleibt bis zum Abschluss durch den Käuferschutz gesichert.',
          ],
          ctaLabel: 'Bestellung ansehen',
          ctaPath: buyerPath,
        }),
      ];
    case 'ORDER_PICKUP_REQUESTED':
      return [
        toSeller(`${buyerName} möchte ${t} abholen und bar bezahlen. Vereinbart im Chat Ort und Zeit - der Artikel ist ${pickupPolicy.holdHours} Stunden reserviert.`, {
          subject: `Abholanfrage: ${t}`,
          title: 'Neue Abholanfrage',
          lines: [
            `Artikel: ${t}`,
            `Preis: ${eur(order.totalAmount)} (Barzahlung bei Übergabe)`,
            `Bestätige nach der Übergabe "Übergeben & bezahlt". Ohne Bestätigung endet die Reservierung nach ${pickupPolicy.holdHours} Stunden.`,
          ],
          ctaLabel: 'Abholung organisieren',
          ctaPath: sellerPath,
        }),
        toBuyer(`Deine Abholanfrage für ${t} ist bei ${sellerName}. Der Artikel ist ${pickupPolicy.holdHours} Stunden für dich reserviert - vereinbart Ort und Zeit im Chat.`),
      ];
    case 'ORDER_PICKUP_REMINDER':
      return [
        toSeller(`Erinnerung: Die Reservierung für ${t} läuft bald ab. Bestätige nach der Übergabe "Übergeben & bezahlt".`),
        toBuyer(`Erinnerung: Die Abholung von ${t} sollte bald stattfinden, sonst endet die Reservierung.`),
      ];
    case 'ORDER_PICKUP_COMPLETED':
      return [toBuyer(`Übergabe von ${t} bestätigt. Viel Freude damit! Bewerte jetzt ${sellerName}.`)];
    case 'ORDER_SHIP_REMINDER':
      return [
        toSeller(`Erinnerung: ${t} ist bezahlt, aber noch nicht versendet. Ohne Versand innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen nach dem Kauf wird die Bestellung storniert.`, {
          subject: `Bitte versenden: ${t}`,
          title: 'Versand-Erinnerung',
          lines: [`Artikel: ${t}`, 'Trage nach dem Versand die Sendungsnummer ein.'],
          ctaLabel: 'Jetzt versenden',
          ctaPath: sellerPath,
        }),
      ];
    case 'ORDER_SHIPPED':
      if (wasAlreadyShipped) {
        return [toBuyer(`${sellerName} hat die Versanddaten für ${t} aktualisiert.${tracking}`)];
      }
      return [
        toBuyer(`${t} ist unterwegs (${carrierLabel(order.shippingCarrier)}).${tracking} Bestätige den Empfang, sobald alles passt - ohne Meldung schließen wir ${completionPolicy.autoCompleteAfterShippedDays} Tage nach Versand automatisch ab.`, {
          subject: `Versendet: ${t}`,
          title: 'Dein Artikel ist unterwegs',
          lines: [
            `Versand: ${carrierLabel(order.shippingCarrier)}`,
            ...(order.trackingCode ? [`Sendungsnummer: ${order.trackingCode}`] : []),
            'Stimmt etwas nicht? Melde das Problem vor dem automatischen Abschluss in deiner Bestellung.',
          ],
          ctaLabel: 'Sendung ansehen',
          ctaPath: buyerPath,
        }),
      ];
    case 'ORDER_COMPLETED':
      return [
        toSeller(`${buyerName} hat den Erhalt von ${t} bestätigt. Der Verkauf ist abgeschlossen.`, {
          subject: `Abgeschlossen: ${t}`,
          title: 'Verkauf abgeschlossen',
          lines: [`Artikel: ${t}`],
          ctaLabel: 'Verkauf ansehen',
          ctaPath: sellerPath,
        }),
      ];
    case 'ORDER_AUTO_COMPLETED':
      return [
        toSeller(`${t}: Bestellung automatisch abgeschlossen (kein Problem gemeldet).`, {
          subject: `Abgeschlossen: ${t}`,
          title: 'Verkauf abgeschlossen',
          lines: [`Artikel: ${t}`],
          ctaLabel: 'Verkauf ansehen',
          ctaPath: sellerPath,
        }),
        toBuyer(`${t}: Bestellung automatisch abgeschlossen. Wie war dein Kauf? Bewerte ${sellerName}.`),
      ];
    case 'ORDER_DISPUTED':
      return [
        toSeller(`${buyerName} hat für ${t} ein Problem gemeldet. Bitte antworte im Chat - unser Team prüft den Fall.`, {
          subject: `Problem gemeldet: ${t}`,
          title: 'Käuferschutz-Fall eröffnet',
          lines: [`Artikel: ${t}`, `Grund: ${order.disputeReason || '-'}`, 'Bis zur Entscheidung erfolgt keine Auszahlung.'],
          ctaLabel: 'Fall ansehen',
          ctaPath: sellerPath,
        }),
        toBuyer(`Deine Meldung zu ${t} ist eingegangen. Wir melden uns, sobald der Fall geprüft ist.`),
      ];
    case 'ORDER_DISPUTE_RESOLVED': {
      const refunded = order.disputeResolution === 'REFUNDED';
      const note = order.disputeResolutionNote ? `Begründung: ${order.disputeResolutionNote}` : '';
      return [
        toBuyer(
          refunded ? `Käuferschutz: Du erhältst eine Erstattung für ${t}. ${note}`.trim() : `Käuferschutz: Der Fall zu ${t} wurde ohne Erstattung abgeschlossen. ${note}`.trim(),
          {
            subject: `Entscheidung zu deinem Fall: ${t}`,
            title: 'Käuferschutz-Entscheidung',
            lines: [refunded ? 'Ergebnis: Erstattung' : 'Ergebnis: Abschluss ohne Erstattung', ...(note ? [note] : [])],
            ctaLabel: 'Bestellung ansehen',
            ctaPath: buyerPath,
          },
        ),
        toSeller(
          refunded ? `Käuferschutz: Der Fall zu ${t} wurde zugunsten des Käufers entschieden. ${note}`.trim() : `Käuferschutz: Der Fall zu ${t} wurde zu deinen Gunsten entschieden. ${note}`.trim(),
          {
            subject: `Entscheidung zum Fall: ${t}`,
            title: 'Käuferschutz-Entscheidung',
            lines: [refunded ? 'Ergebnis: Erstattung an den Käufer' : 'Ergebnis: Verkauf abgeschlossen', ...(note ? [note] : [])],
            ctaLabel: 'Verkauf ansehen',
            ctaPath: sellerPath,
          },
        ),
      ];
    }
    case 'ORDER_CANCEL_REQUESTED': {
      const why = cancelReasonLabel(order.cancelRequestReason);
      return [
        toSeller(`${buyerName} bittet um Stornierung von ${t}${why ? ` (${why})` : ''}. Annehmen oder ablehnen - wenn du versendest, gilt die Anfrage als abgelehnt.`, {
          subject: `Stornierungsanfrage: ${t}`,
          title: 'Stornierungsanfrage',
          lines: [`Artikel: ${t}`, `Bitte antworte innerhalb von ${cancellationPolicy.requestAnswerHours} Stunden.`],
          ctaLabel: 'Anfrage beantworten',
          ctaPath: sellerPath,
        }),
        toBuyer(`Deine Stornierungsanfrage für ${t} ist bei ${sellerName}. Du bekommst Bescheid, sobald geantwortet wurde.`),
      ];
    }
    case 'ORDER_CANCEL_DECLINED':
      return [toBuyer(`Die Stornierungsanfrage für ${t} wurde nicht angenommen. Die Bestellung wird wie geplant versendet.`)];
    case 'ORDER_CANCELLED': {
      const by = order.cancelledBy;
      const why = cancelReasonLabel(order.cancelReason);
      const money = pickup ? '' : 'Der gezahlte Betrag wird vollständig erstattet.';
      const list: NotificationInput[] = [];
      if (by === 'BUYER') {
        list.push(toBuyer(`Du hast ${t} storniert. ${money}`.trim()));
      } else {
        list.push(toBuyer(`Die Bestellung ${t} wurde storniert${why ? ` (${why})` : ''}. ${money}`.trim(), {
          subject: `Storniert: ${t}`,
          title: 'Bestellung storniert',
          lines: [`Artikel: ${t}`, ...(why ? [`Grund: ${why}`] : []), ...(money ? [money] : [])],
          ctaLabel: 'Ähnliche Artikel finden',
          ctaPath: '/catalog',
        }));
      }
      if (by !== 'SELLER') {
        list.push(toSeller(`Die Bestellung ${t} wurde storniert${why ? ` (${why})` : ''}. Der Artikel ist wieder im Verkauf.`, {
          subject: `Storniert: ${t}`,
          title: 'Bestellung storniert',
          lines: [`Artikel: ${t}`, ...(why ? [`Grund: ${why}`] : []), 'Der Artikel ist wieder für andere Käufer sichtbar.'],
          ctaLabel: 'Verkäufe ansehen',
          ctaPath: sellerPath,
        }));
      }
      return list;
    }
    default:
      return [];
  }
}

function buildRealtimeEvent(input: PublishOrderLifecycleEventInput): OrderStatusEvent {
  const { order, actorId, eventType } = input;
  const actorName = actorId === order.buyer.id
    ? displayName(order.buyer.name, 'Der Käufer')
    : displayName(order.seller.name, 'Der Verkäufer');
  const paths = buildOrderPaths(order.id);

  return {
    orderId: order.id,
    eventType,
    status: order.status,
    summary: buildSummary(input),
    actorId,
    actorName,
    buyerId: order.buyer.id,
    sellerId: order.seller.id,
    productId: order.product.id,
    productTitle: order.product.title,
    trackingCode: order.trackingCode,
    shippingCarrier: order.shippingCarrier,
    disputeReason: order.disputeReason,
    updatedAt: new Date(order.updatedAt).toISOString(),
    buyerPath: paths.buyerPath,
    sellerPath: paths.sellerPath,
  };
}

/** Realtime + in-app + e-mail for one lifecycle event. Never throws: a failed side effect must not undo a committed order. */
export async function publishOrderLifecycleEvent(input: PublishOrderLifecycleEventInput) {
  const results = await Promise.allSettled([
    triggerEvent(CHANNELS.order(input.order.id), EVENTS.ORDER_STATUS, buildRealtimeEvent(input)),
    createSystemNotifications(buildNotifications(input)),
  ]);
  const failures = results.flatMap((r, i) => (r.status === 'rejected' ? [{ channel: i === 0 ? 'realtime' : 'notifications', reason: r.reason }] : []));
  if (failures.length > 0) {
    console.error('Order communication side-effects failed', { orderId: input.order.id, eventType: input.eventType, failures });
  }
}
