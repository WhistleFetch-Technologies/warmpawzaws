/** Shop delivery is not charged. Kept so cart and order totals stay on one helper. */
export const ECOMMERCE_DEFAULT_DELIVERY_FEE = 0;

export function computeEcommerceDeliveryFee(_subtotalAfterDiscount?: number): number {
  void _subtotalAfterDiscount;
  return ECOMMERCE_DEFAULT_DELIVERY_FEE;
}
