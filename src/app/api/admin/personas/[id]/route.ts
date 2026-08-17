import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { z } from 'zod/v4';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  avatar: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(80).optional().nullable(),
  isSuspended: z.boolean().optional(),
});

/**
 * GET /api/admin/personas/[id] - Single persona, for the persona-inbox header.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const persona = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, avatar: true, isPersonaAccount: true, managedByUserId: true },
    });

    if (!persona?.isPersonaAccount || persona.managedByUserId !== session.user.id) {
      return ApiResponse.notFound('Persona nicht gefunden.');
    }

    return ApiResponse.success(persona);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}

/**
 * PATCH /api/admin/personas/[id] - Edit a persona's real profile info, or
 * pause it (isSuspended) so it stops receiving new TATANGA-assigned products
 * without deleting it (existing listings/messages must keep a valid seller).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const persona = await prisma.user.findUnique({
      where: { id },
      select: { isPersonaAccount: true, managedByUserId: true },
    });
    if (!persona?.isPersonaAccount || persona.managedByUserId !== session.user.id) {
      return ApiResponse.notFound('Persona nicht gefunden.');
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return ApiResponse.validationError(parsed.error.issues[0]?.message || 'Ungueltige Eingabe.');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        location: true,
        isSuspended: true,
      },
    });

    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
