jest.mock('@/lib/commerce-switch-client', () => ({
  isWarmpawzPay: jest.fn(() => false),
}));

import { isWarmpawzPay } from '@/lib/commerce-switch-client';
import {
  filterMarketplaceHubTiles,
  isWarmpawzAppointmentsHubEnabled,
} from '../warmpawz-appointments-customer';

jest.mock('@/lib/commerce-switch-routing', () => ({
  resolveServiceBookingCommerceRouteForNavigation: jest.fn(),
}));

jest.mock('@/lib/commerce-switch-routing/warmpawz-pay-feature', () => ({
  isWarmpawzPayModuleCapable: jest.fn(() => true),
}));

const { resolveServiceBookingCommerceRouteForNavigation } = jest.requireMock(
  '@/lib/commerce-switch-routing',
) as {
  resolveServiceBookingCommerceRouteForNavigation: jest.Mock;
};

describe('isWarmpawzAppointmentsHubEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows nutrition WAPPT hub when Pay is active despite excluded commerce domain', () => {
    resolveServiceBookingCommerceRouteForNavigation.mockReturnValue({
      excludedDomain: true,
      useMarketplaceFlow: false,
    });
    expect(isWarmpawzAppointmentsHubEnabled('nutrition')).toBe(true);
    expect(isWarmpawzAppointmentsHubEnabled('pet_nutritionist')).toBe(true);
  });

  it('blocks unknown categories on excluded domains', () => {
    resolveServiceBookingCommerceRouteForNavigation.mockReturnValue({
      excludedDomain: true,
      useMarketplaceFlow: false,
    });
    expect(isWarmpawzAppointmentsHubEnabled('tele_only_service')).toBe(false);
  });
});

describe('filterMarketplaceHubTiles', () => {
  const vetTiles = [
    { id: 'tele' },
    { id: 'clinic' },
    { id: 'home' },
    { id: 'lab' },
    { id: 'medicine' },
    { id: 'physiotherapy' },
  ];
  const groomingTiles = [
    { id: 'grooming_center' },
    { id: 'grooming_home' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps only tele in Pay mode — same for guest and logged-in', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(true);
    expect(filterMarketplaceHubTiles(vetTiles, { keepIds: ['tele'] }).map((t) => t.id)).toEqual([
      'tele',
    ]);
  });

  it('hides grooming centre/home in Pay mode — same for guest and logged-in', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(true);
    expect(filterMarketplaceHubTiles(groomingTiles)).toEqual([]);
  });

  it('leaves marketplace tiles visible when Pay is off', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(false);
    expect(filterMarketplaceHubTiles(vetTiles, { keepIds: ['tele'] }).map((t) => t.id)).toEqual(
      vetTiles.map((t) => t.id),
    );
    expect(filterMarketplaceHubTiles(groomingTiles).map((t) => t.id)).toEqual([
      'grooming_center',
      'grooming_home',
    ]);
  });
});
