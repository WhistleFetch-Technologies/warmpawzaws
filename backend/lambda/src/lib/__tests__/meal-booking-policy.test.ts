import {
  clampLeadTimeHours,
  evaluateMealBookingForPlan,
  requireMealPlanTiming,
} from '../../utils/meal-booking-policy';

describe('meal-booking-policy', () => {
  it('clamps lead hours to 0–72', () => {
    expect(clampLeadTimeHours(100)).toBe(72);
    expect(clampLeadTimeHours(0)).toBe(0);
  });

  it('requires plan timing fields', () => {
    const r = requireMealPlanTiming({});
    expect(r.ok).toBe(false);
  });

  it('accepts Postgres TIME cutoff (HH:mm:ss)', () => {
    const r = requireMealPlanTiming({
      lead_time_hours: 2,
      order_cutoff_time: '20:00:00',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.orderCutoffTime).toBe('20:00');
  });

  it('falls back to dietary_requirements timing', () => {
    const r = requireMealPlanTiming({
      dietary_requirements: { leadTimeHours: 2, orderCutoffTime: '18:30' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.leadTimeHours).toBe(2);
      expect(r.orderCutoffTime).toBe('18:30');
    }
  });

  it('blocks delivery inside lead window', () => {
    const now = new Date('2026-05-25T08:00:00+05:30');
    const delivery = new Date(now.getTime() + 2 * 3600000).toISOString();
    const result = evaluateMealBookingForPlan(
      {
        vendorId: 'v1',
        mealPlanId: 'p1',
        purchaseType: 'ONE_OFF',
        requestedDeliveryAt: delivery,
        now: now.toISOString(),
      },
      { lead_time_hours: 24, order_cutoff_time: '18:00' },
    );
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('LEAD_TIME_TOO_SHORT');
  });

  it('blocks same-day after order cutoff', () => {
    const now = new Date('2026-05-25T19:00:00+05:30');
    const delivery = '2026-05-25T21:00:00+05:30';
    const result = evaluateMealBookingForPlan(
      {
        vendorId: 'v1',
        mealPlanId: 'p1',
        purchaseType: 'ONE_OFF',
        requestedDeliveryAt: delivery,
        now: now.toISOString(),
      },
      { lead_time_hours: 2, order_cutoff_time: '18:00' },
    );
    expect(result.allowed).toBe(false);
    expect(result.blockCode).toBe('SAME_DAY_CUTOFF_PASSED');
  });
});
