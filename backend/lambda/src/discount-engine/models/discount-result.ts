import type { DiscountFunding } from '../enums/discount-funding';
import type { DiscountOwner } from '../enums/discount-owner';
import type { DiscountTrigger } from '../enums/discount-trigger';

/** A single discount application produced by the engine. */
export interface AppliedDiscount {
  id: string;
  name: string;
  owner: DiscountOwner;
  trigger: DiscountTrigger;
  funding?: DiscountFunding;
  discountAmount: number;
  benefitType?: string;
  /** 1-based application order. */
  order: number;
  /** Bridge to legacy source labels during migration. */
  legacySource?: 'vendor' | 'platform' | 'coupon';
  metadata?: Record<string, unknown>;
}

/** Computed benefit breakdown (Phase 3 will populate richly). */
export interface DiscountBenefitLine {
  type: string;
  amount: number;
  description?: string;
}

/**
 * Settlement preview — populated by Settlement Engine (Phase 7).
 * Single source of truth for funding split at checkout/resolver time.
 */
export interface DiscountSettlementPreview {
  customerPayable?: number;
  vendorReceivable?: number;
  platformCost?: number;
  vendorCost?: number;
  platformReceivable?: number;
  vendorDiscountShare?: number;
  platformDiscountShare?: number;
  sharedDiscountShare?: { platform: number; vendor: number; total?: number };
  platformFees?: number;
  convenienceFees?: number;
  deliveryFees?: number;
  packagingFees?: number;
  taxes?: number;
  netSettlement?: number;
  grossBeforeDiscount?: number;
  totalDiscount?: number;
  appliedFunding?: Array<{
    discountId: string;
    name?: string;
    funding: string;
    discountAmount: number;
    platformShare: number;
    vendorShare: number;
    order?: number;
  }>;
  policyFingerprint?: string;
  settlementVersion?: string;
  entries?: Array<{
    party: 'PLATFORM' | 'VENDOR' | 'CUSTOMER';
    role: string;
    amount: number;
  }>;
  audit?: import('../settlement/types').SettlementAudit;
}

/**
 * Unified output from Discount Engine V2.
 * Named DiscountEngineResult to avoid collision with legacy DiscountResult
 * in discount-calculation-service.ts.
 */
export interface DiscountEngineResult {
  originalAmount: number;
  totalSavings: number;
  finalAmount: number;
  applied: AppliedDiscount[];
  benefits: DiscountBenefitLine[];
  settlement?: DiscountSettlementPreview;
  messages: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export function emptyDiscountEngineResult(originalAmount: number): DiscountEngineResult {
  return {
    originalAmount,
    totalSavings: 0,
    finalAmount: originalAmount,
    applied: [],
    benefits: [],
    messages: [],
    warnings: [],
  };
}
