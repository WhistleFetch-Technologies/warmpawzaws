import { isWarmpawzAppointmentsHubEnabled } from '../warmpawz-appointments-customer';

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
