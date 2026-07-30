import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * Get the current server-side session.
 * Use in Server Components and API routes.
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Resolve the current session for public routes without turning auth misconfiguration
 * into a 500 for otherwise public pages or APIs.
 */
export async function getOptionalSession() {
  if (!process.env.NEXTAUTH_SECRET) {
    return null;
  }

  try {
    return await getSession();
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : undefined;

    if (errorCode === 'NO_SECRET') {
      return null;
    }

    throw error;
  }
}

/**
 * Require authentication. Throws if not authenticated.
 * Use in API routes that need auth:
 *
 * ```ts
 * const session = await requireAuth();
 * // session.user.id is guaranteed to exist
 * ```
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new AuthError('Nicht autorisiert. Bitte logge dich ein.');
  }

  return session;
}

/**
 * Require admin role. Throws if not admin.
 */
export async function requireAdmin() {
  const session = await requireAuth();

  if (session.user.role !== 'ADMIN') {
    throw new AuthError('Zugriff verweigert. Admin-Rechte erforderlich.');
  }

  return session;
}

/**
 * Custom auth error class for consistent error handling.
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

