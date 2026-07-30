import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/products/[id]/views — Increment product view count
 * No auth required (anonymous views allowed)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!product || product.status !== 'ACTIVE') {
      return ApiResponse.notFound('Produkt nicht gefunden.');
    }

    await prisma.product.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return ApiResponse.success({ viewed: true });
  } catch {
    return ApiResponse.serverError();
  }
}
