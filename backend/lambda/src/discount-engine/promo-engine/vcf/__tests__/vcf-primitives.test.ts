import { classifyPaymentChannel } from '../channel';
import { categoryIdFromVendorRole } from '../category-from-role';
import { resolvePaymentContext } from '../payment-context';
import { visitCountForPromo } from '../visit-count';
import { matchesVisitLoop } from '../visit-loop';
import { rankEligible } from '../rank-eligible';
import { applyCombinedCap } from '../combined-cap';
import { emptyVisitProfile, type PromoVcfConfig, type RankedPromo } from '../types';

describe('V/C/F channel', () => {
  it('classifies tele styles as tele', () => {
    expect(classifyPaymentChannel({ surface: 'booking', serviceStyle: 'video_consultation' })).toBe(
      'tele'
    );
  });
  it('treats home and clinic as one appointment channel', () => {
    expect(classifyPaymentChannel({ surface: 'booking', serviceStyle: 'at_home' })).toBe(
      'appointment'
    );
    expect(classifyPaymentChannel({ surface: 'booking', serviceStyle: 'at_center' })).toBe(
      'appointment'
    );
  });
  it('never infers paybill from a category slug', () => {
    expect(classifyPaymentChannel({ surface: 'booking', serviceStyle: 'grooming' })).toBeNull();
    expect(classifyPaymentChannel({ surface: 'paybill' })).toBe('paybill');
  });
  it('marks shop as ecommerce spend-only', () => {
    expect(classifyPaymentChannel({ surface: 'ecommerce' })).toBe('ecommerce');
  });
});

describe('category from vendor role', () => {
  const catalogue = [
    { id: 'cat-groom', vendor_roles: ['role-groom', 'groomer'] },
    { id: 'cat-vet', vendor_roles: ['role-vet'] },
  ];
  it('maps role id to service_categories.id', () => {
    expect(categoryIdFromVendorRole({ roleId: 'role-groom', categories: catalogue })).toBe(
      'cat-groom'
    );
  });
  it('does not invent a slug when the role matches nothing', () => {
    expect(categoryIdFromVendorRole({ roleId: 'role-unknown', categories: catalogue })).toBeNull();
  });
});

describe('payment context', () => {
  const catalogue = [{ id: 'cat-vet', vendor_roles: ['vet-role'] }];
  it('lets a real booking category win over vendor role', () => {
    const ctx = resolvePaymentContext({
      surface: 'paybill',
      vendorId: 'v1',
      roleId: 'vet-role',
      bookingCategoryId: 'cat-vet',
      catalogue,
    });
    expect(ctx.channel).toBe('paybill');
    expect(ctx.categoryId).toBe('cat-vet');
    expect(ctx.vendorId).toBe('v1');
  });
  it('skips category when booking id is not in the catalogue', () => {
    const ctx = resolvePaymentContext({
      surface: 'paybill',
      vendorId: 'v1',
      roleId: 'missing',
      bookingCategoryId: 'not-a-row',
      catalogue,
    });
    expect(ctx.categoryId).toBeNull();
  });
});

describe('visit count is per promo source', () => {
  const profile = emptyVisitProfile();
  profile.platform.tele.count = 2;
  profile.platform.paybill.count = 1;
  profile.vendors.v1 = {
    categoryId: 'c1',
    roleId: 'r1',
    tele: { count: 4, lastAt: null },
    appointment: { count: 1, lastAt: null },
    paybill: { count: 3, lastAt: null },
  };
  profile.categories.c1 = {
    tele: { count: 10, lastAt: null },
    appointment: { count: 0, lastAt: null },
    paybill: { count: 0, lastAt: null },
  };

  function source(partial: PromoVcfConfig['visitSource']): PromoVcfConfig['visitSource'] {
    return partial;
  }

  it('sums tele+appointment+paybill for general V', () => {
    expect(
      visitCountForPromo(
        profile,
        source({ letter: 'V', vendorId: 'v1', width: 'general' })
      )
    ).toBe(8);
  });
  it('counts only ticked channels for specific C', () => {
    expect(
      visitCountForPromo(
        profile,
        source({ letter: 'C', categoryId: 'c1', width: 'specific', channels: ['tele'] })
      )
    ).toBe(10);
  });
  it('does not mix vendor counts into platform F', () => {
    expect(visitCountForPromo(profile, source({ letter: 'F', width: 'general' }))).toBe(3);
  });
});

describe('visit loop', () => {
  it('treats first visit as completed count 0', () => {
    expect(matchesVisitLoop(0, { kind: 'visit_number', n: 1 })).toBe(true);
    expect(matchesVisitLoop(1, { kind: 'visit_number', n: 1 })).toBe(false);
  });
  it('matches every Nth on the upcoming visit number', () => {
    expect(matchesVisitLoop(1, { kind: 'every_nth', n: 2 })).toBe(true);
    expect(matchesVisitLoop(0, { kind: 'every_nth', n: 2 })).toBe(false);
  });
  it('matches from N onward', () => {
    expect(matchesVisitLoop(4, { kind: 'from_onward', n: 5 })).toBe(true);
    expect(matchesVisitLoop(2, { kind: 'from_onward', n: 5 })).toBe(false);
  });
});

describe('specificity rank', () => {
  const vendor: RankedPromo = {
    promotionId: 'v',
    publishLetter: 'V',
    priority: 1,
    updatedAt: '2026-01-01',
    discount: 50,
    cashback: 0,
  };
  const platform: RankedPromo = {
    promotionId: 'f',
    publishLetter: 'F',
    priority: 99,
    updatedAt: '2026-09-01',
    discount: 200,
    cashback: 0,
  };
  const category: RankedPromo = {
    promotionId: 'c',
    publishLetter: 'C',
    priority: 50,
    updatedAt: '2026-06-01',
    discount: 80,
    cashback: 10,
  };

  it('lets a qualifying vendor beat category and platform', () => {
    const { winner, fallbacks } = rankEligible([platform, category, vendor]);
    expect(winner?.promotionId).toBe('v');
    expect(fallbacks.map((f) => f.reason)).toContain('LOST_TO_MORE_SPECIFIC');
  });

  it('does not skip category when the vendor list is empty (score-all input)', () => {
    const { winner } = rankEligible([platform, category]);
    expect(winner?.promotionId).toBe('c');
  });

  it('re-sorts eligible by least instant discount when the specificity winner has that override', () => {
    const vendorOverride: RankedPromo = {
      ...vendor,
      rankingOverride: 'least_platform_loss',
      discount: 50,
    };
    const cheapPlatform: RankedPromo = { ...platform, discount: 10 };
    const { winner } = rankEligible([vendorOverride, category, cheapPlatform]);
    expect(winner?.promotionId).toBe('f');
  });

  it('does not run override when unset', () => {
    const { winner } = rankEligible([vendor, platform]);
    expect(winner?.promotionId).toBe('v');
  });
});

describe('combined cap', () => {
  it('cuts cashback first then discount', () => {
    expect(applyCombinedCap({ discount: 80, cashback: 50, maxDiscount: 100, billAmount: 500 })).toEqual({
      discount: 80,
      cashback: 20,
    });
    expect(applyCombinedCap({ discount: 120, cashback: 40, maxDiscount: 100, billAmount: 500 })).toEqual({
      discount: 100,
      cashback: 0,
    });
  });
});
