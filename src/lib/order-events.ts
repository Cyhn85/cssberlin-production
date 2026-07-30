import {
  disputeOpenedSellerEmail,
  newSaleSellerEmail,
  orderCompletedSellerEmail,
  orderConfirmedEmail,
  sendEmail,
  shippingUpdateEmail,
  type EmailOptions,
} from '@/lib/email';
import { createSystemNotifications } from '@/lib/notifications';
import { CHANNELS, EVENTS, triggerEvent } from '@/lib/pusher';
import { type OrderLifecycleEventType, type OrderStatusEvent } from '@/lib/realtime';
import { orderStatusToLabel } from '@/lib/utils/condition-map';

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
};

type NotificationPlan = {
  senderId: string;
  receiverId: string;
  content: string;
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

function buildOrderPaths(orderId: string) {
  return {
    buyerPath: `/purchases/${orderId}`,
    sellerPath: `/sales/${orderId}`,
  };
}

function buildSummary(input: PublishOrderLifecycleEventInput) {
  const { order, eventType, wasAlreadyShipped } = input;
  const statusLabel = orderStatusToLabel[order.status] || order.status;

  switch (eventType) {
    case 'ORDER_PAID':
      return `${order.product.title}: Zahlung bestaetigt. Versand kann jetzt vorbereitet werden.`;
    case 'ORDER_SHIPPED':
      if (wasAlreadyShipped) {
        return order.trackingCode
          ? `${order.product.title}: Versanddaten aktualisiert (${order.trackingCode}).`
          : `${order.product.title}: Versanddaten aktualisiert.`;
      }
      return order.trackingCode
        ? `${order.product.title}: Bestellung ist jetzt versendet (${order.trackingCode}).`
        : `${order.product.title}: Bestellung ist jetzt versendet.`;
    case 'ORDER_COMPLETED':
      return `${order.product.title}: Bestellung wurde erfolgreich abgeschlossen.`;
    case 'ORDER_DISPUTED':
      return `${order.product.title}: Ein Streitfall wurde eroeffnet.`;
    default:
      return `${order.product.title}: Status ist jetzt ${statusLabel}.`;
  }
}

function buildNotifications(input: PublishOrderLifecycleEventInput): NotificationPlan[] {
  const { order, eventType, wasAlreadyShipped } = input;
  const buyerName = displayName(order.buyer.name, 'Der Kaeufer');
  const sellerName = displayName(order.seller.name, 'Der Verkaeufer');
  const trackingSuffix = order.trackingCode ? ` (Tracking: ${order.trackingCode})` : '';

  switch (eventType) {
    case 'ORDER_PAID':
      return [
        {
          senderId: order.buyer.id,
          receiverId: order.seller.id,
          content: `${buyerName} hat ${order.product.title} gekauft. Bitte bereite den Versand vor.`,
        },
        {
          senderId: order.seller.id,
          receiverId: order.buyer.id,
          content: `Deine Zahlung fuer ${order.product.title} wurde bestaetigt. Die Bestellung ist jetzt in deinen Kaeufen sichtbar.`,
        },
      ];
    case 'ORDER_SHIPPED':
      return [
        {
          senderId: order.seller.id,
          receiverId: order.buyer.id,
          content: wasAlreadyShipped
            ? `${sellerName} hat die Versanddaten fuer ${order.product.title} aktualisiert${trackingSuffix}.`
            : `${sellerName} hat ${order.product.title} als versendet markiert${trackingSuffix}.`,
        },
      ];
    case 'ORDER_COMPLETED':
      return [
        {
          senderId: order.buyer.id,
          receiverId: order.seller.id,
          content: `${buyerName} hat den Erhalt von ${order.product.title} bestaetigt. Die Bestellung ist jetzt abgeschlossen.`,
        },
      ];
    case 'ORDER_DISPUTED':
      return [
        {
          senderId: order.buyer.id,
          receiverId: order.seller.id,
          content: `${buyerName} hat fuer ${order.product.title} einen Streitfall eroeffnet. Bitte pruefe die Bestellung.`,
        },
      ];
    default:
      return [];
  }
}

function buildEmails(input: PublishOrderLifecycleEventInput): Array<EmailOptions | null> {
  const { order, eventType } = input;
  const buyerName = displayName(order.buyer.name, 'cssberlin member');
  const sellerName = displayName(order.seller.name, 'cssberlin seller');

  switch (eventType) {
    case 'ORDER_PAID':
      return [
        order.buyer.email
          ? {
              ...orderConfirmedEmail(buyerName, order.product.title, order.totalAmount, order.id),
              to: order.buyer.email,
            }
          : null,
        order.seller.email
          ? {
              ...newSaleSellerEmail(sellerName, buyerName, order.product.title, order.totalAmount, order.id),
              to: order.seller.email,
            }
          : null,
      ];
    case 'ORDER_SHIPPED':
      return [
        order.buyer.email
          ? {
              ...shippingUpdateEmail(
                buyerName,
                order.product.title,
                order.id,
                order.trackingCode,
                order.shippingCarrier || 'DHL'
              ),
              to: order.buyer.email,
            }
          : null,
      ];
    case 'ORDER_COMPLETED':
      return [
        order.seller.email
          ? {
              ...orderCompletedSellerEmail(sellerName, buyerName, order.product.title, order.id),
              to: order.seller.email,
            }
          : null,
      ];
    case 'ORDER_DISPUTED':
      return [
        order.seller.email
          ? {
              ...disputeOpenedSellerEmail(
                sellerName,
                buyerName,
                order.product.title,
                order.id,
                order.disputeReason || 'Kein Grund hinterlegt.'
              ),
              to: order.seller.email,
            }
          : null,
      ];
    default:
      return [];
  }
}

function buildRealtimeEvent(input: PublishOrderLifecycleEventInput): OrderStatusEvent {
  const { order, actorId, eventType } = input;
  const actorName = actorId === order.buyer.id
    ? displayName(order.buyer.name, 'Der Kaeufer')
    : displayName(order.seller.name, 'Der Verkaeufer');
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

async function sendQueuedEmails(emails: Array<EmailOptions | null>) {
  const deliveries = emails.filter((email): email is EmailOptions => Boolean(email));
  await Promise.all(deliveries.map((email) => sendEmail(email)));
}

export async function publishOrderLifecycleEvent(input: PublishOrderLifecycleEventInput) {
  const realtimeEvent = buildRealtimeEvent(input);
  const notifications = buildNotifications(input);
  const emails = buildEmails(input);

  const results = await Promise.allSettled([
    triggerEvent(CHANNELS.order(input.order.id), EVENTS.ORDER_STATUS, realtimeEvent),
    notifications.length > 0 ? createSystemNotifications(notifications) : Promise.resolve([]),
    emails.length > 0 ? sendQueuedEmails(emails) : Promise.resolve(),
  ]);

  const failures = results.flatMap((result, index) => {
    if (result.status !== 'rejected') {
      return [];
    }

    const label = index === 0 ? 'realtime' : index === 1 ? 'notifications' : 'email';
    return [
      {
        channel: label,
        reason: result.reason,
      },
    ];
  });

  if (failures.length > 0) {
    console.error('Order communication side-effects failed', {
      orderId: input.order.id,
      eventType: input.eventType,
      failures,
    });
  }
}

