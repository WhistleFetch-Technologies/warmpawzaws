/**
 * Finance S2 rollout — funding-aware settlement integration.
 * Default LEGACY preserves existing accrual + batch behavior.
 */
export type FinanceFundingAwareSettlementMode = 'LEGACY' | 'SHADOW' | 'AUTHORITATIVE';

const VALID: FinanceFundingAwareSettlementMode[] = ['LEGACY', 'SHADOW', 'AUTHORITATIVE'];

export function getFinanceFundingAwareSettlementMode(): FinanceFundingAwareSettlementMode {
  const raw = process.env.FINANCE_FUNDING_AWARE_SETTLEMENT?.trim().toUpperCase();
  if (raw && VALID.includes(raw as FinanceFundingAwareSettlementMode)) {
    return raw as FinanceFundingAwareSettlementMode;
  }
  return 'LEGACY';
}

export function isFinanceFundingAwareSettlementEnabled(): boolean {
  return getFinanceFundingAwareSettlementMode() !== 'LEGACY';
}

export function isFinanceFundingAwareSettlementShadow(): boolean {
  return getFinanceFundingAwareSettlementMode() === 'SHADOW';
}

export function isFinanceFundingAwareSettlementAuthoritative(): boolean {
  return getFinanceFundingAwareSettlementMode() === 'AUTHORITATIVE';
}

/** When true, vendor_earnings INSERT and batch aggregation use funding-aware paths. */
export function useFundingAwareVendorEarnings(): boolean {
  return isFinanceFundingAwareSettlementAuthoritative();
}

/** When true, calculate-daily aggregates vendor_earnings instead of recalculating bookings. */
export function useFundingAwareSettlementBatch(): boolean {
  return isFinanceFundingAwareSettlementAuthoritative();
}
