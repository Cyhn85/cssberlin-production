/**
 * Shared UI label and formatting helpers.
 */

export const conditionToLabel: Record<string, string> = {
  NEW_WITH_TAGS: 'Neu mit Etikett',
  NEW_WITHOUT_TAGS: 'Neu',
  VERY_GOOD: 'Sehr gut',
  GOOD: 'Gut',
  ACCEPTABLE: 'Akzeptabel',
};

export const labelToCondition: Record<string, string> = Object.fromEntries(
  Object.entries(conditionToLabel).map(([key, value]) => [value, key])
);

export function getConditionLabel(condition: string): string {
  return conditionToLabel[condition] || condition;
}

export function getConditionEnum(label: string): string {
  return labelToCondition[label] || label;
}

export const productStatusToLabel: Record<string, string> = {
  DRAFT: 'Entwurf',
  ACTIVE: 'Aktiv',
  HIDDEN: 'Nicht gelistet',
  RESERVED: 'Reserviert',
  SOLD: 'Verkauft',
};

export const orderStatusToLabel: Record<string, string> = {
  PENDING_PAYMENT: 'Ausstehende Zahlung',
  PENDING_PICKUP: 'Abholung vereinbart',
  PAID: 'Bezahlt',
  SHIPPED: 'Versendet',
  DELIVERED: 'Zugestellt',
  COMPLETED: 'Abgeschlossen',
  DISPUTED: 'Streitfall',
  CANCELLED: 'Storniert',
  REFUNDED: 'Erstattet',
};

export const offerStatusToLabel: Record<string, string> = {
  PENDING: 'Ausstehend',
  ACCEPTED: 'Angenommen',
  REJECTED: 'Abgelehnt',
  COUNTERED: 'Gegenangebot beendet',
  EXPIRED: 'Abgelaufen',
};

export type OrderTimelineStep = {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  active: boolean;
};

const ORDER_TIMELINE_BLUEPRINT = [
  {
    key: 'payment',
    label: 'Zahlung bestätigt',
    description: 'Die Bestellung ist erfolgreich eingegangen und für beide Seiten sichtbar.',
  },
  {
    key: 'shipment',
    label: 'Versand durch Verkäufer',
    description: 'Der Verkäufer hinterlegt Versanddienst und Tracking.',
  },
  {
    key: 'delivery',
    label: 'Lieferung beim Käufer',
    description: 'Die Sendung ist angekommen oder wird vom Käufer bestätigt.',
  },
  {
    key: 'completion',
    label: 'Bestellung abgeschlossen',
    description: 'Die Transaktion ist beendet und der Artikel wechselt endgültig in den Bestand des Käufers.',
  },
] as const;

function getTimelineState(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return { completedCount: 0, activeIndex: 0 };
    case 'PAID':
      return { completedCount: 1, activeIndex: 1 };
    case 'SHIPPED':
      return { completedCount: 2, activeIndex: 2 };
    case 'DELIVERED':
      return { completedCount: 3, activeIndex: 3 };
    case 'COMPLETED':
      return { completedCount: 4, activeIndex: -1 };
    case 'DISPUTED':
      return { completedCount: 2, activeIndex: -1 };
    case 'CANCELLED':
    case 'REFUNDED':
      return { completedCount: 1, activeIndex: -1 };
    default:
      return { completedCount: 0, activeIndex: -1 };
  }
}

const PICKUP_TIMELINE_BLUEPRINT = [
  { key: 'payment', label: 'Abholung angefragt', description: 'Der Artikel ist für den Käufer reserviert. Ort und Zeit werden im Chat vereinbart.' },
  { key: 'delivery', label: 'Übergabe & Barzahlung', description: 'Käufer prüft den Artikel vor Ort und zahlt bar.' },
  { key: 'completion', label: 'Kauf abgeschlossen', description: 'Der Verkäufer hat die Übergabe bestätigt.' },
] as const;

function getPickupState(status: string) {
  switch (status) {
    case 'PENDING_PICKUP':
      return { completedCount: 1, activeIndex: 1 };
    case 'COMPLETED':
      return { completedCount: 3, activeIndex: -1 };
    case 'CANCELLED':
    case 'REFUNDED':
      return { completedCount: 1, activeIndex: -1 };
    default:
      return { completedCount: 0, activeIndex: 0 };
  }
}

export function getOrderTimeline(status: string, pickup = false): OrderTimelineStep[] {
  if (pickup) {
    const st = getPickupState(status);
    return PICKUP_TIMELINE_BLUEPRINT.map((step, index) => ({
      ...step,
      completed: index < st.completedCount,
      active: index === st.activeIndex,
    })) as unknown as OrderTimelineStep[];
  }
  const state = getTimelineState(status);

  return ORDER_TIMELINE_BLUEPRINT.map((step, index) => ({
    ...step,
    completed: index < state.completedCount,
    active: index === state.activeIndex,
  }));
}

export function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export function formatPrice(price: number): string {
  return price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const value = new Date(date);
  const diffMs = now.getTime() - value.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHr < 24) return `vor ${diffHr} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
  return value.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}