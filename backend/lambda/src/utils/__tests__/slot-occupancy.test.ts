import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SLOT_OCCUPANCY_LOCK_NAMESPACE,
  countOverlappingBookings,
  evaluateSlotAvailability,
  intervalsOverlap,
  isRequestedIntervalAvailable,
  parseBookingTimeMinutes,
  resolveDurationMinutes,
  slotOccupancyLockPair,
} from '../slot-occupancy';
import { bookingConsumesCapacity } from '../payment-hold';

const lambdaRoot = join(__dirname, '../../..');

function read(relativeFromLambdaRoot: string): string {
  return readFileSync(join(lambdaRoot, relativeFromLambdaRoot), 'utf8');
}

describe('slot occupancy intervals', () => {
  test('parseBookingTimeMinutes reads HH:mm and HH:mm:ss', () => {
    expect(parseBookingTimeMinutes('14:00')).toBe(14 * 60);
    expect(parseBookingTimeMinutes('14:30:00')).toBe(14 * 60 + 30);
  });

  test('60-minute 14:00 overlaps 14:30 but not 15:00', () => {
    expect(intervalsOverlap(14 * 60, 15 * 60, 14 * 60 + 30, 15 * 60 + 30)).toBe(true);
    expect(intervalsOverlap(14 * 60, 15 * 60, 15 * 60, 16 * 60)).toBe(false);
  });

  test('capacity 1 rejects a second overlapping booking', () => {
    const occupying = [{ booking_time: '14:00:00', duration_minutes: 60 }];
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '14:00',
        durationMinutes: 30,
        capacity: 1,
      })
    ).toBe(false);
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '14:30',
        durationMinutes: 30,
        capacity: 1,
      })
    ).toBe(false);
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '15:00',
        durationMinutes: 30,
        capacity: 1,
      })
    ).toBe(true);
  });

  test('capacity 2 allows a second overlapping booking', () => {
    const occupying = [{ booking_time: '14:00:00', duration_minutes: 60 }];
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '14:00',
        durationMinutes: 60,
        capacity: 2,
      })
    ).toBe(true);
  });

  test('excludeBookingId ignores self when rescheduling', () => {
    const occupying = [
      { id: 'self', booking_time: '14:00:00', duration_minutes: 30 },
      { id: 'other', booking_time: '15:00:00', duration_minutes: 30 },
    ];
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '14:00',
        durationMinutes: 30,
        excludeBookingId: 'self',
      })
    ).toBe(true);
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '15:00',
        durationMinutes: 30,
        excludeBookingId: 'self',
      })
    ).toBe(false);
  });

  test('countOverlappingBookings counts interval hits', () => {
    expect(
      countOverlappingBookings(
        [
          { booking_time: '14:00', duration_minutes: 60 },
          { booking_time: '14:30', duration_minutes: 30 },
        ],
        14 * 60,
        15 * 60
      )
    ).toBe(2);
  });

  test('lock pair is vendor+date+staff, shared namespace', () => {
    expect(slotOccupancyLockPair('v1', '2026-08-13', null)).toEqual([
      'v1|2026-08-13|nostaff',
      SLOT_OCCUPANCY_LOCK_NAMESPACE,
    ]);
    expect(slotOccupancyLockPair('v1', '2026-08-13', 'staff-9')[0]).toBe('v1|2026-08-13|staff-9');
  });
});

describe('original availability occupancy defect', () => {
  test('VA2 occupancy is called with vendor id and date, not undefined duration_minutes', () => {
    const service = read(
      'src/endpoints/customer/discovery/services/vendor-available-slots.service.ts'
    );
    expect(service).not.toMatch(/dbVendorAvailableSlots28\(\s*duration_minutes\s*\)/);
    expect(service).toMatch(/dbVendorAvailableSlots28\(\s*resolvedVendorId\s*,\s*date\s*\)/);
    expect(service).not.toMatch(/dbVendorAvailableSlots28\([^)]*\)\.catch\(\s*\(\)\s*=>\s*\(\s*\{\s*rows:\s*\[\]/);
  });

  test('occupancy SQL excludes instant tele and uses the payment-hold blocking predicate', () => {
    const file = read('src/utils/slot-occupancy.ts');
    expect(file).toContain('SQL_BOOKING_BLOCKS_SLOT');
    expect(file).toContain('is_instant_tele');
    expect(file).toContain('pg_advisory_xact_lock');
    expect(file).toContain(SLOT_OCCUPANCY_LOCK_NAMESPACE);
    expect(file).toContain('SAVEPOINT sp_vendor_window_capacity');
  });

  test('create, reschedule, revive, package, and follow-up share occupancy', () => {
    const create = read('src/endpoints/booking/endpoints/bookings-enhanced.booking.ts');
    const followup = read('src/endpoints/followup-reschedule.ts');
    const pkg = read('src/utils/package-slot-validation.ts');
    const finalize = read('src/utils/payments/finalize-captured-payment.ts');
    expect(create).toContain('assertSlotAvailableInTx');
    expect(create).toContain('acquireSlotOccupancyLock');
    expect(followup).toContain('assertSlotAvailableInTx');
    const apptRepo = read(
      'src/endpoints/customer/appointments/repos/appointment-base-handlers.repo.ts'
    );
    expect(apptRepo).toContain('evaluateSlotAvailability');
    expect(apptRepo).toContain('acquireSlotOccupancyLock');
    expect(pkg).toContain('assertNoVendorSlotConflictsForSchedule');
    expect(finalize).toContain('acquireSlotOccupancyLock');
    expect(finalize).toContain('evaluateSlotAvailability');
  });

  test('subscription, otp, and package session inserts use occupancy', () => {
    const sub = read('src/endpoints/subscription-booking.ts');
    const otp = read('src/endpoints/otp-enhanced.ts');
    const pkgBookings = read('src/utils/package-bookings.ts');
    const pkgEndpoint = read('src/endpoints/package-booking.ts');
    expect(sub).toContain('assertSlotAvailableInTx');
    expect(otp).toContain('assertSlotAvailableInTx');
    expect(pkgBookings).toContain('assertSlotAvailableInTx');
    expect(pkgEndpoint).toContain('loadVendorServiceDurationMinutes');
    expect(pkgEndpoint).not.toMatch(/durationMinutes:\s*30/);
  });

  test('instant tele inserts are not forced onto vendor-slot occupancy', () => {
    const v2 = read('src/endpoints/teleCommunication/endpoints/instant-tele-v2.teleconsultation.ts');
    const v3 = read('src/endpoints/teleCommunication/endpoints/instant-tele-v3.teleconsultation.ts');
    expect(v2).toContain('is_instant_tele');
    expect(v3).toContain('is_instant_tele');
    expect(v2).not.toContain('assertSlotAvailableInTx');
    expect(v3).not.toContain('assertSlotAvailableInTx');
  });
});

describe('availability occupancy rules (tests 1, 4, 5, 7, 8, 11, 12)', () => {
  const mockDb = (occupying: Array<Record<string, unknown>>, capacity = 1) => {
    return async (sql: string) => {
      if (String(sql).includes('FROM bookings')) return { rows: occupying };
      if (String(sql).includes('vendor_availability_v2')) {
        return {
          rows: [{ max_capacity: capacity, win_start: '09:00', win_end: '18:00' }],
        };
      }
      return { rows: [] };
    };
  };

  test('Test 1 — after a 2 PM booking, 2 PM is unavailable', async () => {
    const occupying = [{ booking_time: '14:00:00', duration_minutes: 60 }];
    const ok = await evaluateSlotAvailability(mockDb(occupying), {
      vendorId: 'v1',
      date: '2026-08-13',
      startTime: '14:00',
      durationMinutes: 60,
    });
    expect(ok).toBe(false);
  });

  test('Test 4 — pending_payment hold occupies the slot', () => {
    expect(
      bookingConsumesCapacity({
        status: 'pending_payment',
        payment_hold_expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
    ).toBe(true);
    expect(
      isRequestedIntervalAvailable({
        occupying: [{ booking_time: '14:00', duration_minutes: 60 }],
        startTime: '14:00',
        durationMinutes: 60,
        capacity: 1,
      })
    ).toBe(false);
  });

  test('Test 5 — expired payment hold does not consume capacity', () => {
    expect(
      bookingConsumesCapacity({
        status: 'pending_payment',
        payment_hold_expires_at: new Date(Date.now() - 60_000).toISOString(),
      })
    ).toBe(false);
  });

  test('Test 7 — cancelled / rejected / vendor-decline statuses release capacity', () => {
    expect(bookingConsumesCapacity({ status: 'cancelled' })).toBe(false);
    expect(bookingConsumesCapacity({ status: 'rejected' })).toBe(false);
    expect(bookingConsumesCapacity({ status: 'no_show' })).toBe(false);
    expect(bookingConsumesCapacity({ status: 'confirmed' })).toBe(true);
    expect(bookingConsumesCapacity({ status: 'completed' })).toBe(true);
  });

  test('Test 8 — reschedule excludeBookingId releases old interval', () => {
    const occupying = [{ id: 'A', booking_time: '14:00:00', duration_minutes: 60 }];
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '15:00',
        durationMinutes: 60,
        excludeBookingId: 'A',
      })
    ).toBe(true);
    expect(
      isRequestedIntervalAvailable({
        occupying,
        startTime: '14:00',
        durationMinutes: 60,
        excludeBookingId: 'A',
      })
    ).toBe(true);
  });

  test('Test 11 — 2:00–3:00 overlaps 2:30–3:30', () => {
    expect(
      isRequestedIntervalAvailable({
        occupying: [{ booking_time: '14:00:00', duration_minutes: 60 }],
        startTime: '14:30',
        durationMinutes: 60,
        capacity: 1,
      })
    ).toBe(false);
  });

  test('Test 12 — two staff resources do not share a lock key', () => {
    const a = slotOccupancyLockPair('v1', '2026-08-13', 'staff-a')[0];
    const b = slotOccupancyLockPair('v1', '2026-08-13', 'staff-b')[0];
    expect(a).not.toBe(b);
    expect(
      isRequestedIntervalAvailable({
        occupying: [{ booking_time: '14:00', duration_minutes: 60, staff_id: 'staff-a' }],
        startTime: '14:00',
        durationMinutes: 60,
        capacity: 1,
      })
    ).toBe(false);
  });

  test('resolveDurationMinutes uses service config, not a hardcoded 60', () => {
    expect(resolveDurationMinutes(45, 30)).toBe(45);
    expect(resolveDurationMinutes(undefined, null, 90)).toBe(90);
  });
});
