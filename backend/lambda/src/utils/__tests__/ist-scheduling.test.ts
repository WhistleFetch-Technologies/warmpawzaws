import { describe, expect, test } from '@jest/globals';
import {
  addDaysToYmd,
  dayOfWeekFromYmd,
  isSlotPastInIst,
  minutesFromHhmm,
  ymdInIst,
} from '../ist-scheduling';

describe('ist-scheduling', () => {
  test('ymdInIst returns Asia/Kolkata calendar date', () => {
    const d = new Date('2026-06-19T13:05:00.000Z'); // 18:35 IST
    expect(ymdInIst(d)).toBe('2026-06-19');
  });

  test('isSlotPastInIst marks afternoon slot past at 18:35 IST', () => {
    const now = new Date('2026-06-19T13:05:00.000Z');
    expect(isSlotPastInIst('2026-06-19', '13:30', 30, now)).toBe(true);
  });

  test('isSlotPastInIst keeps future slot on today', () => {
    const now = new Date('2026-06-19T13:05:00.000Z');
    expect(isSlotPastInIst('2026-06-19', '19:00', 30, now)).toBe(false);
  });

  test('isSlotPastInIst leaves tomorrow unchanged', () => {
    const now = new Date('2026-06-19T13:05:00.000Z');
    expect(isSlotPastInIst('2026-06-20', '09:00', 30, now)).toBe(false);
  });

  test('addDaysToYmd and dayOfWeekFromYmd', () => {
    expect(addDaysToYmd('2026-06-19', 1)).toBe('2026-06-20');
    expect(dayOfWeekFromYmd('2026-06-19')).toBe(5); // Friday
  });

  test('minutesFromHhmm', () => {
    expect(minutesFromHhmm('13:30')).toBe(810);
  });
});
