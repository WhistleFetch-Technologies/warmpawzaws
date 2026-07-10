/**
 * Resolve e-commerce product GST inputs for taxCalculationService.
 * Mirrors resolve-service-booking-tax-item.ts for the product/order path.
 *
 * Decision (locked in, see Ecommerce Settlement Engine plan): all product catalog
 * prices are GST-inclusive MRP. GST is ALWAYS computed on the ORIGINAL per-line
 * price — never on a discounted amount, regardless of whether a vendor or admin
 * promotion applied. This function must never receive a discounted amount.
 */

import type { TaxItem } from '../lib/services/tax-calculation-service';

export type EcommerceProductTaxLineInput = {
  productId: string;
  /** ORIGINAL unit price (never post-discount). */
  unitPrice: number;
  quantity: number;
  hsnCode?: string | null;
};

export function buildEcommerceProductTaxItems(
  lines: EcommerceProductTaxLineInput[]
): TaxItem[] {
  return lines.map((line) => ({
    id: line.productId,
    type: 'product' as const,
    hsnCode: line.hsnCode ? String(line.hsnCode).trim() || undefined : undefined,
    amount: line.unitPrice,
    quantity: line.quantity,
    // MRP is always GST-inclusive per locked business decision — never derived from
    // whether a discount applied.
    amountIsTaxInclusive: true,
  }));
}
