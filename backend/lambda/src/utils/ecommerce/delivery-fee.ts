/** Ecommerce delivery: flat fee on all order values (delivery coupons may waive on client). */
export const ECOMMERCE_DEFAULT_DELIVERY_FEE = 150;

export function computeEcommerceDeliveryFee(_subtotalAfterDiscount?: number): number {
  void _subtotalAfterDiscount;
  return ECOMMERCE_DEFAULT_DELIVERY_FEE;
}
