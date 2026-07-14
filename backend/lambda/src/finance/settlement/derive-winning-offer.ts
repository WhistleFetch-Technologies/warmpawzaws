/**
 * Derive winning offer from discount amounts — Apply Best Offer Only (max customer savings).
 */
import type { SettlementFundingType, SettlementOfferType, WinningOfferSnapshot } from './types';

export type DiscountCandidateInput = {
  offerType: SettlementOfferType;
  fundingType: SettlementFundingType;
  discountAmount: number;
  offerId?: string;
  offerName?: string;
  vendorShare?: number;
  platformShare?: number;
  sharedSplit?: { platformPercent: number; vendorPercent: number };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pick single winning offer by maximum customer savings (Policy Center default). */
export function deriveWinningOfferByMaxSavings(
  vendorBasePrice: number,
  candidates: DiscountCandidateInput[]
): WinningOfferSnapshot | null {
  const eligible = candidates.filter((c) => c.discountAmount > 0);
  if (!eligible.length) return null;

  const withEffective = eligible.map((c) => {
    let amount = c.discountAmount;
    if (c.fundingType === 'VENDOR' && c.offerType.includes('PROMOTION')) {
      const pct = vendorBasePrice > 0 ? (c.discountAmount / vendorBasePrice) * 100 : 0;
      if (pct > 0 && pct <= 100 && c.discountAmount < vendorBasePrice * 0.99) {
        amount = round2(vendorBasePrice * (pct / 100));
      }
    }
    return { ...c, effectiveSavings: amount };
  });

  withEffective.sort((a, b) => b.effectiveSavings - a.effectiveSavings);
  const winner = withEffective[0];
  return {
    offerType: winner.offerType,
    fundingType: winner.fundingType,
    discountAmount: round2(winner.discountAmount),
    offerId: winner.offerId,
    offerName: winner.offerName,
    vendorShare: winner.vendorShare,
    platformShare: winner.platformShare,
    sharedSplit: winner.sharedSplit,
  };
}

export type FinancialMetaDiscountInput = {
  vendorBasePrice: number;
  vendorDiscount?: number;
  platformDiscount?: number;
  couponDiscount?: number;
  /** When coupon is vendor-funded vs platform-funded */
  couponFundingType?: SettlementFundingType;
  vendorPromotionId?: string;
  platformPromotionId?: string;
  couponId?: string;
  /** Explicit winning offer from resolver (preferred) */
  winningOffer?: WinningOfferSnapshot | null;
};

/** Build winning offer from wp_financial_meta discount fields or explicit winner. */
export function resolveWinningOfferFromFinancialMeta(
  input: FinancialMetaDiscountInput
): WinningOfferSnapshot | null {
  if (input.winningOffer) return input.winningOffer;

  const candidates: DiscountCandidateInput[] = [];

  const vd = round2(Math.max(0, input.vendorDiscount ?? 0));
  if (vd > 0) {
    candidates.push({
      offerType: 'VENDOR_PROMOTION',
      fundingType: 'VENDOR',
      discountAmount: vd,
      offerId: input.vendorPromotionId,
    });
  }

  const pd = round2(Math.max(0, input.platformDiscount ?? 0));
  if (pd > 0) {
    candidates.push({
      offerType: 'PLATFORM_PROMOTION',
      fundingType: 'PLATFORM',
      discountAmount: pd,
      offerId: input.platformPromotionId,
    });
  }

  const cd = round2(Math.max(0, input.couponDiscount ?? 0));
  if (cd > 0) {
    const couponFunding = input.couponFundingType ?? 'PLATFORM';
    candidates.push({
      offerType: couponFunding === 'VENDOR' ? 'VENDOR_COUPON' : 'PLATFORM_COUPON',
      fundingType: couponFunding,
      discountAmount: cd,
      offerId: input.couponId,
    });
  }

  return deriveWinningOfferByMaxSavings(input.vendorBasePrice, candidates);
}

export function fundingTypeFromOfferType(offerType: SettlementOfferType): SettlementFundingType {
  if (offerType.startsWith('VENDOR')) return 'VENDOR';
  if (offerType.startsWith('PLATFORM')) return 'PLATFORM';
  if (offerType === 'SHARED' || offerType === 'CAMPAIGN') return 'SHARED';
  return 'PLATFORM';
}
