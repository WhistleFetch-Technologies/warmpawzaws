import { resolveSearchCategoriesFromRows } from '../resolver';
import { getBuiltinTaxonomyRows } from '../builtin-keywords';

describe('Phase 2 taxonomy hub resolution (builtin fallback)', () => {
  const rows = getBuiltinTaxonomyRows();

  it('resolves dog doctor to vet hub', () => {
    const { categories } = resolveSearchCategoriesFromRows('dog doctor', rows);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].hubSlug).toBe('vet');
  });

  it('resolves vet near me to vet hub', () => {
    const { categories } = resolveSearchCategoriesFromRows('vet near me', rows);
    expect(categories[0]?.hubSlug).toBe('vet');
  });

  it('resolves dog grooming to grooming hub', () => {
    const { categories } = resolveSearchCategoriesFromRows('dog grooming', rows);
    expect(categories[0]?.hubSlug).toBe('grooming');
  });

  it('resolves pet nutritionist to nutritionist hub', () => {
    const { categories } = resolveSearchCategoriesFromRows('pet nutritionist', rows);
    expect(categories[0]?.hubSlug).toBe('nutritionist');
  });
});
