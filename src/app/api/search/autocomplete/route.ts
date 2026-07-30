import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { respondWithPublicApiFallback } from '@/lib/api-error';

/**
 * GET /api/search/autocomplete?q=... - Search autocomplete suggestions
 * Returns top 5 product title matches + top 3 category matches
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return ApiResponse.success({ products: [], categories: [] });
    }

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          title: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          price: true,
          images: { take: 1, select: { url: true }, orderBy: { orderIndex: 'asc' } },
        },
        take: 5,
        orderBy: { likes: 'desc' },
      }),
      prisma.category.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          emoji: true,
          _count: { select: { products: true } },
        },
        take: 3,
      }),
    ]);

    return ApiResponse.success({ products, categories });
  } catch (error) {
    return respondWithPublicApiFallback('GET /api/search/autocomplete error', error, {
      products: [],
      categories: [],
    });
  }
}
