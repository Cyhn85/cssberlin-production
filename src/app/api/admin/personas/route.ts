import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';
import { randomUUID } from 'crypto';

const createSchema = z.object({
  name: z.string().min(2).max(60),
  avatar: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(80).optional().nullable(),
});

/**
 * GET /api/admin/personas - Persona (pool) seller accounts managed by the
 * currently signed-in admin. Real User rows, never independently logged
 * into — see src/lib/persona-auth.ts.
 */
export async function GET() {
  try {
    const session = await requireAdmin();

    const personas = await prisma.user.findMany({
      where: { isPersonaAccount: true, managedByUserId: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        bio: true,
        location: true,
        isSuspended: true,
        createdAt: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return ApiResponse.success(personas);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}

/**
 * POST /api/admin/personas - Create a new persona seller account owned by
 * the current admin. Content (name/avatar/bio/location) must be real and
 * presentable - this endpoint only builds the account, it never invents an
 * identity.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Ungueltige Eingabe.');
    }

    const persona = await prisma.user.create({
      data: {
        // Structurally required unique field for a User row that nobody logs
        // into directly; not a real inbox. See plan notes on this necessity.
        email: `persona-${randomUUID()}@personas.cssberlin.internal`,
        name: parsed.data.name,
        avatar: parsed.data.avatar || null,
        bio: parsed.data.bio || null,
        location: parsed.data.location || null,
        isPersonaAccount: true,
        managedByUserId: session.user.id,
        isVerified: true,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        location: true,
        isSuspended: true,
        createdAt: true,
      },
    });

    return ApiResponse.created(persona);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
