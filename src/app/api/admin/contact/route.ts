import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

/** GET /api/admin/contact?status=OPEN|DONE - contact requests and DSA notices */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const status = request.nextUrl.searchParams.get('status') === 'DONE' ? 'DONE' : 'OPEN';
    const items = await prisma.contactRequest.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: 200 });
    return ApiResponse.success(items);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}

/** PUT /api/admin/contact { id, status } */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null);
    if (!body?.id || !['OPEN', 'DONE'].includes(body.status)) return ApiResponse.validationError('Ungültig.');
    const updated = await prisma.contactRequest.update({ where: { id: body.id }, data: { status: body.status } });
    return ApiResponse.success(updated);
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.forbidden(error.message);
    return ApiResponse.serverError();
  }
}
