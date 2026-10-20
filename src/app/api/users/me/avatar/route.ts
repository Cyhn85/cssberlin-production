import { NextRequest } from 'next/server';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const UPLOAD_ROOT = process.env.LOCAL_UPLOAD_DIR || '/app/uploads';
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * POST /api/users/me/avatar (multipart "file") - profile picture on our own disk,
 * served by nginx under /uploads/avatars/. Re-encoded to a 256 px WebP with
 * sharp, which also strips EXIF (camera GPS coordinates must never go public).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const rl = await rateLimit(`avatar:${session.user.id}`, 'API');
    if (!rl.success) return ApiResponse.error('Zu viele Versuche.', 429);

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') return ApiResponse.validationError('Bitte wähle ein Bild aus.');
    if (!ALLOWED.has(file.type)) return ApiResponse.validationError('Erlaubt sind JPG, PNG oder WebP.');
    if (file.size > MAX_BYTES) return ApiResponse.validationError('Das Bild darf höchstens 3 MB groß sein.');

    const sharp = (await import('sharp')).default;
    const input = Buffer.from(await file.arrayBuffer());
    let output: Buffer;
    try {
      output = await sharp(input).rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
    } catch {
      return ApiResponse.validationError('Das Bild konnte nicht gelesen werden.');
    }

    const dir = path.join(UPLOAD_ROOT, 'avatars');
    await mkdir(dir, { recursive: true });
    const filename = `${session.user.id}-${Date.now()}.webp`;
    await writeFile(path.join(dir, filename), output);

    const previous = await prisma.user.findUnique({ where: { id: session.user.id }, select: { avatar: true } });
    const url = `/uploads/avatars/${filename}`;
    await prisma.user.update({ where: { id: session.user.id }, data: { avatar: url } });

    // remove the old own file (never touch Google avatars or other hosts)
    if (previous?.avatar?.startsWith('/uploads/avatars/')) {
      await rm(path.join(dir, path.basename(previous.avatar)), { force: true }).catch(() => undefined);
    }

    return ApiResponse.success({ avatar: url });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/users/me/avatar error:', error);
    return ApiResponse.serverError();
  }
}
