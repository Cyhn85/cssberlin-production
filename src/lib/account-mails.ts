import { sendEmail, noticeEmail } from '@/lib/email';
import { businessProfile } from '@/config/business-profile';

/**
 * Account e-mails (the ones Vinted / eBay / Kleinanzeigen send to the registered
 * address). All go through sendEmail -> Resend if configured, else the shop's
 * own SMTP mailbox (info@cssberlin.de). Never throw: a mail that cannot be sent
 * must not break registration or a password change.
 */

const hello = (name?: string | null) => (name?.trim() ? `Hallo ${name.trim()},` : 'Hallo,');

export async function sendWelcomeMail(to: string, name?: string | null) {
  return sendEmail(noticeEmail({
    to,
    subject: `Willkommen bei ${businessProfile.brandName}!`,
    title: 'Willkommen bei cssberlin.de',
    intro: `${hello(name)} schön, dass du da bist. Dein Konto ist bereit.`,
    lines: [
      'Entdecke Second-Hand-Mode aus deiner Nähe, merke dir Lieblingsstücke und mach faire Preisvorschläge.',
      'Verkaufen ist für Privatpersonen kostenlos - Fotos hochladen, Preis festlegen, fertig.',
      'Tipp: Hinterlege in den Einstellungen deine PLZ, dann findest du Artikel zum Abholen in deiner Nähe.',
    ],
    ctaLabel: 'Jetzt stöbern',
    ctaPath: '/catalog',
    accent: '#2D6A4F',
  })).catch(() => false);
}

export async function sendPasswordResetMail(to: string, link: string, minutes: number) {
  return sendEmail(noticeEmail({
    to,
    subject: 'Passwort zurücksetzen',
    title: 'Neues Passwort festlegen',
    intro: `Du hast ein neues Passwort für dein Konto bei ${businessProfile.brandName} angefordert.`,
    lines: [
      `Der Link ist ${minutes} Minuten gültig und funktioniert nur einmal.`,
      'Warst du das nicht? Dann ignoriere diese E-Mail - dein Passwort bleibt unverändert.',
    ],
    ctaLabel: 'Passwort zurücksetzen',
    ctaUrl: link,
  })).catch(() => false);
}

export async function sendPasswordChangedMail(to: string, name?: string | null) {
  return sendEmail(noticeEmail({
    to,
    subject: 'Dein Passwort wurde geändert',
    title: 'Passwort geändert',
    intro: `${hello(name)} das Passwort für dein Konto wurde gerade geändert.`,
    lines: [
      `Zeitpunkt: ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} Uhr`,
      `Warst du das nicht? Setze dein Passwort sofort neu und schreib uns an ${businessProfile.publicEmail}.`,
    ],
    ctaLabel: 'Zum Login',
    ctaPath: '/login',
  })).catch(() => false);
}

export async function sendAccountStatusMail(to: string, name: string | null, suspended: boolean, reason?: string | null) {
  return sendEmail(noticeEmail({
    to,
    subject: suspended ? 'Dein Konto wurde eingeschränkt' : 'Dein Konto ist wieder aktiv',
    title: suspended ? 'Konto eingeschränkt' : 'Konto wieder aktiv',
    intro: suspended
      ? `${hello(name)} wir haben dein Konto vorübergehend gesperrt.`
      : `${hello(name)} dein Konto ist wieder freigeschaltet.`,
    lines: suspended
      ? [`Grund: ${reason || 'Verstoß gegen die Nutzungsbedingungen'}`, `Du kannst der Entscheidung widersprechen: Antworte auf diese E-Mail oder schreib an ${businessProfile.publicEmail}.`]
      : ['Du kannst wieder kaufen, verkaufen und Nachrichten schreiben.'],
    ctaLabel: suspended ? 'Kontakt aufnehmen' : 'Zu cssberlin.de',
    ctaPath: suspended ? '/kontakt' : '/',
  })).catch(() => false);
}
