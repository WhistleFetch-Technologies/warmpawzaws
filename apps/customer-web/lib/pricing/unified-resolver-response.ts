/**
 * Unified Resolver Response — mirrors backend contract.
 * Frontend renders only; never decides promotion/coupon winners.
 */
export type DiscountApplicationStrategy =
  | 'BEST_OFFER_ONLY'
  | 'PROMOTION_PLUS_COUPON'
  | 'STACK_ELIGIBLE'
  | 'FULLY_CONFIGURABLE';

export interface UnifiedResolverAppliedOffer {
  id: string;
  name: string;
  offerType: string;
  source: 'vendor' | 'platform' | 'coupon';
  discountAmount: number;
  trigger: 'AUTO' | 'CODE';
  order: number;
  benefitType?: string;
}

export interface UnifiedResolverRejectedOffer {
  id: string;
  name?: string;
  offerType?: string;
  reason: string;
  reasonCode?: string;
  trigger?: 'AUTO' | 'CODE';
  discountAmount?: number;
}

export interface UnifiedResolverPolicySnapshot {
  applicationStrategy: DiscountApplicationStrategy;
  winningStrategy?: string | null;
  policyFingerprint?: string | null;
  publishId?: string | null;
  policyVersion?: string;
  resolverMode: string;
  settlementMode: string;
  stackMode: string;
  priorityMode: string;
  combinationMatrix?: Array<{ left: string; right: string; allowed: boolean }>;
  featureFlags?: Record<string, string>;
}

export interface UnifiedResolverSavings {
  originalAmount: number;
  totalSavings: number;
  finalAmount: number;
  vendorDiscountAmount: number;
  platformDiscountAmount: number;
  couponDiscountAmount: number;
}

export interface UnifiedResolverDisplayMessage {
  type: 'info' | 'success' | 'warning' | 'error';
  code?: string;
  message: string;
}

export interface UnifiedResolverResponse {
  success: boolean;
  resolverSource: 'v2' | 'legacy';
  resolverVersion?: string;
  currentPolicy: UnifiedResolverPolicySnapshot;
  appliedOffers: UnifiedResolverAppliedOffer[];
  rejectedOffers: UnifiedResolverRejectedOffer[];
  savings: UnifiedResolverSavings;
  funding?: {
    platformCost?: number;
    vendorCost?: number;
    vendorReceivable?: number;
    customerPayable?: number;
    netSettlement?: number;
  };
  displayMessages: UnifiedResolverDisplayMessage[];
  settlementPreview?: Record<string, unknown>;
  vendorPromotionId?: string;
  platformPromotionId?: string;
  winningPromotion?: UnifiedResolverAppliedOffer | null;
  displayPromotionsOnly?: boolean;
  /** Legacy aliases */
  originalAmount?: number;
  vendorDiscountAmount?: number;
  platformDiscountAmount?: number;
  totalSavings?: number;
  finalAmount?: number;
  applied?: Array<{
    id: string;
    source: string;
    name: string;
    discountAmount: number;
    promotionType?: string;
  }>;
  bestPromotion?: {
    id: string;
    source?: string;
    name?: string;
    calculatedDiscount?: number;
  } | null;
  policyApplicationStrategy?: DiscountApplicationStrategy;
}

export function normalizeUnifiedQuote(raw: UnifiedResolverResponse | null): UnifiedResolverResponse | null {
  if (!raw || raw.success === false) return null;
  const savings = raw.savings ?? {
    originalAmount: raw.originalAmount ?? 0,
    totalSavings: raw.totalSavings ?? 0,
    finalAmount: raw.finalAmount ?? 0,
    vendorDiscountAmount: raw.vendorDiscountAmount ?? 0,
    platformDiscountAmount: raw.platformDiscountAmount ?? 0,
    couponDiscountAmount: 0,
  };
  const appliedOffers =
    raw.appliedOffers ??
    (raw.applied ?? []).map((a, idx) => ({
      id: a.id,
      name: a.name,
      offerType: a.promotionType ?? a.source,
      source: (a.promotionType === 'coupon'
        ? 'coupon'
        : a.source === 'vendor'
          ? 'vendor'
          : 'platform') as 'vendor' | 'platform' | 'coupon',
      discountAmount: a.discountAmount,
      trigger: (a.promotionType === 'coupon' ? 'CODE' : 'AUTO') as 'AUTO' | 'CODE',
      order: idx + 1,
    }));

  return {
    ...raw,
    savings,
    appliedOffers,
    rejectedOffers: raw.rejectedOffers ?? [],
    displayMessages: raw.displayMessages ?? [],
    currentPolicy: raw.currentPolicy ?? {
      applicationStrategy: raw.policyApplicationStrategy ?? 'BEST_OFFER_ONLY',
      resolverMode: 'unknown',
      settlementMode: 'unknown',
      stackMode: 'unknown',
      priorityMode: 'unknown',
    },
    winningPromotion:
      raw.winningPromotion ??
      (raw.bestPromotion
        ? {
            id: raw.bestPromotion.id,
            name: raw.bestPromotion.name ?? 'Offer',
            offerType: raw.bestPromotion.source ?? 'platform',
            source: raw.bestPromotion.source === 'vendor' ? 'vendor' : 'platform',
            discountAmount: raw.bestPromotion.calculatedDiscount ?? 0,
            trigger: 'AUTO',
            order: 1,
          }
        : appliedOffers.find((o) => o.trigger === 'AUTO') ?? appliedOffers[0] ?? null),
  };
}

export function promoSavingsFromQuote(quote: UnifiedResolverResponse | null): number {
  if (!quote) return 0;
  return quote.appliedOffers
    .filter((o) => o.trigger === 'AUTO')
    .reduce((s, o) => s + o.discountAmount, 0);
}

export function couponSavingsFromQuote(quote: UnifiedResolverResponse | null): number {
  if (!quote) return 0;
  return quote.appliedOffers
    .filter((o) => o.source === 'coupon' || o.trigger === 'CODE')
    .reduce((s, o) => s + o.discountAmount, 0);
}

export function totalSavingsFromQuote(quote: UnifiedResolverResponse | null): number {
  return quote?.savings?.totalSavings ?? quote?.totalSavings ?? 0;
}
