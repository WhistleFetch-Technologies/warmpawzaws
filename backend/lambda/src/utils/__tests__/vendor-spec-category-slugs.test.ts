import {
  expandSpecCategorySlugs,
  isBoardingFamilySpecCategory,
  isSitterFamilySpecCategory,
  normalizeCatalogCategoryKey,
  roleNamesForSpecCategoryQuery,
} from '../vendor-spec-category-slugs';

describe('vendor-spec-category-slugs', () => {
  it('maps pet sitting aliases to sitter spec category (not boarding)', () => {
    expect(expandSpecCategorySlugs('pet-sitter')).toContain('sitter');
    expect(expandSpecCategorySlugs('Pet Sitting')).toContain('sitter');
    expect(expandSpecCategorySlugs('pet-sitter')).not.toContain('boarding');
  });

  it('maps pet boarding aliases to boarding spec category only', () => {
    expect(expandSpecCategorySlugs('pet_boarding')).toContain('boarding');
    expect(expandSpecCategorySlugs('pet-daycare')).toContain('boarding');
    expect(expandSpecCategorySlugs('pet_boarding')).not.toContain('sitter');
  });

  it('detects sitter family categories separately from boarding', () => {
    const sitterSlugs = expandSpecCategorySlugs('pet_sitting').map(normalizeCatalogCategoryKey);
    expect(isSitterFamilySpecCategory(sitterSlugs)).toBe(true);
    expect(isBoardingFamilySpecCategory(sitterSlugs)).toBe(false);
  });

  it('skips role filter for boarding and sitter family categories', () => {
    const boardingSlugs = expandSpecCategorySlugs('pet_boarding').map(normalizeCatalogCategoryKey);
    const sitterSlugs = expandSpecCategorySlugs('pet_sitting').map(normalizeCatalogCategoryKey);
    expect(roleNamesForSpecCategoryQuery(boardingSlugs, ['boarding_solo'])).toEqual([]);
    expect(roleNamesForSpecCategoryQuery(sitterSlugs, ['sitter'])).toEqual([]);
  });

  it('keeps role filter for non-boarding categories', () => {
    const slugs = expandSpecCategorySlugs('grooming').map(normalizeCatalogCategoryKey);
    expect(roleNamesForSpecCategoryQuery(slugs, ['groomer_solo', 'groomer'])).toEqual([
      'groomer_solo',
      'groomer',
    ]);
  });
});
