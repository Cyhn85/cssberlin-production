import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth';

/**
 * GET /api/auth/session
 * Returns the authenticated session without turning missing auth secrets into a public 500.
 */
export async function GET() {
  try {
    const session = await getOptionalSession();
    return NextResponse.json(session ?? null);
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json(null);
  }
}