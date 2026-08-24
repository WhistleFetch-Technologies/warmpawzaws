/**
 * Prefer the stored funding-aware settlement snapshot when vendor_earnings
 * recorded customer-paid (e.g. a ₹40 platform fee) as vendor gross.
 * Does not read or write GST columns.
 */

export type LedgerMoney = {
  gross: number;
  commission: number;
  net: number;
};

export type FundingAwareSnapshotHint = {
  available: boolean;
  fundingType?: string | null;
  winningOfferType?: string | null;
  platformCoupon?: number;
  commissionBase: number;
  commissionAmount: number;
  vendorSettlement: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isPlatformFunded(hint: FundingAwareSnapshotHint): boolean {
  const funding = String(hint.fundingType || '').toUpperCase();
  const offer = String(hint.winningOfferType || '').toUpperCase();
  return funding === 'PLATFORM' || offer === 'PLATFORM_COUPON' || (hint.platformCoupon || 0) > 0.009;
}

function snapshotAddsUp(hint: FundingAwareSnapshotHint): boolean {
  return (
    Math.abs(hint.commissionAmount + hint.vendorSettlement - hint.commissionBase) <= 0.05 &&
    hint.commissionBase > 0.009 &&
    hint.vendorSettlement > 0.009
  );
}

/**
 * When a platform-funded coupon zeroed the customer charge, completion sometimes
 * stored Razorpay ₹40 as vendor gross. The checkout snapshot still has the real
 * vendor settlement (e.g. Chandrali ₹1,799.10). Use that snapshot for reports.
 */
export function correctLedgerFromFundingSnapshot(
  ledger: LedgerMoney,
  hint: FundingAwareSnapshotHint,
  customerPaid = 0,
): LedgerMoney {
  if (!hint.available || !isPlatformFunded(hint) || !snapshotAddsUp(hint)) {
    return ledger;
  }
  if (hint.vendorSettlement <= ledger.net + 0.01) {
    return ledger;
  }
  const usedCustomerPaidAsGross =
    Math.abs(ledger.gross - customerPaid) <= 0.05 || ledger.gross + 0.01 < hint.commissionBase * 0.25;
  if (!usedCustomerPaidAsGross) {
    return ledger;
  }
  return {
    gross: round2(hint.commissionBase),
    commission: round2(hint.commissionAmount),
    net: round2(hint.vendorSettlement),
  };
}

export function resolveStoredGstPercent(params: {
  gstRate?: unknown;
  gstTotal: number;
  taxableValue: number;
}): number {
  const gstTotal = Number(params.gstTotal) || 0;
  if (gstTotal <= 0.009) return 0;
  const stored = Number(params.gstRate);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored * 100) / 100;
  const taxable = Number(params.taxableValue) || 0;
  if (taxable <= 0.009) return 0;
  return Math.round((gstTotal / taxable) * 10000) / 100;
}
