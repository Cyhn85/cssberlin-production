import { ApiResponse } from '@/lib/api-response';

const DATABASE_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P5010']);
const DATABASE_UNAVAILABLE_NAMES = new Set([
  'PrismaClientInitializationError',
  'PrismaClientRustPanicError',
]);
const DATABASE_UNAVAILABLE_PATTERNS = [
  /can't reach database server/i,
  /database .* not reachable/i,
  /database is currently unavailable/i,
  /environment variable not found: database_url/i,
  /econnrefused/i,
  /connection terminated unexpectedly/i,
  /timed out fetching a new connection/i,
];

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: string }).code);
  }

  return undefined;
}

function getErrorName(error: unknown) {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name?: string }).name);
  }

  return undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return undefined;
}

export function isDatabaseUnavailableError(error: unknown) {
  const errorCode = getErrorCode(error);
  if (errorCode && DATABASE_UNAVAILABLE_CODES.has(errorCode)) {
    return true;
  }

  const errorName = getErrorName(error);
  if (errorName && DATABASE_UNAVAILABLE_NAMES.has(errorName)) {
    return true;
  }

  const message = getErrorMessage(error);
  return message ? DATABASE_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message)) : false;
}

export function respondWithApiError(context: string, error: unknown) {
  console.error(`${context}:`, error);

  if (isDatabaseUnavailableError(error)) {
    return ApiResponse.error('Datenbank ist derzeit nicht erreichbar.', 503);
  }

  return ApiResponse.serverError();
}

export function respondWithPublicApiFallback<T extends Record<string, unknown>>(
  context: string,
  error: unknown,
  fallbackData: T
) {
  if (isDatabaseUnavailableError(error)) {
    console.warn(`${context}: serving degraded public fallback`, error);
    return ApiResponse.success({
      ...fallbackData,
      degraded: true,
    });
  }

  return respondWithApiError(context, error);
}
