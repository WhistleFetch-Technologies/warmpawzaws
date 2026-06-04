/** MRP vs selling price — mirrors backend/lambda product-ecommerce-pricing. */

export function productDiscountPercent(mrp: number, sellingPrice: number): number {
  if (!mrp || mrp <= sellingPrice) return 0;
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

export function formatVendorProductSellingDisplay(
  price: number,
  originalPrice?: number | null,
): { selling: number; mrp?: number; discountPercent: number } {
  const mrp = originalPrice && originalPrice > 0 ? originalPrice : undefined;
  const selling = price > 0 ? price : mrp ?? 0;
  const discountPercent = mrp ? productDiscountPercent(mrp, selling) : 0;
  return { selling, mrp, discountPercent };
}
