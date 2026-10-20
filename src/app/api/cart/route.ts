import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

const MAX_CART = 50;

const bodySchema = z.object({
  /** merge: union of local + server (after login); add / remove: single item */
  action: z.enum(['merge', 'add', 'remove', 'clear']),
  productIds: z.array(z.string().min(1).max(40)).max(MAX_CART).optional(),
  productId: z.string().min(1).max(40).optional(),
});

async function cartIds(userId: string) {
  const rows = await prisma.cartItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { productId: true } });
  return rows.map((r) => r.productId);
}

/** GET /api/cart - product ids in my cart (synced across devices) */
export async function GET() {
  try {
    const session = await requireAuth();
    return ApiResponse.success({ productIds: await cartIds(session.user.id) });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * POST /api/cart - the browser cart (localStorage) keeps working logged out;
 * after login it is merged here once, then every add/remove is mirrored.
 * Own items and items that no longer exist are dropped silently.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiResponse.validationError('Ungültige Warenkorb-Aktion.');
    const { action, productIds = [], productId } = parsed.data;

    if (action === 'clear') {
      await prisma.cartItem.deleteMany({ where: { userId } });
    } else if (action === 'remove' && productId) {
      await prisma.cartItem.deleteMany({ where: { userId, productId } });
    } else {
      const wanted = action === 'merge' ? productIds : productId ? [productId] : [];
      if (wanted.length) {
        const valid = await prisma.product.findMany({
          where: { id: { in: wanted }, sellerId: { not: userId }, status: { in: ['ACTIVE', 'RESERVED'] } },
          select: { id: true },
        });
        const current = await prisma.cartItem.count({ where: { userId } });
        const room = Math.max(0, MAX_CART - current);
        await prisma.cartItem.createMany({
          data: valid.slice(0, room).map((p) => ({ userId, productId: p.id })),
          skipDuplicates: true,
        });
      }
    }
    return ApiResponse.success({ productIds: await cartIds(userId) });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
