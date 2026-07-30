import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { respondWithApiError } from '@/lib/api-error';
import { embedImageFromBase64, cosineSimilarity } from '@/lib/image-embedding';

// Cosine similarity threshold below which a match is considered unrelated.
// gemini-embedding-2 does not center around 0 for unrelated images the way
// some embedding models do - live testing showed ~0.79 similarity between two
// genuinely unrelated images (icon vs. banner graphic) and ~1.0 for an
// identical image. 0.9 is a deliberately strict starting point so unrelated
// photos honestly return "no matches" rather than weak forced results.
// TODO: recalibrate empirically once the catalog has enough real, diverse
// product photos to compare true near-duplicates against true unrelated items.
const MIN_SIMILARITY = 0.9;
const MAX_RESULTS = 24;

/**
 * POST /api/search/image — real visual similarity search.
 * Embeds the uploaded photo with the same Gemini multimodal embedding model
 * used at listing time, then ranks active products by cosine similarity
 * against their stored image embeddings. No keyword/tag heuristics involved.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return ApiResponse.validationError('Bitte lade ein Bild hoch.');
    }
    if (!file.type.startsWith('image/')) {
      return ApiResponse.validationError('Nur Bilddateien werden unterstuetzt.');
    }
    if (file.size > 8 * 1024 * 1024) {
      return ApiResponse.validationError('Das Bild darf maximal 8 MB gross sein.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const queryEmbedding = await embedImageFromBase64(base64, file.type);
    if (!queryEmbedding) {
      return ApiResponse.error('Die Bildsuche ist gerade nicht verfuegbar. Bitte versuche es spaeter erneut.');
    }

    const images = await prisma.productImage.findMany({
      where: {
        product: { status: 'ACTIVE' },
        embedding: { isEmpty: false },
      },
      select: {
        embedding: true,
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            originalPrice: true,
            brand: true,
            size: true,
            condition: true,
            likes: true,
            ecoCO2Saved: true,
            images: { orderBy: { orderIndex: 'asc' }, take: 1, select: { url: true } },
            seller: { select: { name: true } },
          },
        },
      },
    });

    const bestPerProduct = new Map<string, { product: (typeof images)[number]['product']; score: number }>();

    for (const image of images) {
      if (!image.product) continue;
      const score = cosineSimilarity(queryEmbedding, image.embedding);
      const existing = bestPerProduct.get(image.product.id);
      if (!existing || score > existing.score) {
        bestPerProduct.set(image.product.id, { product: image.product, score });
      }
    }

    const results = [...bestPerProduct.values()]
      .filter((entry) => entry.score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((entry) => ({ ...entry.product, similarity: entry.score }));

    return ApiResponse.success({ items: results, matchType: 'visual-embedding', scanned: images.length });
  } catch (error) {
    return respondWithApiError('POST /api/search/image error', error);
  }
}
