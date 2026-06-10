import {
  buildBannerBackgroundImageCss,
  buildBannerGradientOverlayBackground,
  normalizeBannerHexColor,
  parseBannerMetadataRecord,
  resolveBannerGradients,
} from '../customer-banner-surface';

describe('parseBannerMetadataRecord', () => {
  it('parses JSON string metadata', () => {
    expect(parseBannerMetadataRecord('{"gradient_from":"#111111"}')).toEqual({
      gradient_from: '#111111',
    });
  });
});

describe('resolveBannerGradients', () => {
  it('reads top-level and metadata snake_case', () => {
    expect(
      resolveBannerGradients({
        gradientFrom: '#aaaaaa',
        metadata: { gradient_to: '#bbbbbb' },
      })
    ).toEqual({ gradientFrom: '#aaaaaa', gradientTo: '#bbbbbb' });
  });
});

describe('normalizeBannerHexColor', () => {
  it('adds hash for bare hex', () => {
    expect(normalizeBannerHexColor('1e40af', '#000')).toBe('#1e40af');
  });

  it('falls back on invalid values', () => {
    expect(normalizeBannerHexColor('not-a-color', '#ff0000')).toBe('#ff0000');
  });
});

describe('buildBannerBackgroundImageCss', () => {
  it('returns solid gradient when no image', () => {
    expect(
      buildBannerBackgroundImageCss({
        gradientFrom: '#1e40af',
        gradientTo: '#7c3aed',
      })
    ).toBe('linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)');
  });

  it('stacks CMS gradient tint over image url', () => {
    const css = buildBannerBackgroundImageCss({
      imageUrl: 'https://cdn.example.com/banner.jpg',
      gradientFrom: '#1e40af',
      gradientTo: '#7c3aed',
    });
    expect(css).toContain('linear-gradient(135deg, rgba(30, 64, 175, 0.85)');
    expect(css).toContain('url("https://cdn.example.com/banner.jpg")');
  });
});

describe('buildBannerGradientOverlayBackground', () => {
  it('uses admin colors with alpha instead of black', () => {
    const css = buildBannerGradientOverlayBackground({
      gradientFrom: '#ff0000',
      gradientTo: '#0000ff',
    });
    expect(css).toContain('rgba(255, 0, 0, 0.85)');
    expect(css).not.toContain('rgba(0, 0, 0');
  });
});
