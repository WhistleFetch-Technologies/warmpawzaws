import {
  resolveServiceCatalogCategoryDisplay,
  resolveServiceCatalogCategoryDisplayWithRoleFallback,
} from '../service-catalog-sync';

describe('resolveServiceCatalogCategoryDisplay', () => {
  it('maps veterinary category_id when category_name is blank (admin list bug)', () => {
    expect(
      resolveServiceCatalogCategoryDisplay({
        category_id: 'veterinary',
        category_name: null,
      })
    ).toEqual({
      category_id: 'veterinary',
      category_name: 'Veterinary Services',
    });
  });

  it('does not invent General when both name and id are missing', () => {
    expect(resolveServiceCatalogCategoryDisplay({})).toEqual({
      category_id: '',
      category_name: '',
    });
  });

  it('prefers real category_id over misleading General category_name', () => {
    expect(
      resolveServiceCatalogCategoryDisplay({
        category_id: 'veterinary',
        category_name: 'General',
      })
    ).toEqual({
      category_id: 'veterinary',
      category_name: 'Veterinary Services',
    });
  });
});

describe('resolveServiceCatalogCategoryDisplayWithRoleFallback', () => {
  it('uses role fallback only when service has no category fields', () => {
    expect(
      resolveServiceCatalogCategoryDisplayWithRoleFallback(
        { category_id: null, category_name: null },
        { categoryId: 'veterinary', categoryName: 'Veterinary Services' }
      )
    ).toEqual({
      category_id: 'veterinary',
      category_name: 'Veterinary Services',
    });
  });
});
