/** @jest-environment jsdom */

import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { BottomNavigation } from '../BottomNavigation';

const mockUseCommerceConfigOptional = jest.fn();

jest.mock('@/lib/commerce-config-provider', () => ({
  useCommerceConfigOptional: () => mockUseCommerceConfigOptional(),
}));

jest.mock('@/lib/customer-ecommerce-flag', () => ({
  isCustomerEcommerceEnabled: () => true,
}));

jest.mock('@/lib/app-review-demo-account', () => ({
  isAppReviewDemoAccount: () => false,
  readStoredCustomerPhone: () => '',
}));

jest.mock('@/lib/profile-menu-open-context', () => ({
  useProfileMenuOpen: () => false,
}));

jest.mock('@/lib/commerce-switch-routing/warmpawz-pay-feature', () => ({
  isWarmpawzPayModuleCapable: () => true,
}));

function renderBottomNav(commerce: {
  isLoaded: boolean;
  isWarmpawzPay: boolean;
  isMarketplace: boolean;
  activeModelId: 'marketplace' | 'warmpawz_pay';
  config: object;
  isDegraded: boolean;
  refresh: () => Promise<void>;
}) {
  mockUseCommerceConfigOptional.mockReturnValue(commerce);
  return render(
    createElement(BottomNavigation, {
      currentScreen: 'home',
      onNavigate: jest.fn(),
    }),
  );
}

describe('BottomNavigation commerce switch', () => {
  beforeEach(() => {
    mockUseCommerceConfigOptional.mockReset();
    process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED = 'true';
  });

  it('shows paw Pay Bill FAB when commerce is warmpawz_pay', () => {
    renderBottomNav({
      isLoaded: true,
      isWarmpawzPay: true,
      isMarketplace: false,
      activeModelId: 'warmpawz_pay',
      config: {},
      isDegraded: false,
      refresh: async () => undefined,
    });

    expect(screen.getByRole('button', { name: 'Pay Bill' })).toBeTruthy();
  });

  it('hides paw Pay Bill FAB when commerce is marketplace', () => {
    renderBottomNav({
      isLoaded: true,
      isWarmpawzPay: false,
      isMarketplace: true,
      activeModelId: 'marketplace',
      config: {},
      isDegraded: false,
      refresh: async () => undefined,
    });

    expect(screen.queryByRole('button', { name: 'Pay Bill' })).toBeNull();
    expect(screen.getByTestId('customer-tabbar-marketplace')).toBeTruthy();
    expect(screen.queryByTestId('customer-tabbar-wpay')).toBeNull();
  });

  it('uses 5-column tabbar when warmpawz_pay is active', () => {
    renderBottomNav({
      isLoaded: true,
      isWarmpawzPay: true,
      isMarketplace: false,
      activeModelId: 'warmpawz_pay',
      config: {},
      isDegraded: false,
      refresh: async () => undefined,
    });

    expect(screen.getByTestId('customer-tabbar-wpay')).toBeTruthy();
  });

  it('updates paw FAB when commerce context changes on rerender', () => {
    mockUseCommerceConfigOptional.mockReturnValue({
      isLoaded: true,
      isWarmpawzPay: false,
      isMarketplace: true,
      activeModelId: 'marketplace',
      config: {},
      isDegraded: false,
      refresh: async () => undefined,
    });

    const view = render(
      createElement(BottomNavigation, {
        currentScreen: 'home',
        onNavigate: jest.fn(),
      }),
    );

    expect(screen.queryByRole('button', { name: 'Pay Bill' })).toBeNull();

    mockUseCommerceConfigOptional.mockReturnValue({
      isLoaded: true,
      isWarmpawzPay: true,
      isMarketplace: false,
      activeModelId: 'warmpawz_pay',
      config: {},
      isDegraded: false,
      refresh: async () => undefined,
    });

    view.rerender(
      createElement(BottomNavigation, {
        currentScreen: 'home',
        onNavigate: jest.fn(),
      }),
    );

    expect(screen.getByRole('button', { name: 'Pay Bill' })).toBeTruthy();
  });
});
