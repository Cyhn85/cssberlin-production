import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { isMailConfigured, sendMail } from '@/lib/mailer';
import { businessProfile } from '@/config/business-profile';

export const runtime = 'nodejs';

const TOKEN_TTL_MINUTES = 60;

/**
 * POST /api/auth/forgot-password  { email }
 *
 * Schickt einen Zuruecksetzen-Link. Zwei Dinge sind bewusst so gebaut:
 *
 *  - Die Antwort ist immer dieselbe, egal ob die Adresse existiert. Sonst
 *    koennte man ueber dieses Formular herausfinden, wer hier ein Konto hat.
 *  - In der Datenbank liegt nur der SHA-256-Hash des Tokens. Das Klartext-Token
 *    steht ausschliesslich in der Mail.
 *
 * Ist kein SMTP eingerichtet, wird das offen gesagt - lieber eine ehrliche
 * Fehlermeldung als ein Link, der nie ankommt.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(getClientIP(request), 'AUTH');
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Zu viele Versuche. Bitte spaeter erneut versuchen.' },
        { status: 429 },
      );
    }

    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: `Der Versand von E-Mails ist derzeit nicht eingerichtet. Bitte wende dich an ${businessProfile.publicEmail}.`,
        },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const genericAnswer = NextResponse.json({
      success: true,
      message: 'Wenn ein Konto zu dieser Adresse existiert, ist die E-Mail unterwegs.',
    });
    if (!email || !email.includes('@')) return genericAnswer;

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return genericAnswer;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Aeltere offene Anfragen entwerten, damit immer nur ein Link gueltig ist.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
      },
    });

    const link = `${businessProfile.websiteUrl}/passwort-zuruecksetzen?token=${token}`;
    await sendMail({
      to: email,
      subject: 'Passwort zuruecksetzen',
      text:
        `Du hast ein neues Passwort fuer dein Konto bei ${businessProfile.brandName} angefordert.\n\n` +
        `${link}\n\n` +
        `Der Link gilt ${TOKEN_TTL_MINUTES} Minuten. Warst du das nicht, kannst du diese ` +
        `E-Mail einfach ignorieren - dein Passwort bleibt unveraendert.`,
    });

    return genericAnswer;
  } catch (error) {
    console.error('POST /api/auth/forgot-password error:', error);
    return NextResponse.json(
      { success: false, error: 'Anfrage konnte nicht verarbeitet werden.' },
      { status: 500 },
    );
  }
}
