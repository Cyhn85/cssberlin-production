export const CHANNELS = {
  user: (userId: string) => `private-user-${userId}`,
  conversation: (userId1: string, userId2: string) => {
    const sorted = [userId1, userId2].sort();
    return `private-conversation-${sorted[0]}-${sorted[1]}`;
  },
  product: (productId: string) => `product-${productId}`,
  order: (orderId: string) => `private-order-${orderId}`,
};

export const EVENTS = {
  NEW_MESSAGE: 'new-message',
  MESSAGE_READ: 'message-read',
  NEW_OFFER: 'new-offer',
  OFFER_UPDATED: 'offer-updated',
  ORDER_STATUS: 'order-status',
  NOTIFICATION: 'notification',
  TYPING: 'typing',
};

export type OrderLifecycleEventType =
  | 'ORDER_PAID'
  | 'ORDER_SHIPPED'
  | 'ORDER_COMPLETED'
  | 'ORDER_DISPUTED';

export type OrderStatusEvent = {
  orderId: string;
  eventType: OrderLifecycleEventType;
  status: string;
  summary: string;
  actorId: string;
  actorName: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productTitle: string;
  trackingCode: string | null;
  shippingCarrier: string | null;
  disputeReason: string | null;
  updatedAt: string;
  buyerPath: string;
  sellerPath: string;
};

export function isAuthorizedUserChannel(channelName: string, userId: string) {
  return channelName === CHANNELS.user(userId);
}

export function isAuthorizedConversationChannel(channelName: string, userId: string) {
  const prefix = 'private-conversation-';
  if (!channelName.startsWith(prefix)) {
    return false;
  }

  const ids = channelName.slice(prefix.length).split('-');
  return ids.includes(userId);
}

export function getOrderIdFromChannel(channelName: string) {
  const prefix = 'private-order-';
  if (!channelName.startsWith(prefix)) {
    return null;
  }

  return channelName.slice(prefix.length) || null;
}
