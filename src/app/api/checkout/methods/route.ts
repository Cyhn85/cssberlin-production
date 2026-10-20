import { ApiResponse } from '@/lib/api-response';
import { listPaymentMethods } from '@/lib/payments/methods';

/** GET /api/checkout/methods - which payment methods are live right now (no secrets, only flags). */
export async function GET() {
  return ApiResponse.success({ methods: listPaymentMethods() });
}
