import {
  buildBannerPreviewBackground,
  buildShopBannerCtaLink,
  buildShopBannerTarget,
  mergeShopBannerIntoMetadata,
  parseShopBannerTargetFromAdminRow,
  validateShopBannerSaveTarget,
} from '../banner-admin';

describe('shop banner metadata helpers', () => {
  it('builds informational shop target', () => {
    expect(buildShopBannerTarget({ targetMode: 'informational' })).toEqual({
      targetLevel: 'informational',
    });
    expect(buildShopBannerCtaLink({ targetLevel: 'informational' })).toBe('');
  });

  it('builds product shop target and cta link', () => {
    const target = buildShopBannerTarget({
      targetMode: 'product',
      productId: '11111111-1111-1111-1111-111111111111',
      productName: 'Treats',
      productSku: 'TR-1',
    });
    expect(target).toEqual({
      targetLevel: 'product',
      productId: '11111111-1111-1111-1111-111111111111',
      productName: 'Treats',
      productSku: 'TR-1',
    });
    expect(buildShopBannerCtaLink(target)).toBe('/shop/11111111-1111-1111-1111-111111111111');
  });

  it('merges shop target into banner metadata', () => {
    const meta = mergeShopBannerIntoMetadata(
      { gradient_from: '#111', gradient_to: '#222' },
      { targetLevel: 'product', productId: 'abc', productName: 'Food', productSku: 'F1' }
    );
    expect(meta.shopBannerTarget).toEqual({
      targetLevel: 'product',
      productId: 'abc',
      productName: 'Food',
      productSku: 'F1',
    });
  });

  it('parses shopBannerTarget from admin row', () => {
    const parsed = parseShopBannerTargetFromAdminRow({
      metadata: {
        shopBannerTarget: {
          targetLevel: 'product',
          productId: '11111111-1111-1111-1111-111111111111',
          productName: 'Kibble',
          productSku: 'KB-1',
        },
      },
    });
    expect(parsed?.targetLevel).toBe('product');
    expect(parsed?.productId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('falls back to legacy /shop/{id} cta link', () => {
    const parsed = parseShopBannerTargetFromAdminRow({
      cta_link: '/shop/22222222-2222-2222-2222-222222222222',
    });
    expect(parsed).toEqual({
      targetLevel: 'product',
      productId: '22222222-2222-2222-2222-222222222222',
    });
  });

  it('validates product selection for product mode', () => {
    expect(validateShopBannerSaveTarget({ targetMode: 'informational', productId: '' }).ok).toBe(true);
    expect(validateShopBannerSaveTarget({ targetMode: 'product', productId: '' }).ok).toBe(false);
    expect(validateShopBannerSaveTarget({ targetMode: 'product', productId: 'abc' }).ok).toBe(true);
  });
});

describe('buildBannerPreviewBackground', () => {
  it('tints image with CMS gradient colors', () => {
    const css = buildBannerPreviewBackground({
      imageUrl: 'https://example.com/b.jpg',
      gradientFrom: '#1e40af',
      gradientTo: '#7c3aed',
    });
    expect(css).toContain('rgba(30, 64, 175, 0.85)');
    expect(css).toContain('url("https://example.com/b.jpg")');
  });
});
