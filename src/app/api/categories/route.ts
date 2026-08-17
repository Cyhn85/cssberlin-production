import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { respondWithPublicApiFallback } from '@/lib/api-error';
import { LAUNCH_ROOT_CATEGORIES, isLaunchCategory } from '@/config/launch-scope';

/**
 * GET /api/categories - Get all categories with product counts
 * Public endpoint, no auth required
 * Returns hierarchical category tree
 *
 * YAYIN KAPSAMI: Yalnizca launch-scope.ts'te acik olan kok kategoriler ve
 * onlarin altlari doner. Kategoriler SILINMEZ — sadece bu ucta suzulur, yani
 * kapsami genisletmek icin tek satirlik bir liste degisikligi yeterlidir.
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        children: {
          include: {
            _count: { select: { products: { where: { status: 'ACTIVE' } } } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      // Kapsam DB sorgusunda uygulanir: kapali kategoriler hic cekilmez.
      where: { parentId: null, name: { in: [...LAUNCH_ROOT_CATEGORIES] } },
      orderBy: { name: 'asc' },
    });

    const allCategories = await prisma.category.findMany({
      include: {
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    });

    // Duz listede kok VE alt kategoriler var; alt kategoriler kokun
    // durumunu miras alir. Kok id -> ad haritasiyla suzulur.
    const kokAdlari = new Map(
      allCategories.filter((c) => !c.parentId).map((c) => [c.id, c.name])
    );
    const acikFlat = allCategories.filter((c) =>
      isLaunchCategory(c.parentId ? kokAdlari.get(c.parentId) : c.name)
    );

    return ApiResponse.success({
      tree: categories,
      flat: acikFlat,
    });
  } catch (error) {
    return respondWithPublicApiFallback('GET /api/categories error', error, {
      tree: [],
      flat: [],
    });
  }
}
