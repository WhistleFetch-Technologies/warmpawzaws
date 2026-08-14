import { describe, expect, test } from '@jest/globals';
import {
  assertDistinctScheduleSlots,
  assertNoVendorSlotConflicts,
  findDuplicateScheduleSlotKeys,
  normalizeSlotTimeKey,
  validatePackagePurchaseSchedule,
} from '../package-slot-validation';

describe('package-slot-validation', () => {
  test('normalizeSlotTimeKey accepts HH:mm and HH:mm:ss', () => {
    expect(normalizeSlotTimeKey('12:10')).toBe('12:10');
    expect(normalizeSlotTimeKey('12:10:00')).toBe('12:10');
  });

  test('findDuplicateScheduleSlotKeys flags same date+time', () => {
    const keys = findDuplicateScheduleSlotKeys([
      { date: '2026-07-02', time: '12:10' },
      { date: '2026-07-02', time: '12:10:00' },
      { date: '2026-07-03', time: '12:10' },
    ]);
    expect(keys).toEqual(['2026-07-02|12:10']);
  });

  test('assertDistinctScheduleSlots returns DUPLICATE_SLOT_TIMES', () => {
    const result = assertDistinctScheduleSlots([
      { date: '2026-07-02', time: '12:10' },
      { date: '2026-07-02', time: '12:10' },
    ]);
    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'DUPLICATE_SLOT_TIMES',
      message: 'Each session slot on the same day must use a different time.',
    });
  });

  test('assertNoVendorSlotConflicts returns SLOT_CONFLICT when booking exists', async () => {
    const mockQuery = async () =>
      ({
        rows: [{ id: 'booking-1', booking_time: '12:10:00', duration_minutes: 30 }],
      }) as any;
    const result = await assertNoVendorSlotConflicts(
      'vendor-1',
      [{ date: '2026-07-02', time: '12:10' }],
      mockQuery
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SLOT_CONFLICT');
      expect(result.status).toBe(409);
    }
  });

  test('validatePackagePurchaseSchedule rejects duplicate expanded multi-day schedule', async () => {
    const mockQuery = async () => ({ rows: [] }) as any;
    const result = await validatePackagePurchaseSchedule({
      vendorId: 'vendor-1',
      sessionSchedule: [
        { sessionNumber: 1, date: '2026-07-02', time: '12:10' },
        { sessionNumber: 2, date: '2026-07-02', time: '12:10' },
      ],
      unlimitedPurchase: false,
      totalSessionsForPurchase: 4,
      sessionsPerDay: 2,
      sessionIntervalDays: 7,
      queryFn: mockQuery,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('DUPLICATE_SLOT_TIMES');
    }
  });

  test('validatePackagePurchaseSchedule passes distinct multi-slot schedule', async () => {
    const mockQuery = async () => ({ rows: [] }) as any;
    const result = await validatePackagePurchaseSchedule({
      vendorId: 'vendor-1',
      sessionSchedule: [
        { sessionNumber: 1, date: '2026-07-02', time: '12:10' },
        { sessionNumber: 2, date: '2026-07-02', time: '14:00' },
      ],
      unlimitedPurchase: false,
      totalSessionsForPurchase: 4,
      sessionsPerDay: 2,
      sessionIntervalDays: 7,
      queryFn: mockQuery,
    });
    expect(result).toEqual({ ok: true });
  });
});
