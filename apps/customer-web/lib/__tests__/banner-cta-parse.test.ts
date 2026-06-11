import { parseBannerCtaLink, isVendorBannerCta, buildBannerCtaPathFromSegments } from '../banner-cta-parse';

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
});
