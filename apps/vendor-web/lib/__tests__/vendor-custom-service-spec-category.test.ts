import { resolveVendorCustomServiceSpecCategoryId } from '../vendor-custom-service-spec-category';

describe('resolveVendorCustomServiceSpecCategoryId', () => {
  it('uses platform category UUID when set', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        platformCategoryId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        categoryName: 'Pet Boarding',
      })
    ).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('resolves pet sitting display name to category slug', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'Pet Sitting',
        catalogCategories: [
          { id: 'uuid-1', category_id: 'pet-sitter', name: 'Pet Sitting' },
        ],
      })
    ).toBe('pet-sitter');
  });

  it('falls back to normalized name when catalogue row is missing', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'Pet Boarding',
        catalogCategories: [],
      })
    ).toBe('pet_boarding');
  });

  it('matches micro-category slug id directly', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'pet_boarding',
        catalogCategories: [],
      })
    ).toBe('pet_boarding');
  });
});
