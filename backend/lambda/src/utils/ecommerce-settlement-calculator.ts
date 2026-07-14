/**
 * Pure e-commerce settlement math — single source of truth for every scenario.
 *
 * P    = original unit price × qty, summed              (GST-inclusive catalog price)
 * D    = discount amount from the ONE selected promotion  (vendor or admin — never both)
 * Paid = P − D                                          (customer pays for goods)
 *
 * Commission taxable base:
 *   - No promo / admin-funded: T from original P  (platform absorbs D; vendor settles on P)
 *   - Vendor-funded:           T from Paid (= P − D)  — commission on discounted amount
 *
 * G    = commissionBaseMerchandise − T                (GST on the commission base, informational)
 * Comm = T × commissionRate/100
 *
 * Vendor payout (goods portion):
 *   - No promo         : vendor = P − Comm,            platform = Comm
 *   - Vendor promo      : vendor = (P − D) − Comm,      platform = Comm
 *   - Admin/platform    : vendor = P − Comm,            platform = Comm − D  (can be negative)
 *
 * Reconciliation invariant (always holds): (P − D) = vendorPayout + platformNet
 */

export type PromotionSource = 'vendor' | 'admin' | null;

export type EcommerceSettlementInput = {
  /** Original GST-inclusive catalog price x qty, summed across the order's lines. Never discounted. */
  merchandiseValue: number;
  /** Blended GST rate (%) implied by taxableValue vs merchandiseValue; only used if taxableValue is omitted. */
  gstRate?: number;
  /**
   * Taxable value T for the original merchandise P (ex-GST).
   * When omitted, derived from merchandiseValue and gstRate.
   * For vendor-funded discounts, commission is recomputed from discounted goods (P − D).
   */
  taxableValue?: number;
  commissionRate: number;
  /** Who funded the single active discount for this order. null/undefined = no discount. */
  promotionSource: PromotionSource;
  /** Discount amount D. Ignored (treated as 0) when promotionSource is null. */
  discountAmount?: number;
};

export type EcommerceSettlementResult = {
  merchandiseValue: number;
  /** Taxable base used for commission (discounted when vendor-funded). */
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

/** Infer GST % from inclusive merchandise and its ex-GST taxable value. */
export function inferGstRateFromTaxable(merchandiseValue: number, taxableValue: number): number {
  if (!(merchandiseValue > 0) || !(taxableValue > 0) || taxableValue >= merchandiseValue) {
    return 0;
  }
  return (merchandiseValue / taxableValue - 1) * 100;
}

export function calculateEcommerceSettlement(
  input: EcommerceSettlementInput
): EcommerceSettlementResult {
  const merchandiseValue = Math.max(0, Number(input.merchandiseValue) || 0);
  const originalTaxable = roundMoney(
    input.taxableValue != null
      ? Number(input.taxableValue) || 0
      : computeTaxableValue(merchandiseValue, Number(input.gstRate) || 0)
  );
  const gstRate =
    Number(input.gstRate) > 0
      ? Number(input.gstRate)
      : inferGstRateFromTaxable(merchandiseValue, originalTaxable);
  const commissionRate = Math.max(0, Number(input.commissionRate) || 0);

  const promotionSource = input.promotionSource ?? null;
  const discountAmount =
    promotionSource != null ? Math.max(0, Number(input.discountAmount) || 0) : 0;
  const customerPayableGoods = roundMoney(Math.max(0, merchandiseValue - discountAmount));

  // Vendor-funded: commission on discounted goods. Otherwise on original catalog taxable.
  const commissionMerchandise =
    promotionSource === 'vendor' ? customerPayableGoods : merchandiseValue;
  const taxableValue = roundMoney(
    promotionSource === 'vendor'
      ? computeTaxableValue(commissionMerchandise, gstRate)
      : originalTaxable
  );
  const gstAmount = roundMoney(Math.max(0, commissionMerchandise - taxableValue));
  const commissionAmount = roundMoney((taxableValue * commissionRate) / 100);

  let vendorPayoutAmount: number;
  let platformNetAmount: number;

  if (promotionSource === 'vendor') {
    vendorPayoutAmount = roundMoney(customerPayableGoods - commissionAmount);
    platformNetAmount = commissionAmount;
  } else if (promotionSource === 'admin') {
    vendorPayoutAmount = roundMoney(merchandiseValue - commissionAmount);
    platformNetAmount = roundMoney(commissionAmount - discountAmount);
  } else {
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
    customerPayableGoods,
  };
}

/** Reconciliation invariant check — used by tests and defensive assertions in the processor. */
export function settlementReconciles(result: EcommerceSettlementResult, toleranceRupees = 0.01): boolean {
  const lhs = result.customerPayableGoods;
  const rhs = result.vendorPayoutAmount + result.platformNetAmount;
  return Math.abs(lhs - rhs) <= toleranceRupees;
}
