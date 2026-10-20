import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { getOptionalSession } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { sendMail, isMailConfigured } from '@/lib/mailer';
import { businessProfile } from '@/config/business-profile';

const TOPICS = ['allgemein', 'bestellung', 'konto', 'melden', 'presse'] as const;

const schema = z.object({
  topic: z.enum(TOPICS),
  name: z.string().trim().min(2, 'Bitte gib deinen Namen an.').max(80),
  email: z.string().trim().email('Bitte gib eine gültige E-Mail-Adresse an.').max(120),
  subject: z.string().trim().min(3, 'Bitte gib einen Betreff an.').max(120),
  message: z.string().trim().min(10, 'Bitte beschreibe dein Anliegen (mindestens 10 Zeichen).').max(4000),
  url: z.string().trim().max(500).optional(),
  // honeypot: real people never fill this hidden field
  website: z.string().max(0).optional(),
});

/**
 * POST /api/contact - contact form and DSA notice ("melden").
 * Saved to ContactRequest first (so nothing is lost while SMTP is not set),
 * then mailed to the shop inbox if mail is configured. 5 per hour per IP.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(`contact:${getClientIP(request)}`, 'AUTH');
    if (!rl.success) return ApiResponse.error('Zu viele Anfragen. Bitte versuche es in einer Minute erneut.', 429);

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Bitte prüfe deine Eingaben.');
    const d = parsed.data;
    if (d.topic === 'melden' && !d.url) return ApiResponse.validationError('Bitte gib den Link zum gemeldeten Inhalt an.');

    const session = await getOptionalSession().catch(() => null);
    const saved = await prisma.contactRequest.create({
      data: { topic: d.topic, name: d.name, email: d.email.toLowerCase(), subject: d.subject, message: d.message, url: d.url || null, userId: session?.user?.id ?? null },
    });
    const ticket = saved.id.slice(-8).toUpperCase();

    if (isMailConfigured()) {
      await sendMail({
        to: businessProfile.publicEmail,
        subject: `[Kontakt #${ticket}] ${d.topic === 'melden' ? 'MELDUNG: ' : ''}${d.subject}`,
        text: `Thema: ${d.topic}\nVon: ${d.name} <${d.email}>${session?.user?.id ? ` (Nutzer ${session.user.id})` : ''}\n${d.url ? `Link: ${d.url}\n` : ''}\n${d.message}`,
      });
      await sendMail({
        to: d.email,
        subject: `Wir haben deine Nachricht erhalten (#${ticket})`,
        text: `Hallo ${d.name},\n\ndanke für deine Nachricht an cssberlin.de. Wir melden uns in der Regel innerhalb von 24 Stunden.\n\nDeine Vorgangsnummer: ${ticket}\nBetreff: ${d.subject}\n\nViele Grüße\ncssberlin.de`,
      });
    }

    return ApiResponse.created({ ticket });
  } catch (error) {
    console.error('POST /api/contact error:', error);
    return ApiResponse.serverError();
  }
}
