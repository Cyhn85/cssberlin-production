import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { saveProductImage } from '@/lib/local-storage';
import { embedImageFromUrl } from '@/lib/image-embedding';
import { PRODUCT_ANGLES } from '@/lib/product-angles';

export const runtime = 'nodejs';

const CONDITION_MAP: Record<string, string> = {
  new: 'NEW_WITH_TAGS',
  new_with_tags: 'NEW_WITH_TAGS',
  new_without_tags: 'NEW_WITHOUT_TAGS',
  very_good: 'VERY_GOOD',
  good: 'GOOD',
  acceptable: 'ACCEPTABLE',
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveCategoryId(rawSlug: string | null): Promise<{ categoryId: string; fellBackTo: string | null }> {
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const needle = normalize(rawSlug || '');

  if (needle) {
    const exact = categories.find((c) => normalize(c.name) === needle);
    if (exact) return { categoryId: exact.id, fellBackTo: null };

    const partial = categories.find(
      (c) => normalize(c.name).includes(needle) || needle.includes(normalize(c.name))
    );
    if (partial) return { categoryId: partial.id, fellBackTo: null };
  }

  const fallback = categories.sort((a, b) => a.name.localeCompare(b.name))[0];
  if (!fallback) throw new Error('Keine Kategorien in der Datenbank vorhanden.');
  return { categoryId: fallback.id, fellBackTo: fallback.name };
}

async function pickPersonaSellerId(): Promise<string | null> {
  const personas = await prisma.user.findMany({
    where: { isPersonaAccount: true, isSuspended: false },
    select: {
      id: true,
      _count: { select: { products: { where: { status: 'ACTIVE' } } } },
    },
  });

  if (personas.length === 0) return null;

  personas.sort((a, b) => a._count.products - b._count.products);
  return personas[0].id;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.TATANGA_IMPORT_API_KEY;

    if (!expectedKey) {
      console.error('TATANGA_IMPORT_API_KEY is not configured on the server.');
      return ApiResponse.serverError('Import ist serverseitig nicht konfiguriert.');
    }
    if (!apiKey || apiKey !== expectedKey) {
      return ApiResponse.unauthorized('Ungueltiger API-Schluessel.');
    }

    const rl = await rateLimit(getClientIP(request), 'UPLOAD');
    if (!rl.success) return ApiResponse.rateLimited();

    const formData = await request.formData();

    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const price = Number(formData.get('price'));
    const brand = formData.get('brand') ? String(formData.get('brand')) : undefined;
    const size = formData.get('size') ? String(formData.get('size')) : undefined;
    const conditionRaw = normalize(String(formData.get('condition') || 'good'));
    const categorySlug = formData.get('category_slug') ? String(formData.get('category_slug')) : null;
    const sourcePlatform = formData.get('source_platform') ? String(formData.get('source_platform')) : null;
    const sourceUrl = formData.get('source_url') ? String(formData.get('source_url')) : null;
    const hubProductId = formData.get('hub_product_id') ? String(formData.get('hub_product_id')) : null;

    if (!title || !Number.isFinite(price) || price <= 0) {
      return ApiResponse.validationError('title und ein positiver price sind erforderlich.');
    }

    const condition = CONDITION_MAP[conditionRaw] || 'GOOD';

    // Optional deliberate 6-angle set (image_front, image_back, image_top,
    // image_bottom, image_left, image_right) - only used if TATANGA shot
    // this specific product on all 6 sides. Falls back to the generic
    // "images" array below when absent, which is the common case.
    const angleFiles: Array<{ angle: string; file: File }> = [];
    for (const angle of PRODUCT_ANGLES) {
      const entry = formData.get(`image_${angle.toLowerCase()}`);
      if (entry instanceof File && entry.size > 0) {
        angleFiles.push({ angle, file: entry });
      }
    }
    const hasFullAngleUpload = angleFiles.length === PRODUCT_ANGLES.length;

    // Overall cap is 9 images (matches the product page gallery: 1 main + two
    // rows of 4 thumbnails, no empty slots). The 6 angle shots count against
    // this cap, leaving room for up to 3 extra regular photos alongside them.
    const MAX_TOTAL_IMAGES = 9;
    const imageFiles = formData
      .getAll('images')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .slice(0, MAX_TOTAL_IMAGES - angleFiles.length);

    if (imageFiles.length === 0 && !hasFullAngleUpload) {
      return ApiResponse.validationError('Mindestens ein Bild (Feld "images", oder alle 6 image_* Winkelfelder) ist erforderlich.');
    }

    // Idempotent re-publish: same TATANGA product clicked "publish" again
    // updates the existing listing instead of creating a duplicate.
    if (hubProductId) {
      const existing = await prisma.product.findUnique({
        where: { sourceHubId: hubProductId },
        select: { id: true },
      });
      if (existing) {
        const updated = await prisma.product.update({
          where: { id: existing.id },
          data: {
            title,
            description: description || undefined,
            price,
            brand,
            size,
            condition: condition as never,
          },
        });
        // IndexNow: Bing/Yandex'e guncellenen urunu tekrar taramasini bildir (fire-and-forget).
        void import('@/lib/indexnow').then((m) =>
          m.pingIndexNow([`https://cssberlin.de/product/${updated.id}`])
        ).catch(() => {});
        // Flat shape on purpose: this is what TATANGA's publish_product() reads
        // directly off the top-level JSON, not the app's normal {success,data} envelope.
        return NextResponse.json({ success: true, productId: updated.id, duplicate: true });
      }
    }

    const { categoryId, fellBackTo } = await resolveCategoryId(categorySlug);
    if (fellBackTo) {
      console.warn(`TATANGA import: category_slug "${categorySlug}" not found, falling back to "${fellBackTo}".`);
    }

    const sellerId = await pickPersonaSellerId();
    if (!sellerId) {
      return ApiResponse.error(
        'Kein Persona-Verkaeuferkonto vorhanden. Bitte zuerst unter /admin/personas mindestens ein Konto anlegen.',
        422
      );
    }

    const product = await prisma.product.create({
      data: {
        title,
        description: description || '',
        price,
        brand,
        size,
        condition: condition as never,
        status: 'ACTIVE',
        categoryId,
        sellerId,
        sourcePlatform,
        sourceUrl,
        sourceHubId: hubProductId,
      },
    });

    const savedImages: { id: string; url: string }[] = [];
    let orderIndex = 0;

    if (hasFullAngleUpload) {
      for (const { angle, file } of angleFiles) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const url = await saveProductImage(buffer, product.id, orderIndex, file.type || 'image/jpeg');
        const image = await prisma.productImage.create({
          data: { url, orderIndex, productId: product.id, angle },
        });
        savedImages.push({ id: image.id, url });
        orderIndex += 1;
      }
    }

    for (const file of imageFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await saveProductImage(buffer, product.id, orderIndex, file.type || 'image/jpeg');
      const image = await prisma.productImage.create({
        data: { url, orderIndex, productId: product.id },
      });
      savedImages.push({ id: image.id, url });
      orderIndex += 1;
    }

    // Best-effort, same as normal /api/products uploads: never blocks the response.
    try {
      await Promise.all(
        savedImages.map(async (image) => {
          const embedding = await embedImageFromUrl(image.url);
          if (embedding) {
            await prisma.productImage.update({ where: { id: image.id }, data: { embedding } });
          }
        })
      );
    } catch (embeddingError) {
      console.warn('Image embedding generation failed for imported product', product.id, embeddingError);
    }

    // IndexNow: yeni yayinlanan urunu Bing/Yandex'e anlik bildir (fire-and-forget, akisi kirmaz).
    void import('@/lib/indexnow').then((m) =>
      m.pingIndexNow([`https://cssberlin.de/product/${product.id}`])
    ).catch(() => {});

    return NextResponse.json({ success: true, productId: product.id, duplicate: false, sellerId, categoryId });
  } catch (error: any) {
    console.error('POST /api/products/import error:', error);
    return ApiResponse.serverError();
  }
}
