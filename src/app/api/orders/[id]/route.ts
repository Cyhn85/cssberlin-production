import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { updateOrderSchema } from '@/lib/validations';
import { markShipped } from '@/lib/order-state';
import { orderErrorResponse } from '@/lib/api-order-errors';
import { normalizeCarrier } from '@/config/shipping-policy';

type Params = { params: Promise<{ id: string }> };

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
        reviews: true,
      },
    });

    if (!order) return ApiResponse.notFound('Bestellung nicht gefunden.');
    if (order.buyerId !== session.user.id && order.sellerId !== session.user.id) {
      return ApiResponse.forbidden();
    }

    const me = session.user.id;
    return ApiResponse.success({
      ...order,
      review: order.reviews.find((r) => r.authorId === me) ?? null,
      receivedReview: order.reviews.find((r) => r.authorId !== me) ?? null,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * PUT /api/orders/[id] - Seller marks the order shipped / updates tracking.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const parsed = updateOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiResponse.validationError('Ungültige Versanddaten.');

    const { status, trackingCode, shippingCarrier } = parsed.data;
    if (status && status !== 'SHIPPED') {
      return ApiResponse.forbidden('Bestellungen können hier nur als versendet markiert werden.');
    }

    const current = await prisma.order.findUnique({ where: { id }, select: { shippingCarrier: true, trackingCode: true } });
    if (!current) return ApiResponse.notFound('Bestellung nicht gefunden.');

    const carrier = normalizeCarrier(shippingCarrier || current.shippingCarrier || '');
    if (!carrier || carrier === 'PICKUP') {
      return ApiResponse.validationError('Bitte wähle einen Versanddienst (DHL, Hermes, DPD oder GLS).');
    }
    const tracking = trackingCode?.trim() || current.trackingCode || null;
    if (tracking && !/^[A-Za-z0-9-]{6,40}$/.test(tracking)) {
      return ApiResponse.validationError('Die Sendungsnummer sieht ungültig aus (6-40 Buchstaben/Ziffern).');
    }

    const updated = await markShipped(id, session.user.id, carrier, tracking);
    return ApiResponse.success(updated);
  } catch (error: any) {
    return orderErrorResponse(error, 'PUT /api/orders/[id]');
  }
}
