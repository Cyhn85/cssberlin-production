import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/**
 * GET /api/orders — Get user's orders (as buyer and seller)
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const [purchases, sales] = await Promise.all([
      prisma.order.findMany({
        where: { buyerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          product: { include: { images: { take: 1, /* embedding HARIC: 3072'lik vektor gorsel basina ~42 KB sisiriyor */ select: { id: true, url: true, thumbUrl: true, mediumUrl: true, orderIndex: true, productId: true, angle: true } } } },
          seller: { select: { id: true, name: true, avatar: true } },
          reviews: true,
        },
      }),
      prisma.order.findMany({
        where: { sellerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          product: { include: { images: { take: 1, /* embedding HARIC: 3072'lik vektor gorsel basina ~42 KB sisiriyor */ select: { id: true, url: true, thumbUrl: true, mediumUrl: true, orderIndex: true, productId: true, angle: true } } } },
          buyer: { select: { id: true, name: true, avatar: true } },
          reviews: true,
        },
      }),
    ]);

    // `review` = the review I wrote for this order, `receivedReview` = the one written about me.
    const me = session.user.id;
    const withReviews = <T extends { reviews: Array<{ authorId: string }> }>(o: T) => ({
      ...o,
      review: o.reviews.find((r) => r.authorId === me) ?? null,
      receivedReview: o.reviews.find((r) => r.authorId !== me) ?? null,
    });

    return ApiResponse.success({ purchases: purchases.map(withReviews), sales: sales.map(withReviews) });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
