import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/feed — Personalized product feed for logged-in user
 * Algorithm:
 * 1. Products from followed sellers (highest priority)
 * 2. Products in favorited categories
 * 3. Trending products (high views/likes ratio)
 * 4. Recent products (fallback)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const cursor = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 50);

    // Get user's followed sellers and favorite categories
    const [following, favoriteProducts] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { followedId: true },
      }),
      prisma.favorite.findMany({
        where: { userId },
        include: { product: { select: { categoryId: true } } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const followedIds = following.map((f) => f.followedId);
    const favCategoryIds = [...new Set(favoriteProducts.map((f) => f.product.categoryId))];

    // Build feed query with weighted ordering
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        sellerId: { not: userId }, // Don't show own products
      },
      include: {
        images: { take: 1, orderBy: { orderIndex: 'asc' }, select: { url: true } },
        seller: { select: { id: true, name: true, avatar: true, username: true } },
        category: { select: { id: true, name: true, emoji: true } },
        _count: { select: { favorites: true, offers: true } },
      },
      orderBy: [
        { likes: 'desc' },
        { views: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit * 3, // Fetch extra for re-ranking
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // Re-rank: boost followed sellers and favorite categories
    const scored = products.map((product) => {
      let score = 0;

      // Followed seller boost (+50)
      if (followedIds.includes(product.sellerId)) score += 50;

      // Favorite category boost (+30)
      if (favCategoryIds.includes(product.categoryId)) score += 30;

      // Trending boost (engagement ratio)
      const engagement = (product.likes + product._count.favorites * 2 + product._count.offers * 5);
      const age = Math.max(1, (Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60)); // hours
      score += Math.min(engagement / age * 10, 20);

      // Freshness bonus (last 24h)
      if (Date.now() - product.createdAt.getTime() < 24 * 60 * 60 * 1000) {
        score += 10;
      }

      return { ...product, _feedScore: score };
    });

    // Sort by feed score and take limit
    scored.sort((a, b) => b._feedScore - a._feedScore);
    const feedItems = scored.slice(0, limit);

    const hasMore = products.length >= limit;
    const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1].id : null;

    // Clean up internal scores before returning
    const cleanItems = feedItems.map(({ _feedScore, ...item }) => item);

    return ApiResponse.success({
      products: cleanItems,
      nextCursor: hasMore ? nextCursor : null,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
