import {
  isWapptPolicyEligibleBooking,
  normalizeWapptHubCategory,
  WAPPT_COMMERCE_MODE,
  WAPPT_HUB_CATEGORIES,
} from '../../../endpoints/warmpawz-appointments/shared/wappt-policy.constants';
import { mapWapptRefundTierBodyToDb } from '../../../endpoints/warmpawz-appointments/shared/wappt-refund-tier-mapper';
import { computeRefundFromTier } from '../cancellation-policy-service';

describe('WAPPT policy eligibility', () => {
  it('accepts warmpawz_appointments non-tele bookings', () => {
    expect(
      isWapptPolicyEligibleBooking({
        commerce_mode: WAPPT_COMMERCE_MODE,
        service_type: 'at_home',
      }),
    ).toBe(true);
  });

  it('rejects tele even when commerce_mode is warmpawz_appointments', () => {
    expect(
      isWapptPolicyEligibleBooking({
        commerce_mode: WAPPT_COMMERCE_MODE,
        service_type: 'tele',
      }),
    ).toBe(false);
  });

  it('rejects marketplace bookings', () => {
    expect(
      isWapptPolicyEligibleBooking({
        commerce_mode: 'marketplace',
        service_type: 'at_center',
      }),
    ).toBe(false);
  });
});

describe('normalizeWapptHubCategory', () => {
  it('maps groomer alias to grooming', () => {
    expect(normalizeWapptHubCategory('pet_groomer')).toBe('grooming');
  });

  it('returns null for unknown categories', () => {
    expect(normalizeWapptHubCategory('shop')).toBeNull();
  });

  it('covers all hub slugs', () => {
    for (const slug of WAPPT_HUB_CATEGORIES) {
      expect(normalizeWapptHubCategory(slug)).toBe(slug);
    }
  });
});

describe('mapWapptRefundTierBodyToDb', () => {
  it('scopes platform tiers to warmpawz_appointments commerce_mode', () => {
    const row = mapWapptRefundTierBodyToDb(
      { name: 'Default', refundPercentage: 80, cancelledBy: 'pet_parent' },
      { policyScope: 'platform' },
    );
    expect(row.commerce_mode).toBe('warmpawz_appointments');
    expect(row.policy_scope).toBe('platform');
    expect(row.service_category).toBeNull();
  });

  it('stores category on category-scoped tiers', () => {
    const row = mapWapptRefundTierBodyToDb(
      { name: 'Grooming', refundPercentage: 50, cancelledBy: 'pet_parent', cancellationWindow: '6_plus' },
      { policyScope: 'category', serviceCategory: 'grooming' },
    );
    expect(row.policy_scope).toBe('category');
    expect(row.service_category).toBe('grooming');
    expect(row.hours_before_service).toBe(6);
  });
});

describe('computeRefundFromTier WAPPT fallback', () => {
  it('returns zero refund when no tier matches (safe WAPPT default)', () => {
    const result = computeRefundFromTier(1000, null, 0, 0);
    expect(result.refundAmount).toBe(0);
    expect(result.refundPercentage).toBe(0);
  });

  it('applies tier percentage and cancellation fee', () => {
    const result = computeRefundFromTier(
      1000,
      { refundPercentage: 75, cancellationFee: 50, maxPartialRefundPercentage: null },
      0,
      0,
    );
    expect(result.refundAmount).toBe(700);
    expect(result.cancellationFee).toBe(50);
  });
});
