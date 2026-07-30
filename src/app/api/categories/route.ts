import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { respondWithPublicApiFallback } from '@/lib/api-error';

/**
 * GET /api/categories - Get all categories with product counts
 * Public endpoint, no auth required
 * Returns hierarchical category tree
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        children: {
          include: {
            _count: { select: { products: { where: { status: 'ACTIVE' } } } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });

    const allCategories = await prisma.category.findMany({
      include: {
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    });

    return ApiResponse.success({
      tree: categories,
      flat: allCategories,
    });
  } catch (error) {
    return respondWithPublicApiFallback('GET /api/categories error', error, {
      tree: [],
      flat: [],
    });
  }
}
