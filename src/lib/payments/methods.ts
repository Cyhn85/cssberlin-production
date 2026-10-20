/**
 * Zahlungsarten — eine Liste für Checkout-Seite, Checkout-API, Hilfeseite und Assistent.
 *
 * Grundregel: eine Zahlungsart ist nur dann "aktiv", wenn ihr Backend wirklich
 * konfiguriert ist. Früher legte der Checkout ohne Stripe-Schlüssel einfach eine
 * BEZAHLTE Bestellung an ("dev mode") - live hieß das: jeder konnte jeden Artikel
 * gratis "kaufen" und der Verkäufer bekam die Aufforderung zu versenden. Jetzt
 * antwortet die API für eine inaktive Zahlungsart mit 503 und legt nichts an.
 *
 * Diese Datei liest nur Umgebungsvariablen und ist daher serverseitig. Die Seite
 * bekommt den Status über GET /api/checkout/methods.
 */

export type PaymentMethodId = 'card' | 'klarna' | 'sepa_debit' | 'paypal' | 'pickup_cash';

export type PaymentMethodInfo = {
  id: PaymentMethodId;
  label: string;
  description: string;
  provider: 'stripe' | 'paypal' | 'none';
  /** Abholung: kein Versand, keine Online-Zahlung, kein Käuferschutz. */
  requiresShipping: boolean;
  buyerProtection: boolean;
  enabled: boolean;
};

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

const PAYPAL_ADAPTER_READY = false;

const DEFINITIONS: Array<Omit<PaymentMethodInfo, 'enabled'>> = [
  {
    id: 'card',
    label: 'Kredit- / Debitkarte',
    description: 'Visa, Mastercard, American Express, Apple Pay, Google Pay',
    provider: 'stripe',
    requiresShipping: true,
    buyerProtection: true,
  },
  {
    id: 'klarna',
    label: 'Klarna',
    description: 'Rechnung oder Ratenkauf über Klarna',
    provider: 'stripe',
    requiresShipping: true,
    buyerProtection: true,
  },
  {
    id: 'sepa_debit',
    label: 'SEPA-Lastschrift',
    description: 'Abbuchung vom Bankkonto (Bestätigung dauert 1–3 Werktage)',
    provider: 'stripe',
    requiresShipping: true,
    buyerProtection: true,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    description: 'Bezahlen mit deinem PayPal-Konto',
    provider: 'paypal',
    requiresShipping: true,
    buyerProtection: true,
  },
  {
    id: 'pickup_cash',
    label: 'Abholung & Barzahlung',
    description: 'Du holst den Artikel persönlich ab und zahlst bei der Übergabe',
    provider: 'none',
    requiresShipping: false,
    buyerProtection: false,
  },
];

export function listPaymentMethods(): PaymentMethodInfo[] {
  const stripe = stripeConfigured();
  const paypal = paypalConfigured();
  return DEFINITIONS.map((d) => ({
    ...d,
    // PayPal: the keys alone are not enough - the order/capture adapter is not
    // written yet, so PayPal stays off even when keys exist. Flip PAYPAL_ADAPTER_READY
    // once src/lib/payments/paypal.ts exists and has been tested in sandbox.
    enabled: d.provider === 'stripe' ? stripe : d.provider === 'paypal' ? paypal && PAYPAL_ADAPTER_READY : true,
  }));
}

export function getPaymentMethod(id: unknown): PaymentMethodInfo | null {
  if (typeof id !== 'string') return null;
  return listPaymentMethods().find((m) => m.id === id) ?? null;
}

/** Stripe-Checkout akzeptiert nur diese Typen (giropay wurde 2024 eingestellt). */
export const STRIPE_PAYMENT_METHOD_TYPES = ['card', 'klarna', 'sepa_debit'] as const;
