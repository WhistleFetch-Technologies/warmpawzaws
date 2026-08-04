import { filterMarketplaceRowsWhenWapptPresent } from '@/lib/search-wappt-dedup';

describe('filterMarketplaceRowsWhenWapptPresent', () => {
  it('drops marketplace vet rows not in WAPPT when WAPPT vet exists', () => {
    const rows = [
      { id: 'wappt-1', type: 'vendor', category: 'vet', name: 'Bindu Vet Clinic' },
      { id: 'mp-1', type: 'vendor', category: 'general', name: 'Business' },
      { id: 'prod-1', type: 'product', category: 'shop', name: 'Treats' },
    ];
    const wappt = [{ id: 'wappt-1', category: 'vet' }];
    const out = filterMarketplaceRowsWhenWapptPresent(rows, wappt, 'vet', '');
    expect(out.map((r) => r.id)).toEqual(['wappt-1', 'prod-1']);
  });

  it('dedupes grooming hub rows to WAPPT ids', () => {
    const rows = [
      { id: 'g-wappt', type: 'vendor', category: 'grooming', name: 'Bindu Grooming' },
      { id: 'g-mp', type: 'vendor', category: 'groomer_center', name: 'Business' },
    ];
    const wappt = [{ id: 'g-wappt', category: 'grooming' }];
    const out = filterMarketplaceRowsWhenWapptPresent(rows, wappt, 'grooming', '');
    expect(out.map((r) => r.id)).toEqual(['g-wappt']);
  });

  it('passes through when no WAPPT rows', () => {
    const rows = [{ id: 'a', type: 'vendor', category: 'cafe', name: 'Cafe' }];
    expect(filterMarketplaceRowsWhenWapptPresent(rows, [], '', '')).toEqual(rows);
  });
});
