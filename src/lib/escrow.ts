/**
 * Escrow Payment System for cssberlin.de
 *
 * Flow:
 * 1. Buyer pays → Stripe holds funds (PaymentIntent)
 * 2. Seller ships → tracking provided
 * 3. Buyer confirms delivery → status COMPLETED
 * 4. System releases payment to seller (minus platform fee)
 *
 * Dispute flow:
 * - Buyer opens dispute within 2 days of delivery
 * - Payment frozen until admin resolves
 * - Admin can: refund buyer, release to seller, or split
 */

import { getStripe, STRIPE_CONFIG } from './stripe';

interface PayoutResult {
  success: boolean;
  transferId?: string;
  amount?: number;
  error?: string;
}

/**
 * Release escrow payment to seller after buyer confirms delivery
 * Requires seller to have a Stripe Connect account (future feature)
 */
export async function releasePayout(
  paymentIntentId: string,
  sellerStripeAccountId: string | null,
  itemPrice: number
): Promise<PayoutResult> {
  // If no Stripe configured or no seller account, log and skip
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Escrow payout skipped — Stripe not configured');
    return { success: true, amount: itemPrice }; // Dev mode
  }

  if (!sellerStripeAccountId) {
    console.warn('Escrow payout skipped — Seller has no Stripe Connect account');
    return {
      success: false,
      error: 'Seller Stripe account not connected. Manual payout required.',
    };
  }

  try {
    const stripe = await getStripe();

    // Calculate seller payout (item price minus platform fee)
    const platformFee = Math.round(itemPrice * STRIPE_CONFIG.PLATFORM_FEE_RATE * 100);
    const payoutAmount = Math.round(itemPrice * 100) - platformFee;

    const transfer = await stripe.transfers.create({
      amount: payoutAmount,
      currency: STRIPE_CONFIG.CURRENCY,
      destination: sellerStripeAccountId,
      transfer_group: paymentIntentId,
      description: 'cssberlin.de Verkaufserlös',
    });

    return {
      success: true,
      transferId: transfer.id,
      amount: payoutAmount / 100,
    };
  } catch (error: any) {
    console.error('Escrow payout failed:', error);
    return {
      success: false,
      error: error.message || 'Payout failed',
    };
  }
}

/**
 * Refund buyer (full or partial) for disputed orders
 */
export async function refundBuyer(
  paymentIntentId: string,
  amount?: number // If not provided, full refund
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Refund skipped — Stripe not configured');
    return { success: true }; // Dev mode
  }

  try {
    const stripe = await getStripe();

    const refundData: any = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundData);

    return {
      success: true,
      refundId: refund.id,
    };
  } catch (error: any) {
    console.error('Refund failed:', error);
    return {
      success: false,
      error: error.message || 'Refund failed',
    };
  }
}

/**
 * Check payment status for an order
 */
export async function checkPaymentStatus(
  paymentIntentId: string
): Promise<{ status: string; amount: number }> {
  if (!process.env.STRIPE_SECRET_KEY || !paymentIntentId) {
    return { status: 'unknown', amount: 0 };
  }

  try {
    const stripe = await getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      status: intent.status,
      amount: intent.amount / 100,
    };
  } catch (error) {
    console.error('Payment status check failed:', error);
    return { status: 'error', amount: 0 };
  }
}
