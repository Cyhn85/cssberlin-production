import prisma from '@/lib/db';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { updateProfileSchema } from '@/lib/validations';

/**
 * GET /api/users/me - Get current user's full profile and recent listings
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const [user, rating] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          bio: true,
          location: true,
          avatar: true,
          role: true,
          isVerified: true,
          phoneVerified: true,
          idVerified: true,
          dac7Reported: true,
          ecoCO2Saved: true,
          itemsRecycled: true,
          createdAt: true,
          bundleDiscount: true,
          products: {
            orderBy: { createdAt: 'desc' },
            take: 24,
            include: {
              images: { orderBy: { orderIndex: 'asc' }, take: 1 },
              category: { select: { id: true, name: true, emoji: true } },
              _count: { select: { favorites: true, offers: true } },
            },
          },
          _count: {
            select: {
              products: true,
              ordersAsSeller: { where: { status: 'COMPLETED' } },
              ordersAsBuyer: true,
              followers: true,
              following: true,
              receivedReviews: true,
            },
          },
        },
      }),
      prisma.review.aggregate({
        where: { targetUserId: session.user.id },
        _avg: { rating: true },
      }),
    ]);

    if (!user) return ApiResponse.notFound();

    return ApiResponse.success({
      ...user,
      rating: Math.round((rating._avg.rating || 0) * 10) / 10,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * PUT /api/users/me - Update current user's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungueltige Profildaten.');
    }

    if (parsed.data.username) {
      const existing = await prisma.user.findUnique({
        where: { username: parsed.data.username },
      });
      if (existing && existing.id !== session.user.id) {
        return ApiResponse.error('Dieser Benutzername ist bereits vergeben.');
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        location: true,
        avatar: true,
      },
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('PUT /api/users/me error:', error);
    return ApiResponse.serverError();
  }
}
