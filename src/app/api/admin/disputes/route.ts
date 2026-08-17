import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/admin/disputes - Real, open Käuferschutz cases (Order.status = DISPUTED).
 */
export async function GET() {
  try {
    await requireAdmin();

    const disputes = await prisma.order.findMany({
      where: { status: 'DISPUTED' },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        disputeReason: true,
        itemPrice: true,
        shippingFee: true,
        protectionFee: true,
        totalAmount: true,
        trackingCode: true,
        shippingCarrier: true,
        createdAt: true,
        updatedAt: true,
        product: { select: { id: true, title: true, images: { take: 1, orderBy: { orderIndex: 'asc' }, select: { url: true } } } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    return ApiResponse.success(disputes);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
