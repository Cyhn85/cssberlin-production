import { ApiResponse } from '@/lib/api-response';
import { OrderTransitionError } from '@/lib/order-state';

/** Shared error mapping for the order routes. */
export function orderErrorResponse(error: any, label: string) {
  if (error?.name === 'AuthError') return ApiResponse.unauthorized();
  if (error instanceof OrderTransitionError) return ApiResponse.error(error.message, error.status);
  console.error(`${label} error:`, error);
  return ApiResponse.serverError();
}
