import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEAL_BOOKING_POLICY,
  evaluateMealBookingPolicy,
  validateMealBookingPolicyRules,
  clampLeadTimeHoursForPlatform,
} from '../../utils/meal-booking-policy';

describe('meal-booking-policy', () => {
  it('validates default-shaped policy', () => {
    const r = validateMealBookingPolicyRules(DEFAULT_MEAL_BOOKING_POLICY);
    expect(r.ok).toBe(true);
  });

  it('clamps lead hours to platform bounds', () => {
    const p = DEFAULT_MEAL_BOOKING_POLICY;
    expect(clampLeadTimeHoursForPlatform(100, p)).toBe(72);
    expect(clampLeadTimeHoursForPlatform(0, p)).toBe(0);
  });

  it('blocks delivery inside lead window', () => {
    const now = new Date('2026-05-25T08:00:00+05:30');
    const delivery = new Date(now.getTime() + 2 * 3600000).toISOString();
    const result = evaluateMealBookingPolicy(
      DEFAULT_MEAL_BOOKING_POLICY,
      { leadTimeHours: 24 },
      {
        vendorId: 'v1',
        mealPlanId: 'p1',
        purchaseType: 'ONE_OFF',
        requestedDeliveryAt: delivery,
        now: now.toISOString(),
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('LEAD_TIME_TOO_SHORT');
  });
});
