import {
  normalizeAdminBannerRow,
  getStoredBannerImageUrl,
  getBannerDisplayImageUrl,
  validateBannerCtaLink,
  isBrokenBannerImageUrl,
  DEFAULT_HOME_HERO_BANNER_IMAGE_PATH,
} from '../banner-admin';

describe('banner image URL helpers', () => {
  it('normalizeAdminBannerRow does not inject image_url for home_top with empty image', () => {
    const row = normalizeAdminBannerRow({
      id: '1',
      type: 'home_top',
      title: 'Test',
      image_url: null,
    });
    expect(row.image_url).toBe('');
    expect(row.imageUrl).toBe('');
  });

  it('normalizeAdminBannerRow does not inject image_url for home_middle with empty image', () => {
    const row = normalizeAdminBannerRow({
      id: '2',
      type: 'home_middle',
      title: 'Middle',
      image_url: '',
    });
    expect(row.image_url).toBe('');
  });

  it('normalizeAdminBannerRow preserves stored image URL', () => {
    const row = normalizeAdminBannerRow({
      id: '3',
      type: 'shop',
      image_url: 'https://cdn.example.com/banner.jpg',
    });
    expect(row.image_url).toBe('https://cdn.example.com/banner.jpg');
  });

  it('getStoredBannerImageUrl returns raw value without defaults', () => {
    expect(getStoredBannerImageUrl({ image_url: null })).toBe('');
    expect(getStoredBannerImageUrl({ imageUrl: ' https://x.test/a.png ' })).toBe('https://x.test/a.png');
  });

  it('getBannerDisplayImageUrl hides broken hero-pet path', () => {
    expect(getBannerDisplayImageUrl({ image_url: '/images/home/hero-pet.webp' })).toBe('');
    expect(getBannerDisplayImageUrl({ image_url: 'https://cdn.example.com/a.jpg' })).toBe(
      'https://cdn.example.com/a.jpg'
    );
  });

  it('isBrokenBannerImageUrl detects legacy hero-pet path', () => {
    expect(isBrokenBannerImageUrl('/images/home/hero-pet.webp')).toBe(true);
    expect(isBrokenBannerImageUrl('/images/home/dog-peep.webp')).toBe(false);
  });

  it('DEFAULT_HOME_HERO_BANNER_IMAGE_PATH aligns with customer-web asset', () => {
    expect(DEFAULT_HOME_HERO_BANNER_IMAGE_PATH).toBe('/images/home/dog-peep.webp');
  });
});

describe('validateBannerCtaLink', () => {
  it('rejects /vet/placeholder', () => {
    const result = validateBannerCtaLink('/vet/placeholder');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/placeholder/i);
    }
  });

  it('allows valid vendor CTA paths', () => {
    expect(validateBannerCtaLink('/vet/Healing Tails Pet Hospital').ok).toBe(true);
    expect(validateBannerCtaLink('').ok).toBe(true);
  });
});
