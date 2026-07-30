import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { createReviewSchema } from '@/lib/validations';

/**
 * POST /api/reviews — Create a review for a completed order
 * Rules: Only COMPLETED orders, 1 review per order, buyer reviews seller
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const parsed = createReviewSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungültige Bewertungsdaten.');
    }

    const { orderId, rating, comment } = parsed.data;

    // Get order with existing review check
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true },
    });

    if (!order) {
      return ApiResponse.notFound('Bestellung nicht gefunden.');
    }

    // Only buyer can review
    if (order.buyerId !== session.user.id) {
      return ApiResponse.forbidden('Nur der Käufer kann eine Bewertung abgeben.');
    }

    // Must be completed
    if (order.status !== 'COMPLETED') {
      return ApiResponse.error('Bewertung nur für abgeschlossene Bestellungen möglich.');
    }

    // No duplicate reviews
    if (order.review) {
      return ApiResponse.error('Du hast diese Bestellung bereits bewertet.');
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        orderId,
        authorId: session.user.id,
        targetUserId: order.sellerId,
        rating,
        comment,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    return ApiResponse.created(review);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/reviews error:', error);
    return ApiResponse.serverError();
  }
}
