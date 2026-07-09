jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/customer-location', () => ({
  resolveCustomerLocation: jest.fn(async () => ({ state: 'KA', city: 'Bangalore' })),
}));

import {
  resolveServiceStyleLaunchFromCatalog,
  shouldBlockServiceStyleNavigation,
  serviceStyleLaunchBlockMessage,
  type ServiceLaunchCatalogEntry,
} from '../customer-service-style-launch';

const catalog: ServiceLaunchCatalogEntry[] = [
  {
    serviceId: 'vet',
    effectiveStatus: 'launched',
    supportedStyles: ['tele', 'at_center', 'at_home'],
    effectiveStyles: {
      tele: { effectiveStatus: 'launched', inheritsParent: true },
      at_center: { effectiveStatus: 'launched', inheritsParent: true },
      at_home: { effectiveStatus: 'hidden', inheritsParent: false },
    },
  },
];

describe('resolveServiceStyleLaunchFromCatalog', () => {
  it('inherits parent when style has no entry', () => {
    const r = resolveServiceStyleLaunchFromCatalog(catalog, 'grooming', 'at_home');
    expect(r.status).toBe('hidden');
    expect(r.inheritsParent).toBe(true);
  });

  it('uses style effective status when override exists', () => {
    const r = resolveServiceStyleLaunchFromCatalog(catalog, 'vet', 'at_home');
    expect(r.status).toBe('hidden');
    expect(r.inheritsParent).toBe(false);
  });

  it('inherits parent for launched style without override', () => {
    const r = resolveServiceStyleLaunchFromCatalog(catalog, 'vet', 'tele');
    expect(r.status).toBe('launched');
    expect(r.inheritsParent).toBe(true);
  });
});

describe('shouldBlockServiceStyleNavigation', () => {
  it('blocks hidden and coming_soon only', () => {
    expect(shouldBlockServiceStyleNavigation('hidden')).toBe(true);
    expect(shouldBlockServiceStyleNavigation('coming_soon')).toBe(true);
    expect(shouldBlockServiceStyleNavigation('launched')).toBe(false);
    expect(shouldBlockServiceStyleNavigation('beta')).toBe(false);
  });

  it('returns user-facing block messages', () => {
    expect(serviceStyleLaunchBlockMessage('coming_soon')).toContain('coming soon');
    expect(serviceStyleLaunchBlockMessage('hidden')).toContain('not available');
    expect(serviceStyleLaunchBlockMessage('launched')).toBe('');
  });
});
