import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/orders — Get user's orders (as buyer and seller)
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const [purchases, sales] = await Promise.all([
      prisma.order.findMany({
        where: { buyerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          product: { include: { images: { take: 1 } } },
          seller: { select: { id: true, name: true, avatar: true } },
          review: true,
        },
      }),
      prisma.order.findMany({
        where: { sellerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          product: { include: { images: { take: 1 } } },
          buyer: { select: { id: true, name: true, avatar: true } },
          review: true,
        },
      }),
    ]);

    return ApiResponse.success({ purchases, sales });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
