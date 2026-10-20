import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { resolveDispute, OrderTransitionError } from '@/lib/order-state';

type Params = { params: Promise<{ id: string }> };

const resolveSchema = z.object({
  outcome: z.enum(['REFUNDED', 'COMPLETED']),
  note: z.string().min(5, 'Bitte kurz begründen.').max(1000),
});

/**
 * POST /api/admin/disputes/[id]/resolve - Admin closes a Käuferschutz case.
 * REFUNDED: dispute upheld - refund via Stripe when the order was paid online,
 *           item goes back on sale, both sides are notified.
 * COMPLETED: dispute rejected - order completes, item SOLD, both sides notified.
 * Before, this only wrote a label: no money moved, nobody was told and the item
 * stayed RESERVED forever.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const parsed = resolveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Ungültige Eingabe.');
    }

    const updated = await resolveDispute(id, admin.user.id, parsed.data.outcome, parsed.data.note);
    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    if (error instanceof OrderTransitionError) return ApiResponse.error(error.message, error.status);
    console.error('POST /api/admin/disputes/[id]/resolve error:', error);
    return ApiResponse.serverError();
  }
}
