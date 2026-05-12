import {
  CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE,
  withCustomerServiceListPagination,
} from '@warmpawz/shared-types';
import {
  defaultCustomerServiceFullListParams,
  urlCustomerAddressesByPhone,
  urlCustomerPetsByPhoneQuery,
  myPetsListParams,
} from '../customer-service-list-urls';

describe('customer-service list URLs', () => {
  it('appends page size sort with defaults for full list', () => {
    const path = urlCustomerPetsByPhoneQuery('9999999999');
    expect(path).toContain('phone=');
    expect(path).toContain(`size=${CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE}`);
    expect(path).toContain('page=0');
    expect(path).toContain('sort=');
  });

  it('myPetsListParams uses page size 10', () => {
    const built = withCustomerServiceListPagination('/x', myPetsListParams(2));
    expect(built).toContain('page=2');
    expect(built).toContain('size=10');
  });

  it('addresses by phone includes pagination query', () => {
    const u = urlCustomerAddressesByPhone('8888888888', defaultCustomerServiceFullListParams());
    expect(u.startsWith('/customer/addresses?phone=')).toBe(true);
    expect(u).toContain('&page=0');
  });
});
