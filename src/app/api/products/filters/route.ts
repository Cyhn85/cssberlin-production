import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { respondWithPublicApiFallback } from '@/lib/api-error';

/**
 * GET /api/products/filters - Dynamic filter options from the current catalog
 */
export async function GET() {
  try {
    const [brands, sizes, categories] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'ACTIVE', brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
        take: 50,
      }),
      prisma.product.findMany({
        where: { status: 'ACTIVE', size: { not: null } },
        select: { size: true },
        distinct: ['size'],
        take: 40,
      }),
      prisma.category.findMany({
        where: { parentId: null },
        select: {
          id: true,
          name: true,
          emoji: true,
          _count: { select: { products: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return ApiResponse.success({
      brands: brands.map((entry) => entry.brand).filter(Boolean),
      sizes: sizes.map((entry) => entry.size).filter(Boolean),
      categories,
    });
  } catch (error) {
    return respondWithPublicApiFallback('GET /api/products/filters error', error, {
      brands: [],
      sizes: [],
      categories: [],
    });
  }
}
