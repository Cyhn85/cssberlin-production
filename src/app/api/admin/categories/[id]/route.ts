import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  emoji: z.string().max(8).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
});

/**
 * PATCH /api/admin/categories/[id] - Edit a real category.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return ApiResponse.validationError('Ungueltige Eingabe.');

    const updated = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    if (error.code === 'P2025') return ApiResponse.notFound('Kategorie nicht gefunden.');
    if (error.code === 'P2002') return ApiResponse.error('Eine Kategorie mit diesem Namen existiert bereits.', 409);
    return ApiResponse.serverError();
  }
}

/**
 * DELETE /api/admin/categories/[id] - Remove an empty, leaf category.
 * Categories with products or subcategories cannot be deleted (data integrity).
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      select: { _count: { select: { products: true, children: true } } },
    });
    if (!category) return ApiResponse.notFound('Kategorie nicht gefunden.');
    if (category._count.products > 0 || category._count.children > 0) {
      return ApiResponse.error('Kategorien mit Artikeln oder Unterkategorien koennen nicht geloescht werden.', 409);
    }

    await prisma.category.delete({ where: { id } });
    return ApiResponse.success({ id });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
