import {
  STATIC_SHOP_DISPLAY_CATEGORIES,
  isShopCategoryStaticImageUrl,
} from '../shop-category-static-images';

describe('shop-category-static-images', () => {
  it('exports nine static home shop categories with local image paths', () => {
    expect(STATIC_SHOP_DISPLAY_CATEGORIES).toHaveLength(9);
    for (const cat of STATIC_SHOP_DISPLAY_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.image_url).toBeTruthy();
      expect(isShopCategoryStaticImageUrl(cat.image_url)).toBe(true);
    }
  });

  it('includes expected category names for home grid', () => {
    const names = STATIC_SHOP_DISPLAY_CATEGORIES.map((c) => c.name);
    expect(names).toContain('Pet Food');
    expect(names).toContain('Pet Accessories');
    expect(names).toContain('Pet Training');
  });
});
