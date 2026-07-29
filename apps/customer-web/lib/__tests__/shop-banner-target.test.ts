import {
  isShopInformationalTarget,
  parseShopBannerTargetFromMetadata,
  resolveShopBannerProductPath,
} from '../shop-banner-target';

describe('customer shop banner target', () => {
  it('parses informational shop banner metadata', () => {
    expect(
      parseShopBannerTargetFromMetadata({
        shopBannerTarget: { targetLevel: 'informational' },
      })
    ).toEqual({ targetLevel: 'informational' });
    expect(isShopInformationalTarget({ targetLevel: 'informational' })).toBe(true);
  });

  it('parses product shop banner metadata', () => {
    const target = parseShopBannerTargetFromMetadata(
      {
        shopBannerTarget: {
          targetLevel: 'product',
          productId: '11111111-1111-1111-1111-111111111111',
        },
      },
      '/shop/11111111-1111-1111-1111-111111111111'
    );
    expect(target?.targetLevel).toBe('product');
    expect(resolveShopBannerProductPath(target)).toBe(
      '/shop/placeholder?productId=11111111-1111-1111-1111-111111111111'
    );
  });

  it('resolves legacy cta link without metadata', () => {
    const target = parseShopBannerTargetFromMetadata(null, '/shop/22222222-2222-2222-2222-222222222222');
    expect(resolveShopBannerProductPath(target)).toBe(
      '/shop/placeholder?productId=22222222-2222-2222-2222-222222222222'
    );
  });
});
