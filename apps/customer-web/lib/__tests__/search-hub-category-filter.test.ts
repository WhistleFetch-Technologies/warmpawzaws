import {
  applyHubCategoryFilter,
  inferHubSlugFromSearchQuery,
} from '../search-hub-category-filter';

/**
 * applyHubCategoryFilter is a pass-through in hub-only browse (no keyword) so
 * GET /search rendering matches GET /customer/discover-services exactly (the
 * backend already filtered identically). In keyword+hub mode the filter still
 * gates free-text matches to the active hub's category aliases / name hints.
 *
 * Regression: see "search shows 1 walker / home shows 2" — Bindushree (role
 * vet_clinic, has a dog-walk service) is included by home via the broad
 * walkerCategoryDiscoveryOr SQL branch; the client must not re-drop her.
 */
describe('applyHubCategoryFilter — hub-only browse (no keyword) is pass-through', () => {
  it('keeps vendors regardless of their primary category column (parity with home)', () => {
    const rows = [
      { type: 'vendor' as const, category: 'walker', name: 'Test Dog walker' },
      // Mirrors Bindushree: vet_clinic role appears in walker hub because she
      // has a walker-style service; SQL EXISTS already qualified her upstream.
      { type: 'vendor' as const, category: 'vet_clinic', name: 'Bindushree M' },
      { type: 'vendor' as const, category: '', name: 'Empty Cat Walker' },
    ];
    const out = applyHubCategoryFilter(rows, 'walker', '');
    expect(out.map((r) => r.name).sort()).toEqual([
      'Bindushree M',
      'Empty Cat Walker',
      'Test Dog walker',
    ]);
  });

  it('keeps grooming and vet vendors in the walker hub when they came from upstream', () => {
    const rows = [
      { type: 'vendor' as const, category: 'grooming', name: 'Groom Plus' },
      { type: 'vendor' as const, category: 'vet', name: 'City Vet' },
    ];
    expect(applyHubCategoryFilter(rows, 'walker', '')).toHaveLength(2);
  });

  it('returns the input unchanged for hub-only browse without filtering anything', () => {
    const rows = [
      { type: 'vendor' as const, category: 'pet_clinic', name: 'A' },
      { type: 'service' as const, category: 'walker', name: 'B' },
      { type: 'service' as const, category: 'grooming', name: 'C' },
    ];
    expect(applyHubCategoryFilter(rows, 'vet', '')).toEqual(rows);
  });
});

describe('applyHubCategoryFilter — keyword + hub mode (free-text)', () => {
  it('drops sibling-hub rows even with a keyword present', () => {
    const rows = [
      { type: 'vendor' as const, category: 'veterinary', name: 'City Vet Center' },
      { type: 'service' as const, category: 'veterinary', name: 'Behaviour Consultation' },
    ];
    expect(applyHubCategoryFilter(rows, 'training', 'train')).toEqual([]);
  });

  it('keeps rows whose category is in the training alias set', () => {
    const rows = [
      { type: 'service' as const, category: 'training', name: 'Obedience' },
      { type: 'service' as const, category: 'behavioral', name: 'Manners' },
    ];
    const out = applyHubCategoryFilter(rows, 'training', 'dog training');
    expect(out).toHaveLength(2);
  });

  it('surfaces legacy vendors with empty category via hint text', () => {
    const rows = [{ type: 'vendor' as const, category: '', name: 'Paws Dog Training' }];
    expect(applyHubCategoryFilter(rows, 'training', 'dog training')).toHaveLength(1);
  });

  it('excludes wrong vertical when category is set on the row', () => {
    const rows = [{ type: 'vendor' as const, category: 'veterinary', name: 'We also train parrots' }];
    expect(applyHubCategoryFilter(rows, 'training', 'train parrots')).toEqual([]);
  });

  it('keyword cannot rescue a walker whose name gives no walk hint and category is wrong vertical', () => {
    const rows = [{ type: 'vendor' as const, category: 'veterinary', name: 'ABC Services' }];
    expect(applyHubCategoryFilter(rows, 'walker', 'dog walker')).toHaveLength(0);
  });
});

describe('inferHubSlugFromSearchQuery', () => {
  it('infers walker from dog walker search text', () => {
    expect(inferHubSlugFromSearchQuery('dog walker')).toBe('walker');
  });
});
