import { NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma';
import prisma from '@/lib/db';
import { getOptionalSession, requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { respondWithApiError, respondWithPublicApiFallback } from '@/lib/api-error';
import { createProductSchema } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';
import { embedImageFromUrl } from '@/lib/image-embedding';

function parseNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * GET /api/products - Public product listing with filters and cursor pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const cursor = searchParams.get('cursor') || undefined;
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
    const category = searchParams.get('category') || undefined;
    const sort = searchParams.get('sort') || 'newest';
    const q = searchParams.get('q')?.trim() || undefined;
    const brand = searchParams.get('brand')?.trim() || undefined;
    const size = searchParams.get('size')?.trim() || undefined;
    const condition = searchParams.get('condition') || undefined;
    const minPrice = parseNumber(searchParams.get('minPrice'));
    const maxPrice = parseNumber(searchParams.get('maxPrice'));
    const sellerId = searchParams.get('sellerId') || undefined;
    const includeAll = searchParams.get('includeAll') === 'true';

    let session = null;
    if (sellerId && includeAll) {
      try {
        session = await getOptionalSession();
      } catch (sessionError) {
        console.warn('GET /api/products optional session unavailable, continuing publicly:', sessionError);
      }
    }

    const where: Prisma.ProductWhereInput = {};

    if (sellerId) {
      where.sellerId = sellerId;
      if (!(includeAll && session?.user?.id === sellerId)) {
        where.status = 'ACTIVE';
      }
    } else {
      where.status = 'ACTIVE';
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = {
        OR: [
          { id: category },
          { name: { equals: category, mode: 'insensitive' } },
          { parent: { name: { equals: category, mode: 'insensitive' } } },
        ],
      };
    }

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (size) {
      where.size = { equals: size, mode: 'insensitive' };
    }

    if (condition) {
      where.condition = condition as any;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = {
      createdAt: 'desc',
    };

    if (sort === 'price_asc') orderBy = { price: 'asc' };
    else if (sort === 'price_desc') orderBy = { price: 'desc' };
    else if (sort === 'popular') orderBy = [{ likes: 'desc' }, { views: 'desc' }, { createdAt: 'desc' }];

    const products = await prisma.product.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        images: { orderBy: { orderIndex: 'asc' }, take: 1 },
        seller: { select: { id: true, name: true, avatar: true, username: true, location: true } },
        category: { select: { id: true, name: true, emoji: true } },
        _count: { select: { favorites: true, offers: true } },
      },
    });

    const hasMore = products.length > limit;
    const items = hasMore ? products.slice(0, limit) : products;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return ApiResponse.success({
      items,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return respondWithPublicApiFallback('GET /api/products error', error, {
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  }
}

/**
 * POST /api/products - Create a new product listing (auth required)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const rl = await rateLimit(session.user.id, 'UPLOAD');
    if (!rl.success) return ApiResponse.rateLimited();

    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      });
      return ApiResponse.validationError(errors);
    }

    const data = parsed.data;
    const ecoCO2Saved = calculateEcoImpact(data.price);

    const product = await prisma.product.create({
      data: {
        title: data.title,
        description: data.description || '',
        price: data.price,
        originalPrice: data.originalPrice,
        condition: data.condition,
        size: data.size,
        brand: data.brand,
        shippingCost: data.shippingCost || 0,
        status: data.status || 'ACTIVE',
        ecoCO2Saved,
        categoryId: data.categoryId,
        sellerId: session.user.id,
        images: {
          create: data.imageUrls.map((url, index) => ({
            url,
            orderIndex: index,
          })),
        },
      },
      include: {
        images: { orderBy: { orderIndex: 'asc' } },
        seller: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, emoji: true } },
      },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        itemsRecycled: { increment: 1 },
        ecoCO2Saved: { increment: ecoCO2Saved },
      },
    });

    // Best-effort: generate real visual-search embeddings for each image.
    // Never blocks or fails product creation if this doesn't work.
    try {
      await Promise.all(
        product.images.map(async (image) => {
          const embedding = await embedImageFromUrl(image.url);
          if (embedding) {
            await prisma.productImage.update({
              where: { id: image.id },
              data: { embedding },
            });
          }
        })
      );
    } catch (embeddingError) {
      console.warn('Image embedding generation failed for product', product.id, embeddingError);
    }

    return ApiResponse.created(product);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return respondWithApiError('POST /api/products error', error);
  }
}

function calculateEcoImpact(price: number): number {
  if (price <= 10) return 8;
  if (price <= 30) return 14;
  if (price <= 100) return 20;
  return 30;
}
