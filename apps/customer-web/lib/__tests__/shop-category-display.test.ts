import {
  isShopCategoryActive,
  filterShopCategoriesWithProducts,
  mapApiCategoriesToShop,
  normalizeShopCategoryRow,
  resolveShopCategoryParam,
  sortPetFoodSubcategoriesForShop,
  sortShopCategories,
} from '../shop-category-display';

describe('shop-category-display', () => {
  describe('isShopCategoryActive', () => {
    it('returns true when is_active/enabled is missing', () => {
      expect(isShopCategoryActive({ id: '1', name: 'Food' })).toBe(true);
    });

    it('returns false for is_active or enabled false', () => {
      expect(isShopCategoryActive({ is_active: false })).toBe(false);
      expect(isShopCategoryActive({ enabled: false })).toBe(false);
      expect(isShopCategoryActive({ is_active: 'false' })).toBe(false);
    });

    it('returns true for explicit active values', () => {
      expect(isShopCategoryActive({ is_active: true })).toBe(true);
      expect(isShopCategoryActive({ enabled: true })).toBe(true);
    });
  });

  it('uses static local image_url by category name (ignores API S3 url)', () => {
    const cat = normalizeShopCategoryRow({
      id: 'uuid-1',
      name: 'Pet Food',
      image_url: 'https://bucket.s3.amazonaws.com/ecommerce/categories/old.png',
    });
    expect(cat.image_url).toBe('/images/shop/categories/pet-food.jpeg');
    expect(cat.name).toBe('Pet Food');
  });

  it('sorts by display_order then name', () => {
    const sorted = sortShopCategories([
      { id: '2', name: 'B', display_order: 2 },
      { id: '1', name: 'A', display_order: 1 },
      { id: '3', name: 'C', display_order: 1 },
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['1', '3', '2']);
  });

  it('returns empty array for empty input', () => {
    expect(mapApiCategoriesToShop([])).toEqual([]);
  });

  it('filters rows without id or name', () => {
    const result = mapApiCategoriesToShop([
      { id: '', name: 'X' },
      { id: 'ok', name: 'Valid', display_order: 0 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Valid');
  });

  it('excludes inactive categories from mapped output', () => {
    const result = mapApiCategoriesToShop([
      { id: 'active', name: 'Pet Food', is_active: true, display_order: 1 },
      { id: 'inactive', name: 'Pet Pharmacy', is_active: false, display_order: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('active');
  });

  describe('resolveShopCategoryParam', () => {
    const categories = [
      { id: 'uuid-food', name: 'Pet Food' },
      { id: 'uuid-toys', name: 'Pet Toys' },
      { id: 'uuid-beds', name: 'Pet Beds & Furniture' },
    ];

    it('passes through matching UUID ids', () => {
      expect(resolveShopCategoryParam('uuid-food', categories)).toBe('uuid-food');
    });

    it('resolves static slug pet-food to API id', () => {
      expect(resolveShopCategoryParam('pet-food', categories)).toBe('uuid-food');
    });

    it('resolves short alias food to Pet Food id', () => {
      expect(resolveShopCategoryParam('food', categories)).toBe('uuid-food');
    });

    it('resolves beds furniture slug variants', () => {
      expect(resolveShopCategoryParam('pet-beds-furniture', categories)).toBe('uuid-beds');
    });

    it('returns empty for unknown slug', () => {
      expect(resolveShopCategoryParam('not-a-category', categories)).toBe('');
    });

    it('returns empty when categories list is empty', () => {
      expect(resolveShopCategoryParam('pet-food', [])).toBe('');
    });
  });

  it('sorts Pet Food subcategories with Therapeutic Food first', () => {
    const sorted = sortPetFoodSubcategoriesForShop([
      { id: 'dry', name: 'Dry Pet Food', display_order: 12 },
      { id: 'wet', name: 'Wet Pet Food', display_order: 13 },
      { id: 'ther', name: 'Therapeutic Food', display_order: 16 },
    ]);
    expect(sorted.map((c) => c.name)).toEqual([
      'Therapeutic Food',
      'Dry Pet Food',
      'Wet Pet Food',
    ]);
  });

  describe('filterShopCategoriesWithProducts', () => {
    it('keeps categories with product_count > 0', () => {
      const result = filterShopCategoriesWithProducts([
        { id: 'a', name: 'Food', product_count: 2 },
        { id: 'b', name: 'Empty', product_count: 0 },
        { id: 'c', name: 'Toys' },
      ]);
      expect(result.map((c) => c.id)).toEqual(['a']);
    });
  });
});
