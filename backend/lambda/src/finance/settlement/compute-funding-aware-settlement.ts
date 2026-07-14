/**
 * Finance S2 — authoritative commission base + settlement amounts.
 * Discount Engine provides funding; Finance provides commission rate only.
 */
import type {
  ComputeFundingAwareSettlementInput,
  ComputeFundingAwareSettlementResult,
  FundingSummarySnapshot,
  SettlementFundingType,
  WinningOfferSnapshot,
} from './types';
import { SETTLEMENT_SNAPSHOT_VERSION as SNAPSHOT_VERSION } from './types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function vendorReductionFromOffer(
  vendorBasePrice: number,
  offer: WinningOfferSnapshot | null
): { commissionBase: number; vendorCost: number; platformCost: number; funding: FundingSummarySnapshot } {
  const emptyFunding: FundingSummarySnapshot = {
    vendorPaid: 0,
    platformPaid: 0,
    sharedVendorPaid: 0,
    sharedPlatformPaid: 0,
    campaignPaid: 0,
  };

  if (!offer || offer.discountAmount <= 0) {
    return {
      commissionBase: vendorBasePrice,
      vendorCost: 0,
      platformCost: 0,
      funding: emptyFunding,
    };
  }

  const funding = { ...emptyFunding };
  const { fundingType, discountAmount, offerType } = offer;

  switch (fundingType) {
    case 'PLATFORM': {
      funding.platformPaid = discountAmount;
      if (offerType === 'CAMPAIGN') funding.campaignPaid = discountAmount;
      return {
        commissionBase: vendorBasePrice,
        vendorCost: 0,
        platformCost: discountAmount,
        funding,
      };
    }
    case 'VENDOR': {
      funding.vendorPaid = discountAmount;
      const base = round2(Math.max(0, vendorBasePrice - discountAmount));
      return {
        commissionBase: base,
        vendorCost: discountAmount,
        platformCost: 0,
        funding,
      };
    }
    case 'SHARED': {
      const vendorShare =
        offer.vendorShare ??
        round2(discountAmount * ((offer.sharedSplit?.vendorPercent ?? 50) / 100));
      const platformShare =
        offer.platformShare ?? round2(Math.max(0, discountAmount - vendorShare));
      funding.sharedVendorPaid = vendorShare;
      funding.sharedPlatformPaid = platformShare;
      funding.vendorPaid = vendorShare;
      funding.platformPaid = platformShare;
      const base = round2(Math.max(0, vendorBasePrice - vendorShare));
      return {
        commissionBase: base,
        vendorCost: vendorShare,
        platformCost: platformShare,
        funding,
      };
    }
    default:
      return {
        commissionBase: vendorBasePrice,
        vendorCost: 0,
        platformCost: 0,
        funding: emptyFunding,
      };
  }
}

/** Map offer type to funding when only type is known (Rules 1–4). */
export function commissionBaseForOfferType(
  vendorBasePrice: number,
  offerType: WinningOfferSnapshot['offerType'],
  discountAmount: number,
  fundingType?: SettlementFundingType
): number {
  const ft = fundingType ?? (offerType.startsWith('VENDOR') ? 'VENDOR' : 'PLATFORM');
  const offer: WinningOfferSnapshot = {
    offerType,
    fundingType: ft,
    discountAmount,
  };
  return vendorReductionFromOffer(vendorBasePrice, offer).commissionBase;
}

/**
 * Compute full funding-aware settlement snapshot.
 * Commission rate MUST come from Finance (caller responsibility).
 */
export function computeFundingAwareSettlement(
  input: ComputeFundingAwareSettlementInput
): ComputeFundingAwareSettlementResult {
  const vendorBasePrice = round2(Math.max(0, input.vendorBasePrice));
  const commissionRate = input.commissionRate;

  const { commissionBase, vendorCost, platformCost, funding } = vendorReductionFromOffer(
    vendorBasePrice,
    input.winningOffer
  );

  const commissionAmount = round2((commissionBase * commissionRate) / 100);
  const vendorSettlement = round2(Math.max(0, commissionBase - commissionAmount));

  const policy = input.commissionPolicy;

  return {
    version: SNAPSHOT_VERSION,
    vendorBasePrice,
    winningOffer: input.winningOffer,
    commissionBase,
    commissionRate,
    commissionAmount,
    vendorSettlement,
    platformCost,
    vendorCost,
    fundingSummary: funding,
    commissionPolicy: {
      tierName: policy?.tier.name ?? null,
      subscriptionActive: policy?.subscription.active ?? false,
      tierSource: policy?.tierSource ?? 'fallback',
      subscriptionSource: policy?.subscriptionSource ?? 'none',
      fallbackSource: policy?.fallbackSource ?? null,
    },
    policyVersion: input.policyVersion,
    policyFingerprint: input.policyFingerprint,
    computedAt: new Date().toISOString(),
  };
}

export { SNAPSHOT_VERSION as SETTLEMENT_SNAPSHOT_VERSION };
