import { describe, expect, test } from '@jest/globals';
import {
  bookingTimeToMinutes,
  hasDurationOverlapWithExisting,
  intervalsOverlap,
} from '../booking-slot-overlap';

describe('booking-slot-overlap', () => {
  test('bookingTimeToMinutes parses HH:mm', () => {
    expect(bookingTimeToMinutes('14:45')).toBe(14 * 60 + 45);
    expect(bookingTimeToMinutes('14:45:00')).toBe(14 * 60 + 45);
  });

  test('intervalsOverlap detects partial overlap', () => {
    expect(intervalsOverlap(870, 900, 885, 915)).toBe(true);
    expect(intervalsOverlap(870, 900, 900, 930)).toBe(false);
    expect(intervalsOverlap(870, 900, 800, 870)).toBe(false);
  });

  test('hasDurationOverlapWithExisting blocks overlapping duration', () => {
    const existing = [{ booking_time: '14:45', duration_minutes: 30 }];
    expect(hasDurationOverlapWithExisting('14:45', 30, existing)).toBe(true);
    expect(hasDurationOverlapWithExisting('15:15', 30, existing)).toBe(false);
    expect(hasDurationOverlapWithExisting('14:30', 30, existing)).toBe(true);
  });

  test('hasDurationOverlapWithExisting respects minimum 15-minute duration', () => {
    const existing = [{ booking_time: '10:00', duration_minutes: 10 }];
    expect(hasDurationOverlapWithExisting('10:10', 15, existing)).toBe(true);
  });
});
