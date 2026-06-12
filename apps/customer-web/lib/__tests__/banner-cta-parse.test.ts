import {
  parseBannerCtaLink,
  isVendorBannerCta,
  buildBannerCtaPathFromSegments,
  resolveBannerDeepLinkVendorSlug,
} from '../banner-cta-parse';

describe('banner-cta-parse', () => {
  it('detects vendor deep links', () => {
    expect(isVendorBannerCta('/vet/Healing Tails Pet Hospital')).toBe(true);
    expect(parseBannerCtaLink('/grooming/Paws & Claws')).toEqual({
      persona: 'grooming',
      vendorName: 'Paws & Claws',
    });
  });

  it('ignores single-segment category links', () => {
    expect(isVendorBannerCta('/vet')).toBe(false);
    expect(isVendorBannerCta('/grooming')).toBe(false);
  });

  it('rejects reserved placeholder vendor slug', () => {
    expect(isVendorBannerCta('/vet/placeholder')).toBe(false);
    expect(parseBannerCtaLink('/vet/placeholder')).toBeNull();
  });

  it('builds CTA paths from route segments', () => {
    expect(buildBannerCtaPathFromSegments('vet', ['Bindushree M'])).toBe('/vet/Bindushree M');
    expect(buildBannerCtaPathFromSegments('vet', null)).toBe('/vet');
  });

  it('reads vendor name from browser URL when static export params are placeholder', () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, pathname: '/vet/Healing%20Tails%20Pet%20Hospital', search: '' },
    });
    expect(resolveBannerDeepLinkVendorSlug('vet', ['placeholder'])).toEqual(['Healing Tails Pet Hospital']);
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
