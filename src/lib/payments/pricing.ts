import { resolveShippingFee, isPickupCarrier, type ShippingResult } from '@/config/shipping-policy';
import { protectionFeeFor } from '@/config/marketplace-policy';

/**
 * Preisberechnung für den Checkout — dieselbe Funktion für Seite und API.
 * Abholung: kein Versand und kein Käuferschutz (es wird nichts über die
 * Plattform bezahlt, das Geld geht bei der Übergabe direkt an den Verkäufer).
 */
export type CheckoutQuote = {
  itemPrice: number;
  shipping: ShippingResult;
  shippingFee: number;
  protectionFee: number;
  totalAmount: number;
  pickup: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quoteCheckout(params: {
  itemPrice: number;
  productShippingCost?: number | null;
  isFirstOrder?: boolean;
  carrier: string;
}): CheckoutQuote {
  const pickup = isPickupCarrier(params.carrier);
  const shipping = resolveShippingFee({
    itemPrice: params.itemPrice,
    productShippingCost: params.productShippingCost,
    isFirstOrder: params.isFirstOrder,
    shippingMethod: pickup ? 'PICKUP' : params.carrier,
  });
  const protectionFee = pickup ? 0 : protectionFeeFor(params.itemPrice);
  return {
    itemPrice: round2(params.itemPrice),
    shipping,
    shippingFee: shipping.fee,
    protectionFee,
    totalAmount: round2(params.itemPrice + shipping.fee + protectionFee),
    pickup,
  };
}
