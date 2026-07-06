/**
 * Persist V2 settlement preview into booking financial metadata when settlement mode is authoritative.
 */
import { isSettlementAuthoritative } from '../settlement/settlement-mode';
import type { DiscountSettlementPreview } from '../models/discount-result';

export function appendSettlementPreviewToFinancialMeta(
  financialMeta: Record<string, unknown>,
  settlement?: DiscountSettlementPreview
): Record<string, unknown> {
  if (!isSettlementAuthoritative() || !settlement) {
    return financialMeta;
  }
  return {
    ...financialMeta,
    discountSettlementPreview: settlement,
    discountSettlementVersion: settlement.settlementVersion ?? '1.0.0',
    policyFingerprint: settlement.policyFingerprint,
  };
}

export function extractResolverSettlementFromMeta(
  meta: Record<string, unknown> | undefined
): DiscountSettlementPreview | undefined {
  if (!meta) return undefined;
  const preview = meta.discountSettlementPreview;
  if (preview && typeof preview === 'object') {
    return preview as DiscountSettlementPreview;
  }
  return undefined;
}
