/**
 * Unified Resolver Response — single contract for service page, booking, payment,
 * admin simulator, and audit viewers. Frontend renders only; never decides winners.
 */
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import {
  ensureBusinessRules,
  type DiscountPolicyBundle,
} from '../config/business-rules-mapper';
import type {
  DiscountApplicationStrategy,
  WinningStrategyKey,
} from '../config/business-rules-types';
import type { DiscountSettlementPreview } from '../models/discount-result';
import type { RuntimePolicy } from '../policy/runtime-policy';
import { getResolverMode } from '../policy/resolver-mode';
import { getSettlementMode } from '../settlement/settlement-mode';
import { getStackMode } from '../stack/stack-mode';
import { getPriorityMode } from '../policy/runtime-policy-loader';
import type { AppliedDiscount } from '../models/discount-result';
import type { ResolverResult } from './types';
import type { BookingPromotionResult } from '../../utils/service-promotion-engine';
import type { OfferResolutionResult } from './offer-resolution';

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
}

export interface UnifiedResolverPolicySnapshot {
  applicationStrategy: DiscountApplicationStrategy;
  winningStrategy?: WinningStrategyKey | null;
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
  settlementPreview?: DiscountSettlementPreview;
  /** Legacy compat — first winning auto promotion */
  vendorPromotionId?: string;
  platformPromotionId?: string;
  winningPromotion?: UnifiedResolverAppliedOffer | null;
  /** When true, caller requested promos-only (no coupon input). */
  displayPromotionsOnly?: boolean;
}

function mapSourceKey(source: DiscountSource, owner: DiscountOwner): string {
  if (source === DiscountSource.PLATFORM_COUPON) return 'PLATFORM_COUPON';
  if (source === DiscountSource.VENDOR_COUPON) return 'VENDOR_COUPON';
  if (source === DiscountSource.VENDOR_PROMOTION) return 'VENDOR_PROMOTION';
  if (source === DiscountSource.PLATFORM_PROMOTION) return 'PLATFORM_PROMOTION';
  return owner === DiscountOwner.VENDOR ? 'VENDOR_PROMOTION' : 'PLATFORM_PROMOTION';
}

function mapAppliedSource(
  d: AppliedDiscount
): 'vendor' | 'platform' | 'coupon' {
  if (
    d.trigger === DiscountTrigger.CODE ||
    d.legacySource === 'coupon' ||
    d.metadata?.source === DiscountSource.PLATFORM_COUPON ||
    d.metadata?.source === DiscountSource.VENDOR_COUPON
  ) {
    return 'coupon';
  }
  if (d.owner === DiscountOwner.VENDOR || d.legacySource === 'vendor') return 'vendor';
  return 'platform';
}

function splitSavings(applied: UnifiedResolverAppliedOffer[]): Omit<
  UnifiedResolverSavings,
  'originalAmount' | 'totalSavings' | 'finalAmount'
> {
  let vendorDiscountAmount = 0;
  let platformDiscountAmount = 0;
  let couponDiscountAmount = 0;
  for (const o of applied) {
    if (o.source === 'coupon') couponDiscountAmount += o.discountAmount;
    else if (o.source === 'vendor') vendorDiscountAmount += o.discountAmount;
    else platformDiscountAmount += o.discountAmount;
  }
  return { vendorDiscountAmount, platformDiscountAmount, couponDiscountAmount };
}

export function buildPolicySnapshot(
  runtimePolicy: RuntimePolicy,
  bundle?: DiscountPolicyBundle
): UnifiedResolverPolicySnapshot {
  const rules = ensureBusinessRules({
    priority: runtimePolicy.priority,
    stack: runtimePolicy.stack,
    funding: runtimePolicy.funding,
    limits: runtimePolicy.limits,
    businessRules: runtimePolicy.businessRules ?? bundle?.businessRules,
  });

  return {
    applicationStrategy: rules.applicationStrategy,
    winningStrategy: rules.winningStrategy ?? null,
    policyFingerprint: runtimePolicy.policyFingerprint ?? null,
    publishId: runtimePolicy.publishId ?? null,
    policyVersion: rules.version,
    resolverMode: getResolverMode(),
    settlementMode: getSettlementMode(),
    stackMode: getStackMode(),
    priorityMode: getPriorityMode(),
    combinationMatrix: rules.combinationMatrix.map((r) => ({
      left: r.left,
      right: r.right,
      allowed: r.allowed,
    })),
  };
}

function buildDisplayMessages(
  applied: UnifiedResolverAppliedOffer[],
  rejected: UnifiedResolverRejectedOffer[],
  policy: UnifiedResolverPolicySnapshot
): UnifiedResolverDisplayMessage[] {
  const messages: UnifiedResolverDisplayMessage[] = [];
  if (applied.length === 0 && rejected.length === 0) {
    messages.push({
      type: 'info',
      code: 'NO_OFFERS',
      message: 'No eligible offers for this booking.',
    });
    return messages;
  }
  for (const r of rejected) {
    messages.push({
      type: 'warning',
      code: r.reasonCode ?? 'OFFER_REJECTED',
      message: r.reason,
    });
  }
  if (applied.length > 1) {
    messages.push({
      type: 'success',
      code: 'MULTIPLE_APPLIED',
      message: `${applied.length} offers applied per ${policy.applicationStrategy} policy.`,
    });
  } else if (applied.length === 1) {
    messages.push({
      type: 'success',
      code: 'OFFER_APPLIED',
      message: `${applied[0].name} applied — you save ₹${applied[0].discountAmount.toFixed(0)}.`,
    });
  }
  return messages;
}

function mapAppliedDiscounts(result: ResolverResult): UnifiedResolverAppliedOffer[] {
  return result.applied.map((d, idx) => ({
    id: d.id,
    name: d.name,
    offerType: mapSourceKey(
      (d.metadata?.source as DiscountSource) ?? DiscountSource.PLATFORM_PROMOTION,
      d.owner
    ),
    source: mapAppliedSource(d),
    discountAmount: d.discountAmount,
    trigger: d.trigger === DiscountTrigger.CODE ? 'CODE' : 'AUTO',
    order: d.order ?? idx + 1,
    benefitType: d.benefitType,
  }));
}

function mapRejectedFromResolver(result: ResolverResult): UnifiedResolverRejectedOffer[] {
  const rejected: UnifiedResolverRejectedOffer[] = [];
  const priority = result.metadata?.priority;
  const resolutionRejected =
    (priority?.autoPhase?.rejectedByLimit ?? []).concat(
      priority?.couponPhase?.rejectedByLimit ?? []
    ) ?? [];

  for (const r of resolutionRejected) {
    rejected.push({
      id: r.candidateId,
      reason: r.reasonDetail ?? r.reasonCode ?? 'REJECTED_BY_POLICY',
      reasonCode: r.reasonCode,
    });
  }

  for (const c of result.rejectedCandidates ?? []) {
    if (rejected.some((x) => x.id === c.id)) continue;
    rejected.push({
      id: c.id,
      name: c.name,
      offerType: mapSourceKey(c.source, c.owner),
      reason: 'Not eligible for this booking',
      reasonCode: 'INELIGIBLE',
    });
  }

  return rejected;
}

export function mapResolverResultToUnifiedResponse(
  result: ResolverResult,
  runtimePolicy: RuntimePolicy,
  options?: {
    resolverSource?: 'v2' | 'legacy';
    displayPromotionsOnly?: boolean;
    offerResolution?: OfferResolutionResult;
    bundle?: DiscountPolicyBundle;
  }
): UnifiedResolverResponse {
  const appliedOffers = mapAppliedDiscounts(result);
  const rejectedFromResolution =
    options?.offerResolution?.rejectedOffers?.map((r) => ({
      id: r.candidateId,
      reason: r.reason,
      reasonCode: 'POLICY_REJECTED',
    })) ?? [];
  const rejectedOffers = [
    ...rejectedFromResolution,
    ...mapRejectedFromResolver(result).filter(
      (r) => !rejectedFromResolution.some((x) => x.id === r.id)
    ),
  ];

  const savingsSplit = splitSavings(appliedOffers);
  const currentPolicy = buildPolicySnapshot(runtimePolicy, options?.bundle);
  const settlement = result.settlement;
  const autoPromo = appliedOffers.find((o) => o.trigger === 'AUTO') ?? appliedOffers[0] ?? null;

  return {
    success: true,
    resolverSource: options?.resolverSource ?? 'v2',
    resolverVersion: result.resolverVersion,
    currentPolicy,
    appliedOffers,
    rejectedOffers,
    savings: {
      originalAmount: result.originalAmount,
      totalSavings: result.totalSavings,
      finalAmount: result.finalAmount,
      ...savingsSplit,
    },
    funding: settlement
      ? {
          platformCost: settlement.platformCost,
          vendorCost: settlement.vendorCost,
          vendorReceivable: settlement.vendorReceivable,
          customerPayable: settlement.customerPayable,
          netSettlement: settlement.netSettlement,
        }
      : undefined,
    displayMessages: buildDisplayMessages(appliedOffers, rejectedOffers, currentPolicy),
    settlementPreview: settlement,
    vendorPromotionId: appliedOffers.find((o) => o.source === 'vendor' && o.trigger === 'AUTO')?.id,
    platformPromotionId: appliedOffers.find(
      (o) => o.source === 'platform' && o.trigger === 'AUTO'
    )?.id,
    winningPromotion: autoPromo,
    displayPromotionsOnly: options?.displayPromotionsOnly,
  };
}

/** Map legacy booking stack when resolver mode is OFF or fallback. */
export function mapLegacyBookingToUnifiedResponse(
  booking: BookingPromotionResult,
  runtimePolicy: RuntimePolicy,
  options?: { displayPromotionsOnly?: boolean; bundle?: DiscountPolicyBundle }
): UnifiedResolverResponse {
  const currentPolicy = buildPolicySnapshot(runtimePolicy, options?.bundle);
  const appliedOffers: UnifiedResolverAppliedOffer[] = (booking.applied ?? []).map((a, idx) => ({
    id: a.id,
    name: a.name,
    offerType:
      a.promotionType === 'coupon'
        ? 'PLATFORM_COUPON'
        : a.source === 'vendor'
          ? 'VENDOR_PROMOTION'
          : 'PLATFORM_PROMOTION',
    source:
      a.promotionType === 'coupon'
        ? 'coupon'
        : a.source === 'vendor'
          ? 'vendor'
          : 'platform',
    discountAmount: a.discountAmount,
    trigger: a.promotionType === 'coupon' ? 'CODE' : 'AUTO',
    order: idx + 1,
  }));

  const savingsSplit = splitSavings(appliedOffers);
  const autoPromo = appliedOffers.find((o) => o.trigger === 'AUTO') ?? appliedOffers[0] ?? null;

  return {
    success: true,
    resolverSource: 'legacy',
    currentPolicy,
    appliedOffers,
    rejectedOffers: [],
    savings: {
      originalAmount: booking.originalAmount,
      totalSavings: booking.totalSavings,
      finalAmount: booking.finalAmount,
      ...savingsSplit,
    },
    displayMessages: buildDisplayMessages(appliedOffers, [], currentPolicy),
    settlementPreview: booking.settlement,
    vendorPromotionId: booking.vendorPromotionId,
    platformPromotionId: booking.platformPromotionId,
    winningPromotion: autoPromo,
    displayPromotionsOnly: options?.displayPromotionsOnly,
  };
}
