/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import { WARMPAWZ_CART_KEY } from '../warmpawz-cart-storage';
import { getAnonymousIdStorageKey } from '../anonymous-id';
import {
  WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY,
  WARMPAWZ_SHOP_DELIVERY_ADDRESS_ID_KEY,
} from '../ecommerce/checkout-address-storage';
import { GUEST_BOOKING_INTENT_KEY, GUEST_JOURNEY_BACKUP_KEY } from '../guest-booking-intent';

jest.mock('../push-bootstrap', () => ({
  teardownPushNotifications: jest.fn().mockResolvedValue(undefined),
  ensureCapacitorPushRegistrationPipeline: jest.fn().mockResolvedValue(undefined),
  bootstrapPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

import {
  clearCustomerSession,
  getPostLogoutHref,
  getStoredCustomerJwtForSession,
  initializeSession,
  signOutCustomer,
} from '../session-utils';
import { getCognitoIdToken, refreshCognitoTokensIfNeeded } from '../cognito-auth';
import { apiClient, getCustomerAuthHeadersForUpload } from '../api-client';
import { hasAuthenticatedCustomerSession, isGuestApplicationState } from '../guest-auth-gate';
import { resolveGuestPublicApiPath } from '../guest-public-api-path';
import { hasValidGuestHomeLocation } from '../location-storage';
import {
  shouldMountGuestHomeContent,
  shouldShowGuestHomeLocationGate,
} from '../guest-home-location-gate';

const CUSTOMER_WEB_ROOT = path.resolve(__dirname, '../..');

function seedCustomerA(): void {
  localStorage.setItem(
    'customerCognitoTokens',
    JSON.stringify({
      accessToken: 'access-A',
      idToken: 'id-token-A',
      refreshToken: 'refresh-A',
      expiresIn: 3600,
    })
  );
  localStorage.setItem('customerTokenExpiry', String(Date.now() + 60 * 60 * 1000));
  localStorage.setItem('customerRefreshTokenExpiry', String(Date.now() + 90 * 24 * 60 * 60 * 1000));
  localStorage.setItem('customerUser', JSON.stringify({ sub: 'sub-A', phone: '9999990001' }));
  localStorage.setItem('customerPhone', '9999990001');
  localStorage.setItem('customer_phone', '9999990001');
  localStorage.setItem('phone', '9999990001');
  localStorage.setItem('customerId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  localStorage.setItem('customer_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  localStorage.setItem('warmpawz_customer_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  localStorage.setItem('authToken', 'id-token-A');
  localStorage.setItem(
    'customerData',
    JSON.stringify({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', phone: '9999990001', name: 'Customer A' })
  );
  localStorage.setItem('customerProfile', JSON.stringify({ firstName: 'Ada' }));
  localStorage.setItem('customerPets', JSON.stringify([{ id: 'pet-A', name: 'Rex' }]));
  localStorage.setItem('customerPetsOwnerPhone', '9999990001');
  localStorage.setItem('customerOnboardingComplete', 'true');
  localStorage.setItem('onboarding_completed', 'true');
  localStorage.setItem('profile_completed', 'true');
  localStorage.setItem('warmpawz_payments_v2_9999990001', JSON.stringify([{ id: 'pm-A', last4: '1111' }]));
  localStorage.setItem(WARMPAWZ_CART_KEY, JSON.stringify([{ productId: 'sku-1', quantity: 2 }]));
  localStorage.setItem('warmpawz_location_v1', JSON.stringify({ city: 'Bengaluru' }));
  localStorage.setItem(getAnonymousIdStorageKey(), 'anon-keep-me');
  sessionStorage.setItem(WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY, 'addr-A');
  sessionStorage.setItem(WARMPAWZ_SHOP_DELIVERY_ADDRESS_ID_KEY, 'addr-A');
  sessionStorage.setItem('warmpawz_last_pet_9999990001', 'pet-A');
  sessionStorage.setItem('warmpawz_home_9999990001_critical', JSON.stringify({ name: 'Ada' }));
  sessionStorage.setItem('warmpawz_home_guest_critical', JSON.stringify({ guest: true }));
  sessionStorage.setItem(
    GUEST_BOOKING_INTENT_KEY,
    JSON.stringify({
      v: 1,
      savedAt: Date.now(),
      kind: 'booking',
      returnPath: '/',
      vendorId: 'vendor-1',
      idToken: 'leaked-jwt-A',
      customerPhone: '9999990001',
    })
  );
}

describe('customer logout isolation', () => {
  const originalBrowse = process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
    delete (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: unknown }).__WARMPAWZ_RUNTIME_CONFIG__;
  });

  afterEach(() => {
    if (originalBrowse === undefined) {
      delete process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = originalBrowse;
    }
  });

  it('sidebar/profile source paths use signOutCustomer instead of partial cleanup', () => {
    const sidebar = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/UserAccountSidebar.tsx'),
      'utf8'
    );
    expect(sidebar).toMatch(/const handleLogout = async \(\) => \{[\s\S]*await signOutCustomer\(\);/);
    expect(sidebar).not.toMatch(/const handleLogout[\s\S]*removeItem\('customerPhone'\)/);

    const profile = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/CustomerProfileView.tsx'),
      'utf8'
    );
    expect(profile).toMatch(/await signOutCustomer\(\)/);

    const app = fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, 'components/customer/CustomerApp.tsx'), 'utf8');
    expect(app).toMatch(/await signOutCustomer\(\)/);
    expect(app).toMatch(/getPostLogoutHref\(\)/);

    const apiSrc = fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, 'lib/api-client.ts'), 'utf8');
    expect(apiSrc).toMatch(/await signOutCustomer\(\)/);
    expect(apiSrc).toMatch(/getPostLogoutHref\(\)/);
    expect(apiSrc).not.toMatch(/window\.location\.href = '\/auth'/);

    const quick = fs.readFileSync(
      path.join(CUSTOMER_WEB_ROOT, 'components/customer/profile/ProfileQuickActions.tsx'),
      'utf8'
    );
    expect(quick).toMatch(/onLogout/);
  });

  it('apiClient.clearAuth uses the same canonical teardown as logout', () => {
    seedCustomerA();
    localStorage.setItem('warmpawz_wishlist', JSON.stringify(['sku-A']));
    localStorage.setItem('activeTeleQueueId', 'queue-A');
    localStorage.setItem('offline_queue', JSON.stringify([{ id: 1 }]));
    apiClient.clearAuth();
    expect(localStorage.getItem('customerPhone')).toBeNull();
    expect(localStorage.getItem('customerId')).toBeNull();
    expect(localStorage.getItem('customerData')).toBeNull();
    expect(localStorage.getItem('customerPets')).toBeNull();
    expect(localStorage.getItem('profile_completed')).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('customerCognitoTokens')).toBeNull();
    expect(localStorage.getItem('warmpawz_wishlist')).toBeNull();
    expect(localStorage.getItem('activeTeleQueueId')).toBeNull();
    expect(localStorage.getItem('offline_queue')).toBeNull();
    expect(localStorage.getItem(WARMPAWZ_CART_KEY)).toContain('sku-1');
    expect(localStorage.getItem('warmpawz_location_v1')).toContain('Bengaluru');
    expect(hasAuthenticatedCustomerSession()).toBe(false);
    expect(isGuestApplicationState()).toBe(true);
  });

  it('canonical logout clears Cognito JWT/refresh and customer identity', async () => {
    seedCustomerA();
    await signOutCustomer();

    expect(localStorage.getItem('customerCognitoTokens')).toBeNull();
    expect(localStorage.getItem('customerUser')).toBeNull();
    expect(localStorage.getItem('customerRefreshTokenExpiry')).toBeNull();
    expect(localStorage.getItem('customerPhone')).toBeNull();
    expect(localStorage.getItem('customerId')).toBeNull();
    expect(localStorage.getItem('warmpawz_customer_id')).toBeNull();
    expect(localStorage.getItem('customerData')).toBeNull();
    expect(localStorage.getItem('customerProfile')).toBeNull();
    expect(localStorage.getItem('customerPets')).toBeNull();
    expect(localStorage.getItem('warmpawz_payments_v2_9999990001')).toBeNull();
    expect(sessionStorage.getItem(WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY)).toBeNull();
    expect(sessionStorage.getItem('warmpawz_last_pet_9999990001')).toBeNull();
    expect(sessionStorage.getItem('warmpawz_home_9999990001_critical')).toBeNull();
    expect(getCognitoIdToken()).toBeNull();
    expect(getStoredCustomerJwtForSession()).toBeNull();
    expect(isGuestApplicationState()).toBe(true);
    expect(hasAuthenticatedCustomerSession()).toBe(false);
  });

  it('getAuthToken() is unauthenticated after logout', async () => {
    seedCustomerA();
    expect(getCustomerAuthHeadersForUpload().Authorization).toBe('Bearer id-token-A');
    await signOutCustomer();
    expect(getCustomerAuthHeadersForUpload().Authorization).toBeUndefined();
    expect(getCustomerAuthHeadersForUpload().Authorization).toBeUndefined();
  });

  it('does not send Customer A JWT on customer bookings/profile/pets paths after logout', async () => {
    seedCustomerA();
    await signOutCustomer();
    expect(getCustomerAuthHeadersForUpload().Authorization).toBeUndefined();
    expect(getStoredCustomerJwtForSession()).toBeNull();
    expect(resolveGuestPublicApiPath('/customer/bookings?phone=9999990001')).toBe(
      '/customer/bookings?phone=9999990001'
    );
    expect(resolveGuestPublicApiPath('/customer/discover-services')).toBe('/public/discover-services');
  });

  it('ecommerce checkout requires fresh authentication after logout', async () => {
    seedCustomerA();
    expect(hasAuthenticatedCustomerSession()).toBe(true);
    await signOutCustomer();
    const phone = localStorage.getItem('customerPhone');
    expect(!phone || !hasAuthenticatedCustomerSession()).toBe(true);
  });

  it('preserves guest cart, location, anonymous id, and guest home cache', async () => {
    seedCustomerA();
    await signOutCustomer();
    expect(localStorage.getItem(WARMPAWZ_CART_KEY)).toContain('sku-1');
    expect(localStorage.getItem('warmpawz_location_v1')).toContain('Bengaluru');
    expect(localStorage.getItem(getAnonymousIdStorageKey())).toBe('anon-keep-me');
    expect(sessionStorage.getItem('warmpawz_home_guest_critical')).toContain('guest');
  });

  it('keeps valid Guest-safe coordinates after logout without customer identity', async () => {
    seedCustomerA();
    localStorage.setItem(
      'warmpawz_location_v1',
      JSON.stringify({
        v: 1,
        latitude: 12.97,
        longitude: 77.59,
        timestamp: Date.now(),
        source: 'gps',
        city: 'Bengaluru',
      })
    );
    await signOutCustomer();
    const persisted = JSON.parse(String(localStorage.getItem('warmpawz_location_v1')));
    expect(hasValidGuestHomeLocation(persisted)).toBe(true);
    expect(hasAuthenticatedCustomerSession()).toBe(false);
    expect(
      shouldMountGuestHomeContent({
        isGuest: true,
        isAuthenticated: false,
        locationHydrated: true,
        latitude: persisted.latitude,
        longitude: persisted.longitude,
      })
    ).toBe(true);
  });

  it('gates Guest Home after logout when retained location has no coordinates', async () => {
    seedCustomerA();
    await signOutCustomer();
    const persisted = JSON.parse(String(localStorage.getItem('warmpawz_location_v1')));
    expect(hasValidGuestHomeLocation(persisted)).toBe(false);
    expect(
      shouldShowGuestHomeLocationGate({
        isGuest: true,
        isAuthenticated: false,
        locationHydrated: true,
        latitude: persisted.latitude ?? null,
        longitude: persisted.longitude ?? null,
      })
    ).toBe(true);
  });

  it('Customer B cannot inherit Customer A authenticated state after logout', async () => {
    seedCustomerA();
    await signOutCustomer();

    localStorage.setItem('customerPhone', '8888880002');
    localStorage.setItem(
      'customerCognitoTokens',
      JSON.stringify({
        accessToken: 'access-B',
        idToken: 'id-token-B',
        refreshToken: 'refresh-B',
        expiresIn: 3600,
      })
    );
    localStorage.setItem('customerTokenExpiry', String(Date.now() + 60 * 60 * 1000));

    expect(localStorage.getItem('customerPets')).toBeNull();
    expect(localStorage.getItem('customerData')).toBeNull();
    expect(localStorage.getItem('warmpawz_payments_v2_9999990001')).toBeNull();
    expect(sessionStorage.getItem(WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY)).toBeNull();
    expect(getCognitoIdToken()).toBe('id-token-B');
    expect(getCustomerAuthHeadersForUpload().Authorization).toBe('Bearer id-token-B');
    expect(getCustomerAuthHeadersForUpload().Authorization).not.toBe('Bearer id-token-A');
  });

  it('reload after logout stays guest and cannot silently refresh Customer A', async () => {
    seedCustomerA();
    await signOutCustomer();
    initializeSession();
    const refreshed = await refreshCognitoTokensIfNeeded();
    expect(refreshed).toBeNull();
    expect(getCognitoIdToken()).toBeNull();
    expect(getCustomerAuthHeadersForUpload().Authorization).toBeUndefined();
    expect(isGuestApplicationState()).toBe(true);
  });

  it('strips leaked auth fields from guest journey but keeps guest intent', () => {
    seedCustomerA();
    clearCustomerSession();
    const raw = sessionStorage.getItem(GUEST_BOOKING_INTENT_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(String(raw)) as Record<string, unknown>;
    expect(parsed.vendorId).toBe('vendor-1');
    expect(parsed.idToken).toBeUndefined();
    expect(parsed.customerPhone).toBeUndefined();
    expect(localStorage.getItem(GUEST_JOURNEY_BACKUP_KEY) || raw).toBeTruthy();
  });

  it('navigates to marketplace when guest browsing is on, otherwise /auth', () => {
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
    expect(getPostLogoutHref()).toBe('/');
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'false';
    expect(getPostLogoutHref()).toBe('/auth');
  });

  it('does not use localStorage.clear() in canonical cleanup', () => {
    const src = fs.readFileSync(path.join(CUSTOMER_WEB_ROOT, 'lib/session-utils.ts'), 'utf8');
    expect(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).not.toMatch(/localStorage\.clear\s*\(/);
  });
});
