import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { createReviewSchema } from '@/lib/validations';
import { createSystemNotification } from '@/lib/notifications';

/**
 * POST /api/reviews — Create a review for a completed order
 * Rules: Only COMPLETED orders, one review per side, buyer <-> seller
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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reviews: { select: { authorId: true } } },
    });

    if (!order) {
      return ApiResponse.notFound('Bestellung nicht gefunden.');
    }

    // Both sides rate each other (Vinted/eBay style): buyer -> seller, seller -> buyer.
    const isBuyer = order.buyerId === session.user.id;
    const isSeller = order.sellerId === session.user.id;
    if (!isBuyer && !isSeller) {
      return ApiResponse.forbidden('Nur Käufer oder Verkäufer dieser Bestellung können bewerten.');
    }

    if (order.status !== 'COMPLETED') {
      return ApiResponse.error('Bewertung nur für abgeschlossene Bestellungen möglich.');
    }

    if (order.reviews.some((r) => r.authorId === session.user.id)) {
      return ApiResponse.error('Du hast diese Bestellung bereits bewertet.');
    }

    const review = await prisma.review.create({
      data: {
        orderId,
        authorId: session.user.id,
        targetUserId: isBuyer ? order.sellerId : order.buyerId,
        rating,
        comment,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    });

    void createSystemNotification({
      senderId: session.user.id,
      receiverId: review.targetUserId,
      category: 'listingActivity',
      content: `${review.author.name || 'Ein Mitglied'} hat dich mit ${rating} von 5 Sternen bewertet.`,
      email: {
        subject: `Neue Bewertung: ${rating} von 5 Sternen`,
        title: 'Du hast eine neue Bewertung',
        intro: `${review.author.name || 'Ein Mitglied'} hat dich mit ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} bewertet.`,
        lines: comment ? [`„${comment}“`] : [],
        ctaLabel: 'Profil ansehen',
        ctaPath: `/profile/${review.targetUserId}`,
      },
    }).catch(() => undefined);

    return ApiResponse.created(review);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/reviews error:', error);
    return ApiResponse.serverError();
  }
}
