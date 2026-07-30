import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';
import { publishOrderLifecycleEvent } from '@/lib/order-events';

type Params = { params: Promise<{ id: string }> };

const disputeSchema = z.object({
  reason: z
    .string()
    .min(10, 'Bitte beschreibe den Grund genauer (mindestens 10 Zeichen).')
    .max(1000, 'Beschreibung darf maximal 1000 Zeichen lang sein.'),
});

/**
 * POST /api/orders/[id]/dispute - Buyer opens a dispute
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });
    if (!order) return ApiResponse.notFound('Bestellung nicht gefunden.');

    if (order.buyerId !== session.user.id) {
      return ApiResponse.forbidden('Nur der Kaeufer kann einen Kaeuferschutz-Fall eroeffnen.');
    }

    if (order.status !== 'DELIVERED' && order.status !== 'SHIPPED') {
      return ApiResponse.error('Kaeuferschutz ist nur fuer versendete oder zugestellte Bestellungen moeglich.');
    }

    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const timeSinceUpdate = Date.now() - order.updatedAt.getTime();
    if (timeSinceUpdate > twoDaysMs) {
      return ApiResponse.error('Der Kaeuferschutz-Zeitraum (2 Tage nach Zustellung) ist abgelaufen.');
    }

    const body = await request.json();
    const parsed = disputeSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Bitte gib einen gueltigen Grund an.');
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'DISPUTED',
        disputeReason: parsed.data.reason,
      },
      include: {
        product: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    await publishOrderLifecycleEvent({
      eventType: 'ORDER_DISPUTED',
      order: updated,
      actorId: order.buyerId,
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/orders/[id]/dispute error:', error);
    return ApiResponse.serverError();
  }
}
