import { wallDateTimeToUtcMs, computeHoursUntilBookingStart } from '../booking-start-wall-time';

describe('booking-start-wall-time', () => {
  it('maps IST wall 2pm to correct UTC instant', () => {
    const ms = wallDateTimeToUtcMs('2026-04-22', '14:00:00', 'Asia/Kolkata');
    expect(ms).not.toBeNull();
    const d = new Date(ms!);
    expect(d.toISOString()).toBe('2026-04-22T08:30:00.000Z');
  });

  it('prefers vendor-local wall over booking_datetime when both are set', () => {
    const h = computeHoursUntilBookingStart({
      booking_date: '2026-04-22',
      booking_time: '14:00',
      vendor_timezone: 'Asia/Kolkata',
      booking_datetime: '2026-04-22T14:00:00.000Z',
    });
    const hNaiveDatetime = (new Date('2026-04-22T14:00:00.000Z').getTime() - Date.now()) / 3600000;
    const hWall = (new Date('2026-04-22T08:30:00.000Z').getTime() - Date.now()) / 3600000;
    expect(Math.abs(h - hWall)).toBeLessThan(1e-6);
    expect(Math.abs(h - hNaiveDatetime)).toBeGreaterThan(4);
  });
});
