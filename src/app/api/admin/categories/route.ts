import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
  parentId: z.string().optional().nullable(),
});

/**
 * GET /api/admin/categories - Full real category tree for management.
 */
export async function GET() {
  try {
    await requireAdmin();

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true, children: true } },
        parent: { select: { id: true, name: true } },
      },
    });

    return ApiResponse.success(categories);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}

/**
 * POST /api/admin/categories - Create a real category.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Ungueltige Eingabe.');
    }

    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        emoji: parsed.data.emoji || null,
        color: parsed.data.color || null,
        parentId: parsed.data.parentId || null,
      },
    });

    return ApiResponse.created(category);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    if (error.code === 'P2002') return ApiResponse.error('Eine Kategorie mit diesem Namen existiert bereits.', 409);
    return ApiResponse.serverError();
  }
}
