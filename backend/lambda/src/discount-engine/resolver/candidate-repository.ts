import { DiscountDomain } from '../enums/discount-domain';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import { getCandidateNormalizer } from '../candidates/candidate-normalizer';
import {
  CouponCandidateProvider,
  PlatformPromotionCandidateProvider,
  VendorPromotionCandidateProvider,
  VendorServicePromotionCandidateProvider,
} from '../candidates/providers';
import type { CandidateProvider } from '../candidates/providers/types';
import type { DiscountCandidate } from '../candidates/types';
import type { DiscountContext } from '../models/discount-context';
import { discountContextToLoadContext } from './context-runtime';
import type { CandidateRepository } from './types';

function normalizeRow(row: unknown, provider: CandidateProvider): DiscountCandidate {
  const normalizer = getCandidateNormalizer();
  const record = row as Record<string, unknown>;

  switch (provider.source) {
    case DiscountSource.PLATFORM_COUPON:
      return normalizer.fromCoupon(record);
    case DiscountSource.PLATFORM_PROMOTION:
      return normalizer.fromPlatformPromotion(record);
    case DiscountSource.VENDOR_PROMOTION:
    case DiscountSource.VENDOR_COUPON:
      if (record.min_booking_value != null || record.applicable_service_styles != null) {
        return normalizer.fromVendorServicePromotion(record);
      }
      return normalizer.fromVendorProductPromotion(record);
    default:
      return normalizer.fromVendorProductPromotion(record);
  }
}

export function selectProvidersForContext(context: DiscountContext): CandidateProvider[] {
  const { domain, trigger, couponCode, owner } = context;

  if (trigger === DiscountTrigger.CODE && couponCode) {
    const list: CandidateProvider[] = [
      new CouponCandidateProvider(),
      new PlatformPromotionCandidateProvider(),
    ];
    if (domain === DiscountDomain.SERVICE) {
      list.push(new VendorServicePromotionCandidateProvider());
    } else {
      list.push(new VendorPromotionCandidateProvider());
    }
    return list;
  }

  if (domain === DiscountDomain.SERVICE) {
    if (owner === DiscountOwner.VENDOR) {
      return [new VendorServicePromotionCandidateProvider()];
    }
    if (owner === DiscountOwner.PLATFORM) {
      return [new PlatformPromotionCandidateProvider()];
    }
    const serviceProviders: CandidateProvider[] = [
      new VendorServicePromotionCandidateProvider(),
      new PlatformPromotionCandidateProvider(),
    ];
    // S5 — booking stack with coupon code: auto phase + coupon phase candidates
    if (couponCode) {
      serviceProviders.push(new CouponCandidateProvider());
    }
    return serviceProviders;
  }

  if (owner === DiscountOwner.PLATFORM) {
    return [new PlatformPromotionCandidateProvider()];
  }
  const ecommerceProviders: CandidateProvider[] = [
    new VendorPromotionCandidateProvider(),
    new PlatformPromotionCandidateProvider(),
  ];
  if (couponCode) {
    ecommerceProviders.unshift(new CouponCandidateProvider());
  }
  return ecommerceProviders;
}

function matchesTrigger(candidate: DiscountCandidate, context: DiscountContext): boolean {
  if (context.trigger === DiscountTrigger.AUTO) {
    return !candidate.code;
  }
  const code = String(context.couponCode || '').trim().toUpperCase();
  return Boolean(code && candidate.code && candidate.code.toUpperCase() === code);
}

function matchesOwner(candidate: DiscountCandidate, context: DiscountContext): boolean {
  if (!context.owner) return true;
  return candidate.owner === context.owner;
}

function filterCandidates(candidates: DiscountCandidate[], context: DiscountContext): DiscountCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    if (!matchesOwner(c, context)) return false;
    if (context.trigger === DiscountTrigger.CODE && context.couponCode) {
      if (c.source === DiscountSource.PLATFORM_COUPON) return true;
      return matchesTrigger(c, context);
    }
    if (context.trigger === DiscountTrigger.AUTO && c.code) {
      const normalizedCoupon = String(context.couponCode || '').trim().toUpperCase();
      if (normalizedCoupon && c.code.toUpperCase() === normalizedCoupon) return true;
      if (c.source === DiscountSource.PLATFORM_PROMOTION) return true;
      return false;
    }
    return true;
  });
}

export class DefaultCandidateRepository implements CandidateRepository {
  async loadCandidates(
    context: DiscountContext,
    providers?: CandidateProvider[]
  ): Promise<{ candidates: DiscountCandidate[]; providerBreakdown: Record<string, number> }> {
    const loadContext = discountContextToLoadContext(context);
    const providerList = providers ?? selectProvidersForContext(context);
    const providerBreakdown: Record<string, number> = {};
    const normalized: DiscountCandidate[] = [];

    for (const provider of providerList) {
      const rows = await provider.load(loadContext);
      const key = provider.constructor.name;
      providerBreakdown[key] = (providerBreakdown[key] ?? 0) + rows.length;
      for (const row of rows) {
        normalized.push(normalizeRow(row, provider));
      }
    }

    return {
      candidates: filterCandidates(normalized, context),
      providerBreakdown,
    };
  }
}

let defaultRepository: DefaultCandidateRepository | null = null;

export function getCandidateRepository(): DefaultCandidateRepository {
  if (!defaultRepository) {
    defaultRepository = new DefaultCandidateRepository();
  }
  return defaultRepository;
}

export function resetCandidateRepositoryForTests(): void {
  defaultRepository = new DefaultCandidateRepository();
}
