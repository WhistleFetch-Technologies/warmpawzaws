import {
  CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE,
  CUSTOMER_SERVICE_LIST_SORT_DEFAULT,
  withCustomerServiceListPagination,
  type CustomerServiceListPaginationParams,
} from '@warmpawz/shared-types';

/** First page, max page size — for booking/selectors until UI paginates. */
export function defaultCustomerServiceFullListParams(): CustomerServiceListPaginationParams {
  return { page: 0, size: CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE };
}

export function urlCustomerPetsByPhoneQuery(
  phone: string,
  opts: CustomerServiceListPaginationParams = defaultCustomerServiceFullListParams()
): string {
  return withCustomerServiceListPagination(
    `/customer/pets?phone=${encodeURIComponent(phone)}`,
    opts
  );
}

export function urlCustomerPetsByPhonePath(
  phone: string,
  opts: CustomerServiceListPaginationParams = defaultCustomerServiceFullListParams()
): string {
  return withCustomerServiceListPagination(
    `/customer/pets/${encodeURIComponent(phone)}`,
    opts
  );
}

export function urlCustomerAddressesByPhone(
  phone: string,
  opts: CustomerServiceListPaginationParams = defaultCustomerServiceFullListParams()
): string {
  return withCustomerServiceListPagination(
    `/customer/addresses?phone=${encodeURIComponent(phone)}`,
    opts
  );
}

export function urlCustomerPetsByCustomerId(
  customerId: string,
  opts: CustomerServiceListPaginationParams = defaultCustomerServiceFullListParams()
): string {
  return withCustomerServiceListPagination(`/customer/${customerId}/pets`, opts);
}

export function urlPetsCustomerByCustomerId(
  customerId: string,
  opts: CustomerServiceListPaginationParams = defaultCustomerServiceFullListParams()
): string {
  return withCustomerServiceListPagination(`/pets/customer/${customerId}`, opts);
}

export function urlCustomerAddressesByCustomerId(
  customerId: string,
  opts: CustomerServiceListPaginationParams = defaultCustomerServiceFullListParams()
): string {
  return withCustomerServiceListPagination(
    `/customer/${customerId}/addresses`,
    opts
  );
}

/** Default paging for My Pets list UI (matches backend default size 10). */
export function myPetsListParams(page: number): CustomerServiceListPaginationParams {
  return {
    page,
    size: 10,
    sort: CUSTOMER_SERVICE_LIST_SORT_DEFAULT,
  };
}
