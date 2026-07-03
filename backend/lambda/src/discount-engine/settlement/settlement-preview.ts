import type { DiscountSettlementPreview } from '../models/discount-result';
import type { SettlementAudit, SettlementPreview } from './types';

const SETTLEMENT_VERSION = '1.0.0';

export function buildSettlementPreview(
  audit: Omit<SettlementAudit, 'settlementVersion' | 'timestamp'>,
  started: number
): SettlementDecisionPreview {
  const timestamp = new Date().toISOString();
  const fullAudit: SettlementAudit = {
    ...audit,
    settlementVersion: SETTLEMENT_VERSION,
    timestamp,
    executionTimeMs: Date.now() - started,
  };

  const preview: SettlementPreview = {
    ...fullAudit,
    customerPayable: fullAudit.customerPaid,
    vendorCost: fullAudit.vendorDiscountShare,
  };

  return { preview, audit: fullAudit };
}

export interface SettlementDecisionPreview {
  preview: SettlementPreview;
  audit: SettlementAudit;
}

/** Maps engine preview to resolver-facing DiscountSettlementPreview. */
export function toDiscountSettlementPreview(preview: SettlementPreview): DiscountSettlementPreview {
  return {
    customerPayable: preview.customerPayable,
    vendorReceivable: preview.vendorReceivable,
    platformCost: preview.platformCost,
    vendorCost: preview.vendorCost,
    platformReceivable: preview.platformReceivable,
    vendorDiscountShare: preview.vendorDiscountShare,
    platformDiscountShare: preview.platformDiscountShare,
    sharedDiscountShare: preview.sharedDiscountShare,
    platformFees: preview.fees.platformFees,
    convenienceFees: preview.fees.convenienceFees,
    deliveryFees: preview.fees.deliveryFees,
    packagingFees: preview.fees.packagingFees,
    taxes: preview.fees.taxes,
    netSettlement: preview.netSettlement,
    grossBeforeDiscount: preview.originalAmount,
    totalDiscount: preview.totalDiscount,
    appliedFunding: preview.appliedFunding,
    policyFingerprint: preview.policyFingerprint,
    settlementVersion: preview.settlementVersion,
    entries: [
      { party: 'CUSTOMER', role: 'PAYABLE', amount: preview.customerPayable },
      { party: 'VENDOR', role: 'RECEIVABLE', amount: preview.vendorReceivable },
      { party: 'PLATFORM', role: 'DISCOUNT_COST', amount: preview.platformCost },
      { party: 'VENDOR', role: 'DISCOUNT_COST', amount: preview.vendorCost },
      { party: 'PLATFORM', role: 'FEE_RECEIVABLE', amount: preview.platformReceivable },
    ],
    audit: preview,
  };
}

export { SETTLEMENT_VERSION };
