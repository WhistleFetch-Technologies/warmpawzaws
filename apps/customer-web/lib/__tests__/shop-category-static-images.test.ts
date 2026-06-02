import { getShopCategoryStaticImageUrl, slugifyShopCategoryName } from '../shop-category-static-images';

describe('shop-category-static-images', () => {
  it('slugifies category names', () => {
    expect(slugifyShopCategoryName('Pet Beds & Furniture')).toBe('pet-beds-furniture');
  });

  it('maps catalog category names to public paths', () => {
    expect(getShopCategoryStaticImageUrl('Pet Food')).toBe('/images/shop/categories/pet-food.jpeg');
    expect(getShopCategoryStaticImageUrl('Pet Accessories')).toBe(
      '/images/shop/categories/pet-accessories.jpeg'
    );
    expect(getShopCategoryStaticImageUrl('Pet Beds & Furniture')).toBe(
      '/images/shop/categories/pet-beds-furniture.jpeg'
    );
  });
});
