import {
  parseBannerCtaLink,
  parseBannerTargetFromMetadata,
  normalizeBannerServiceStyle,
  buildVendorProfileNavTarget,
  buildBookingNavTarget,
  enrichBannersWithNavTargets,
  resolveBannerCtaNavigation,
} from '../banner-cta-resolver';

describe('parseBannerCtaLink', () => {
  it('parses /persona/vendor name paths', () => {
    expect(parseBannerCtaLink('/vet/Healing Tails Pet Hospital')).toEqual({
      persona: 'vet',
      vendorName: 'Healing Tails Pet Hospital',
    });
  });

  it('parses paths without leading slash', () => {
    expect(parseBannerCtaLink('vet/Healing Tails')).toEqual({
      persona: 'vet',
      vendorName: 'Healing Tails',
    });
  });

  it('returns null for single-segment persona-only links', () => {
    expect(parseBannerCtaLink('/vet')).toBeNull();
    expect(parseBannerCtaLink('/grooming')).toBeNull();
  });

  it('returns null for external URLs', () => {
    expect(parseBannerCtaLink('https://example.com/vet/clinic')).toBeNull();
  });

  it('returns null for reserved placeholder vendor slug', () => {
    expect(parseBannerCtaLink('/vet/placeholder')).toBeNull();
    expect(parseBannerCtaLink('/vet/placeholder.html')).toBeNull();
  });
});

describe('parseBannerTargetFromMetadata', () => {
  it('reads legacy vendor bannerTarget from metadata', () => {
    const target = parseBannerTargetFromMetadata({
      gradient_from: '#fff',
      bannerTarget: {
        persona: 'vet',
        serviceStyle: 'at_center',
        vendorId: '11111111-1111-1111-1111-111111111111',
        vendorName: 'Healing Tails',
        vendorServiceId: null,
        targetLevel: 'vendor',
      },
    });
    expect(target).toMatchObject({
      persona: 'vet',
      serviceStyle: 'at_center',
      vendorId: '11111111-1111-1111-1111-111111111111',
      targetLevel: 'vendor',
    });
  });

  it('reads category-only bannerTarget', () => {
    const target = parseBannerTargetFromMetadata({
      bannerTarget: {
        categoryId: 'veterinary',
        customerScreen: 'vet',
        targetLevel: 'category',
      },
    });
    expect(target).toMatchObject({
      categoryId: 'veterinary',
      customerScreen: 'vet',
      targetLevel: 'category',
    });
  });

  it('reads service_type bannerTarget', () => {
    const target = parseBannerTargetFromMetadata({
      bannerTarget: {
        categoryId: 'grooming',
        customerScreen: 'grooming',
        targetLevel: 'service_type',
        serviceStyle: 'at_home',
      },
    });
    expect(target).toMatchObject({
      targetLevel: 'service_type',
      serviceStyle: 'at_home',
    });
  });

  it('reads article bannerTarget', () => {
    const target = parseBannerTargetFromMetadata({
      bannerTarget: {
        targetLevel: 'article',
        articleSlug: 'pawints-program',
        articleTitle: 'Pawints Program',
      },
    });
    expect(target).toMatchObject({
      targetLevel: 'article',
      articleSlug: 'pawints-program',
    });
  });

  it('returns null when no target info', () => {
    expect(parseBannerTargetFromMetadata({ bannerTarget: {} })).toBeNull();
  });
});

describe('resolveBannerCtaNavigation article', () => {
  it('resolves article slug to in-app path without DB', async () => {
    const nav = await resolveBannerCtaNavigation({
      metadata: {
        bannerTarget: {
          targetLevel: 'article',
          articleSlug: 'pawints-program',
        },
      },
    });
    expect(nav).toEqual({
      kind: 'path',
      path: '/articles?slug=pawints-program',
    });
  });

  it('encodes special characters in article slug', async () => {
    const nav = await resolveBannerCtaNavigation({
      metadata: {
        bannerTarget: {
          targetLevel: 'article',
          articleSlug: 'loyalty & rewards',
        },
      },
    });
    expect(nav).toEqual({
      kind: 'path',
      path: '/articles?slug=loyalty%20%26%20rewards',
    });
  });
});

describe('normalizeBannerServiceStyle', () => {
  it('normalizes aliases', () => {
    expect(normalizeBannerServiceStyle('clinic')).toBe('at_center');
    expect(normalizeBannerServiceStyle('home')).toBe('at_home');
    expect(normalizeBannerServiceStyle('online')).toBe('tele');
  });
});

describe('buildVendorProfileNavTarget', () => {
  const vendor = { id: 'v1', business_name: 'Healing Tails' };

  it('type-only vet → vet-services-by-style with serviceStyle', () => {
    const nav = buildVendorProfileNavTarget('vet', vendor, 'at_center');
    expect(nav).toEqual({
      kind: 'screen',
      screen: 'vet-services-by-style',
      data: expect.objectContaining({
        vendorId: 'v1',
        serviceStyle: 'at_center',
      }),
    });
    expect(nav.kind === 'screen' && nav.data.returnScreen).toBeUndefined();
  });

  it('type-only grooming → grooming screen with vendorId', () => {
    const nav = buildVendorProfileNavTarget('grooming', vendor, 'at_home');
    expect(nav).toEqual({
      kind: 'screen',
      screen: 'grooming',
      data: expect.objectContaining({
        vendorId: 'v1',
        serviceStyle: 'at_home',
      }),
    });
  });
});

describe('buildBookingNavTarget', () => {
  const vendor = { id: 'v1', business_name: 'Healing Tails' };
  const service = {
    id: 'vs1',
    service_id: 'sc1',
    service_name: 'CRP + Rabies Vaccination',
    service_style: 'at_center',
    price: 2700,
    duration: 30,
    metadata: {},
  };

  it('service selected → direct vet-booking', () => {
    const nav = buildBookingNavTarget('vet', vendor, service);
    expect(nav.kind).toBe('screen');
    if (nav.kind === 'screen') {
      expect(nav.screen).toBe('vet-booking');
      expect(nav.data).toMatchObject({
        vendorId: 'v1',
        serviceId: 'vs1',
        serviceStyle: 'at_center',
      });
      expect(nav.data.returnScreen).toBeUndefined();
    }
  });

  it('tele vet service sets teleInstantPay flag', () => {
    const nav = buildBookingNavTarget('vet', vendor, { ...service, service_style: 'tele' });
    if (nav.kind === 'screen') {
      expect(nav.data.teleInstantPay).toBe(true);
    }
  });
});

describe('enrichBannersWithNavTargets', () => {
  it('skips navTarget for checkout banners', async () => {
    const result = await enrichBannersWithNavTargets([
      {
        type: 'checkout',
        title: 'Checkout promo',
        metadata: {
          bannerTarget: {
            categoryId: 'vet',
            customerScreen: 'vet',
            targetLevel: 'category',
          },
        },
      },
    ]);
    expect(result[0].navTarget).toBeUndefined();
  });

  it('skips navTarget for home informational banners', async () => {
    const result = await enrichBannersWithNavTargets([
      {
        position: 'home_top',
        title: 'Awareness',
        metadata: {
          bannerTarget: { targetLevel: 'informational' },
        },
      },
    ]);
    expect(result[0].navTarget).toBeUndefined();
  });
});
