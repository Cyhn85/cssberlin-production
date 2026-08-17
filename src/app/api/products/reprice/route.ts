import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';

export const runtime = 'nodejs';

// Ein einzelner Aufruf darf den Preis hoechstens halbieren. Das ist keine
// fachliche Regel, sondern eine Notbremse: ein Rechenfehler auf TATANGA-Seite
// soll nicht den gesamten Katalog verramschen.
const MAX_DROP_RATIO = 0.5;

type RepriceItem = { hub_product_id?: string; product_id?: string; price?: number };

/**
 * POST /api/products/reprice
 *
 * TATANGA meldet gesenkte Preise. Bewusst eng gehalten:
 *  - nur Artikel mit sourceHubId, also nur unsere eigenen Importe. Angebote
 *    echter Verkaeufer werden hier niemals angefasst.
 *  - originalPrice wird beim ersten Mal festgehalten und danach nie ueberschrieben,
 *    damit der Rabatt immer gegen den urspruenglichen Preis gerechnet wird.
 *  - Preiserhoehungen werden abgelehnt: diese Route senkt Preise, sonst nichts.
 */
export async function POST(request: NextRequest) {
  try {
    const expectedKey = process.env.TATANGA_IMPORT_API_KEY;
    if (!expectedKey) {
      console.error('TATANGA_IMPORT_API_KEY is not configured on the server.');
      return ApiResponse.serverError('Reprice ist serverseitig nicht konfiguriert.');
    }
    if (request.headers.get('x-api-key') !== expectedKey) {
      return ApiResponse.unauthorized('Ungueltiger API-Schluessel.');
    }

    const payload = await request.json();
    const items: RepriceItem[] = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.validationError('Erwartet wird ein Array oder { items: [...] }.');
    }

    const updated: { id: string; from: number; to: number }[] = [];
    const skipped: { ref: string; reason: string }[] = [];

    for (const item of items) {
      const ref = String(item.hub_product_id || item.product_id || '').trim();
      const newPrice = Number(item.price);
      if (!ref) {
        skipped.push({ ref: '(ohne id)', reason: 'hub_product_id oder product_id fehlt' });
        continue;
      }
      if (!Number.isFinite(newPrice) || newPrice <= 0) {
        skipped.push({ ref, reason: 'price muss eine positive Zahl sein' });
        continue;
      }

      const product = await prisma.product.findFirst({
        where: item.hub_product_id ? { sourceHubId: ref } : { id: ref },
        select: { id: true, price: true, originalPrice: true, sourceHubId: true },
      });
      if (!product) {
        skipped.push({ ref, reason: 'Artikel nicht gefunden' });
        continue;
      }
      // Sicherheitsgrenze: fremde Angebote bleiben unberuehrt.
      if (!product.sourceHubId) {
        skipped.push({ ref, reason: 'kein TATANGA-Artikel - Preis wird nicht angefasst' });
        continue;
      }
      if (newPrice >= product.price) {
        skipped.push({ ref, reason: 'diese Route senkt nur Preise' });
        continue;
      }
      if (newPrice < product.price * MAX_DROP_RATIO) {
        skipped.push({ ref, reason: `Preissturz ueber ${(1 - MAX_DROP_RATIO) * 100}% - bitte manuell pruefen` });
        continue;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: {
          price: newPrice,
          // Nur beim ersten Mal setzen, sonst wandert die Rabattbasis mit.
          originalPrice: product.originalPrice ?? product.price,
        },
      });
      updated.push({ id: product.id, from: product.price, to: newPrice });
    }

    return NextResponse.json({ success: true, updated: updated.length, items: updated, skipped });
  } catch (error) {
    console.error('POST /api/products/reprice error:', error);
    return ApiResponse.serverError();
  }
}
