/**
 * Stripe Server Instance for cssberlin.de
 * Only initialized when STRIPE_SECRET_KEY is configured
 */

let stripeInstance: any = null;

export async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
  }

  if (!stripeInstance) {
    const Stripe = (await import('stripe')).default;
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }

  return stripeInstance;
}

/**
 * Stripe Constants
 */
export const STRIPE_CONFIG = {
  // Käuferschutz (Buyer Protection) fees
  BUYER_PROTECTION_RATE: 0.05, // 5% of item price
  BUYER_PROTECTION_FIXED: 0.99, // + €0.99 fixed fee

  // Platform commission
  PLATFORM_FEE_RATE: 0.0, // 0% for now (revenue from Käuferschutz only)

  // Supported payment methods in Germany
  PAYMENT_METHODS: ['card', 'sepa_debit', 'klarna', 'giropay'] as const,

  // Currency
  CURRENCY: 'eur' as const,
};

/**
 * Calculate total order amount
 */
export function calculateOrderAmount(itemPrice: number, shippingFee: number) {
  const protectionFee =
    Math.round(
      (itemPrice * STRIPE_CONFIG.BUYER_PROTECTION_RATE + STRIPE_CONFIG.BUYER_PROTECTION_FIXED) * 100
    ) / 100;

  const totalAmount = Math.round((itemPrice + shippingFee + protectionFee) * 100) / 100;

  return {
    itemPrice,
    shippingFee,
    protectionFee,
    totalAmount,
  };
}
