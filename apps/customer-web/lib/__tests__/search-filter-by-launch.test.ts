jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/customer-location', () => ({
  resolveCustomerLocation: jest.fn(async () => ({ state: 'MH', city: 'Pune' })),
}));

import {
  isSearchRowLaunchedForCustomer,
  filterSearchRowsByLaunch,
} from '../search-filter-by-launch';
import type { ServiceLaunchCatalogEntry } from '../customer-service-style-launch';

const catalog: ServiceLaunchCatalogEntry[] = [
  {
    serviceId: 'vet',
    effectiveStatus: 'launched',
    supportedStyles: ['tele', 'at_center', 'at_home'],
    effectiveStyles: {
      tele: { effectiveStatus: 'launched', inheritsParent: true },
      at_center: { effectiveStatus: 'hidden', inheritsParent: false },
      at_home: { effectiveStatus: 'hidden', inheritsParent: false },
    },
  },
  {
    serviceId: 'grooming',
    effectiveStatus: 'launched',
    supportedStyles: ['at_center', 'at_home'],
    effectiveStyles: {
      at_center: { effectiveStatus: 'hidden', inheritsParent: false },
      at_home: { effectiveStatus: 'launched', inheritsParent: true },
    },
  },
];

describe('isSearchRowLaunchedForCustomer', () => {
  it('keeps tele vet rows outside launch cities', () => {
    expect(
      isSearchRowLaunchedForCustomer(catalog, {
        category: 'vet',
        serviceStyle: 'tele',
      })
    ).toBe(true);
  });

  it('drops clinic vet rows when at_center hidden', () => {
    expect(
      isSearchRowLaunchedForCustomer(catalog, {
        category: 'veterinary',
        serviceStyle: 'at_center',
      })
    ).toBe(false);
  });

  it('keeps hub rows when any style is launched and serviceStyle omitted', () => {
    expect(
      isSearchRowLaunchedForCustomer(catalog, {
        category: 'grooming',
      })
    ).toBe(true);
  });

  it('allows symptom rows when any allowed style is launched', () => {
    expect(
      isSearchRowLaunchedForCustomer(catalog, {
        type: 'symptom',
        category: 'vet',
        data: {
          allowedServiceStyles: ['tele', 'at_center'],
        },
      })
    ).toBe(true);
  });
});

describe('filterSearchRowsByLaunch', () => {
  it('filters mixed search rows', () => {
    const rows = [
      { id: '1', category: 'vet', serviceStyle: 'tele' },
      { id: '2', category: 'vet', serviceStyle: 'at_center' },
      { id: '3', category: 'shop' },
    ];
    const filtered = filterSearchRowsByLaunch(catalog, rows);
    expect(filtered.map((r) => r.id)).toEqual(['1', '3']);
  });
});
