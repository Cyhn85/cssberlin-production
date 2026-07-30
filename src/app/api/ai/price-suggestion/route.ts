import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/price-suggestion — AI-powered price suggestion
 * Analyzes similar sold products + AI recommendation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const rateLimitResult = await rateLimit(session.user.id, 'AI');
    if (!rateLimitResult.success) {
      return ApiResponse.rateLimited();
    }

    const { title, brand, categoryId, condition, originalPrice } = await request.json();

    if (!title) {
      return ApiResponse.error('Titel ist erforderlich.');
    }

    // Find similar products (sold and active) for market analysis
    const similarProducts = await prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: title.split(' ')[0], mode: 'insensitive' as const } },
          ...(brand ? [{ brand: { equals: brand, mode: 'insensitive' as const } }] : []),
          ...(categoryId ? [{ categoryId }] : []),
        ],
        status: { in: ['ACTIVE', 'SOLD'] },
      },
      select: {
        price: true,
        originalPrice: true,
        condition: true,
        status: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics
    const activePrices = similarProducts
      .filter((p) => p.status === 'ACTIVE')
      .map((p) => p.price);
    const soldPrices = similarProducts
      .filter((p) => p.status === 'SOLD')
      .map((p) => p.price);
    const allPrices = similarProducts.map((p) => p.price);

    const avgActive = activePrices.length > 0
      ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length
      : null;
    const avgSold = soldPrices.length > 0
      ? soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length
      : null;

    // Condition multiplier (relative to VERY_GOOD)
    const conditionMultiplier: Record<string, number> = {
      NEW_WITH_TAGS: 1.2,
      NEW_WITHOUT_TAGS: 1.1,
      VERY_GOOD: 1.0,
      GOOD: 0.85,
      ACCEPTABLE: 0.7,
    };

    const multiplier = conditionMultiplier[condition] || 1.0;

    // Calculate suggestion
    let suggestedPrice: number;
    let confidence: 'high' | 'medium' | 'low';

    if (avgSold !== null && soldPrices.length >= 3) {
      // High confidence: enough sold data
      suggestedPrice = avgSold * multiplier;
      confidence = 'high';
    } else if (avgActive !== null) {
      // Medium: use active listings (usually higher)
      suggestedPrice = avgActive * 0.9 * multiplier; // Slightly below active
      confidence = 'medium';
    } else if (originalPrice) {
      // Low: estimate from original price
      suggestedPrice = originalPrice * 0.4 * multiplier;
      confidence = 'low';
    } else {
      return ApiResponse.success({
        suggestedPrice: null,
        confidence: 'low',
        message: 'Nicht genügend Daten für eine Preisempfehlung. Überprüfe ähnliche Angebote im Katalog.',
        marketData: { similarCount: 0 },
      });
    }

    // Round to nice price
    suggestedPrice = Math.round(suggestedPrice * 100) / 100;
    if (suggestedPrice > 10) {
      suggestedPrice = Math.round(suggestedPrice);
    }

    const minPrice = Math.round(suggestedPrice * 0.8 * 100) / 100;
    const maxPrice = Math.round(suggestedPrice * 1.2 * 100) / 100;

    return ApiResponse.success({
      suggestedPrice,
      priceRange: { min: minPrice, max: maxPrice },
      confidence,
      marketData: {
        similarCount: allPrices.length,
        avgActivePrice: avgActive ? Math.round(avgActive * 100) / 100 : null,
        avgSoldPrice: avgSold ? Math.round(avgSold * 100) / 100 : null,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/ai/price-suggestion error:', error);
    return ApiResponse.serverError();
  }
}
