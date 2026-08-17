import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';

type Params = { params: Promise<{ id: string }> };

const resolveSchema = z.object({
  outcome: z.enum(['REFUNDED', 'COMPLETED']),
  note: z.string().min(5, 'Bitte kurz begruenden.').max(1000),
});

/**
 * POST /api/admin/disputes/[id]/resolve - Admin closes a Käuferschutz case.
 * REFUNDED: dispute upheld, order marked refunded (real refund still has to be
 * executed via Stripe/manual transfer once live payments are active).
 * COMPLETED: dispute rejected, order proceeds as a normal completed sale.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Ungueltige Eingabe.');
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return ApiResponse.notFound('Bestellung nicht gefunden.');
    if (order.status !== 'DISPUTED') {
      return ApiResponse.error('Diese Bestellung hat aktuell keinen offenen Kaeuferschutz-Fall.', 409);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: parsed.data.outcome,
        disputeResolution: parsed.data.outcome,
        disputeResolutionNote: parsed.data.note,
        disputeResolvedAt: new Date(),
      },
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
