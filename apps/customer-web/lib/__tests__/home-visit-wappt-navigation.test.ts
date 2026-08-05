import {
  resolveHomeVisitVendorListNavigation,
  resolveHomeVisitWapptCategory,
} from '../home-visit-wappt-navigation';

jest.mock('@/lib/warmpawz-appointments-customer', () => ({
  isWarmpawzAppointmentsHubEnabled: jest.fn(),
}));

const { isWarmpawzAppointmentsHubEnabled } = jest.requireMock(
  '@/lib/warmpawz-appointments-customer',
) as { isWarmpawzAppointmentsHubEnabled: jest.Mock };

describe('resolveHomeVisitWapptCategory', () => {
  it('maps all home visit hub target screens', () => {
    expect(resolveHomeVisitWapptCategory('vet-home-visit')).toBe('vet');
    expect(resolveHomeVisitWapptCategory('grooming_home')).toBe('grooming');
    expect(resolveHomeVisitWapptCategory('training_home')).toBe('training');
    expect(resolveHomeVisitWapptCategory('walker')).toBe('walker');
    expect(resolveHomeVisitWapptCategory('pet-sitter')).toBe('sitting');
  });

  it('returns null for unknown screens', () => {
    expect(resolveHomeVisitWapptCategory('vet-clinic-list')).toBeNull();
  });
});

describe('resolveHomeVisitVendorListNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isWarmpawzAppointmentsHubEnabled.mockReturnValue(true);
  });

  const fromHomeVisit = { fromHomeVisitLanding: true };

  it.each([
    ['vet-home-visit', 'vet'],
    ['grooming_home', 'grooming'],
    ['training_home', 'training'],
    ['walker', 'walker'],
    ['pet-sitter', 'sitting'],
  ] as const)('routes %s to WAPPT at_home for category %s', (screen, category) => {
    const nav = resolveHomeVisitVendorListNavigation(screen, fromHomeVisit);
    expect(nav).toEqual({
      screen: 'wappt-discovery',
      category,
      serviceStyle: 'at_home',
      lockStyleFilter: true,
      profileBackScreen: 'home-service-selection',
    });
  });

  it('returns null without fromHomeVisitLanding flag', () => {
    expect(resolveHomeVisitVendorListNavigation('vet-home-visit', {})).toBeNull();
    expect(resolveHomeVisitVendorListNavigation('vet-home-visit')).toBeNull();
  });

  it('returns null when WAPPT hub is disabled for category', () => {
    isWarmpawzAppointmentsHubEnabled.mockReturnValue(false);
    expect(resolveHomeVisitVendorListNavigation('vet-home-visit', fromHomeVisit)).toBeNull();
  });

  it('returns null for unmapped target screens', () => {
    expect(resolveHomeVisitVendorListNavigation('nutritionist', fromHomeVisit)).toBeNull();
  });
});
