import { describe, expect, test, jest, beforeEach } from '@jest/globals';

jest.mock('../vendor-commission-rate', () => ({
  getVendorCommissionRate: jest.fn(async () => 10),
  isCanonicalPackageParentBooking: jest.fn(() => false),
  isPackageSessionChildBooking: jest.fn(() => true),
}));

jest.mock('../../finance/commission/resolve-vendor-commission-policy', () => ({
  resolveVendorCommissionPolicy: jest.fn(async () => ({ commissionRate: 10 })),
}));

import { backfillPackageSessionEarningsForCompletedBookings } from '../package-session-sync';

type EarningsRow = { id: string; bookingId: string; amount: number; status: string };

function createDb(state: {
  missingBookingIds: string[];
  purchaseId: string;
  vendorId: string;
  earnings: EarningsRow[];
}) {
  const updates: Array<{ id: string; amount: number }> = [];
  const inserts: Array<{ bookingId: string; amount: number }> = [];
  const vendorDeltas: number[] = [];
  const unmatched: string[] = [];

  const db = {
    updates,
    inserts,
    vendorDeltas,
    unmatched,
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      const text = String(sql);

      if (text.includes('INSERT INTO vendor_earnings')) {
        const bookingId = String(params[1]);
        const amount = Number(params[2]);
        if (state.earnings.some((e) => e.bookingId === bookingId)) {
          return { rowCount: 0, rows: [] };
        }
        state.earnings.push({
          id: `ve-${state.earnings.length + 1}`,
          bookingId,
          amount,
          status: 'pending',
        });
        inserts.push({ bookingId, amount });
        return { rowCount: 1, rows: [{ id: `ve-${state.earnings.length}` }] };
      }
      if (text.includes('AND NOT EXISTS (SELECT 1 FROM vendor_earnings ve WHERE ve.booking_id = b.id)')) {
        return { rows: state.missingBookingIds.map((id) => ({ id })) };
      }
      if (text.includes('SELECT 1 FROM vendor_earnings WHERE booking_id')) {
        const bookingId = String(params[0]);
        const hit = state.earnings.some((e) => e.bookingId === bookingId);
        return { rowCount: hit ? 1 : 0, rows: hit ? [{ '?column?': 1 }] : [] };
      }
      if (text.includes('SELECT package_purchase_id::text AS package_purchase_id')) {
        return { rows: [{ package_purchase_id: state.purchaseId }] };
      }
      if (text.includes('FROM package_purchases') && text.includes('total_sessions')) {
        return { rows: [{ total_sessions: 48, unlimited: false }] };
      }
      if (text.includes('is_package_session, false) = false') && text.includes('parent_booking_id IS NULL')) {
        return {
          rows: [
            {
              vendor_id: state.vendorId,
              total_amount: 12712,
              base_price: 12712,
              notes: null,
              purchase_amount: 12712,
            },
          ],
        };
      }
      if (text.includes('FOR UPDATE')) {
        return { rows: [{ id: state.purchaseId }] };
      }
      if (text.includes('ve.status = \'pending\'') && text.includes('ORDER BY ve.realized_at')) {
        return {
          rows: state.earnings
            .filter((e) => e.status === 'pending')
            .map((e) => ({ id: e.id, amount: e.amount })),
        };
      }
      if (text.includes('COUNT(*)::int AS cnt') && text.includes('vendor_earnings ve')) {
        return { rows: [{ cnt: state.earnings.length }] };
      }
      if (text.includes('UPDATE vendor_earnings')) {
        const amount = Number(params[0]);
        const id = String(params[3]);
        const row = state.earnings.find((e) => e.id === id);
        if (row) row.amount = amount;
        updates.push({ id, amount });
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('UPDATE vendors')) {
        vendorDeltas.push(Number(params[0]));
        return { rowCount: 1, rows: [] };
      }
      unmatched.push(text.replace(/\s+/g, ' ').trim().slice(0, 160));
      return { rows: [], rowCount: 0 };
    }),
  };
  return db;
}

describe('package-session-sync earnings (Pet walker 1999 regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('backfill credits 238.35 after three inflated 11440.80 rows', async () => {
    const db = createDb({
      missingBookingIds: ['session-4'],
      purchaseId: 'pkg-walker-1999',
      vendorId: 'vendor-walker-1999',
      earnings: [
        { id: 've-1', bookingId: 'session-1', amount: 11440.8, status: 'pending' },
        { id: 've-2', bookingId: 'session-2', amount: 11440.8, status: 'pending' },
        { id: 've-3', bookingId: 'session-3', amount: 11440.8, status: 'pending' },
      ],
    });

    const created = await backfillPackageSessionEarningsForCompletedBookings(
      db,
      ['vendor-walker-1999'],
      '[TEST]',
      20
    );

    expect(created).toBe(1);
    expect(db.unmatched).toEqual([]);
    expect(db.updates.map((u) => u.amount)).toEqual([238.35, 238.35, 238.35]);
    expect(db.inserts).toEqual([{ bookingId: 'session-4', amount: 238.35 }]);
    expect(db.updates.map((u) => u.amount)).toEqual([238.35, 238.35, 238.35]);
    expect(db.inserts).toEqual([{ bookingId: 'session-4', amount: 238.35 }]);
  });
});
