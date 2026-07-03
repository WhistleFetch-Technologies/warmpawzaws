import {
  computeDurationSessionPriceRupees,
  computeSameDaySessionBilledMinutes,
  DURATION_SESSION_BILLING_SLOT_MINUTES,
} from '../duration-session-pricing';

describe('duration-session-pricing', () => {
  it('computes proportional price in 30-min blocks', () => {
    const price = computeDurationSessionPriceRupees(600, 60, 90);
    expect(price).toBeGreaterThan(0);
    const slots = Math.ceil(90 / DURATION_SESSION_BILLING_SLOT_MINUTES);
    const expected = Math.round(slots * ((600 * DURATION_SESSION_BILLING_SLOT_MINUTES) / 60));
    expect(price).toBeGreaterThanOrEqual(Math.min(600, Math.max(49, Math.round(600 * 0.3))));
    expect(price).toBeGreaterThanOrEqual(expected - 1);
  });

  it('same-day session rejects different checkout date', () => {
    expect(
      computeSameDaySessionBilledMinutes('2026-07-10', '10:00', '2026-07-11', '11:00')
    ).toBe(-1);
  });

  it('same-day session returns minutes when end after start', () => {
    expect(
      computeSameDaySessionBilledMinutes('2026-07-10', '10:00', '2026-07-10', '11:30')
    ).toBe(90);
  });

  it('same-day session returns 0 when end not after start', () => {
    expect(
      computeSameDaySessionBilledMinutes('2026-07-10', '11:00', '2026-07-10', '10:00')
    ).toBe(0);
  });
});
