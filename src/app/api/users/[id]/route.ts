import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { respondWithApiError } from '@/lib/api-error';
import { getOptionalSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/users/[id] - Get public user profile and active wardrobe
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const [user, rating, session] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          location: true,
          avatar: true,
          isVerified: true,
          phoneVerified: true,
          ecoCO2Saved: true,
          itemsRecycled: true,
          createdAt: true,
          products: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 24,
            include: {
              images: { orderBy: { orderIndex: 'asc' }, take: 1 },
              category: { select: { id: true, name: true, emoji: true } },
              seller: { select: { id: true, name: true, avatar: true, username: true } },
              _count: { select: { favorites: true, offers: true } },
            },
          },
          _count: {
            select: {
              products: { where: { status: 'ACTIVE' } },
              followers: true,
              following: true,
              receivedReviews: true,
            },
          },
        },
      }),
      prisma.review.aggregate({
        where: { targetUserId: id },
        _avg: { rating: true },
      }),
      getOptionalSession(),
    ]);

    if (!user) return ApiResponse.notFound('Benutzer nicht gefunden.');

    let isFollowing = false;
    if (session?.user?.id && session.user.id !== id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followedId: {
            followerId: session.user.id,
            followedId: id,
          },
        },
      });
      isFollowing = !!follow;
    }

    return ApiResponse.success({
      ...user,
      averageRating: Math.round((rating._avg.rating || 0) * 10) / 10,
      isFollowing,
    });
  } catch (error) {
    return respondWithApiError('GET /api/users/[id] error', error);
  }
}

