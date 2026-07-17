/**
 * Populate coupon usage.count / usage.perUserCount for AUTHORITATIVE rule evaluation.
 * CandidateNormalizer hardcodes count=0 and omits perUserCount — without this,
 * CouponMaxUsesPerUserRule always sees 0 and never enforces Admin per-customer limits.
 */
import { DiscountSource } from '../enums/discount-source';
import type { DiscountCandidate } from './types';
import type { DiscountContext } from '../models/discount-context';
import {
  countCouponUsagesTotal,
  countCustomerCouponUsages,
} from '../adapters/coupon-usage-counts';

export async function enrichCouponCandidatesWithUsage(
  candidates: DiscountCandidate[],
  context: DiscountContext
): Promise<DiscountCandidate[]> {
  const customerId = context.customerId?.trim();
  const excludeBookingId =
    context.booking?.bookingId?.trim() ||
    (typeof context.metadata?.excludeBookingId === 'string'
      ? context.metadata.excludeBookingId.trim()
      : undefined);

  const enriched: DiscountCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.source !== DiscountSource.PLATFORM_COUPON) {
      enriched.push(candidate);
      continue;
    }

    const code = (candidate.code || context.couponCode || '').trim().toUpperCase();
    const [totalCount, perUserCount] = await Promise.all([
      countCouponUsagesTotal(candidate.id),
      customerId
        ? countCustomerCouponUsages(candidate.id, customerId, {
            couponCode: code || undefined,
            excludeBookingId,
          })
        : Promise.resolve(0),
    ]);

    enriched.push({
      ...candidate,
      usage: {
        limit: candidate.usage?.limit ?? null,
        count: totalCount,
        perUserLimit: candidate.usage?.perUserLimit ?? null,
        perUserCount,
      },
    });
  }
  return enriched;
}
