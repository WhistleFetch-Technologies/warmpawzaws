import { rowMatchesService, serviceLabelForRow } from '../promo-engine/list-service';
import { filterPromoEngineRows } from '../promo-engine/draft';
import type { CatalogServiceCategory } from '../promo-engine/catalog-categories';
import type { PromoEngineListItem } from '../promo-engine/types';

const PET_SHOP = 'f363b0b4-448b-4286-b308-fabf95fbad6f';
const VET = '63d34efd-76b0-4e2e-8aa0-4465ddef6620';

const categories: CatalogServiceCategory[] = [
  { id: VET, slug: 'vet', name: 'Vet Care' },
  { id: PET_SHOP, slug: 'shop', name: 'Pet Shop', isEcommerce: true },
];

function row(overrides: Partial<PromoEngineListItem>): PromoEngineListItem {
  return {
    id: 'p1',
    name: 'Promo',
    code: '',
    status: 'ACTIVE',
    serviceCategories: [],
    ruleType: 'CUSTOMER_JOURNEY',
    fundingType: 'WARMPAWZ',
    usageCount: 0,
    startAt: '',
    endAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('serviceLabelForRow', () => {
  it('keeps legacy service_categories labels', () => {
    expect(serviceLabelForRow(row({ serviceCategories: ['vet'] }), categories)).toBe('Vet Care');
  });

  it('shows published categories and restricted channels for C', () => {
    const r = row({
      publishScope: { letter: 'C', ids: [PET_SHOP], names: ['Pet Shop'], channels: ['ecommerce'] },
    });
    expect(serviceLabelForRow(r, categories)).toBe('Pet Shop · Ecommerce');
  });

  it('prefers live catalogue names over the saved name', () => {
    const r = row({
      publishScope: { letter: 'C', ids: [VET, PET_SHOP], names: ['Old vet', 'Old shop'], channels: [] },
    });
    expect(serviceLabelForRow(r, categories)).toBe('Vet Care, Pet Shop');
  });

  it('shows vendors for V and all services for F', () => {
    expect(
      serviceLabelForRow(
        row({ publishScope: { letter: 'V', ids: ['v1', 'v2'], names: ['15 furries', 'v2'], channels: [] } }),
        categories,
      ),
    ).toBe('Vendor: 15 furries, v2');
    expect(
      serviceLabelForRow(row({ publishScope: { letter: 'F', ids: [], names: [], channels: [] } }), categories),
    ).toBe('All services');
  });

  it('returns empty when nothing is known', () => {
    expect(serviceLabelForRow(row({}), categories)).toBe('');
  });
});

describe('rowMatchesService', () => {
  const shopPromo = row({
    id: 'shop',
    publishScope: { letter: 'C', ids: [PET_SHOP], names: ['Pet Shop'], channels: ['ecommerce'] },
  });
  const vendorPromo = row({
    id: 'vendor',
    publishScope: { letter: 'V', ids: ['v1'], names: ['15 furries'], channels: [] },
  });
  const legacyVet = row({ id: 'legacy', serviceCategories: ['vet'], publishScope: null });

  it('matches C-published categories by catalogue slug', () => {
    expect(rowMatchesService(shopPromo, 'shop', categories)).toBe(true);
    expect(rowMatchesService(shopPromo, 'vet', categories)).toBe(false);
  });

  it('never matches V/F publish scopes to a category', () => {
    expect(rowMatchesService(vendorPromo, 'shop', categories)).toBe(false);
  });

  it('filters list rows by legacy and published categories', () => {
    const f = { query: '', status: 'all', service: 'shop', type: 'all' };
    expect(
      filterPromoEngineRows([shopPromo, vendorPromo, legacyVet], f, categories).map((r) => r.id),
    ).toEqual(['shop']);
    expect(
      filterPromoEngineRows([shopPromo, vendorPromo, legacyVet], { ...f, service: 'vet' }, categories).map(
        (r) => r.id,
      ),
    ).toEqual(['legacy']);
  });
});
