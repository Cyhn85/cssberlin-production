import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { openDispute } from '@/lib/order-state';
import { orderErrorResponse } from '@/lib/api-order-errors';

type Params = { params: Promise<{ id: string }> };

const disputeSchema = z.object({
  reason: z
    .string()
    .min(10, 'Bitte beschreibe den Grund genauer (mindestens 10 Zeichen).')
    .max(1000, 'Beschreibung darf maximal 1000 Zeichen lang sein.'),
});

/**
 * POST /api/orders/[id]/dispute - Buyer reports a problem (Käuferschutz).
 *
 * Possible while the order is SHIPPED/DELIVERED, i.e. until it completes -
 * either by the buyer's confirmation or automatically (completionPolicy).
 * The window used to be "2 days since updatedAt", so any later edit to the
 * order silently reset or shortened it.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const parsed = disputeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Bitte gib einen gültigen Grund an.');
    }
    const updated = await openDispute(id, session.user.id, parsed.data.reason);
    return ApiResponse.success(updated);
  } catch (error: any) {
    return orderErrorResponse(error, 'POST /api/orders/[id]/dispute');
  }
}
