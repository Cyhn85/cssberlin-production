import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';

type Params = { params: Promise<{ id: string }> };

const moderateSchema = z.object({
  action: z.enum(['HIDE', 'RESTORE']),
  reason: z.string().max(1000).optional(),
});

/**
 * POST /api/admin/products/[id]/moderate - Force-hide or restore a listing.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = moderateSchema.safeParse(body);
    if (!parsed.success) return ApiResponse.validationError('Ungueltige Eingabe.');

    if (parsed.data.action === 'HIDE' && !parsed.data.reason?.trim()) {
      return ApiResponse.validationError('Bitte gib einen Grund fuer die Entfernung an.');
    }

    const product = await prisma.product.findUnique({ where: { id }, select: { status: true } });
    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');
    if (product.status === 'SOLD' || product.status === 'RESERVED') {
      return ApiResponse.error('Verkaufte oder reservierte Artikel koennen nicht moderiert werden.', 409);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        status: parsed.data.action === 'HIDE' ? 'HIDDEN' : 'ACTIVE',
        moderationReason: parsed.data.action === 'HIDE' ? parsed.data.reason : null,
        moderatedAt: new Date(),
      },
      select: { id: true, status: true, moderationReason: true, moderatedAt: true },
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
