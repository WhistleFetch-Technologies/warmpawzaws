import {
  areSpecializationRowsValidForCatalogSlug,
  expandSpecCategorySlugs,
  expandSpecCategorySlugsForDbQuery,
  filterSpecializationMasterRowsForVendorCategory,
  isBoardingSpecializationRow,
  isSitterFamilySpecCategory,
  isSitterSpecializationRow,
  normalizeCatalogCategoryKey,
  roleNamesForSpecCategoryQuery,
} from '../vendor-spec-category-slugs';

describe('vendor-spec-category-slugs', () => {
  it('maps pet sitting aliases to sitter spec category (not boarding-only query key)', () => {
    expect(expandSpecCategorySlugs('pet-sitter')).toContain('sitter');
    expect(expandSpecCategorySlugs('pet-sitter')).not.toContain('boarding');
    expect(expandSpecCategorySlugsForDbQuery('pet-sitter')).toContain('boarding');
  });

  it('maps pet boarding aliases to boarding spec category only', () => {
    expect(expandSpecCategorySlugs('pet_boarding')).toContain('boarding');
    expect(expandSpecCategorySlugs('pet_boarding')).not.toContain('sitter');
  });

  it('filters sitting rows out of boarding pick and boarding rows out of sitting pick', () => {
    const rows = [
      { specialization_id: 'daycare', applicable_roles: ['boarding', 'pet_boarder'] },
      { specialization_id: 'overnight_sitting', applicable_roles: ['sitter', 'pet_sitter'] },
      { specialization_id: 'drop_in', applicable_roles: ['sitter'] },
    ];
    const boardingSlugs = expandSpecCategorySlugs('pet_boarding').map(normalizeCatalogCategoryKey);
    const sitterSlugs = expandSpecCategorySlugs('pet_sitting').map(normalizeCatalogCategoryKey);

    expect(
      filterSpecializationMasterRowsForVendorCategory(rows, boardingSlugs).map((r) => r.specialization_id)
    ).toEqual(['daycare']);
    expect(
      filterSpecializationMasterRowsForVendorCategory(rows, sitterSlugs).map((r) => r.specialization_id)
    ).toEqual(['overnight_sitting', 'drop_in']);
  });

  it('detects sitter vs boarding rows by specialization_id', () => {
    expect(isSitterSpecializationRow({ specialization_id: 'overnight_sitting', applicable_roles: [] })).toBe(true);
    expect(isBoardingSpecializationRow({ specialization_id: 'short_stay', applicable_roles: [] })).toBe(true);
    expect(isBoardingSpecializationRow({ specialization_id: 'overnight_sitting', applicable_roles: ['sitter'] })).toBe(false);
  });

  it('skips role filter for boarding and sitter family categories', () => {
    const boardingSlugs = expandSpecCategorySlugs('pet_boarding').map(normalizeCatalogCategoryKey);
    const sitterSlugs = expandSpecCategorySlugs('pet_sitting').map(normalizeCatalogCategoryKey);
    expect(isSitterFamilySpecCategory(sitterSlugs)).toBe(true);
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

  it('accepts pet-sitter custom-service specs stored under boarding category_id', () => {
    const rows = [
      {
        specialization_id: 'overnight_sitting',
        category_id: 'boarding',
        applicable_roles: ['sitter', 'pet_sitter'],
      },
      {
        specialization_id: 'drop_in',
        category_id: 'boarding',
        applicable_roles: ['sitter'],
      },
    ];
    expect(
      areSpecializationRowsValidForCatalogSlug(rows, 'pet-sitter', [
        'overnight_sitting',
        'drop_in',
      ])
    ).toBe(true);
  });

  it('rejects boarding-only specs when catalogue category is pet sitting', () => {
    const rows = [
      {
        specialization_id: 'daycare',
        category_id: 'boarding',
        applicable_roles: ['boarding', 'pet_boarder'],
      },
    ];
    expect(areSpecializationRowsValidForCatalogSlug(rows, 'pet-sitter', ['daycare'])).toBe(false);
  });

  it('rejects specs whose category_id is outside the expanded catalogue family', () => {
    const rows = [
      {
        specialization_id: 'bath_brush',
        category_id: 'grooming',
        applicable_roles: ['groomer'],
      },
    ];
    expect(areSpecializationRowsValidForCatalogSlug(rows, 'pet-sitter', ['bath_brush'])).toBe(false);
  });
});
