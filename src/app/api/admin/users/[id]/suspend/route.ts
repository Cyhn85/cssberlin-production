import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';

type Params = { params: Promise<{ id: string }> };

const suspendSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().max(1000).optional(),
});

/**
 * POST /api/admin/users/[id]/suspend - Suspend or reinstate a user account.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = suspendSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungueltige Eingabe.');
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return ApiResponse.notFound('Nutzer nicht gefunden.');
    if (target.role === 'ADMIN') {
      return ApiResponse.forbidden('Admin-Konten koennen hier nicht gesperrt werden.');
    }

    if (parsed.data.suspend && !parsed.data.reason?.trim()) {
      return ApiResponse.validationError('Bitte gib einen Grund fuer die Sperre an.');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isSuspended: parsed.data.suspend,
        suspendedReason: parsed.data.suspend ? parsed.data.reason : null,
        suspendedAt: parsed.data.suspend ? new Date() : null,
      },
      select: { id: true, isSuspended: true, suspendedReason: true, suspendedAt: true },
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
