import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { MAX_SAVED_SEARCHES } from '@/lib/saved-search-alerts';

const ALLOWED_KEYS = ['q', 'category', 'brand', 'size', 'condition', 'minPrice', 'maxPrice', 'lat', 'lng', 'radius'];

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  query: z.string().max(500),
});

/** Keeps only catalogue filter keys - a saved search can never smuggle other parameters. */
function cleanQuery(raw: string) {
  const src = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  const out = new URLSearchParams();
  for (const k of ALLOWED_KEYS) {
    const v = src.get(k)?.trim();
    if (v) out.set(k, v.slice(0, 80));
  }
  return out.toString();
}

/** GET /api/saved-searches - my saved searches */
export async function GET() {
  try {
    const session = await requireAuth();
    const items = await prisma.savedSearch.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' } });
    return ApiResponse.success(items);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/** POST /api/saved-searches { label, query } - save the current catalogue filter */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiResponse.validationError('Ungültige Suche.');
    const query = cleanQuery(parsed.data.query);
    if (!query) return ApiResponse.validationError('Bitte wähle zuerst einen Suchbegriff oder Filter.');

    const existing = await prisma.savedSearch.findFirst({ where: { userId: session.user.id, query } });
    if (existing) return ApiResponse.success(existing);

    const count = await prisma.savedSearch.count({ where: { userId: session.user.id } });
    if (count >= MAX_SAVED_SEARCHES) {
      return ApiResponse.error(`Du kannst höchstens ${MAX_SAVED_SEARCHES} Suchen speichern. Lösche zuerst eine alte.`);
    }
    const created = await prisma.savedSearch.create({ data: { userId: session.user.id, label: parsed.data.label, query } });
    return ApiResponse.created(created);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}

/** DELETE /api/saved-searches?id=... */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const id = request.nextUrl.searchParams.get('id') || '';
    const { count } = await prisma.savedSearch.deleteMany({ where: { id, userId: session.user.id } });
    if (!count) return ApiResponse.notFound('Suche nicht gefunden.');
    return ApiResponse.success({ deleted: true });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    return ApiResponse.serverError();
  }
}
