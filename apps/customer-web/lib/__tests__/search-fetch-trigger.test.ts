import { buildSearchFetchTrigger } from '@/lib/search-fetch-trigger';
import { applyHubCategoryFilter } from '@/lib/search-hub-category-filter';

describe('search page fetch trigger', () => {
  it('uses browse mode for empty query + All category', () => {
    expect(buildSearchFetchTrigger('', '', null, 0)).toEqual({ kind: 'browse', n: 0 });
  });

  it('uses keyword mode when query exists', () => {
    expect(buildSearchFetchTrigger('vet', '', null, 2)).toEqual({ kind: 'keyword', q: 'vet', n: 2 });
  });

  it('uses hub mode when category exists without query', () => {
    expect(buildSearchFetchTrigger('', 'walker', null, 4)).toEqual({ kind: 'hub', c: 'walker', n: 4 });
  });
});

describe('search hub chip filtering', () => {
  const results = [
    { type: 'service', category: 'dog_walking', name: 'Dog Walking' },
    { type: 'service', category: 'pet_daycare', name: 'Daycare' },
    { type: 'service', category: 'pet_clinic', name: 'Clinic' },
    { type: 'service', category: 'grooming', name: 'Spa Bath' },
  ];

  it('keeps all results when All chip is selected', () => {
    expect(applyHubCategoryFilter(results, '', '')).toHaveLength(4);
  });

  it('applies alias-aware filtering for walker', () => {
    const filtered = applyHubCategoryFilter(results, 'walker', '');
    expect(filtered).toEqual([results[0]]);
  });

  it('applies alias-aware filtering for vet and boarding', () => {
    expect(applyHubCategoryFilter(results, 'vet', '')).toEqual([results[2]]);
    expect(applyHubCategoryFilter(results, 'boarding', '')).toEqual([results[1]]);
  });
});
