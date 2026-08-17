import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/admin/stats - Real aggregate counts for the admin dashboard.
 */
export async function GET() {
  try {
    await requireAdmin();

    const [
      totalUsers,
      suspendedUsers,
      activeListings,
      hiddenListings,
      openDisputes,
      orderStatusCounts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isSuspended: true } }),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'HIDDEN' } }),
      prisma.order.count({ where: { status: 'DISPUTED' } }),
      prisma.order.groupBy({ by: ['status'], _count: true }),
    ]);

    return ApiResponse.success({
      totalUsers,
      suspendedUsers,
      activeListings,
      hiddenListings,
      openDisputes,
      ordersByStatus: orderStatusCounts.map((row) => ({ status: row.status, count: row._count })),
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
