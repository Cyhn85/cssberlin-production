import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';

export const runtime = 'nodejs';

/**
 * POST /api/products/withdraw
 *
 * TATANGA-Importe endgueltig entfernen (2026-10-19, Entscheidung des Inhabers: keine Fotos fremder
 * Inserate mehr im Shop). Bewusst eng gehalten:
 *  - nur mit TATANGA_IMPORT_API_KEY (wie /import und /reprice);
 *  - nur Artikel MIT sourceHubId, also eigene Importe. Angebote echter Verkaeufer werden nie angefasst;
 *  - Artikel mit Bestellung (Order, onDelete: Restrict) werden NICHT geloescht, sondern HIDDEN:
 *    Bestellungen sind Buchhaltungsbelege;
 *  - sonst: Favoriten, Angebots-Nachrichten-Verweise, Angebote, Bildzeilen, Bilddateien, Artikel.
 *
 * Body: { "hub_product_ids": ["PROD-..."] }  oder  { "all_hub_imports": true }
 *       "dry_run": true  -> nichts aendern, nur zaehlen, was passieren wuerde.
 */
export async function POST(request: NextRequest) {
  try {
    const expectedKey = process.env.TATANGA_IMPORT_API_KEY;
    if (!expectedKey) return ApiResponse.serverError('Withdraw ist serverseitig nicht konfiguriert.');
    if (request.headers.get('x-api-key') !== expectedKey) {
      return ApiResponse.unauthorized('Ungültiger API-Schlüssel.');
    }

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.hub_product_ids) ? body.hub_product_ids.map(String) : [];
    const all = body?.all_hub_imports === true;
    const dryRun = body?.dry_run === true;
    if (!all && ids.length === 0) {
      return ApiResponse.validationError('hub_product_ids (Array) oder all_hub_imports: true erwartet.');
    }

    const products = await prisma.product.findMany({
      where: all ? { sourceHubId: { not: null } } : { sourceHubId: { in: ids } },
      select: { id: true, sourceHubId: true, _count: { select: { orders: true, offers: true, favorites: true } } },
    });

    const withOrders = products.filter((p) => p._count.orders > 0);
    const deletable = products.filter((p) => p._count.orders === 0);
    const notFound = all ? [] : ids.filter((h) => !products.some((p) => p.sourceHubId === h));

    if (dryRun) {
      return ApiResponse.success({
        dry_run: true,
        found: products.length,
        would_delete: deletable.length,
        would_hide_because_orders: withOrders.map((p) => p.sourceHubId),
        not_found: notFound,
      });
    }

    const deleteIds = deletable.map((p) => p.id);
    if (withOrders.length) {
      await prisma.product.updateMany({ where: { id: { in: withOrders.map((p) => p.id) } }, data: { status: 'HIDDEN' } });
    }
    if (deleteIds.length) {
      await prisma.$transaction([
        prisma.favorite.deleteMany({ where: { productId: { in: deleteIds } } }),
        prisma.message.updateMany({ where: { offer: { productId: { in: deleteIds } } }, data: { offerId: null } }),
        prisma.offer.deleteMany({ where: { productId: { in: deleteIds } } }),
        prisma.productImage.deleteMany({ where: { productId: { in: deleteIds } } }),
        prisma.product.deleteMany({ where: { id: { in: deleteIds } } }),
      ]);
    }

    // Bilddateien erst NACH erfolgreicher DB-Transaktion entfernen (sonst zeigten Zeilen auf fehlende Dateien)
    let filesRemoved = 0;
    try {
      const { rm } = await import('fs/promises');
      const path = await import('path');
      const UPLOAD_ROOT = process.env.LOCAL_UPLOAD_DIR || '/app/uploads';
      for (const id of deleteIds) {
        await rm(path.join(UPLOAD_ROOT, 'products', id), { recursive: true, force: true });
        filesRemoved++;
      }
    } catch (err) {
      console.warn('withdraw: Bildordner konnten nicht vollstaendig entfernt werden', err);
    }

    return ApiResponse.success({
      deleted: deletable.map((p) => p.sourceHubId),
      hidden_because_orders: withOrders.map((p) => p.sourceHubId),
      not_found: notFound,
      image_dirs_removed: filesRemoved,
    });
  } catch (error: any) {
    console.error('POST /api/products/withdraw error', error);
    return ApiResponse.serverError('Withdraw fehlgeschlagen.');
  }
}
