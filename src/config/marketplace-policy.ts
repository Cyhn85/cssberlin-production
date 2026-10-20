/**
 * Marktplatz-Regeln — EINE Quelle für Code, Hilfeseiten und den KI-Assistenten.
 *
 * Vorher standen Fristen und Gebühren verstreut als Zahlen im Code (5 % + 0,99 €
 * an drei Stellen, 60 % Mindestangebot in API und Modal, 30 Minuten Reservierung).
 * Sobald eine Stelle geändert wird, sagt die Hilfeseite etwas anderes als die
 * Rechnung. Alles, was ein Nutzer als Regel lesen kann, kommt von hier.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const buyerProtection = {
  rate: 0.05,
  fixedEur: 0.99,
  /** Käuferschutz gilt nur bei Online-Zahlung mit Versand über die Plattform. */
  appliesToPickup: false,
} as const;

export function protectionFeeFor(itemPrice: number): number {
  return Math.round((itemPrice * buyerProtection.rate + buyerProtection.fixedEur) * 100) / 100;
}

export const checkoutPolicy = {
  /** Stripe-Minimum für expires_at; Zahlungsseite und Reservierung enden gleichzeitig. */
  reservationMinutes: 30,
} as const;

export const pickupPolicy = {
  /** So lange bleibt ein Artikel nach einer Abholanfrage für den Käufer reserviert. */
  holdHours: 48,
} as const;

export const offerPolicy = {
  /** Mindestangebot in Prozent des Listenpreises. */
  minPercent: 60,
  /** Antwortfrist für ein offenes Angebot. */
  answerHours: 48,
  /** Nach Annahme: so lange ist der Artikel zum vereinbarten Preis für den Käufer reserviert. */
  paymentHours: 24,
  /** Eröffnungsangebot + Gegenangebote zusammen. */
  maxRounds: 4,
  /** Schnellauswahl im Angebotsfenster (Prozent Rabatt). */
  quickDiscounts: [10, 15, 20],
} as const;

export const shippingDeadlines = {
  /** Erinnerungen an den Verkäufer nach Zahlungseingang. */
  remindAfterHours: [24, 72],
  /** Nicht versendet nach dieser Zeit -> automatische Stornierung + Erstattung. */
  autoCancelAfterDays: 5,
} as const;

/**
 * Stornierung — angelehnt an eBay (Käufer kann kurz nach dem Kauf stornieren,
 * danach nur auf Anfrage beim Verkäufer) und Vinted (nicht versendet innerhalb
 * der Frist -> automatische Stornierung mit Erstattung). Nach dem Versand gibt
 * es keine Stornierung mehr, sondern "Problem melden" (Käuferschutz).
 */
export const cancellationPolicy = {
  /** Käufer storniert sofort und ohne Begründungspflicht, solange nicht versendet. */
  buyerFreeCancelMinutes: 60,
  /** Danach: Stornierungsanfrage; der Verkäufer hat so lange Zeit zu antworten. */
  requestAnswerHours: 48,
  buyerReasons: [
    { id: 'changed_mind', label: 'Ich habe es mir anders überlegt' },
    { id: 'wrong_item', label: 'Falscher Artikel / falsche Größe bestellt' },
    { id: 'found_cheaper', label: 'Woanders günstiger gefunden' },
    { id: 'shipping_too_slow', label: 'Versand dauert zu lange' },
    { id: 'other', label: 'Anderer Grund' },
  ],
  sellerReasons: [
    { id: 'sold_elsewhere', label: 'Artikel bereits anderweitig verkauft', countsAgainstSeller: true },
    { id: 'damaged', label: 'Artikel beschädigt / Mangel entdeckt', countsAgainstSeller: true },
    { id: 'buyer_asked', label: 'Käufer hat um Stornierung gebeten', countsAgainstSeller: false },
    { id: 'no_pickup', label: 'Käufer ist nicht zur Abholung erschienen', countsAgainstSeller: false },
    { id: 'other', label: 'Anderer Grund', countsAgainstSeller: true },
  ],
} as const;

export const completionPolicy = {
  /** Kein Problem gemeldet: Abschluss so viele Tage nach Versand … */
  autoCompleteAfterShippedDays: 7,
  /** … bzw. so viele Tage nach Zustellung (wenn Zustellung bekannt ist). */
  autoCompleteAfterDeliveredDays: 2,
  /** Ein Problem kann bis zum automatischen Abschluss gemeldet werden. */
  reviewWindowDays: 30,
} as const;

export const ms = { HOUR, DAY } as const;

/** Lesbare Fassung für Hilfeseiten und den Assistenten. */
export const policyFacts = {
  buyerProtection: `${Math.round(buyerProtection.rate * 100)} % des Artikelpreises + ${buyerProtection.fixedEur.toFixed(2).replace('.', ',')} €`,
  reservation: `${checkoutPolicy.reservationMinutes} Minuten`,
  pickupHold: `${pickupPolicy.holdHours} Stunden`,
  offerMin: `${offerPolicy.minPercent} % des Preises`,
  offerAnswer: `${offerPolicy.answerHours} Stunden`,
  offerPayment: `${offerPolicy.paymentHours} Stunden`,
  offerRounds: `${offerPolicy.maxRounds - 1} Gegenangebote`,
  buyerFreeCancel: `${cancellationPolicy.buyerFreeCancelMinutes} Minuten`,
  cancelRequestAnswer: `${cancellationPolicy.requestAnswerHours} Stunden`,
  shipWithin: `${shippingDeadlines.autoCancelAfterDays} Tagen`,
  autoComplete: `${completionPolicy.autoCompleteAfterShippedDays} Tage nach Versand (bzw. ${completionPolicy.autoCompleteAfterDeliveredDays} Tage nach Zustellung)`,
} as const;
