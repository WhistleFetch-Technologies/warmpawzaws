export { resolveVendorCommissionPolicy } from './commission/resolve-vendor-commission-policy';
export type { VendorCommissionPolicy } from './commission/resolve-vendor-commission-policy';

export {
  getFinanceFundingAwareSettlementMode,
  isFinanceFundingAwareSettlementAuthoritative,
  isFinanceFundingAwareSettlementShadow,
  useFundingAwareSettlementBatch,
  useFundingAwareVendorEarnings,
} from './settlement/finance-settlement-mode';

export { computeFundingAwareSettlement, commissionBaseForOfferType } from './settlement/compute-funding-aware-settlement';
export { buildFundingAwareSettlementSnapshot, shouldPersistFundingAwareSnapshot } from './settlement/build-settlement-snapshot';
export {
  attachSettlementSnapshotToFinancialMeta,
  extractSettlementSnapshotFromBooking,
  settlementSnapshotToVendorEarningsMetadata,
} from './settlement/persist-settlement-snapshot';
export { deriveWinningOfferByMaxSavings, resolveWinningOfferFromFinancialMeta } from './settlement/derive-winning-offer';
export type { SettlementSnapshot, WinningOfferSnapshot } from './settlement/types';
