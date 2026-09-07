/** @jest-environment jsdom */

jest.mock('@/lib/commerce-switch-routing/resolve-service-booking-commerce-route', () => ({
  resolveServiceBookingCommerceRouteForNavigation: jest.fn(),
}));

import { resolveServiceBookingCommerceRouteForNavigation } from '@/lib/commerce-switch-routing/resolve-service-booking-commerce-route';
import { launchWarmpawzPayServiceBooking } from '../commerce-switch-routing/launch-warmpawz-pay-service-booking';

describe('launchWarmpawzPayServiceBooking', () => {
  const push = jest.fn();
  const router = { push } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not navigate when marketplace flow is active', () => {
    (resolveServiceBookingCommerceRouteForNavigation as jest.Mock).mockReturnValue({
      useMarketplaceFlow: true,
      effectiveModelId: 'marketplace',
    });

    launchWarmpawzPayServiceBooking({
      router,
      serviceKey: 'vet',
      category: 'vet',
      vendorId: 'v-1',
    });

    expect(push).not.toHaveBeenCalled();
  });

  it('navigates to vendor pay page when warmpawz_pay is active', () => {
    (resolveServiceBookingCommerceRouteForNavigation as jest.Mock).mockReturnValue({
      useMarketplaceFlow: false,
      effectiveModelId: 'warmpawz_pay',
    });

    launchWarmpawzPayServiceBooking({
      router,
      serviceKey: 'vet',
      category: 'vet',
      vendorId: 'v-1',
    });

    expect(push).toHaveBeenCalledWith('/warmpawz-pay/vendors/placeholder?vendorId=v-1');
  });

  it('remembers the service screen before opening Pay so Back can restore it', () => {
    (resolveServiceBookingCommerceRouteForNavigation as jest.Mock).mockReturnValue({
      useMarketplaceFlow: false,
      effectiveModelId: 'warmpawz_pay',
    });
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', search: '', href: 'http://localhost/' },
      writable: true,
      configurable: true,
    });

    launchWarmpawzPayServiceBooking({
      router,
      serviceKey: 'vet',
      category: 'vet',
      vendorId: 'v-1',
    });

    expect(sessionStorage.getItem('warmpawz_wpay_back_intent')).toBe(
      JSON.stringify({ kind: 'spa', screen: 'vet' }),
    );
  });
});
