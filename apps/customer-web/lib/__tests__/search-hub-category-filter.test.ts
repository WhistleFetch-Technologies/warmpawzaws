import { applyHubCategoryFilter } from '../search-hub-category-filter';

/**
 * NOTE: applyHubCategoryFilter is called ONLY for keyword+hub mode (q non-empty).
 * For hub-only browse (q empty) the backend already filtered; page.tsx skips the
 * client re-filter and only runs dedup. Tests below reflect keyword+hub behaviour.
 */
describe('applyHubCategoryFilter', () => {
  it('hub-only browse excludes veterinary vendors/services even when names imply behaviour/training', () => {
    const rows = [
      { type: 'vendor' as const, category: 'veterinary', name: 'City Vet Center' },
      { type: 'service' as const, category: 'veterinary', name: 'Behaviour Consultation' },
    ];
    expect(applyHubCategoryFilter(rows, 'training', '')).toEqual([]);
  });

  it('hub-only browse keeps rows whose category is in the training alias set', () => {
    const rows = [
      { type: 'service' as const, category: 'training', name: 'Obedience' },
      { type: 'service' as const, category: 'behavioral', name: 'Manners' },
    ];
    const out = applyHubCategoryFilter(rows, 'training', '');
    expect(out).toHaveLength(2);
  });

  it('keyword mode can still surface legacy vendors with empty category via hint text', () => {
    const rows = [{ type: 'vendor' as const, category: '', name: 'Paws Dog Training' }];
    expect(applyHubCategoryFilter(rows, 'training', 'dog training')).toHaveLength(1);
  });

  it('keyword mode excludes wrong vertical when category is set on the row', () => {
    const rows = [{ type: 'vendor' as const, category: 'veterinary', name: 'We also train parrots' }];
    expect(applyHubCategoryFilter(rows, 'training', 'train parrots')).toEqual([]);
  });

  it('hub-only browse excludes rows with empty category (client cannot infer hub)', () => {
    expect(
      applyHubCategoryFilter([{ type: 'vendor' as const, category: '', name: 'Mystery Vendor' }], 'nutritionist', '')
    ).toHaveLength(0);
  });

  it('hub-only browse keeps vendor when listing category is role slug from API', () => {
    expect(
      applyHubCategoryFilter(
        [{ type: 'vendor' as const, category: 'nutritionist_center', name: 'Test Center' }],
        'nutritionist',
        ''
      )
    ).toHaveLength(1);
  });

  it('hub-only browse accepts catalog wellness vertical for nutritionist chip', () => {
    const rows = [{ type: 'vendor' as const, category: 'wellness', name: 'Holistic Pet Nutrition' }];
    expect(applyHubCategoryFilter(rows, 'nutritionist', '')).toHaveLength(1);
  });
});
