/** Ecommerce delivery: free when subtotal (after discounts) >= threshold, else flat fee. */
export const ECOMMERCE_FREE_DELIVERY_MIN_SUBTOTAL = 1000;
export const ECOMMERCE_DEFAULT_DELIVERY_FEE = 150;

export function computeEcommerceDeliveryFee(subtotalAfterDiscount: number): number {
  const subtotal = Number(subtotalAfterDiscount) || 0;
  return subtotal >= ECOMMERCE_FREE_DELIVERY_MIN_SUBTOTAL ? 0 : ECOMMERCE_DEFAULT_DELIVERY_FEE;
}
