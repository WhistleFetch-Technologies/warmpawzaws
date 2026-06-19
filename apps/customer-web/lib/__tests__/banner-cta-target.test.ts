import {
  buildArticleBannerPath,
  parseArticleSlugFromBannerPath,
  parseArticleSlugFromCtaLink,
} from '../banner-cta-target';

describe('banner-cta-target article slug parsing', () => {
  it('parseArticleSlugFromBannerPath reads ?slug= query param', () => {
    expect(parseArticleSlugFromBannerPath('/articles?slug=test_page')).toBe('test_page');
    expect(parseArticleSlugFromBannerPath('/articles?slug=loyalty%20%26%20rewards')).toBe(
      'loyalty & rewards'
    );
  });

  it('parseArticleSlugFromCtaLink reads ?slug= query param', () => {
    expect(parseArticleSlugFromCtaLink('/articles?slug=my-slug')).toBe('my-slug');
  });

  it('parseArticleSlugFromCtaLink reads path-style /articles/{slug}', () => {
    expect(parseArticleSlugFromCtaLink('/articles/my-slug')).toBe('my-slug');
    expect(parseArticleSlugFromCtaLink('/articles/encoded%20slug')).toBe('encoded slug');
  });

  it('parseArticleSlugFromCtaLink returns null for non-article paths', () => {
    expect(parseArticleSlugFromCtaLink('/vet/clinic')).toBeNull();
    expect(parseArticleSlugFromCtaLink('/articles')).toBeNull();
    expect(parseArticleSlugFromCtaLink('')).toBeNull();
  });

  it('buildArticleBannerPath produces canonical customer URL', () => {
    expect(buildArticleBannerPath('test_page')).toBe('/articles?slug=test_page');
    expect(buildArticleBannerPath('loyalty & rewards')).toBe(
      '/articles?slug=loyalty%20%26%20rewards'
    );
  });
});
