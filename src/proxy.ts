import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const EXACT_PROTECTED_ROUTES = [
  '/profile',
  '/inbox',
  '/upload',
  '/settings',
  '/dashboard',
  '/purchases',
  '/sales',
  '/favorites',
  '/notifications',
  '/offers',
];

const PREFIX_PROTECTED_ROUTES = ['/checkout', '/purchases', '/sales', '/offers'];

const PROTECTED_API_ROUTES = [
  '/api/products',
  '/api/offers',
  '/api/messages',
  '/api/orders',
  '/api/favorites',
  '/api/reviews',
  '/api/users/me',
  '/api/notifications',
  '/api/checkout',
  '/api/pusher',
  '/api/uploadthing',
  '/api/ai',
];

const AUTH_ROUTES = ['/login', '/register'];
const ADMIN_ROUTES = ['/admin'];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self)',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function isProtectedRoute(pathname: string): boolean {
  if (EXACT_PROTECTED_ROUTES.includes(pathname)) {
    return true;
  }

  return PREFIX_PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isProtectedApiRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/products') && method === 'GET') {
    return false;
  }
  if (pathname.match(/^\/api\/users\/[^/]+$/) && method === 'GET' && !pathname.includes('/me')) {
    return false;
  }
  if (pathname.startsWith('/api/search') && method === 'GET') {
    return false;
  }
  return PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

async function getTokenIfConfigured(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return null;
  }

  try {
    return await getToken({ req: request, secret });
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const needsAuthCheck =
    isProtectedRoute(pathname) ||
    isProtectedApiRoute(pathname, method) ||
    isAuthRoute(pathname) ||
    isAdminRoute(pathname);

  const token = needsAuthCheck ? await getTokenIfConfigured(request) : null;
  const isAuthenticated = !!token;
  const isAdmin = token?.role === 'ADMIN';

  if (isAdminRoute(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    if (!isAdmin) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/', request.url)));
    }
  }

  if (isProtectedRoute(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return addSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isProtectedApiRoute(pathname, method) && !isAuthenticated) {
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Nicht autorisiert. Bitte logge dich ein.' },
        { status: 401 }
      )
    );
  }

  if (isAuthRoute(pathname) && isAuthenticated) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/', request.url)));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};