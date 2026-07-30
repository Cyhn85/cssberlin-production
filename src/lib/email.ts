/**
 * Email Service for cssberlin.de
 *
 * Uses Resend (free: 100 emails/day, 3000/month)
 * Gracefully degrades when not configured.
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cssberlin.de';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'cssberlin.de <noreply@cssberlin.de>';

function resolveUrl(path: string) {
  return `${APP_URL}${path}`;
}

function getTrackingUrl(carrier: string, trackingCode: string) {
  const normalizedCarrier = carrier.trim().toUpperCase();

  switch (normalizedCarrier) {
    case 'DHL':
      return `https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${encodeURIComponent(trackingCode)}`;
    case 'HERMES':
      return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation/#${encodeURIComponent(trackingCode)}`;
    case 'DPD':
      return `https://tracking.dpd.de/status/de_DE/parcel/${encodeURIComponent(trackingCode)}`;
    case 'GLS':
      return `https://gls-group.com/DE/de/sendungsverfolgung?match=${encodeURIComponent(trackingCode)}`;
    default:
      return null;
  }
}

function renderEmailLayout(options: {
  title: string;
  intro: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  accent?: string;
  footer?: string;
}) {
  const accent = options.accent || '#E8651A';
  const footer =
    options.footer ||
    'Du erhaeltst diese Nachricht, weil es eine neue Aktivitaet zu deinem cssberlin.de Konto gibt.';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #9ca3af;">cssberlin.de</p>
        <h1 style="margin: 0; font-size: 28px; line-height: 1.2; color: #111827;">${options.title}</h1>
      </div>
      <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.7; color: #4b5563;">${options.intro}</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 20px; padding: 20px; line-height: 1.7; color: #374151;">
        ${options.body}
      </div>
      ${
        options.ctaLabel && options.ctaUrl
          ? `<div style="margin-top: 24px; text-align: center;"><a href="${options.ctaUrl}" style="display: inline-block; background: ${accent}; color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 999px; font-weight: 700;">${options.ctaLabel}</a></div>`
          : ''
      }
      <p style="margin-top: 28px; font-size: 12px; line-height: 1.6; color: #9ca3af;">${footer}</p>
    </div>
  `;
}

/**
 * Send an email via Resend.
 * Returns true if sent, false if failed or not configured.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Email not sent - RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: options.to,
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
}

export function welcomeEmail(name: string): EmailOptions {
  return {
    to: '',
    subject: `Willkommen bei cssberlin.de, ${name}!`,
    html: renderEmailLayout({
      title: 'Willkommen bei cssberlin.de',
      intro: `Hallo ${name}, schoen, dass du da bist. Gemeinsam machen wir Second-Hand einfacher und nachhaltiger.`,
      body: `
        <p style="margin: 0;">Dein Konto ist bereit. Du kannst jetzt Artikel entdecken, handeln, verkaufen und spaeter auch die AI-Helfer fuer Commerce-Aufgaben nutzen.</p>
      `,
      ctaLabel: 'Katalog entdecken',
      ctaUrl: resolveUrl('/catalog'),
      accent: '#2D6A4F',
      footer: 'Du erhaeltst diese E-Mail, weil du dich bei cssberlin.de registriert hast.',
    }),
  };
}

export function offerReceivedEmail(
  sellerName: string,
  buyerName: string,
  productTitle: string,
  offeredPrice: number,
  productUrl: string
): EmailOptions {
  return {
    to: '',
    subject: `Neues Angebot fuer "${productTitle}"`,
    html: renderEmailLayout({
      title: 'Neues Angebot eingegangen',
      intro: `Hallo ${sellerName}, ${buyerName} hat dir ein Angebot geschickt.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Artikel:</strong> ${productTitle}</p>
        <p style="margin: 0 0 12px;"><strong>Angebot:</strong> ${offeredPrice.toFixed(2)} &euro;</p>
        <p style="margin: 0;">Du kannst direkt auf cssberlin.de antworten und die Verhandlung in deiner Inbox oder in der Angebotsuebersicht weiterfuehren.</p>
      `,
      ctaLabel: 'Angebot ansehen',
      ctaUrl: productUrl,
    }),
  };
}

export function orderConfirmedEmail(
  buyerName: string,
  productTitle: string,
  totalAmount: number,
  orderId: string
): EmailOptions {
  return {
    to: '',
    subject: `Bestellung bestaetigt - ${productTitle}`,
    html: renderEmailLayout({
      title: 'Deine Bestellung ist bestaetigt',
      intro: `Hallo ${buyerName}, deine Zahlung war erfolgreich.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Artikel:</strong> ${productTitle}</p>
        <p style="margin: 0 0 12px;"><strong>Gesamtbetrag:</strong> ${totalAmount.toFixed(2)} &euro;</p>
        <p style="margin: 0;"><strong>Bestellnummer:</strong> ${orderId}</p>
      `,
      ctaLabel: 'Bestellung verfolgen',
      ctaUrl: resolveUrl(`/purchases/${orderId}`),
      accent: '#2D6A4F',
    }),
  };
}

export function newSaleSellerEmail(
  sellerName: string,
  buyerName: string,
  productTitle: string,
  totalAmount: number,
  orderId: string
): EmailOptions {
  return {
    to: '',
    subject: `Neuer Verkauf - ${productTitle}`,
    html: renderEmailLayout({
      title: 'Ein Artikel wurde gekauft',
      intro: `Hallo ${sellerName}, ${buyerName} hat gerade einen deiner Artikel gekauft.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Artikel:</strong> ${productTitle}</p>
        <p style="margin: 0 0 12px;"><strong>Bestellwert:</strong> ${totalAmount.toFixed(2)} &euro;</p>
        <p style="margin: 0;">Bitte hinterlege den Versanddienst und optional die Trackingnummer, damit der Kaeufer den Status sofort sehen kann.</p>
      `,
      ctaLabel: 'Verkauf oeffnen',
      ctaUrl: resolveUrl(`/sales/${orderId}`),
    }),
  };
}

export function shippingUpdateEmail(
  buyerName: string,
  productTitle: string,
  orderId: string,
  trackingCode: string | null,
  carrier: string
): EmailOptions {
  const trackingUrl = trackingCode ? getTrackingUrl(carrier, trackingCode) : null;
  const hasTracking = Boolean(trackingCode);

  return {
    to: '',
    subject: `Dein Paket ist unterwegs - ${productTitle}`,
    html: renderEmailLayout({
      title: 'Versandupdate fuer deine Bestellung',
      intro: `Hallo ${buyerName}, dein Artikel "${productTitle}" wurde als versendet markiert.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Versanddienst:</strong> ${carrier}</p>
        <p style="margin: 0 0 12px;"><strong>Tracking:</strong> ${trackingCode || 'Wird separat nachgereicht'}</p>
        <p style="margin: 0;">Du findest alle weiteren Schritte direkt in deiner Bestellansicht.</p>
      `,
      ctaLabel: hasTracking && trackingUrl ? 'Sendung verfolgen' : 'Bestellung ansehen',
      ctaUrl: hasTracking && trackingUrl ? trackingUrl : resolveUrl(`/purchases/${orderId}`),
    }),
  };
}

export function orderCompletedSellerEmail(
  sellerName: string,
  buyerName: string,
  productTitle: string,
  orderId: string
): EmailOptions {
  return {
    to: '',
    subject: `Bestellung abgeschlossen - ${productTitle}`,
    html: renderEmailLayout({
      title: 'Die Bestellung ist abgeschlossen',
      intro: `Hallo ${sellerName}, ${buyerName} hat den Erhalt bestaetigt.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Artikel:</strong> ${productTitle}</p>
        <p style="margin: 0;">Die Transaktion ist jetzt abgeschlossen. Alle Timeline-Details bleiben in deiner Verkaufsansicht dokumentiert.</p>
      `,
      ctaLabel: 'Verkauf ansehen',
      ctaUrl: resolveUrl(`/sales/${orderId}`),
      accent: '#2D6A4F',
    }),
  };
}

export function disputeOpenedSellerEmail(
  sellerName: string,
  buyerName: string,
  productTitle: string,
  orderId: string,
  reason: string
): EmailOptions {
  return {
    to: '',
    subject: `Streitfall fuer ${productTitle}`,
    html: renderEmailLayout({
      title: 'Ein Streitfall wurde eroeffnet',
      intro: `Hallo ${sellerName}, ${buyerName} hat fuer diese Bestellung einen Kaeuferschutz-Fall gemeldet.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Artikel:</strong> ${productTitle}</p>
        <p style="margin: 0 0 12px;"><strong>Bestellung:</strong> ${orderId}</p>
        <p style="margin: 0;"><strong>Grund:</strong> ${reason}</p>
      `,
      ctaLabel: 'Bestellung pruefen',
      ctaUrl: resolveUrl(`/sales/${orderId}`),
      accent: '#B45309',
    }),
  };
}
