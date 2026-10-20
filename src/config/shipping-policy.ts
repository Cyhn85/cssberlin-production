/**
 * Versandkosten-Politik — EINE Quelle für Checkout-API und Checkout-Seite.
 *
 * Warum zentral: Vorher stand die Regel an zwei Stellen (API und Seite). Sobald
 * eine geändert wird und die andere nicht, zeigt die Seite einen anderen Preis
 * als die Rechnung. Diese Datei ist die einzige Wahrheit.
 *
 * Warum es Untergrenzen gibt — mit echten Zahlen aus dem Katalog gerechnet
 * (6.496 Artikel, Versandkosten 5,99 EUR, Verpackung bereits eingerechnet):
 *
 *   0–20 EUR : 1.733 Artikel, im Schnitt −2,38 EUR  -> JEDE Bestellung Verlust
 *   20–30 EUR:   708 Artikel, im Schnitt +1,60 EUR  -> hauchdünn
 *   30–40 EUR:   379 Artikel, im Schnitt +4,59 EUR  -> tragfähig
 *   50+  EUR : 3.397 Artikel, schlechtester Fall +8,92 EUR -> sicher
 *
 * Ohne Untergrenze verschenkt "Versand frei zur ersten Bestellung" bei 27 % des
 * Katalogs Geld. Deshalb: Gratisversand erst ab einem Warenwert, der ihn trägt.
 */

/** Ab diesem Warenwert ist der Versand immer frei. Schlechtester Fall: +8,92 EUR. */
export const FREE_SHIPPING_THRESHOLD_EUR = 50;

/**
 * Erstbestellung: früher frei, aber erst ab hier. Bei 30 EUR bleibt selbst im
 * schlechtesten Fall +2,97 EUR. Darunter wäre es ein Zuschussgeschäft.
 */
export const FIRST_ORDER_FREE_SHIPPING_MIN_EUR = 30;

/** Fallback, wenn am Artikel nichts hinterlegt ist. */
export const DEFAULT_SHIPPING_FEE_EUR = 4.99;

export type ShippingReason =
  | 'threshold'      // Warenwert über der Freigrenze
  | 'first_order'    // Erstbestellung über der Mindestgrenze
  | 'promo'          // zeitlich begrenzte Aktion (SHIPPING_PROMO)
  | 'pickup'         // Selbstabholung, kein Versand
  | 'charged';       // regulärer Versand

/** Zeitlich begrenzte Gratisversand-Aktion; null = keine Aktion. Immer mit Enddatum. */
export const SHIPPING_PROMO: { until: Date; label: string } | null = null;

/** Versandarten im Checkout. PICKUP = Selbstabholung (wird so auch in Order.shippingCarrier gespeichert). */
export const SHIPPING_CARRIERS = [
  { id: 'DHL', name: 'DHL Paket', eta: '1–3 Werktage' },
  { id: 'HERMES', name: 'Hermes Päckchen', eta: '2–4 Werktage' },
  { id: 'DPD', name: 'DPD Classic', eta: '1–2 Werktage' },
  { id: 'GLS', name: 'GLS Paket', eta: '1–3 Werktage' },
] as const;

export type ShippingCarrierId = (typeof SHIPPING_CARRIERS)[number]['id'] | 'PICKUP';

export function isPickupCarrier(value: unknown): boolean {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return v === 'PICKUP' || v === 'HAND';
}

/** Normalisiert Eingaben aus Formularen; unbekannt -> null (statt stillschweigend DHL). */
export function normalizeCarrier(value: unknown): ShippingCarrierId | null {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (isPickupCarrier(v)) return 'PICKUP';
  const hit = SHIPPING_CARRIERS.find((c) => c.id === v);
  return hit ? hit.id : null;
}

export function carrierLabel(value: string | null | undefined): string {
  if (!value) return 'Versand';
  if (isPickupCarrier(value)) return 'Selbstabholung';
  return SHIPPING_CARRIERS.find((c) => c.id === value.toUpperCase())?.name ?? value;
}

export type ShippingResult = {
  fee: number;
  free: boolean;
  reason: ShippingReason;
};

/**
 * Ermittelt die Versandkosten für eine Bestellung.
 * Dieselbe Funktion muss in API und Oberfläche verwendet werden.
 */
export function resolveShippingFee(params: {
  itemPrice: number;
  productShippingCost?: number | null;
  isFirstOrder?: boolean;
  shippingMethod?: string;
}): ShippingResult {
  const { itemPrice, productShippingCost, isFirstOrder = false, shippingMethod } = params;

  if (shippingMethod && isPickupCarrier(shippingMethod)) {
    return { fee: 0, free: true, reason: 'pickup' };
  }

  // A "1-day free shipping" promo used to short-circuit everything here and was
  // never switched off, so every order shipped free while the product page
  // showed a shipping price. Promotions now need an end date (SHIPPING_PROMO).
  if (SHIPPING_PROMO && Date.now() < SHIPPING_PROMO.until.getTime()) {
    return { fee: 0, free: true, reason: 'promo' };
  }

  if (itemPrice >= FREE_SHIPPING_THRESHOLD_EUR) {
    return { fee: 0, free: true, reason: 'threshold' };
  }
  if (isFirstOrder && itemPrice >= FIRST_ORDER_FREE_SHIPPING_MIN_EUR) {
    return { fee: 0, free: true, reason: 'first_order' };
  }

  const fee = productShippingCost && productShippingCost > 0
    ? productShippingCost
    : DEFAULT_SHIPPING_FEE_EUR;
  return { fee, free: false, reason: 'charged' };
}

/** Kurzer Hinweis für die Oberfläche: wie weit ist es noch bis zum Gratisversand? */
export function amountToFreeShipping(itemPrice: number): number {
  const missing = FREE_SHIPPING_THRESHOLD_EUR - itemPrice;
  return missing > 0 ? Math.round(missing * 100) / 100 : 0;
}
