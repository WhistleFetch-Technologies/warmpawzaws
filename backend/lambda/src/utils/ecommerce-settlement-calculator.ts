/**
 * Pure e-commerce settlement math — single source of truth for every scenario.
 * See the "Ecommerce Settlement Engine" plan §1 for the formulas this implements.
 *
 * P    = original unit price × qty, summed              (GST-inclusive catalog price — "actual price")
 * T    = P / (1 + gstRate/100)                            (taxable value, ALWAYS from original P)
 * G    = P - T                                            (GST amount, informational, ALWAYS from original P)
 * Comm = T × commissionRate/100                           (commission, ALWAYS on original T)
 * D    = discount amount from the ONE selected promotion  (vendor or admin — never both)
 *
 * Vendor payout (goods portion) depends on WHO funded the discount:
 *   - No promo         : vendor = P - Comm,          platform = Comm
 *   - Vendor promo      : vendor = (P - D) - Comm,    platform = Comm            (vendor absorbs D)
 *   - Admin/platform promo: vendor = P - Comm,        platform = Comm - D        (can be negative — platform subsidizes)
 *
 * Reconciliation invariant (always holds): (P - D) = vendorPayout + platformNet
 */

export type PromotionSource = 'vendor' | 'admin' | null;

export type EcommerceSettlementInput = {
  /** Original GST-inclusive catalog price x qty, summed across the order's lines. Never discounted. */
  merchandiseValue: number;
  /** Blended GST rate (%) implied by taxableValue vs merchandiseValue; only used if taxableValue is omitted. */
  gstRate?: number;
  /** Taxable value T. If omitted, derived from merchandiseValue and gstRate. */
  taxableValue?: number;
  commissionRate: number;
  /** Who funded the single active discount for this order. null/undefined = no discount. */
  promotionSource: PromotionSource;
  /** Discount amount D. Ignored (treated as 0) when promotionSource is null. */
  discountAmount?: number;
};

export type EcommerceSettlementResult = {
  merchandiseValue: number;
  taxableValue: number;
  gstAmount: number;
  commissionAmount: number;
  discountAmount: number;
  vendorPayoutAmount: number;
  platformNetAmount: number;
  /** (P - D) — what the customer pays for goods, excluding shipping. */
  customerPayableGoods: number;
};

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function computeTaxableValue(merchandiseValue: number, gstRate: number): number {
  if (!Number.isFinite(gstRate) || gstRate <= 0) return merchandiseValue;
  return merchandiseValue / (1 + gstRate / 100);
}

export function calculateEcommerceSettlement(
  input: EcommerceSettlementInput
): EcommerceSettlementResult {
  const merchandiseValue = Math.max(0, Number(input.merchandiseValue) || 0);
  const taxableValue = roundMoney(
    input.taxableValue != null
      ? Number(input.taxableValue) || 0
      : computeTaxableValue(merchandiseValue, Number(input.gstRate) || 0)
  );
  const gstAmount = roundMoney(merchandiseValue - taxableValue);
  const commissionRate = Math.max(0, Number(input.commissionRate) || 0);
  const commissionAmount = roundMoney((taxableValue * commissionRate) / 100);

  const promotionSource = input.promotionSource ?? null;
  const discountAmount =
    promotionSource != null ? Math.max(0, Number(input.discountAmount) || 0) : 0;

  let vendorPayoutAmount: number;
  let platformNetAmount: number;

  if (promotionSource === 'vendor') {
    // Vendor absorbs the discount in full; commission is unaffected.
    vendorPayoutAmount = roundMoney(merchandiseValue - discountAmount - commissionAmount);
    platformNetAmount = commissionAmount;
  } else if (promotionSource === 'admin') {
    // Platform subsidizes: vendor is paid as if the customer bought at full price.
    vendorPayoutAmount = roundMoney(merchandiseValue - commissionAmount);
    platformNetAmount = roundMoney(commissionAmount - discountAmount);
  } else {
    // No promotion.
    vendorPayoutAmount = roundMoney(merchandiseValue - commissionAmount);
    platformNetAmount = commissionAmount;
  }

  return {
    merchandiseValue: roundMoney(merchandiseValue),
    taxableValue,
    gstAmount,
    commissionAmount,
    discountAmount: roundMoney(discountAmount),
    vendorPayoutAmount: Math.max(0, vendorPayoutAmount),
    platformNetAmount,
    customerPayableGoods: roundMoney(merchandiseValue - discountAmount),
  };
}

/** Reconciliation invariant check — used by tests and defensive assertions in the processor. */
export function settlementReconciles(result: EcommerceSettlementResult, toleranceRupees = 0.01): boolean {
  const lhs = result.customerPayableGoods;
  const rhs = result.vendorPayoutAmount + result.platformNetAmount;
  return Math.abs(lhs - rhs) <= toleranceRupees;
}
