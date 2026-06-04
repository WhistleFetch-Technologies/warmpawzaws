import { resolveSearchCategoriesFromRows } from '../resolver';
import type { SearchTaxonomyKeywordRow } from '../types';

function row(partial: Partial<SearchTaxonomyKeywordRow> & Pick<SearchTaxonomyKeywordRow, 'keyword_normalized' | 'hub_slug'>): SearchTaxonomyKeywordRow {
  return {
    id: '1',
    category_slug: partial.category_slug ?? 'veterinary_healthcare',
    category_display_name: partial.category_display_name ?? 'Veterinary & Healthcare',
    subcategory: partial.subcategory ?? null,
    keyword: partial.keyword ?? partial.keyword_normalized,
    keyword_normalized: partial.keyword_normalized,
    hub_slug: partial.hub_slug,
    weight: partial.weight ?? 100,
    is_active: partial.is_active ?? true,
  };
}

const FIXTURE: SearchTaxonomyKeywordRow[] = [
  row({ keyword_normalized: 'dog doctor', hub_slug: 'vet', category_slug: 'veterinary_healthcare', category_display_name: 'Veterinary & Healthcare' }),
  row({ keyword_normalized: 'pet hostel', hub_slug: 'boarding', category_slug: 'boarding_daycare', category_display_name: 'Boarding & Daycare', subcategory: 'Pet Boarding' }),
  row({ keyword_normalized: 'dog grooming', hub_slug: 'grooming', category_slug: 'grooming', category_display_name: 'Grooming' }),
];

describe('resolveSearchCategoriesFromRows', () => {
  it('returns vet for dog doctor', () => {
    const { categories } = resolveSearchCategoriesFromRows('dog doctor', FIXTURE);
    expect(categories.length).toBeGreaterThanOrEqual(1);
    expect(categories[0].hubSlug).toBe('vet');
    expect(categories[0].displayName).toBe('Veterinary & Healthcare');
    expect(categories[0].categorySlug).toBe('veterinary_healthcare');
  });

  it('returns boarding for pet hostel', () => {
    const { categories } = resolveSearchCategoriesFromRows('pet hostel', FIXTURE);
    expect(categories[0]?.hubSlug).toBe('boarding');
    expect(categories[0]?.subcategory).toBe('Pet Boarding');
  });

  it('returns grooming for dog grooming', () => {
    const { categories } = resolveSearchCategoriesFromRows('dog grooming', FIXTURE);
    expect(categories[0]?.hubSlug).toBe('grooming');
  });

  it('returns empty for blank query', () => {
    expect(resolveSearchCategoriesFromRows('  ', FIXTURE).categories).toEqual([]);
  });
});
