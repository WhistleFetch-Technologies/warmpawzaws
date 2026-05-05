import {
  boardingBilled24hUnits,
  computeBoardingStayPriceRupeesPublic,
  computeStayBilledMinutes,
  wallDateTimeToEpochMs,
} from '../booking-stay-wall-time';

describe('booking-stay-wall-time (Asia/Kolkata)', () => {
  test('24h stay = 1440 minutes, 1 unit @ 1000 = 1000', () => {
    const billed = computeStayBilledMinutes('2026-05-05', '09:00', '2026-05-06', '09:00');
    expect(billed).toBe(1440);
    expect(boardingBilled24hUnits(billed)).toBe(1);
    expect(computeBoardingStayPriceRupeesPublic(1000, billed)).toBe(1000);
  });

  test('25h stay = 1500 minutes, 2 units @ 1000 = 2000', () => {
    const billed = computeStayBilledMinutes('2026-05-05', '09:00', '2026-05-06', '10:00');
    expect(billed).toBe(1500);
    expect(boardingBilled24hUnits(billed)).toBe(2);
    expect(computeBoardingStayPriceRupeesPublic(1000, billed)).toBe(2000);
  });

  test('midnight crossing IST: check-in 23:30 day1, check-out 01:00 day2 → 90 minutes', () => {
    const billed = computeStayBilledMinutes('2026-05-05', '23:30', '2026-05-06', '01:00');
    expect(billed).toBe(90);
    expect(boardingBilled24hUnits(billed)).toBe(1);
  });

  test('wallDateTimeToEpochMs is independent of process TZ (+05:30)', () => {
    const a = wallDateTimeToEpochMs('2026-05-05', '09:00');
    const b = wallDateTimeToEpochMs('2026-05-05', '10:00');
    expect(Number.isFinite(a)).toBe(true);
    expect(b - a).toBe(60 * 60 * 1000);
  });

  test('when checkout time <= check-in on different dates, rolls end by +24h (next-morning checkout)', () => {
    const billed = computeStayBilledMinutes('2026-05-05', '22:00', '2026-05-06', '09:00');
    expect(billed).toBe(11 * 60);
  });
});
