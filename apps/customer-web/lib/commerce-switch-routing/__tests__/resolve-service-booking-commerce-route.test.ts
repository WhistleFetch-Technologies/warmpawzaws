import { clearCommerceSwitchCache } from '@/lib/commerce-switch-client';
import {
  resolveServiceBookingCommerceRoute,
  resolveServiceBookingCommerceRouteForNavigation,
} from '../resolve-service-booking-commerce-route';
import { warmpawzPayRouteAdapter } from '../adapters/warmpawz-pay-route-adapter';
import { marketplaceRouteAdapter } from '../adapters/marketplace-route-adapter';
import { getCommerceRouteAdapter } from '../adapter-registry';

jest.mock('@/lib/commerce-switch-client', () => ({
  getActiveCommerceModel: jest.fn(() => 'marketplace'),
  clearCommerceSwitchCache: jest.fn(),
}));

const { getActiveCommerceModel } = jest.requireMock('@/lib/commerce-switch-client') as {
  getActiveCommerceModel: jest.Mock;
};

describe('resolveServiceBookingCommerceRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCommerceSwitchCache();
    delete process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED;
    getActiveCommerceModel.mockReturnValue('marketplace');
  });

  it('returns marketplace for excluded tele domain', () => {
    const route = resolveServiceBookingCommerceRoute({
      serviceKey: 'vet-tele-consultation',
      serviceStyle: 'tele',
    });
    expect(route.excludedDomain).toBe(true);
    expect(route.useMarketplaceFlow).toBe(true);
    expect(route.effectiveModelId).toBe('marketplace');
  });

  it('returns marketplace for excluded nutrition category', () => {
    const route = resolveServiceBookingCommerceRoute({
      serviceKey: 'nutritionist',
      category: 'pet_nutritionist',
    });
    expect(route.excludedDomain).toBe(true);
    expect(route.useMarketplaceFlow).toBe(true);
  });

  it('uses marketplace when configured model is marketplace', () => {
    getActiveCommerceModel.mockReturnValue('marketplace');
    const route = resolveServiceBookingCommerceRoute({ serviceKey: 'grooming' });
    expect(route.configuredModelId).toBe('marketplace');
    expect(route.useMarketplaceFlow).toBe(true);
  });

  it('prefers activeModelId from context over module cache', () => {
    getActiveCommerceModel.mockReturnValue('marketplace');
    const route = resolveServiceBookingCommerceRoute({
      serviceKey: 'grooming',
      activeModelId: 'warmpawz_pay',
    });
    expect(route.configuredModelId).toBe('warmpawz_pay');
    expect(route.useMarketplaceFlow).toBe(false);
  });

  it('falls back to marketplace when warmpawz_pay is configured but module is disabled', () => {
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED = 'false';
    getActiveCommerceModel.mockReturnValue('warmpawz_pay');
    const route = resolveServiceBookingCommerceRoute({ serviceKey: 'grooming', category: 'grooming' });
    expect(route.configuredModelId).toBe('warmpawz_pay');
    expect(route.effectiveModelId).toBe('marketplace');
    expect(route.useMarketplaceFlow).toBe(true);
    expect(route.fallbackReason).toBe('warmpawz_pay_unavailable');
  });

  it('selects warmpawz_pay when configured and module is capable', () => {
    getActiveCommerceModel.mockReturnValue('warmpawz_pay');
    const route = resolveServiceBookingCommerceRoute({ serviceKey: 'vet', category: 'vet' });
    expect(route.effectiveModelId).toBe('warmpawz_pay');
    expect(route.useMarketplaceFlow).toBe(false);
  });

  it('resolveServiceBookingCommerceRouteForNavigation does not force marketplace fallback', () => {
    getActiveCommerceModel.mockReturnValue('warmpawz_pay');
    const route = resolveServiceBookingCommerceRouteForNavigation({ serviceKey: 'grooming' });
    expect(route.useMarketplaceFlow).toBe(false);
    expect(route.effectiveModelId).toBe('warmpawz_pay');
  });

  it('registers marketplace and warmpawz_pay adapters', () => {
    expect(getCommerceRouteAdapter('marketplace')).toBe(marketplaceRouteAdapter);
    expect(getCommerceRouteAdapter('warmpawz_pay')).toBe(warmpawzPayRouteAdapter);
    expect(warmpawzPayRouteAdapter.isAvailable()).toBe(true);
  });
});
