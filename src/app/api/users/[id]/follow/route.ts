import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/users/[id]/follow — Toggle follow/unfollow a user
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id: targetUserId } = await params;

    // Can't follow yourself
    if (targetUserId === session.user.id) {
      return ApiResponse.error('Du kannst dir nicht selbst folgen.');
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return ApiResponse.notFound('Benutzer nicht gefunden.');
    }

    // Check existing follow
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followedId: {
          followerId: session.user.id,
          followedId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: {
          followerId_followedId: {
            followerId: session.user.id,
            followedId: targetUserId,
          },
        },
      });

      const followerCount = await prisma.follow.count({
        where: { followedId: targetUserId },
      });

      return ApiResponse.success({ following: false, followerCount });
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId: session.user.id,
          followedId: targetUserId,
        },
      });

      const followerCount = await prisma.follow.count({
        where: { followedId: targetUserId },
      });

      return ApiResponse.success({ following: true, followerCount });
    }
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
