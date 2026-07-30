import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

const FINALIZED_ORDER_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

/**
 * GET /api/checkout/first-order-status — whether the current user qualifies
 * for the free-shipping-on-first-order benefit. Mirrors the same check
 * create-session/route.ts uses when it actually sets shippingFee, so the
 * checkout preview never shows a discount it won't also apply at payment.
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const priorFinalizedOrderCount = await prisma.order.count({
      where: { buyerId: session.user.id, status: { in: [...FINALIZED_ORDER_STATUSES] } },
    });

    return ApiResponse.success({ isFirstOrder: priorFinalizedOrderCount === 0 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return ApiResponse.success({ isFirstOrder: false });
    }
    return ApiResponse.serverError();
  }
}
