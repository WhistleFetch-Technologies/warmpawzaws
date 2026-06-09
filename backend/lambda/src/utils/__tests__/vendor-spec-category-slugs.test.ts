import {
  expandSpecCategorySlugs,
  isBoardingFamilySpecCategory,
  normalizeCatalogCategoryKey,
  roleNamesForSpecCategoryQuery,
} from '../vendor-spec-category-slugs';

describe('vendor-spec-category-slugs', () => {
  it('maps pet sitting aliases to boarding spec category', () => {
    expect(expandSpecCategorySlugs('pet-sitter')).toContain('boarding');
    expect(expandSpecCategorySlugs('Pet Sitting')).toContain('boarding');
  });

  it('maps pet boarding aliases to boarding spec category', () => {
    expect(expandSpecCategorySlugs('pet_boarding')).toContain('boarding');
    expect(expandSpecCategorySlugs('pet-daycare')).toContain('boarding');
  });

  it('detects boarding family categories', () => {
    const slugs = expandSpecCategorySlugs('pet_sitting').map(normalizeCatalogCategoryKey);
    expect(isBoardingFamilySpecCategory(slugs)).toBe(true);
  });

  it('skips role filter for boarding family categories', () => {
    const slugs = expandSpecCategorySlugs('pet_boarding').map(normalizeCatalogCategoryKey);
    expect(roleNamesForSpecCategoryQuery(slugs, ['boarding_solo'])).toEqual([]);
  });

  it('keeps role filter for non-boarding categories', () => {
    const slugs = expandSpecCategorySlugs('grooming').map(normalizeCatalogCategoryKey);
    expect(roleNamesForSpecCategoryQuery(slugs, ['groomer_solo', 'groomer'])).toEqual([
      'groomer_solo',
      'groomer',
    ]);
  });
});
