import prisma from '@/lib/db';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { updateProfileSchema } from '@/lib/validations';
import { geocodePostalCode } from '@/lib/geocode';
import { sanitizePrefs } from '@/config/notification-policy';

/**
 * GET /api/users/me - Get current user's full profile and recent listings
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const [user, rating] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          bio: true,
          location: true,
          postalCode: true,
          city: true,
          lat: true,
          lng: true,
          notificationPrefs: true,
          offerMinPercent: true,
          avatar: true,
          role: true,
          isVerified: true,
          phoneVerified: true,
          idVerified: true,
          dac7Reported: true,
          ecoCO2Saved: true,
          itemsRecycled: true,
          createdAt: true,
          bundleDiscount: true,
          products: {
            orderBy: { createdAt: 'desc' },
            take: 24,
            include: {
              images: { orderBy: { orderIndex: 'asc' }, take: 1, /* embedding HARIC: ~42 KB/gorsel */ select: { id: true, url: true, thumbUrl: true, mediumUrl: true, orderIndex: true, productId: true, angle: true } },
              category: { select: { id: true, name: true, emoji: true } },
              _count: { select: { favorites: true, offers: true } },
            },
          },
          _count: {
            select: {
              products: true,
              ordersAsSeller: { where: { status: 'COMPLETED' } },
              ordersAsBuyer: true,
              followers: true,
              following: true,
              receivedReviews: true,
            },
          },
        },
      }),
      prisma.review.aggregate({
        where: { targetUserId: session.user.id },
        _avg: { rating: true },
      }),
    ]);

    if (!user) return ApiResponse.notFound();

    return ApiResponse.success({
      ...user,
      rating: Math.round((rating._avg.rating || 0) * 10) / 10,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/**
 * PUT /api/users/me - Update current user's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Ungültige Profildaten.');
    }

    if (parsed.data.username) {
      const existing = await prisma.user.findUnique({
        where: { username: parsed.data.username },
      });
      if (existing && existing.id !== session.user.id) {
        return ApiResponse.error('Dieser Benutzername ist bereits vergeben.');
      }
    }

    const { postalCode, city, notificationPrefs, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };

    if (notificationPrefs !== undefined) data.notificationPrefs = sanitizePrefs(notificationPrefs);

    if (postalCode !== undefined) {
      if (postalCode === '') {
        Object.assign(data, { postalCode: null, city: null, lat: null, lng: null });
      } else {
        const geo = await geocodePostalCode(postalCode);
        const cityLabel = geo?.city
          ? geo.district && geo.district !== geo.city ? `${geo.city}-${geo.district}` : geo.city
          : city?.trim() || null;
        Object.assign(data, { postalCode, city: cityLabel, lat: geo?.lat ?? null, lng: geo?.lng ?? null });
        // keep the legacy free-text field in sync for older screens
        if (cityLabel) data.location = `${postalCode} ${cityLabel}`;
      }
    } else if (city !== undefined) {
      data.city = city.trim() || null;
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        location: true,
        postalCode: true,
        city: true,
        lat: true,
        lng: true,
        notificationPrefs: true,
        offerMinPercent: true,
        avatar: true,
      },
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('PUT /api/users/me error:', error);
    return ApiResponse.serverError();
  }
}
