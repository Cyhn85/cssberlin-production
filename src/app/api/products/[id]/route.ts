import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, getOptionalSession } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { respondWithApiError } from '@/lib/api-error';
import { updateProductSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/products/[id] - Get product detail (public)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { orderIndex: 'asc' } },
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            location: true,
            isVerified: true,
            createdAt: true,
            _count: { select: { products: true, receivedReviews: true, followers: true } },
          },
        },
        category: { select: { id: true, name: true, emoji: true, parent: { select: { name: true } } } },
        _count: { select: { favorites: true, offers: true } },
      },
    });

    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');

    prisma.product.update({
      where: { id },
      data: { views: { increment: 1 } },
    }).catch(() => {});

    const sellerRating = await prisma.review.aggregate({
      where: { targetUserId: product.sellerId },
      _avg: { rating: true },
      _count: true,
    });

    const similar = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: id },
        status: 'ACTIVE',
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { orderIndex: 'asc' }, take: 1 },
        seller: { select: { name: true } },
      },
    });

    const session = await getOptionalSession();
    let isFavorited = false;
    if (session?.user?.id) {
      const fav = await prisma.favorite.findUnique({
        where: {
          userId_productId: { userId: session.user.id, productId: id },
        },
      });
      isFavorited = !!fav;
    }

    return ApiResponse.success({
      ...product,
      sellerRating: {
        average: sellerRating._avg.rating || 0,
        count: sellerRating._count,
      },
      similar,
      isFavorited,
    });
  } catch (error) {
    return respondWithApiError('GET /api/products/[id] error', error);
  }
}

/**
 * PUT /api/products/[id] - Update product (owner only)
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');
    if (product.sellerId !== session.user.id) {
      return ApiResponse.forbidden('Nur der Eigentumer kann diesen Artikel bearbeiten.');
    }

    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungultige Daten.');
    }

    const updated = await prisma.product.update({
      where: { id },
      data: parsed.data,
      include: {
        images: { orderBy: { orderIndex: 'asc' } },
        category: true,
      },
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return respondWithApiError('PUT /api/products/[id] error', error);
  }
}

/**
 * DELETE /api/products/[id] - Soft-delete product (owner only)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');
    if (product.sellerId !== session.user.id && session.user.role !== 'ADMIN') {
      return ApiResponse.forbidden('Nur der Eigentumer kann diesen Artikel loschen.');
    }

    await prisma.product.update({
      where: { id },
      data: { status: 'HIDDEN' },
    });

    return ApiResponse.message('Artikel wurde geloscht.');
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return respondWithApiError('DELETE /api/products/[id] error', error);
  }
}

