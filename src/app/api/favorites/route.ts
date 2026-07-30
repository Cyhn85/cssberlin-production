import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/favorites — Get user's favorited products
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            images: { orderBy: { orderIndex: 'asc' }, take: 1 },
            seller: { select: { id: true, name: true, avatar: true } },
            category: { select: { name: true, emoji: true } },
          },
        },
      },
    });

    return ApiResponse.success(favorites.map((f) => f.product));
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('GET /api/favorites error:', error);
    return ApiResponse.serverError();
  }
}

/**
 * POST /api/favorites — Toggle favorite on a product
 * Body: { productId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { productId } = await request.json();

    if (!productId) return ApiResponse.error('productId ist erforderlich.');

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');

    // Toggle: check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_productId: { userId: session.user.id, productId },
      },
    });

    if (existing) {
      // Remove favorite
      await prisma.favorite.delete({
        where: {
          userId_productId: { userId: session.user.id, productId },
        },
      });
      // Decrement likes count
      await prisma.product.update({
        where: { id: productId },
        data: { likes: { decrement: 1 } },
      });
      return ApiResponse.success({ favorited: false });
    } else {
      // Add favorite
      await prisma.favorite.create({
        data: { userId: session.user.id, productId },
      });
      await prisma.product.update({
        where: { id: productId },
        data: { likes: { increment: 1 } },
      });
      return ApiResponse.success({ favorited: true });
    }
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/favorites error:', error);
    return ApiResponse.serverError();
  }
}
