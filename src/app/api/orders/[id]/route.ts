import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { updateOrderSchema } from '@/lib/validations';
import { publishOrderLifecycleEvent } from '@/lib/order-events';

type Params = { params: Promise<{ id: string }> };

const SELLER_EDITABLE_STATUSES = ['PAID', 'SHIPPED'] as const;

/**
 * GET /api/orders/[id] - Get order details
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: { include: { images: true } },
        buyer: { select: { id: true, name: true, avatar: true, location: true } },
        seller: { select: { id: true, name: true, avatar: true, location: true } },
        offer: true,
        review: true,
      },
    });

    if (!order) return ApiResponse.notFound('Bestellung nicht gefunden.');
    if (order.buyerId !== session.user.id && order.sellerId !== session.user.id) {
      return ApiResponse.forbidden();
    }

    return ApiResponse.success(order);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * PUT /api/orders/[id] - Update seller shipping details
 */
export async function PUT(request: NextRequest, { params }: Params) {
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

    const body = await request.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) return ApiResponse.validationError('Ungueltige Versanddaten.');

    if (order.sellerId !== session.user.id) {
      return ApiResponse.forbidden('Nur der Verkaeufer kann Versandinformationen aktualisieren.');
    }

    const { status, trackingCode, shippingCarrier } = parsed.data;

    if (status && status !== 'SHIPPED') {
      return ApiResponse.forbidden('Bestellungen koennen hier nur als versendet markiert werden.');
    }

    if (!SELLER_EDITABLE_STATUSES.includes(order.status as (typeof SELLER_EDITABLE_STATUSES)[number])) {
      return ApiResponse.error('Versandinformationen koennen nur fuer bezahlte oder bereits versendete Bestellungen aktualisiert werden.');
    }

    const nextShippingCarrier = shippingCarrier?.trim() || order.shippingCarrier || '';
    const nextTrackingCode = trackingCode?.trim() || order.trackingCode || null;

    if (!nextShippingCarrier) {
      return ApiResponse.validationError('Bitte gib einen Versanddienst an.');
    }

    const wasAlreadyShipped = order.status === 'SHIPPED';

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'SHIPPED',
        shippingCarrier: nextShippingCarrier,
        trackingCode: nextTrackingCode,
      },
      include: {
        product: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    await publishOrderLifecycleEvent({
      eventType: 'ORDER_SHIPPED',
      order: updated,
      actorId: order.sellerId,
      wasAlreadyShipped,
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('PUT /api/orders/[id] error:', error);
    return ApiResponse.serverError();
  }
}
