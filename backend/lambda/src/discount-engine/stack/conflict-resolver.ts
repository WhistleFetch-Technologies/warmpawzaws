import { DiscountFunding } from '../enums/discount-funding';
import { DiscountSource } from '../enums/discount-source';
import type { FundingConfiguration, StackRuleConfig } from '../config/types';
import type { DiscountContext } from '../models/discount-context';
import type { EligibleBenefit } from '../priority/priority-types';
import type { ResolvedStackPolicy, StackConflictRecord, StackRejectionReason } from './types';
import {
  classifyStackPhase,
  isAutoPromotionSource,
  isCouponSource,
  isPlatformSource,
  isVendorSource,
  sourceStackKey,
  type StackPhase,
} from './stack-registry';

export interface ConflictCheckResult {
  allowed: boolean;
  reason?: StackRejectionReason;
  ruleId?: string;
  reasonCode?: string;
  conflictWith?: string;
  detail?: string;
}

function findStackRule(
  left: DiscountSource,
  right: DiscountSource,
  rules: StackRuleConfig[]
): StackRuleConfig | undefined {
  const lk = sourceStackKey(left);
  const rk = sourceStackKey(right);
  return rules.find(
    (r) =>
      (r.left.source === lk && r.right.source === rk) ||
      (r.left.source === rk && r.right.source === lk)
  );
}

function fundingLabel(funding?: DiscountFunding): string | undefined {
  return funding ? String(funding) : undefined;
}

/**
 * Evaluates coexistence between a candidate and already-applied set.
 * Configuration-driven — reads StackPolicyConfiguration + FundingConfiguration.
 */
export class ConflictResolver {
  evaluateFundingVeto(
    candidate: EligibleBenefit,
    applied: EligibleBenefit[],
    funding: FundingConfiguration
  ): ConflictCheckResult {
    const candidateFunding = candidate.candidate.funding;
    if (!candidateFunding) return { allowed: true };

    if (
      isCouponSource(candidate.candidate.source) &&
      candidate.candidate.source === DiscountSource.PLATFORM_COUPON
    ) {
      const hasSharedVendor = applied.some(
        (a) =>
          a.candidate.funding === DiscountFunding.SHARED &&
          isVendorSource(a.candidate.source)
      );
      if (hasSharedVendor && funding.blockSharedWithPlatformCoupon) {
        return {
          allowed: false,
          reason: 'FUNDING',
          reasonCode: 'FUNDING_VETO_SHARED_PLATFORM_COUPON',
          detail: 'Shared-funded promotion blocks platform coupon per funding policy',
        };
      }
    }

    for (const veto of funding.stackVetoes ?? []) {
      if (!veto.id) continue;
      const appliedFunding = applied.map((a) => a.candidate.funding).filter(Boolean);
      if (appliedFunding.includes(DiscountFunding.SHARED) && candidateFunding === DiscountFunding.PLATFORM) {
        return {
          allowed: false,
          reason: 'FUNDING',
          ruleId: veto.id,
          reasonCode: 'FUNDING_STACK_VETO',
          detail: veto.description ?? veto.id,
        };
      }
    }

    return { allowed: true };
  }

  evaluatePairwiseRules(
    candidate: EligibleBenefit,
    applied: EligibleBenefit[],
    policy: ResolvedStackPolicy,
    phase: StackPhase
  ): ConflictCheckResult {
    for (const existing of applied) {
      if (existing.candidate.id === candidate.candidate.id) {
        return {
          allowed: false,
          reason: 'DUPLICATE',
          conflictWith: existing.candidate.id,
          detail: 'Duplicate candidate id',
        };
      }

      const rule = findStackRule(
        candidate.candidate.source,
        existing.candidate.source,
        policy.stackRules
      );
      if (rule && rule.allowed === false) {
        return {
          allowed: false,
          reason: 'RULE',
          ruleId: rule.id,
          reasonCode: rule.reasonCode ?? 'STACK_RULE_DENIED',
          conflictWith: existing.candidate.id,
          detail: `Stack rule ${rule.id} denies coexistence`,
        };
      }

      if (
        !policy.allowMultipleVendorPromotions &&
        isVendorSource(candidate.candidate.source) &&
        isAutoPromotionSource(candidate.candidate.source) &&
        isVendorSource(existing.candidate.source) &&
        isAutoPromotionSource(existing.candidate.source)
      ) {
        return {
          allowed: false,
          reason: 'CONFLICT',
          reasonCode: 'MULTIPLE_VENDOR_PROMOTIONS',
          conflictWith: existing.candidate.id,
          detail: 'Multiple vendor auto promotions not allowed',
        };
      }

      if (
        !policy.allowPlatformWithVendor &&
        phase === 'AUTO_PROMOTIONS' &&
        ((isVendorSource(candidate.candidate.source) && isPlatformSource(existing.candidate.source)) ||
          (isPlatformSource(candidate.candidate.source) && isVendorSource(existing.candidate.source)))
      ) {
        return {
          allowed: false,
          reason: 'CONFLICT',
          reasonCode: 'PLATFORM_VENDOR_COEXISTENCE',
          conflictWith: existing.candidate.id,
          detail: 'Platform and vendor auto promotions may not coexist for this domain',
        };
      }

      if (
        !policy.allowMultipleCoupons &&
        isCouponSource(candidate.candidate.source) &&
        isCouponSource(existing.candidate.source)
      ) {
        return {
          allowed: false,
          reason: 'CONFLICT',
          reasonCode: 'MULTIPLE_COUPONS',
          conflictWith: existing.candidate.id,
          detail: 'Multiple coupons not allowed',
        };
      }

      if (
        candidate.candidate.source === existing.candidate.source &&
        isAutoPromotionSource(candidate.candidate.source)
      ) {
        return {
          allowed: false,
          reason: 'DUPLICATE',
          reasonCode: 'DUPLICATE_SOURCE_LIMIT',
          conflictWith: existing.candidate.id,
          detail: 'Only one auto promotion per source type',
        };
      }
    }

    if (
      phase === 'COUPONS' &&
      !policy.allowCouponWithPromotion &&
      applied.some((a) => classifyStackPhase(a) === 'AUTO_PROMOTIONS')
    ) {
      return {
        allowed: false,
        reason: 'RULE',
        reasonCode: 'COUPON_WITH_PROMOTION_DISABLED',
        detail: 'Coupons disabled when promotions already applied',
      };
    }

    return { allowed: true };
  }

  canApply(
    candidate: EligibleBenefit,
    applied: EligibleBenefit[],
    context: DiscountContext,
    policy: ResolvedStackPolicy,
    funding: FundingConfiguration,
    phase: StackPhase
  ): ConflictCheckResult {
    void context;
    const fundingCheck = this.evaluateFundingVeto(candidate, applied, funding);
    if (!fundingCheck.allowed) return fundingCheck;

    return this.evaluatePairwiseRules(candidate, applied, policy, phase);
  }

  toConflictRecord(
    candidate: EligibleBenefit,
    existing: EligibleBenefit,
    check: ConflictCheckResult
  ): StackConflictRecord {
    return {
      leftId: candidate.candidate.id,
      rightId: existing.candidate.id,
      ruleId: check.ruleId,
      reasonCode: check.reasonCode ?? check.reason ?? 'CONFLICT',
      resolution: 'REJECTED_LOWER',
    };
  }
}

let defaultResolver: ConflictResolver | null = null;

export function getConflictResolver(): ConflictResolver {
  if (!defaultResolver) defaultResolver = new ConflictResolver();
  return defaultResolver;
}

export function resetConflictResolverForTests(): void {
  defaultResolver = new ConflictResolver();
}
