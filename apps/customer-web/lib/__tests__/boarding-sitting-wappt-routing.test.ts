import { isWapptHubCategoryEnabled } from '@/lib/warmpawz-appointments-customer';

jest.mock('@/lib/commerce-switch-routing', () => ({
  resolveServiceBookingCommerceRouteForNavigation: jest.fn(() => ({
    configuredModelId: 'warmpawz_pay',
    effectiveModelId: 'warmpawz_pay',
    useMarketplaceFlow: false,
    excludedDomain: false,
  })),
}));

jest.mock('@/lib/commerce-switch-routing/warmpawz-pay-feature', () => ({
  isWarmpawzPayModuleCapable: jest.fn(() => true),
}));

describe('boarding-sitting-wappt-routing', () => {
  it('enables WAPPT for boarding when Pay route is active', () => {
    expect(isWapptHubCategoryEnabled('boarding')).toBe(true);
  });

  it('enables WAPPT for sitting when Pay route is active', () => {
    expect(isWapptHubCategoryEnabled('sitting')).toBe(true);
  });

  it('disables WAPPT when marketplace flow is forced', () => {
    const { resolveServiceBookingCommerceRouteForNavigation } = jest.requireMock(
      '@/lib/commerce-switch-routing',
    ) as {
      resolveServiceBookingCommerceRouteForNavigation: jest.Mock;
    };
    resolveServiceBookingCommerceRouteForNavigation.mockReturnValueOnce({
      configuredModelId: 'marketplace',
      effectiveModelId: 'marketplace',
      useMarketplaceFlow: true,
      excludedDomain: false,
    });
    expect(isWapptHubCategoryEnabled('boarding')).toBe(false);
  });
});
