import nodemailer from 'nodemailer';
import { businessProfile } from '@/config/business-profile';

/**
 * E-Mail-Versand über das eigene Postfach (SMTP). Kein externer Dienst, keine
 * zusätzliche Anmeldung - es werden nur die Zugangsdaten des bestehenden
 * info@cssberlin.de Postfachs verwendet, die als Umgebungsvariablen gesetzt
 * werden müssen:
 *
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD   (SMTP_SECURE optional)
 *
 * Solange die nicht gesetzt sind, meldet isMailConfigured() ehrlich false und
 * der Aufrufer sagt dem Nutzer, dass der Versand gerade nicht möglich ist -
 * statt eine Mail zu versprechen, die nie ankommt.
 */
export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD,
  );
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 spricht direkt TLS, 587 startet mit STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!isMailConfigured()) return false;
  try {
    await transport().sendMail({
      from: `${businessProfile.businessName} <${process.env.SMTP_FROM || businessProfile.publicEmail}>`,
      ...options,
    });
    return true;
  } catch (error) {
    console.error('sendMail failed:', error);
    return false;
  }
}
