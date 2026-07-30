import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';

type Params = { params: Promise<{ userId: string }> };

/**
 * GET /api/reviews/user/[userId] — Get all reviews for a specific user
 * Public endpoint (no auth required)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { userId } = await params;
    const cursor = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 50);

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return ApiResponse.notFound('Benutzer nicht gefunden.');
    }

    // Get reviews with cursor pagination
    const reviews = await prisma.review.findMany({
      where: { targetUserId: userId },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        order: {
          select: {
            product: {
              select: { id: true, title: true, images: { take: 1, select: { url: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = reviews.length > limit;
    const items = hasMore ? reviews.slice(0, limit) : reviews;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Calculate average rating
    const stats = await prisma.review.aggregate({
      where: { targetUserId: userId },
      _avg: { rating: true },
      _count: true,
    });

    return ApiResponse.success({
      reviews: items,
      nextCursor,
      stats: {
        averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
        totalReviews: stats._count,
      },
    });
  } catch {
    return ApiResponse.serverError();
  }
}
