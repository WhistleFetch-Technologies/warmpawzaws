import { describe, expect, test } from '@jest/globals';
import {
  allocatePackageSessionGross,
  allocatePackageSessionVendorNet,
  allocatedEarningsFromStored,
  allocatedPriorVendorNetSum,
  firstSessionPackageBreakdown,
  isInflatedPackageSessionNet,
  scaleGrossFromVendorNet,
  sqlPackageAllocatedEarningsAgg,
  vendorEarningsAmountsForDisplay,
  vendorPoolAfterCommission,
} from '../package-session-earnings-allocation';
import { isCanonicalPackageParentBooking, isPackageSessionChildBooking } from '../vendor-commission-rate';

describe('package-session-earnings-allocation', () => {
  test('vendor net pool 11440.80 divided by 48 sessions is 238.35', () => {
    const pool = vendorPoolAfterCommission(12712, 10);
    expect(pool).toBe(11440.8);
    const slices: number[] = [];
    let priorSum = 0;
    for (let i = 0; i < 48; i++) {
      const net = allocatePackageSessionVendorNet({
        vendorPool: pool,
        sessionCount: 48,
        priorCount: i,
        priorSum,
      });
      slices.push(net);
      priorSum = Math.round((priorSum + net) * 100) / 100;
    }
    expect(slices[0]).toBe(238.35);
    expect(slices[1]).toBe(238.35);
    expect(slices[2]).toBe(238.35);
    expect(slices.slice(0, 3).reduce((a, b) => Math.round((a + b) * 100) / 100, 0)).toBe(715.05);
    expect(slices.every((s) => s === 238.35)).toBe(true);
    expect(priorSum).toBe(11440.8);
    const first = scaleGrossFromVendorNet({ vendorNet: 238.35, commissionRate: 10 });
    expect(first.vendorNet).toBe(238.35);
    expect(first.allocatedGross).toBeGreaterThan(first.vendorNet);
  });

  test('uncompleted sessions do not receive a slice', () => {
    const pool = vendorPoolAfterCommission(12712, 10);
    expect(
      allocatePackageSessionVendorNet({
        vendorPool: pool,
        sessionCount: 48,
        priorCount: 3,
        priorSum: 715.05,
      })
    ).toBe(238.35);
    expect(
      allocatePackageSessionVendorNet({
        vendorPool: pool,
        sessionCount: 48,
        priorCount: 48,
        priorSum: 11440.8,
      })
    ).toBe(0);
  });
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

  test('allocated prior sum ignores inflated stored nets so session 4 still gets 238.35', () => {
    const pool = vendorPoolAfterCommission(12712, 10);
    const priorSum = allocatedPriorVendorNetSum({
      vendorPool: pool,
      sessionCount: 48,
      priorCount: 3,
    });
    expect(priorSum).toBe(715.05);
    expect(
      allocatePackageSessionVendorNet({
        vendorPool: pool,
        sessionCount: 48,
        priorCount: 3,
        priorSum,
      }),
    ).toBe(238.35);
    expect(isInflatedPackageSessionNet(11440.8, 238.35)).toBe(true);
    expect(isInflatedPackageSessionNet(238.35, 238.35)).toBe(false);
  });

  test('vendor earnings display reslices 11440.80 to 238.35 per walk', () => {
    const shown = vendorEarningsAmountsForDisplay({
      isPackageSession: true,
      parentService: 12712,
      sessionCount: 48,
      sessionSeq: 1,
      storedGross: 12712,
      storedCommission: 1271.2,
      storedNet: 11440.8,
      commissionRate: 10,
    });
    expect(shown.amount).toBe(238.35);
    const second = vendorEarningsAmountsForDisplay({
      isPackageSession: true,
      parentService: 12712,
      sessionCount: 48,
      sessionSeq: 2,
      storedGross: 12712,
      storedCommission: 1271.2,
      storedNet: 11440.8,
      commissionRate: 10,
    });
    const third = vendorEarningsAmountsForDisplay({
      isPackageSession: true,
      parentService: 12712,
      sessionCount: 48,
      sessionSeq: 3,
      storedGross: 12712,
      storedCommission: 1271.2,
      storedNet: 11440.8,
      commissionRate: 10,
    });
    expect(second.amount).toBe(238.35);
    expect(third.amount).toBe(238.35);
    expect(Math.round((shown.amount + second.amount + third.amount) * 100) / 100).toBe(715.05);
    const breakdown = firstSessionPackageBreakdown({
      sessionSeq: 1,
      parentService: 12712,
      sessionCount: 48,
      commissionRate: 10,
      thisSession: shown.amount,
    });
    expect(breakdown?.vendorPool).toBe(11440.8);
    expect(breakdown?.thisSession).toBe(238.35);
    expect(firstSessionPackageBreakdown({
      sessionSeq: 2,
      parentService: 12712,
      sessionCount: 48,
      commissionRate: 10,
      thisSession: second.amount,
    })).toBeNull();
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
    expect(sql).toContain("metadata->'settlementSnapshot'->>'vendorSettlement'");
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
