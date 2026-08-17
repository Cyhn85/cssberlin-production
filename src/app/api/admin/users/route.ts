import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/admin/users?q=... - Real user list/search for moderation.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const q = request.nextUrl.searchParams.get('q')?.trim();

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isVerified: true,
        phoneVerified: true,
        idVerified: true,
        isSuspended: true,
        suspendedReason: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { products: true, ordersAsBuyer: true, ordersAsSeller: true } },
      },
    });

    return ApiResponse.success(users);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
