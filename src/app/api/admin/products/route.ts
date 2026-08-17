import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/admin/products?q=... - Real listing search/list for moderation.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const q = request.nextUrl.searchParams.get('q')?.trim();

    const products = await prisma.product.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { brand: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        moderationReason: true,
        moderatedAt: true,
        views: true,
        likes: true,
        createdAt: true,
        images: { take: 1, orderBy: { orderIndex: 'asc' }, select: { url: true } },
        seller: { select: { id: true, name: true, email: true } },
        category: { select: { name: true } },
      },
    });

    return ApiResponse.success(products);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
