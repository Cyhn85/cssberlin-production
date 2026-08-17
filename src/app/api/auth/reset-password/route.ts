import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/auth/reset-password  { token, password }
 *
 * Setzt das neue Passwort. Das Token wird gehasht nachgeschlagen, muss unbenutzt
 * und noch gueltig sein, und wird direkt danach als verbraucht markiert - ein
 * Link funktioniert also genau einmal.
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

    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    const password = String(body?.password || '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Link ist unvollstaendig.' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.` },
        { status: 400 },
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Dieser Link ist abgelaufen oder wurde bereits verwendet.' },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ success: true, message: 'Passwort geaendert. Du kannst dich jetzt anmelden.' });
  } catch (error) {
    console.error('POST /api/auth/reset-password error:', error);
    return NextResponse.json(
      { success: false, error: 'Passwort konnte nicht geaendert werden.' },
      { status: 500 },
    );
  }
}
