import { describe, expect, test } from '@jest/globals';
import {
  allocatePackageSessionGross,
  allocatedEarningsFromStored,
  sqlPackageAllocatedEarningsAgg,
} from '../package-session-earnings-allocation';
import { isCanonicalPackageParentBooking, isPackageSessionChildBooking } from '../vendor-commission-rate';

describe('package-session-earnings-allocation', () => {
  test('does not give each of 3 sessions the full package price', () => {
    const parent = 12712;
    const n = 3;
    const s1 = allocatePackageSessionGross({
      parentServiceValue: parent,
      sessionCount: n,
      priorCount: 0,
      priorSum: 0,
    });
    const s2 = allocatePackageSessionGross({
      parentServiceValue: parent,
      sessionCount: n,
      priorCount: 1,
      priorSum: s1,
    });
    const s3 = allocatePackageSessionGross({
      parentServiceValue: parent,
      sessionCount: n,
      priorCount: 2,
      priorSum: s1 + s2,
    });
    expect(s1).toBe(4237.33);
    expect(s2).toBe(4237.33);
    expect(s3).toBe(4237.34);
    expect(s1 + s2 + s3).toBe(parent);
    expect(s1).not.toBe(parent);
  });

  test('partial completion recognizes only completed slices', () => {
    const parent = 12712;
    const n = 3;
    const s1 = allocatePackageSessionGross({
      parentServiceValue: parent,
      sessionCount: n,
      priorCount: 0,
      priorSum: 0,
    });
    expect(s1).toBe(4237.33);
    expect(
      allocatePackageSessionGross({
        parentServiceValue: parent,
        sessionCount: n,
        priorCount: 3,
        priorSum: parent,
      }),
    ).toBe(0);
  });

  test('caps remaining so later sessions cannot exceed parent after inflated history', () => {
    expect(
      allocatePackageSessionGross({
        parentServiceValue: 12712,
        sessionCount: 30,
        priorCount: 3,
        priorSum: 38136,
      }),
    ).toBe(0);
  });

  test('allocatedEarningsFromStored reslices historical full-price child rows', () => {
    const a = allocatedEarningsFromStored({
      isPackageSession: true,
      parentService: 12712,
      sessionCount: 3,
      sessionSeq: 1,
      storedGross: 12712,
      storedCommission: 1271.2,
      storedNet: 11440.8,
      commissionRate: 10,
    });
    const b = allocatedEarningsFromStored({
      isPackageSession: true,
      parentService: 12712,
      sessionCount: 3,
      sessionSeq: 2,
      storedGross: 12712,
      storedCommission: 1271.2,
      storedNet: 11440.8,
      commissionRate: 10,
    });
    const c = allocatedEarningsFromStored({
      isPackageSession: true,
      parentService: 12712,
      sessionCount: 3,
      sessionSeq: 3,
      storedGross: 12712,
      storedCommission: 1271.2,
      storedNet: 11440.8,
      commissionRate: 10,
    });
    expect(a.gross + b.gross + c.gross).toBe(12712);
    expect(a.gross).toBe(4237.33);
    expect(c.gross).toBe(4237.34);
  });

  test('normal bookings keep stored earnings', () => {
    const n = allocatedEarningsFromStored({
      isPackageSession: false,
      parentService: 0,
      sessionCount: 0,
      sessionSeq: null,
      storedGross: 500,
      storedCommission: 50,
      storedNet: 450,
      commissionRate: 10,
    });
    expect(n).toEqual({ gross: 500, commission: 50, net: 450 });
  });

  test('daily accrual SQL allocates package sessions in one statement', () => {
    const sql = sqlPackageAllocatedEarningsAgg();
    expect(sql).toContain('package_caps');
    expect(sql).toContain('allocated_earnings');
    expect(sql).toContain('ROW_NUMBER()');
    expect(sql).not.toContain('SELECT * FROM vendor_earnings ve WHERE ve.booking_id = $');
  });
});

describe('package booking classifiers', () => {
  test('parent vs session child', () => {
    expect(
      isCanonicalPackageParentBooking({ package_purchase_id: 'pp', is_package_session: false }),
    ).toBe(true);
    expect(
      isPackageSessionChildBooking({ package_purchase_id: 'pp', is_package_session: true }),
    ).toBe(true);
    expect(isPackageSessionChildBooking({ package_purchase_id: 'pp', is_package_session: false })).toBe(
      false,
    );
    expect(isCanonicalPackageParentBooking({ is_package_session: false })).toBe(false);
  });
});
