import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountStatus } from '../../enums/discount-status';
import { DiscountFunding } from '../../enums/discount-funding';
import type { DiscountCandidate } from '../types';
import type { DiscountContext } from '../../models/discount-context';

vi.mock('../../adapters/coupon-usage-counts', () => ({
  countCouponUsagesTotal: vi.fn(async () => 5),
  countCustomerCouponUsages: vi.fn(async () => 1),
}));

import { enrichCouponCandidatesWithUsage } from '../enrich-coupon-usage';
import { countCustomerCouponUsages } from '../../adapters/coupon-usage-counts';

function couponCandidate(overrides?: Partial<DiscountCandidate>): DiscountCandidate {
  return {
    id: '9823dee6-31df-4dd8-be00-b67b68184968',
    source: DiscountSource.PLATFORM_COUPON,
    owner: DiscountOwner.PLATFORM,
    domain: DiscountDomain.SERVICE,
    status: DiscountStatus.ACTIVE,
    code: 'WARM1O',
    name: 'WARM1O',
    rules: {},
    benefits: { type: 'coupon', discountType: 'percentage', value: 10 },
    usage: { limit: 1000, count: 0, perUserLimit: 1 },
    funding: DiscountFunding.PLATFORM,
    ...overrides,
  };
}

describe('enrichCouponCandidatesWithUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets perUserCount from DB so CouponMaxUsesPerUserRule can enforce', async () => {
    const context: DiscountContext = {
      domain: DiscountDomain.SERVICE,
      amount: 10,
      customerId: '67af41c0-b6b3-4899-ab4b-00fd9db4e446',
      couponCode: 'WARM1O',
    };
    const [enriched] = await enrichCouponCandidatesWithUsage([couponCandidate()], context);
    expect(enriched.usage?.perUserCount).toBe(1);
    expect(enriched.usage?.count).toBe(5);
    expect(enriched.usage?.perUserLimit).toBe(1);
    expect(countCustomerCouponUsages).toHaveBeenCalledWith(
      '9823dee6-31df-4dd8-be00-b67b68184968',
      '67af41c0-b6b3-4899-ab4b-00fd9db4e446',
      expect.objectContaining({ couponCode: 'WARM1O' })
    );
  });

  it('skips DB customer count when customerId missing', async () => {
    const context: DiscountContext = {
      domain: DiscountDomain.SERVICE,
      amount: 10,
      couponCode: 'WARM1O',
    };
    const [enriched] = await enrichCouponCandidatesWithUsage([couponCandidate()], context);
    expect(enriched.usage?.perUserCount).toBe(0);
    expect(countCustomerCouponUsages).not.toHaveBeenCalled();
  });
});
