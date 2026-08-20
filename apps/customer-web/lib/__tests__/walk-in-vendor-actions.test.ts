import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  bookWalkInAppointment,
  payWalkInBill,
  persistWalkInShellNav,
  WALK_IN_PENDING_SHELL_NAV_KEY,
} from '@/lib/walk-in-vendor-actions';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import { WAPPT_VENDOR_PROFILE_SCREEN } from '@/lib/warmpawz-appointments-customer';
import { WALK_IN_VENDORS_PATH } from '@/lib/walk-in-constants';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';

jest.mock('@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking', () => ({
  launchWarmpawzPayServiceBooking: jest.fn(),
}));

jest.mock('@/lib/commerce-switch-routing/should-use-wappt-vendor-card-ui', () => ({
  shouldUseWapptPayVendorCardUi: jest.fn(() => true),
  shouldUseWapptDiscoveryFeed: jest.fn(() => true),
}));

jest.mock('@/lib/search-booking-launch', () => ({
  buildSearchVendorDetailsUrl: jest.fn(
    (vendorId: string) => `/vendor/${vendorId}?intent=profile`
  ),
}));

function makeProvider(overrides: Partial<WalkInProvider> = {}): WalkInProvider {
  return {
    id: 'vendor-bindu-groom',
    displayName: 'Bindu Grooming Service',
    subtitle: 'Grooming Centre',
    photoUrl: null,
    rating: 4.5,
    reviewCount: 10,
    distanceKm: 6.5,
    experienceYears: null,
    fromPrice: null,
    priceLabel: 'starts at',
    category: 'grooming',
    ...overrides,
  };
}

function makeRouter(): AppRouterInstance {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  } as unknown as AppRouterInstance;
}

describe('bookWalkInAppointment', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('home path: opens wappt-vendor-profile via onNavigate (not booking screens)', () => {
    const onNavigate = jest.fn();
    const router = makeRouter();
    const provider = makeProvider({ category: 'grooming' });

    bookWalkInAppointment(provider, router, onNavigate);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(
      WAPPT_VENDOR_PROFILE_SCREEN,
      expect.objectContaining({
        vendorId: 'vendor-bindu-groom',
        vendorName: 'Bindu Grooming Service',
        category: 'grooming',
        serviceStyle: 'at_center',
        profileBackScreen: 'home',
      })
    );
    expect(onNavigate.mock.calls[0][0]).not.toBe('grooming-booking');
    expect(onNavigate.mock.calls[0][0]).not.toBe('vet-booking');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('home path: solo at_home groomer uses resolved at_home style', () => {
    const onNavigate = jest.fn();
    const router = makeRouter();

    bookWalkInAppointment(
      makeProvider({
        subtitle: 'Groomer (Solo)',
        serviceStyle: 'at_home',
      }),
      router,
      onNavigate,
    );

    expect(onNavigate).toHaveBeenCalledWith(
      WAPPT_VENDOR_PROFILE_SCREEN,
      expect.objectContaining({
        serviceStyle: 'at_home',
      }),
    );
  });

  it('home path: solo vet subtitle overrides stale at_center serviceStyle', () => {
    const onNavigate = jest.fn();
    const router = makeRouter();

    bookWalkInAppointment(
      makeProvider({
        id: 'vendor-bindu-vet',
        displayName: 'Bindu Vet Clinic',
        category: 'vet',
        subtitle: 'Vet · Veterinarian (Solo)',
        serviceStyle: 'at_center',
      }),
      router,
      onNavigate,
    );

    expect(onNavigate).toHaveBeenCalledWith(
      WAPPT_VENDOR_PROFILE_SCREEN,
      expect.objectContaining({
        serviceStyle: 'at_home',
      }),
    );
  });

  it('home path: vet category also opens wappt-vendor-profile with at_center', () => {
    const onNavigate = jest.fn();
    const router = makeRouter();

    bookWalkInAppointment(
      makeProvider({
        id: 'vendor-bindu-vet',
        displayName: 'Bindu Vet Clinic',
        category: 'vet',
      }),
      router,
      onNavigate
    );

    expect(onNavigate).toHaveBeenCalledWith(
      WAPPT_VENDOR_PROFILE_SCREEN,
      expect.objectContaining({
        vendorId: 'vendor-bindu-vet',
        category: 'vet',
        serviceStyle: 'at_center',
        profileBackScreen: 'home',
      })
    );
  });

  it('/walk-in path: persists wappt-vendor-profile shell nav and routes home', () => {
    const router = makeRouter();
    const provider = makeProvider();

    bookWalkInAppointment(provider, router);

    expect(router.push).toHaveBeenCalledWith('/');
    const raw = sessionStorage.getItem(WALK_IN_PENDING_SHELL_NAV_KEY);
    expect(raw).toBeTruthy();
    const pending = JSON.parse(raw!) as {
      screen: string;
      data?: Record<string, unknown>;
      returnUrl?: string;
    };
    expect(pending.screen).toBe(WAPPT_VENDOR_PROFILE_SCREEN);
    expect(pending.returnUrl).toBe(WALK_IN_VENDORS_PATH);
    expect(pending.data).toEqual(
      expect.objectContaining({
        vendorId: 'vendor-bindu-groom',
        vendorName: 'Bindu Grooming Service',
        category: 'grooming',
        serviceStyle: 'at_center',
        profileBackScreen: 'home',
        returnScreen: WALK_IN_VENDORS_PATH,
        fromBanner: true,
      })
    );
    expect(pending.screen).not.toBe('grooming-booking');
    expect(pending.screen).not.toBe('vet-booking');
  });

  it('no-ops when vendor id is missing', () => {
    const onNavigate = jest.fn();
    const router = makeRouter();

    bookWalkInAppointment(makeProvider({ id: '  ' }), router, onNavigate);

    expect(onNavigate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(WALK_IN_PENDING_SHELL_NAV_KEY)).toBeNull();
  });

  it('Pay Bill opens the shared vendor Pay Bill screen without immediate login', () => {
    const router = makeRouter();
    payWalkInBill(makeProvider(), router);
    expect(launchWarmpawzPayServiceBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: 'vendor-bindu-groom',
        category: 'grooming',
      })
    );
  });

  it('persistWalkInShellNav stores screen for home handoff', () => {
    persistWalkInShellNav(WAPPT_VENDOR_PROFILE_SCREEN, { vendorId: 'v1' });
    const pending = JSON.parse(sessionStorage.getItem(WALK_IN_PENDING_SHELL_NAV_KEY)!);
    expect(pending.screen).toBe(WAPPT_VENDOR_PROFILE_SCREEN);
    expect(pending.data).toEqual({ vendorId: 'v1' });
  });
});
