import type { Prisma } from '@/generated/prisma';

function parseNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const CONDITIONS = new Set(['NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE']);

/**
 * Catalogue filters from a query string - one implementation for the product
 * API, saved-search alerts and the assistant's product search, so "Levi's bis
 * 40 €" means the same everywhere.
 *
 * Status is NOT set here; callers decide (public lists are ACTIVE only).
 */
export function buildCatalogWhere(searchParams: URLSearchParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const and: Prisma.ProductWhereInput[] = [];

  const q = searchParams.get('q')?.trim();
  const category = searchParams.get('category')?.trim();
  const brand = searchParams.get('brand')?.trim();
  const size = searchParams.get('size')?.trim();
  const condition = searchParams.get('condition')?.trim();
  const minPrice = parseNumber(searchParams.get('minPrice'));
  const maxPrice = parseNumber(searchParams.get('maxPrice'));

  if (q) {
    // every word must match somewhere (title, description or brand)
    for (const word of q.split(/\s+/).filter((w) => w.length > 1).slice(0, 6)) {
      and.push({
        OR: [
          { title: { contains: word, mode: 'insensitive' } },
          { description: { contains: word, mode: 'insensitive' } },
          { brand: { contains: word, mode: 'insensitive' } },
        ],
      });
    }
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

  if (brand) where.brand = { equals: brand, mode: 'insensitive' };
  if (size) where.size = { equals: size, mode: 'insensitive' };
  if (condition && CONDITIONS.has(condition)) where.condition = condition as any;

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = minPrice;
    if (maxPrice !== undefined) where.price.lte = maxPrice;
  }

  // Umkreis-Suche: lat/lng of the searcher (PLZ centroid or browser, with consent) + radius km.
  // Bounding box on the seller's PLZ centroid - cheap, index friendly, good enough at city scale.
  const lat = parseNumber(searchParams.get('lat'));
  const lng = parseNumber(searchParams.get('lng'));
  const radius = parseNumber(searchParams.get('radius'));
  if (lat !== undefined && lng !== undefined && radius && radius > 0 && radius <= 500) {
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    where.seller = { lat: { gte: lat - dLat, lte: lat + dLat }, lng: { gte: lng - dLng, lte: lng + dLng } };
  }

  if (and.length) where.AND = and;
  return where;
}

/** Great-circle distance in km (for "x km entfernt" labels). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
