import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  const readyCheck = request.nextUrl.searchParams.get('ready') === '1';
  const checks: Record<string, string> = {
    app: 'ok',
    auth: process.env.NEXTAUTH_SECRET ? 'configured' : 'missing_secret',
  };

  if (!readyCheck) {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';

    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    console.error('GET /api/health error:', error);
    checks.database = 'unavailable';

    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks,
      },
      { status: 503 }
    );
  }
}
