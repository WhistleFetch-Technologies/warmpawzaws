import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_ORDER,
  MAX_PAGE_SIZE,
  type CatalogueSortField,
  type SortOrder,
} from './catalogue-limits';

export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_SORT_FIELD, DEFAULT_SORT_ORDER };
export type { CatalogueSortField as MerchantSortField, SortOrder };

export const ALLOWED_PLATFORM_STATUS_FILTERS = [
  'approved',
  'pending',
  'suspended',
  'inactive',
  'deleted',
  'all',
] as const;

export type PlatformStatusFilter = (typeof ALLOWED_PLATFORM_STATUS_FILTERS)[number];

export const ALLOWED_WARMPAWZ_PAY_STATUS_FILTERS = [
  'draft',
  'published',
  'hidden',
  'all',
] as const;

export type WarmpawzPayStatusFilter = (typeof ALLOWED_WARMPAWZ_PAY_STATUS_FILTERS)[number];

export const ALLOWED_BUSINESS_TYPE_FILTERS = ['solo', 'business', 'center', 'all'] as const;

export type BusinessTypeFilter = (typeof ALLOWED_BUSINESS_TYPE_FILTERS)[number];

export const ALLOWED_CUSTOMER_VISIBLE_FILTERS = ['visible', 'hidden', 'all'] as const;

export type CustomerVisibleFilter = (typeof ALLOWED_CUSTOMER_VISIBLE_FILTERS)[number];
