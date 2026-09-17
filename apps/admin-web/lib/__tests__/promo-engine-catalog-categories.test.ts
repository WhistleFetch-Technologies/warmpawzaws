import {
  catalogCategorySlug,
  labelForCatalogSlug,
  matchCatalogSlug,
  normalizeCatalogCategories,
} from '../promo-engine/catalog-categories';

describe('normalizeCatalogCategories', () => {
  it('keeps catalogue slugs and display names, drops ecommerce and inactive', () => {
    const rows = normalizeCatalogCategories([
      { id: '1', categoryId: 'grooming', name: 'Grooming', status: 'active' },
      { id: '2', slug: 'vet-care', name: 'Vet Care' },
      { id: '3', category_id: 'boarding', display_name: 'Boarding', type: 'ecommerce' },
      { id: '4', categoryId: 'training', name: 'Training', status: 'inactive' },
      { id: '5', categoryId: 'grooming', name: 'Grooming duplicate' },
    ]);
    expect(rows.map((r) => r.slug)).toEqual(['grooming', 'vet-care']);
    expect(rows[0].name).toBe('Grooming');
    expect(rows[1].name).toBe('Vet Care');
  });

  it('prefers slug over uuid ids', () => {
    expect(
      catalogCategorySlug({
        id: '11111111-1111-4111-8111-111111111111',
        category_id: 'walking',
        name: 'Walking',
      }),
    ).toBe('walking');
  });
});

describe('matchCatalogSlug', () => {
  const cats = normalizeCatalogCategories([
    { categoryId: 'grooming', name: 'Grooming' },
    { slug: 'vet-care', name: 'Veterinary' },
  ]);

  it('maps legacy uppercase values onto catalogue slugs', () => {
    expect(matchCatalogSlug('GROOMING', cats)).toBe('grooming');
    expect(matchCatalogSlug('veterinary', cats)).toBe('vet-care');
    expect(labelForCatalogSlug('GROOMING', cats)).toBe('Grooming');
  });
});
