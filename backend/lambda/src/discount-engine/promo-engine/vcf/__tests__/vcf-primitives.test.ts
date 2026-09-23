import { classifyPaymentChannel, inferEvaluateSurface, resolveSpendChannelFromBooking } from '../channel';
import { parseVcfConfig } from '../parse-config';
import { categoryIdFromVendorRole } from '../category-from-role';
import { resolvePaymentContext } from '../payment-context';
import { visitCountForPromo } from '../visit-count';
import { matchesVisitLoop } from '../visit-loop';
import { rankEligible } from '../rank-eligible';
import { applyCombinedCap } from '../combined-cap';
import { incrementVisitProfile, decrementVisitProfile } from '../visit-profile';
import { redeemAllows } from '../redeem-allows';
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
  it('treats WAPPT commerce_mode as appointment when style is missing', () => {
    expect(
      resolveSpendChannelFromBooking({
        service_type: 'grooming',
        commerce_mode: 'warmpawz_appointments',
      })
    ).toBe('appointment');
  });
  it('keeps tele when the booking style is tele', () => {
    expect(resolveSpendChannelFromBooking({ service_type: 'tele' })).toBe('tele');
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
  it('maps Pay Bill category from vendor role when the client sent no categoryId', () => {
    const ctx = resolvePaymentContext({
      surface: 'paybill',
      vendorId: 'v1',
      roleId: 'vet-role',
      catalogue,
    });
    expect(ctx.channel).toBe('paybill');
    expect(ctx.categoryId).toBe('cat-vet');
  });
});

describe('inferEvaluateSurface', () => {
  it('treats WPAY / paybill as paybill', () => {
    expect(inferEvaluateSurface({ type: 'WPAY' })).toBe('paybill');
    expect(inferEvaluateSurface({ channel: 'paybill' })).toBe('paybill');
  });
  it('treats shop as ecommerce', () => {
    expect(inferEvaluateSurface({ type: 'ECOMMERCE' })).toBe('ecommerce');
    expect(inferEvaluateSurface({ type: 'SHOP' })).toBe('ecommerce');
  });
  it('defaults to booking', () => {
    expect(inferEvaluateSurface({})).toBe('booking');
  });
});

describe('parseVcfConfig redeem mapping', () => {
  it('fills redeem vendor from publish when the id was omitted', () => {
    const vcf = parseVcfConfig({
      vcf: {
        visitSource: { letter: 'F', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'cashback',
        publish: { letter: 'V', vendorId: 'clinic-1' },
        redeem: { letter: 'V', channels: ['paybill'] },
      },
    });
    expect(vcf?.redeem?.vendorId).toBe('clinic-1');
  });
  it('fills redeem category from visit when publish is platform', () => {
    const vcf = parseVcfConfig({
      vcf: {
        visitSource: { letter: 'C', categoryId: 'cat-vet', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'cashback',
        publish: { letter: 'F' },
        redeem: { letter: 'C', channels: ['paybill'] },
      },
    });
    expect(vcf?.redeem?.categoryId).toBe('cat-vet');
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

describe('visit profile writer primitives', () => {
  it('increments platform, category, and vendor cells for paybill', () => {
    const next = incrementVisitProfile({
      profile: emptyVisitProfile(),
      channel: 'paybill',
      vendorId: 'v1',
      categoryId: 'c1',
      roleId: 'r1',
      at: '2026-09-21T00:00:00Z',
    });
    expect(next.platform.paybill.count).toBe(1);
    expect(next.platform.tele.count).toBe(0);
    expect(next.categories.c1.paybill.count).toBe(1);
    expect(next.vendors.v1.paybill.count).toBe(1);
    expect(next.vendors.v1.categoryId).toBe('c1');
  });
  it('does not write ecommerce as a visit', () => {
    const next = incrementVisitProfile({
      profile: emptyVisitProfile(),
      channel: 'ecommerce',
      vendorId: 'v1',
    });
    expect(next).toEqual(emptyVisitProfile());
  });
  it('decrements the same cell once', () => {
    const written = incrementVisitProfile({
      profile: emptyVisitProfile(),
      channel: 'tele',
      vendorId: 'v1',
    });
    const reversed = decrementVisitProfile({
      profile: written,
      channel: 'tele',
      vendorId: 'v1',
    });
    expect(reversed.platform.tele.count).toBe(0);
    expect(reversed.vendors.v1.tele.count).toBe(0);
  });
});

describe('redeem letter + channel', () => {
  const redeem = {
    letter: 'V' as const,
    vendorId: 'v1',
    channels: ['ecommerce'] as Array<'tele' | 'appointment' | 'paybill' | 'ecommerce'>,
  };
  it('blocks Pay Bill when only ecommerce is ticked', () => {
    expect(
      redeemAllows(redeem, { vendorId: 'v1', channel: 'paybill', serviceCategory: 'VET' })
    ).toBe(false);
  });
  it('allows ecommerce at that vendor', () => {
    expect(redeemAllows(redeem, { vendorId: 'v1', channel: 'ecommerce' })).toBe(true);
  });
  it('keeps legacy category lists when there is no letter', () => {
    expect(redeemAllows({ services: ['VET'] }, { serviceCategory: 'VET' })).toBe(true);
    expect(redeemAllows({ services: ['VET'] }, { serviceCategory: 'GROOMING' })).toBe(false);
  });
});

describe('stacked F + V cashback at checkout', () => {
  const allChannels = ['tele', 'appointment', 'paybill', 'ecommerce'] as Array<
    'tele' | 'appointment' | 'paybill' | 'ecommerce'
  >;
  const platform = { letter: 'F' as const, channels: allChannels };
  const vendorScoped = {
    letter: 'V' as const,
    vendorId: 'vendor-a',
    channels: allChannels,
  };

  it('unlocks both at the matching vendor on any allowed style', () => {
    for (const channel of allChannels) {
      expect(redeemAllows(platform, { vendorId: 'vendor-a', channel })).toBe(true);
      expect(redeemAllows(vendorScoped, { vendorId: 'vendor-a', channel })).toBe(true);
    }
  });

  it('unlocks only platform cashback at a different vendor', () => {
    expect(redeemAllows(platform, { vendorId: 'vendor-b', channel: 'tele' })).toBe(true);
    expect(redeemAllows(vendorScoped, { vendorId: 'vendor-b', channel: 'tele' })).toBe(false);
    expect(redeemAllows(platform, { vendorId: 'vendor-b', channel: 'paybill' })).toBe(true);
    expect(redeemAllows(vendorScoped, { vendorId: 'vendor-b', channel: 'paybill' })).toBe(false);
  });
});
