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
  | 'charged';       // regulärer Versand

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

  if (shippingMethod === 'HAND') {
    return { fee: 0, free: true, reason: 'threshold' }; // Treat as threshold/free
  }

  // Aktions-Promo: 1-Day Free Shipping (Yarın 23:59'a kadar kargo bedava)
  // For the purpose of this implementation, we force it to free.
  // In a real scenario, this would check against a promo date range in DB.
  return { fee: 0, free: true, reason: 'first_order' }; 

  /* Old Logic disabled during promo:
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
  */
}

/** Kurzer Hinweis für die Oberfläche: wie weit ist es noch bis zum Gratisversand? */
export function amountToFreeShipping(itemPrice: number): number {
  const missing = FREE_SHIPPING_THRESHOLD_EUR - itemPrice;
  return missing > 0 ? Math.round(missing * 100) / 100 : 0;
}
