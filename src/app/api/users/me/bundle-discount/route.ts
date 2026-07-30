import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { updateBundleDiscountSchema } from '@/lib/validations';

/**
 * GET /api/users/me/bundle-discount — Get current user's bundle discount settings
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const discount = await prisma.bundleDiscount.findUnique({
      where: { userId: session.user.id },
    });

    return ApiResponse.success(
      discount || {
        isActive: false,
        twoItems: 5,
        threeItems: 10,
        fiveItems: 15,
      }
    );
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * PUT /api/users/me/bundle-discount — Update bundle discount settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const parsed = updateBundleDiscountSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError('Ungültige Rabattdaten.');
    }

    const discount = await prisma.bundleDiscount.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...parsed.data,
      },
      update: parsed.data,
    });

    return ApiResponse.success(discount);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('PUT /api/users/me/bundle-discount error:', error);
    return ApiResponse.serverError();
  }
}
