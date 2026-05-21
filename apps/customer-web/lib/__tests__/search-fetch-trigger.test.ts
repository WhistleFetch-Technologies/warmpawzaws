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

  // Hub-only browse (no keyword) is now pass-through: the backend already
  // returned exactly the set discover-services returns for the same chip, so
  // the client must NOT re-filter or it will diverge from home.
  it('hub-only browse returns the API rows unchanged for parity with home', () => {
    expect(applyHubCategoryFilter(results, 'walker', '')).toEqual(results);
    expect(applyHubCategoryFilter(results, 'vet', '')).toEqual(results);
    expect(applyHubCategoryFilter(results, 'boarding', '')).toEqual(results);
  });

  // Keyword + hub still applies alias-aware filtering.
  it('keyword + hub applies alias-aware filtering for walker', () => {
    const filtered = applyHubCategoryFilter(results, 'walker', 'dog walk');
    expect(filtered).toEqual([results[0]]);
  });

  it('keyword + hub applies alias-aware filtering for vet and boarding', () => {
    expect(applyHubCategoryFilter(results, 'vet', 'pet clinic')).toEqual([results[2]]);
    expect(applyHubCategoryFilter(results, 'boarding', 'pet daycare')).toEqual([results[1]]);
  });
});
