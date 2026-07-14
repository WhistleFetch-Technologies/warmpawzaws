/**
 * Finance S2 settlement integration types.
 * Configurable offer types — future-ready for campaigns, flash sales, membership.
 */
import type { VendorCommissionPolicy } from '../commission/resolve-vendor-commission-policy';

export type SettlementOfferType =
  | 'VENDOR_PROMOTION'
  | 'PLATFORM_PROMOTION'
  | 'VENDOR_COUPON'
  | 'PLATFORM_COUPON'
  | 'CAMPAIGN'
  | 'SHARED'
  | 'OTHER';

export type SettlementFundingType = 'PLATFORM' | 'VENDOR' | 'SHARED';

export interface WinningOfferSnapshot {
  offerType: SettlementOfferType;
  fundingType: SettlementFundingType;
  discountAmount: number;
  offerId?: string;
  offerName?: string;
  vendorShare?: number;
  platformShare?: number;
  sharedSplit?: { platformPercent: number; vendorPercent: number };
}

export interface FundingSummarySnapshot {
  vendorPaid: number;
  platformPaid: number;
  sharedVendorPaid: number;
  sharedPlatformPaid: number;
  campaignPaid: number;
}

export interface SettlementSnapshot {
  version: string;
  vendorBasePrice: number;
  winningOffer: WinningOfferSnapshot | null;
  commissionBase: number;
  commissionRate: number;
  commissionAmount: number;
  vendorSettlement: number;
  platformCost: number;
  vendorCost: number;
  fundingSummary: FundingSummarySnapshot;
  commissionPolicy: Pick<
    VendorCommissionPolicy,
    'tierSource' | 'subscriptionSource' | 'fallbackSource'
  > & {
    tierName: string | null;
    subscriptionActive: boolean;
  };
  policyVersion?: string;
  policyFingerprint?: string;
  computedAt: string;
}

export interface ComputeFundingAwareSettlementInput {
  vendorBasePrice: number;
  winningOffer: WinningOfferSnapshot | null;
  commissionRate: number;
  commissionPolicy?: VendorCommissionPolicy;
  policyVersion?: string;
  policyFingerprint?: string;
}

export interface ComputeFundingAwareSettlementResult extends SettlementSnapshot {}

export const SETTLEMENT_SNAPSHOT_VERSION = '2.0.0';
