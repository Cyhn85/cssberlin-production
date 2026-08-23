import { NextResponse } from 'next/server';
import { rm } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';

import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

const UPLOAD_ROOT = process.env.LOCAL_UPLOAD_DIR || '/app/uploads';
const DAYS_TO_KEEP = 7;

/**
 * Nightly disk reclaim for listings that are done: deletes the product photos
 * (files + rows) once a SOLD/HIDDEN listing has been settled for a week.
 *
 * The product row itself is only removed when nothing was ever ordered from it.
 * A sold listing is the counterpart to an invoice, and German bookkeeping rules
 * (§147 AO) require those to stay retrievable for years, so an order attached to
 * a product pins that product permanently. Order also has no onDelete rule, so
 * deleting such a product would either abort the whole run or take the order
 * record down with it.
 *
 * Call with ?dryRun=1 to see what a real run would touch without deleting.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      console.error('CRON_SECRET is not configured; refusing to run cleanup.');
      return NextResponse.json({ error: 'Cleanup is not configured.' }, { status: 503 });
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7).trim();
    const expectedTrimmed = expected.trim();
    try {
      if (!timingSafeEqual(Buffer.from(token), Buffer.from(expectedTrimmed))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch {
      // timingSafeEqual throws if lengths do not match
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - DAYS_TO_KEEP);

    const obsoleteProducts = await prisma.product.findMany({
      where: {
        status: { in: ['SOLD', 'HIDDEN'] },
        updatedAt: { lt: thresholdDate },
      },
      select: {
        id: true,
        images: { select: { id: true } },
        _count: { select: { orders: true } },
      },
    });

    if (obsoleteProducts.length === 0) {
      return NextResponse.json({ message: 'No obsolete products to clean up.' });
    }

    let deletedImagesCount = 0;
    let deletedProductsCount = 0;
    let retainedForBookkeeping = 0;

    for (const product of obsoleteProducts) {
      const hasOrders = product._count.orders > 0;

      if (!dryRun) {
        // Photos go for every settled listing - that is what actually frees disk.
        await rm(path.join(UPLOAD_ROOT, 'products', product.id), {
          recursive: true,
          force: true,
        });
        await prisma.productImage.deleteMany({ where: { productId: product.id } });
      }
      deletedImagesCount += product.images.length;

      if (hasOrders) {
        retainedForBookkeeping++;
        continue;
      }

      if (!dryRun) {
        await prisma.product.delete({ where: { id: product.id } });
      }
      deletedProductsCount++;
    }

    return NextResponse.json({
      message: dryRun ? 'Dry run - nothing deleted' : 'Cleanup successful',
      dryRun,
      productsScanned: obsoleteProducts.length,
      productsDeleted: deletedProductsCount,
      imagesDeleted: deletedImagesCount,
      retainedForBookkeeping,
    });
  } catch (error) {
    console.error('CRON Cleanup Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
