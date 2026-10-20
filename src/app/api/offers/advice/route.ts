import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { acceptanceChance, minimumOffer } from '@/lib/offer-state';
import { offerPolicy, ms } from '@/config/marketplace-policy';

/**
 * GET /api/offers/advice?productId=..&price=.. - buyer-side hint for the offer modal:
 * the real minimum (platform floor or the seller's own rule) and a rough chance
 * band. Uses only public signals; nothing about the seller's private data.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const productId = request.nextUrl.searchParams.get('productId') || '';
    const price = Number(request.nextUrl.searchParams.get('price'));

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { price: true, createdAt: true, status: true, seller: { select: { offerMinPercent: true } }, _count: { select: { favorites: true } } },
    });
    if (!product) return ApiResponse.notFound('Artikel nicht gefunden.');

    const floor = minimumOffer(product.price, product.seller.offerMinPercent);
    const ageDays = (Date.now() - product.createdAt.getTime()) / ms.DAY;
    const quick = offerPolicy.quickDiscounts.map((pct) => {
      const amount = Math.max(floor.amount, Math.round(product.price * (100 - pct)) / 100);
      return { pct, amount, ...acceptanceChance(product.price, amount, ageDays, product._count.favorites) };
    });

    return ApiResponse.success({
      listPrice: product.price,
      minimum: floor.amount,
      sellerRule: floor.sellerRule,
      available: product.status === 'ACTIVE',
      chance: Number.isFinite(price) && price > 0 ? acceptanceChance(product.price, price, ageDays, product._count.favorites) : null,
      quick,
      answerHours: offerPolicy.answerHours,
      paymentHours: offerPolicy.paymentHours,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
