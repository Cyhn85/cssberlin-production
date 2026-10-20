import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { completeOrder } from '@/lib/order-state';
import { orderErrorResponse } from '@/lib/api-order-errors';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/orders/[id]/confirm-delivery - Buyer confirms the item arrived as described.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const updated = await completeOrder(id, { id: session.user.id, role: 'BUYER' });
    return ApiResponse.success(updated);
  } catch (error: any) {
    return orderErrorResponse(error, 'POST /api/orders/[id]/confirm-delivery');
  }
}
