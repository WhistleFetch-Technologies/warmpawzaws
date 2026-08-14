import { describe, expect, test } from '@jest/globals';
import {
  SlotConflictError,
  isRequestedIntervalAvailable,
  slotOccupancyLockPair,
  type OccupyingBooking,
} from '../slot-occupancy';

/**
 * Real concurrent reservation protocol matching assertSlotAvailableInTx:
 * lock(vendor|date|staff) → occupancy check → consume.
 * No Postgres in CI; this races two async tasks against an in-memory mutex
 * with the same empty-result failure mode SELECT FOR UPDATE would miss.
 */
class InMemoryOccupancyStore {
  occupying: OccupyingBooking[] = [];
  private tails = new Map<string, Promise<void>>();

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(key, prev.then(() => gate));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async tryReserve(params: {
    vendorId: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    staffId?: string | null;
    capacity?: number;
  }): Promise<'ok'> {
    const [resource] = slotOccupancyLockPair(params.vendorId, params.date, params.staffId ?? null);
    return this.withLock(resource, async (): Promise<'ok'> => {
      const ok = isRequestedIntervalAvailable({
        occupying: this.occupying,
        startTime: params.startTime,
        durationMinutes: params.durationMinutes,
        capacity: params.capacity ?? 1,
      });
      if (!ok) throw new SlotConflictError();
      this.occupying.push({
        booking_time: params.startTime,
        duration_minutes: params.durationMinutes,
      });
      return 'ok';
    });
  }
}

describe('concurrent slot reservation (Test 3)', () => {
  test('capacity 1: two concurrent 2 PM requests → one ok, one SLOT_CONFLICT', async () => {
    const store = new InMemoryOccupancyStore();
    const req = {
      vendorId: 'v1',
      date: '2026-08-13',
      startTime: '14:00',
      durationMinutes: 60,
      capacity: 1 as const,
    };
    const results = await Promise.allSettled([store.tryReserve(req), store.tryReserve(req)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotConflictError);
    expect(store.occupying).toHaveLength(1);
  });

  test('capacity 2: two concurrent 2 PM requests both succeed', async () => {
    const store = new InMemoryOccupancyStore();
    const req = {
      vendorId: 'v1',
      date: '2026-08-13',
      startTime: '14:00',
      durationMinutes: 60,
      capacity: 2 as const,
    };
    const results = await Promise.allSettled([store.tryReserve(req), store.tryReserve(req)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(store.occupying).toHaveLength(2);
  });

  test('empty occupying list is still serialized (FOR UPDATE empty-result race)', async () => {
    const store = new InMemoryOccupancyStore();
    expect(store.occupying).toHaveLength(0);
    await Promise.allSettled([
      store.tryReserve({
        vendorId: 'v1',
        date: '2026-08-13',
        startTime: '14:00',
        durationMinutes: 60,
      }),
      store.tryReserve({
        vendorId: 'v1',
        date: '2026-08-13',
        startTime: '14:00',
        durationMinutes: 60,
      }),
    ]);
    expect(store.occupying).toHaveLength(1);
  });
});
