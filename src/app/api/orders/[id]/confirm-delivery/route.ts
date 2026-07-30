import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { publishOrderLifecycleEvent } from '@/lib/order-events';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/orders/[id]/confirm-delivery - Buyer confirms delivery
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true, ecoCO2Saved: true } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) return ApiResponse.notFound('Bestellung nicht gefunden.');
    if (order.buyerId !== session.user.id) {
      return ApiResponse.forbidden('Nur der Kaeufer kann den Empfang bestaetigen.');
    }
    if (order.status !== 'DELIVERED' && order.status !== 'SHIPPED') {
      return ApiResponse.error('Empfangsbestaetigung nur fuer versendete oder zugestellte Bestellungen moeglich.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const completedOrder = await tx.order.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: {
          product: { select: { id: true, title: true } },
          buyer: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.product.update({
        where: { id: order.productId },
        data: { status: 'SOLD' },
      });

      await tx.user.update({
        where: { id: order.buyerId },
        data: {
          ecoCO2Saved: { increment: order.product.ecoCO2Saved },
          itemsRecycled: { increment: 1 },
        },
      });

      return completedOrder;
    });

    await publishOrderLifecycleEvent({
      eventType: 'ORDER_COMPLETED',
      order: updated,
      actorId: order.buyerId,
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/orders/[id]/confirm-delivery error:', error);
    return ApiResponse.serverError();
  }
}
