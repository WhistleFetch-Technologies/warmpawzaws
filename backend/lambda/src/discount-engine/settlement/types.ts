import type { DiscountFunding } from '../enums/discount-funding';
import type { AppliedDiscount } from '../models/discount-result';
import type { DiscountContext } from '../models/discount-context';
import type { RuntimePolicy } from '../policy/runtime-policy';
import type { SettlementMode } from './settlement-mode';

export interface SharedDiscountShare {
  platform: number;
  vendor: number;
  total: number;
}

export interface AppliedFundingLine {
  discountId: string;
  name: string;
  funding: DiscountFunding;
  discountAmount: number;
  platformShare: number;
  vendorShare: number;
  order: number;
  sharedSplit?: { platformPercent: number; vendorPercent: number };
}

export interface SettlementFeeBreakdown {
  platformFees: number;
  convenienceFees: number;
  deliveryFees: number;
  packagingFees: number;
  taxes: number;
}

export interface SettlementAudit {
  mode: SettlementMode;
  settlementVersion: string;
  policyFingerprint: string;
  originalAmount: number;
  customerPaid: number;
  totalDiscount: number;
  vendorDiscountShare: number;
  platformDiscountShare: number;
  sharedDiscountShare: SharedDiscountShare;
  vendorReceivable: number;
  platformCost: number;
  platformReceivable: number;
  netSettlement: number;
  appliedFunding: AppliedFundingLine[];
  fees: SettlementFeeBreakdown;
  executionTimeMs: number;
  timestamp: string;
}

export interface SettlementPreview extends SettlementAudit {
  /** Alias for resolver `DiscountSettlementPreview` compatibility. */
  customerPayable: number;
  vendorCost: number;
}

export interface SettlementEngineInput {
  context: DiscountContext;
  applied: AppliedDiscount[];
  originalAmount: number;
  customerPayable: number;
  totalSavings: number;
  runtimePolicy: RuntimePolicy;
  policyFingerprint: string;
}

export interface SettlementDecision {
  preview: SettlementPreview;
  audit: SettlementAudit;
}

export interface ResolvedSettlementPolicy {
  version: string;
  sharedDefaultSplit: { platformPercent: number; vendorPercent: number };
  roundTo: number;
  currency: string;
}

export interface FundingAllocationResult {
  platformShare: number;
  vendorShare: number;
  lines: AppliedFundingLine[];
}
