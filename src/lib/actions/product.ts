'use server';

import prisma from '@/lib/db';
import { Prisma } from '@/generated/prisma';
import { getSession } from '@/lib/auth';

export type SearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  size?: string;
  condition?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
  cursor?: string;
  limit?: number;
};

/**
 * Advanced Search & Filter Algorithm with cursor pagination
 */
export async function searchProducts(params: SearchParams) {
  try {
    const {
      q, category, brand, size, condition,
      minPrice, maxPrice, sort = 'newest',
      cursor, limit = 20,
    } = params;

    const take = Math.min(limit, 50);

    // Build Query Filters
    const whereClause: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
    };

    if (q) {
      whereClause.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (category) {
      // Support both category name and ID
      whereClause.OR = whereClause.OR
        ? undefined // If text search active, filter after
        : undefined;
      whereClause.category = {
        OR: [
          { name: { equals: category, mode: 'insensitive' } },
          { id: category },
          // Also include subcategories
          { parent: { name: { equals: category, mode: 'insensitive' } } },
        ],
      };
    }

    if (brand) whereClause.brand = { equals: brand, mode: 'insensitive' };
    if (size) whereClause.size = { equals: size, mode: 'insensitive' };
    if (condition) whereClause.condition = condition as any;

    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price.gte = parseFloat(minPrice);
      if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
    }

    // Build Sort
    let orderByClause: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = {
      createdAt: 'desc',
    };

    if (sort === 'price_asc') orderByClause = { price: 'asc' };
    else if (sort === 'price_desc') orderByClause = { price: 'desc' };
    else if (sort === 'popular') orderByClause = [{ likes: 'desc' }, { views: 'desc' }];

    // Execute with cursor pagination
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: orderByClause,
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        images: { orderBy: { orderIndex: 'asc' }, take: 2 },
        seller: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, emoji: true } },
        _count: { select: { favorites: true } },
      },
    });

    const hasMore = products.length > take;
    const items = hasMore ? products.slice(0, take) : products;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return {
      success: true,
      data: { items, nextCursor, hasMore },
    };
  } catch (error) {
    console.error('Search Engine Error:', error);
    return {
      success: false,
      data: { items: [], nextCursor: null, hasMore: false },
      error: 'Fehler beim Laden der Produkte.',
    };
  }
}

/**
 * Main Category Map Retrieval
 */
export async function getCategoryTree() {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
    });
    return categories;
  } catch (error) {
    console.error('Category Tree Error', error);
    return [];
  }
}

/**
 * Get dynamic filter options from actual products in DB
 */
export async function getFilterOptions() {
  try {
    const [brands, sizes, categories] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'ACTIVE', brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
        take: 50,
      }),
      prisma.product.findMany({
        where: { status: 'ACTIVE', size: { not: null } },
        select: { size: true },
        distinct: ['size'],
        take: 30,
      }),
      prisma.category.findMany({
        where: { parentId: null },
        select: { id: true, name: true, emoji: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      brands: brands.map((b) => b.brand!).filter(Boolean),
      sizes: sizes.map((s) => s.size!).filter(Boolean),
      categories: categories,
    };
  } catch (error) {
    console.error('Filter Options Error:', error);
    return { brands: [], sizes: [], categories: [] };
  }
}

/**
 * Get current user's own products
 */
export async function getMyProducts() {
  try {
    const session = await getSession();
    if (!session?.user?.id) return [];

    return prisma.product.findMany({
      where: { sellerId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { orderIndex: 'asc' }, take: 1 },
        _count: { select: { favorites: true, offers: true } },
      },
    });
  } catch (error) {
    console.error('My Products Error:', error);
    return [];
  }
}

/**
 * Get featured products for homepage (newest active + most liked)
 */
export async function getFeaturedProducts() {
  try {
    return prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ likes: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      include: {
        images: { orderBy: { orderIndex: 'asc' }, take: 1 },
        seller: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, emoji: true } },
      },
    });
  } catch (error) {
    console.error('Featured Products Error:', error);
    return [];
  }
}

/**
 * Get community eco stats for homepage
 */
export async function getCommunityEcoStats() {
  try {
    const stats = await prisma.user.aggregate({
      _sum: { ecoCO2Saved: true, itemsRecycled: true },
      _count: true,
    });
    return {
      totalCO2Saved: Math.round((stats._sum.ecoCO2Saved || 0) * 10) / 10,
      totalItemsRecycled: stats._sum.itemsRecycled || 0,
      totalUsers: stats._count,
    };
  } catch {
    return { totalCO2Saved: 0, totalItemsRecycled: 0, totalUsers: 0 };
  }
}
