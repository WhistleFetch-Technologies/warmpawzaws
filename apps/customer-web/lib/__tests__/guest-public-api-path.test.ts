/**
 * @jest-environment jsdom
 */

const getJwt = jest.fn(() => null as string | null);

jest.mock('../session-utils', () => ({
  getStoredCustomerJwtForSession: () => getJwt(),
}));

import { resolveGuestPublicApiPath } from '../guest-public-api-path';

describe('resolveGuestPublicApiPath', () => {
  beforeEach(() => {
    getJwt.mockReturnValue(null);
  });

  it('rewrites discover-services for guests', () => {
    expect(resolveGuestPublicApiPath('/customer/discover-services?category=vet')).toBe(
      '/public/discover-services?category=vet'
    );
  });

  it('rewrites vendor services and slots for guests', () => {
    expect(resolveGuestPublicApiPath('/customer/vendor/abc/services')).toBe(
      '/public/vendor/abc/services'
    );
    expect(resolveGuestPublicApiPath('/customer/vendor/abc/available-slots?date=2026-08-12')).toBe(
      '/public/vendor/abc/available-slots?date=2026-08-12'
    );
  });

  it('rewrites warmpawz-pay vendor paths for guests', () => {
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/vendors/nearby?lat=1&lng=2')).toBe(
      '/public/warmpawz-pay/vendors/nearby?lat=1&lng=2'
    );
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/vendors/v1')).toBe(
      '/public/warmpawz-pay/vendors/v1'
    );
  });

  it('rewrites ecommerce product browse for guests', () => {
    expect(resolveGuestPublicApiPath('/ecommerce/products?limit=10')).toBe(
      '/public/ecommerce/products?limit=10'
    );
    expect(resolveGuestPublicApiPath('/ecommerce/products/p1')).toBe('/public/ecommerce/products/p1');
  });

  it('rewrites marketplace search to the public alias', () => {
    expect(resolveGuestPublicApiPath('/search?q=grooming&category=vet')).toBe(
      '/public/search?q=grooming&category=vet'
    );
    expect(resolveGuestPublicApiPath('/search/autocomplete?q=gr')).toBe(
      '/public/search/autocomplete?q=gr'
    );
  });

  it('does not rewrite customer-owned write paths', () => {
    expect(resolveGuestPublicApiPath('/customer/pets')).toBe('/customer/pets');
    expect(resolveGuestPublicApiPath('/ecommerce/orders')).toBe('/ecommerce/orders');
  });

  it('leaves paths unchanged when JWT present', () => {
    getJwt.mockReturnValue('jwt');
    expect(resolveGuestPublicApiPath('/customer/discover-services')).toBe(
      '/customer/discover-services'
    );
  });
});
