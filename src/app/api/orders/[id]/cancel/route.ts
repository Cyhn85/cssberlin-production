import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { answerCancellation, cancelOrder, requestCancellation } from '@/lib/order-state';
import { orderErrorResponse } from '@/lib/api-order-errors';
import { cancellationPolicy } from '@/config/marketplace-policy';

type Params = { params: Promise<{ id: string }> };

const buyerReasonIds: string[] = cancellationPolicy.buyerReasons.map((r) => r.id);
const sellerReasonIds: string[] = cancellationPolicy.sellerReasons.map((r) => r.id);

const schema = z.discriminatedUnion('action', [
  // buyer: instant cancel (first hour after payment / Abholung) - seller: cancel with reason
  z.object({ action: z.literal('cancel'), reason: z.string().min(1), note: z.string().max(200).optional() }),
  // buyer: ask the seller to cancel (after the free window, before shipping)
  z.object({ action: z.literal('request'), reason: z.string().min(1), note: z.string().max(200).optional() }),
  // seller: answer a request
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('decline') }),
]);

/**
 * POST /api/orders/[id]/cancel - every cancellation path; the rules live in src/lib/order-state.ts.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiResponse.validationError('Bitte wähle einen Grund.');
    const body = parsed.data;

    const order = await prisma.order.findUnique({ where: { id }, select: { buyerId: true, sellerId: true } });
    if (!order) return ApiResponse.notFound('Bestellung nicht gefunden.');
    const isBuyer = order.buyerId === session.user.id;
    const isSeller = order.sellerId === session.user.id;
    if (!isBuyer && !isSeller) return ApiResponse.forbidden();

    const withNote = (reason: string, note?: string) => (note?.trim() ? `${reason}: ${note.trim()}` : reason);

    switch (body.action) {
      case 'cancel': {
        const allowed = isSeller ? sellerReasonIds : buyerReasonIds;
        if (!allowed.includes(body.reason)) return ApiResponse.validationError('Ungültiger Grund.');
        const updated = await cancelOrder(id, { id: session.user.id, role: isSeller ? 'SELLER' : 'BUYER' }, withNote(body.reason, body.note));
        return ApiResponse.success(updated);
      }
      case 'request': {
        if (!isBuyer) return ApiResponse.forbidden();
        if (!buyerReasonIds.includes(body.reason)) return ApiResponse.validationError('Ungültiger Grund.');
        return ApiResponse.success(await requestCancellation(id, session.user.id, withNote(body.reason, body.note)));
      }
      case 'accept':
      case 'decline': {
        if (!isSeller) return ApiResponse.forbidden();
        return ApiResponse.success(await answerCancellation(id, session.user.id, body.action === 'accept'));
      }
    }
  } catch (error: any) {
    return orderErrorResponse(error, 'POST /api/orders/[id]/cancel');
  }
}
