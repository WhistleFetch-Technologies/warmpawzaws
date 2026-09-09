import { formatIstDateYYYYMMDD } from '../available-slots-response';
import { addIstCalendarDays, generateBookingDates } from '../wappt-booking-time';

describe('generateBookingDates IST chips', () => {
  it('starts from the IST calendar date, not the browser-local date', () => {
    const now = new Date('2026-06-19T16:30:00.000Z'); // 22:00 IST
    const chips = generateBookingDates(3, now);
    expect(chips[0].date).toBe(formatIstDateYYYYMMDD(now));
    expect(chips[0].date).toBe('2026-06-19');
    expect(chips[1].date).toBe('2026-06-20');
    expect(chips[2].date).toBe('2026-06-21');
  });

  it('adds IST calendar days without local timezone drift', () => {
    expect(addIstCalendarDays('2026-06-19', 1)).toBe('2026-06-20');
  });
});
