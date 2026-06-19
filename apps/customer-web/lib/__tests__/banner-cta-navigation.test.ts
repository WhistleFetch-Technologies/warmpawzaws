import {
  applyBannerNavTarget,
  navigateBannerLink,
  resolveBannerArticlePath,
} from '../banner-cta-navigation';

jest.mock('@/lib/articles-back-nav', () => ({
  rememberArticleDetailBack: jest.fn(),
}));

import { rememberArticleDetailBack } from '@/lib/articles-back-nav';

describe('banner-cta-navigation article paths', () => {
  const push = jest.fn();
  const router = { push, back: jest.fn(), replace: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };

  beforeEach(() => {
    push.mockClear();
    (rememberArticleDetailBack as jest.Mock).mockClear();
  });

  it('navigateBannerLink pushes canonical /articles?slug= path, not bare slug', () => {
    navigateBannerLink('/articles?slug=test_page', undefined, router as never);

    expect(rememberArticleDetailBack).toHaveBeenCalledWith('/');
    expect(push).toHaveBeenCalledWith('/articles?slug=test_page');
    expect(push).not.toHaveBeenCalledWith('test_page');
  });

  it('navigateBannerLink encodes special characters in slug', () => {
    navigateBannerLink('/articles?slug=loyalty%20%26%20rewards', undefined, router as never);

    expect(push).toHaveBeenCalledWith('/articles?slug=loyalty%20%26%20rewards');
    expect(push).not.toHaveBeenCalledWith('loyalty & rewards');
  });

  it('navigateBannerLink canonicalizes path-style /articles/{slug}', () => {
    navigateBannerLink('/articles/my-slug', undefined, router as never);

    expect(push).toHaveBeenCalledWith('/articles?slug=my-slug');
    expect(push).not.toHaveBeenCalledWith('my-slug');
  });

  it('applyBannerNavTarget with path kind pushes full article URL', () => {
    applyBannerNavTarget(
      { kind: 'path', path: '/articles?slug=pet-tips' },
      undefined,
      router as never
    );

    expect(push).toHaveBeenCalledWith('/articles?slug=pet-tips');
    expect(push).not.toHaveBeenCalledWith('pet-tips');
  });

  it('resolveBannerArticlePath from metadata returns canonical path', () => {
    const path = resolveBannerArticlePath({
      metadata: {
        bannerTarget: {
          targetLevel: 'article',
          articleSlug: 'test_page',
        },
      },
    });

    expect(path).toBe('/articles?slug=test_page');
  });

  it('resolveBannerArticlePath from path-style ctaLink returns canonical path', () => {
    const path = resolveBannerArticlePath({
      ctaLink: '/articles/legacy-slug',
    });

    expect(path).toBe('/articles?slug=legacy-slug');
  });
});
