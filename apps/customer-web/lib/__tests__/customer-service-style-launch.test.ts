jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/customer-location', () => ({
  resolveCustomerLocation: jest.fn(async () => ({ state: 'KA', city: 'Bangalore' })),
}));

import {
  resolveServiceStyleLaunchFromCatalog,
  shouldBlockServiceStyleNavigation,
  serviceStyleLaunchBlockMessage,
  isStyleLaunchedForCustomer,
  hasAnyLaunchedStyle,
  filterEntriesByStyleLaunch,
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
  {
    serviceId: 'nutritionist',
    effectiveStatus: 'launched',
    supportedStyles: ['tele', 'at_home'],
    effectiveStyles: {
      tele: { effectiveStatus: 'launched', inheritsParent: true },
      at_home: { effectiveStatus: 'hidden', inheritsParent: false },
    },
  },
  {
    serviceId: 'training',
    effectiveStatus: 'launched',
    supportedStyles: ['at_center', 'at_home', 'tele'],
    effectiveStyles: {
      tele: { effectiveStatus: 'launched', inheritsParent: true },
      at_center: { effectiveStatus: 'launched', inheritsParent: true },
      at_home: { effectiveStatus: 'launched', inheritsParent: true },
    },
  },
  {
    serviceId: 'pet-sitter',
    effectiveStatus: 'launched',
    supportedStyles: ['at_home'],
    effectiveStyles: {
      at_home: { effectiveStatus: 'launched', inheritsParent: true },
    },
  },
];

describe('resolveServiceStyleLaunchFromCatalog', () => {
  it('does not hide tiles when service is missing from catalog', () => {
    const r = resolveServiceStyleLaunchFromCatalog(catalog, 'grooming', 'at_home');
    expect(r.status).toBe('launched');
    expect(r.inheritsParent).toBe(true);
  });

  it('does not hide tiles when catalog is empty', () => {
    const r = resolveServiceStyleLaunchFromCatalog([], 'vet', 'at_home');
    expect(r.status).toBe('launched');
  });

  it('inherits parent when style has no entry on a known service', () => {
    const r = resolveServiceStyleLaunchFromCatalog(catalog, 'vet', 'unknown_style');
    expect(r.status).toBe('launched');
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

  it('maps category alias nutrition → nutritionist for launch lookup', () => {
    const r = resolveServiceStyleLaunchFromCatalog(catalog, 'nutrition', 'tele');
    expect(r.status).toBe('launched');
    expect(shouldBlockServiceStyleNavigation(r.status)).toBe(false);
  });

  it('maps behaviourist/behaviorist → training for launch lookup', () => {
    expect(resolveServiceStyleLaunchFromCatalog(catalog, 'behaviourist', 'tele').status).toBe(
      'launched'
    );
    expect(resolveServiceStyleLaunchFromCatalog(catalog, 'behaviorist', 'tele').status).toBe(
      'launched'
    );
  });

  it('maps sitting → pet-sitter for launch lookup', () => {
    const r = resolveServiceStyleLaunchFromCatalog(catalog, 'sitting', 'at_home');
    expect(r.status).toBe('launched');
  });

  it('keeps canonical ids working (nutritionist, vet)', () => {
    expect(resolveServiceStyleLaunchFromCatalog(catalog, 'nutritionist', 'tele').status).toBe(
      'launched'
    );
    expect(resolveServiceStyleLaunchFromCatalog(catalog, 'vet', 'tele').status).toBe('launched');
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

describe('isStyleLaunchedForCustomer', () => {
  it('returns true for launched/beta styles only', () => {
    expect(isStyleLaunchedForCustomer(catalog, 'vet', 'tele')).toBe(true);
    expect(isStyleLaunchedForCustomer(catalog, 'vet', 'at_home')).toBe(false);
  });
});

describe('hasAnyLaunchedStyle', () => {
  it('keeps parent when tele is launched even if clinic/home hidden', () => {
    expect(hasAnyLaunchedStyle(catalog, 'vet')).toBe(true);
  });

  it('returns false when all styles hidden', () => {
    const hiddenOnly: ServiceLaunchCatalogEntry[] = [
      {
        serviceId: 'training',
        effectiveStatus: 'hidden',
        supportedStyles: ['at_center'],
        effectiveStyles: {
          at_center: { effectiveStatus: 'hidden', inheritsParent: false },
        },
      },
    ];
    expect(hasAnyLaunchedStyle(hiddenOnly, 'training')).toBe(false);
  });
});

describe('filterEntriesByStyleLaunch', () => {
  it('drops popular catalog rows for hidden styles', () => {
    const geoCatalog: ServiceLaunchCatalogEntry[] = [
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
    ];
    const entries = [
      { discoverCategory: 'vet', serviceStyle: 'tele' },
      { discoverCategory: 'vet', serviceStyle: 'at_center' },
    ];
    const filtered = filterEntriesByStyleLaunch(geoCatalog, entries);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].serviceStyle).toBe('tele');
  });
});
