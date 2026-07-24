import type { PublishStatus } from './publish-status';
import { DRAFT, PUBLISHED } from './publish-status';

/** Default offset-pagination page size for admin catalogue and vendor-candidate lists. */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum allowed page size for admin list endpoints. */
export const MAX_PAGE_SIZE = 100;

/** Default batch size for bulk catalogue operations (sequential processing). */
export const DEFAULT_BULK_SIZE = 20;

/** Maximum catalogue IDs per bulk publish / unpublish / delete request. */
export const MAX_BULK_SIZE = 100;

export const ALLOWED_SORT_FIELDS = [
  'updatedAt',
  'publishedAt',
  'businessName',
  'publishStatus',
] as const;

export type CatalogueSortField = (typeof ALLOWED_SORT_FIELDS)[number];

export const DEFAULT_SORT_FIELD: CatalogueSortField = 'updatedAt';

export const ALLOWED_SORT_ORDERS = ['asc', 'desc'] as const;

export type SortOrder = (typeof ALLOWED_SORT_ORDERS)[number];

export const DEFAULT_SORT_ORDER: SortOrder = 'desc';

/** Catalogue row publish_status values (DB). */
export const ALLOWED_PUBLISH_STATUSES: readonly PublishStatus[] = [DRAFT, PUBLISHED];

/** Admin list filter — includes aggregate option. */
export const ALLOWED_PUBLISH_STATUS_FILTERS = [
  'draft',
  'published',
  'not_in_catalogue',
  'all',
] as const;

export type CataloguePublishStatusFilter = (typeof ALLOWED_PUBLISH_STATUS_FILTERS)[number];

export const ALLOWED_ELIGIBILITY_FILTERS = [
  'customer_visible',
  'not_customer_visible',
  'all',
] as const;

export type CatalogueEligibilityFilter = (typeof ALLOWED_ELIGIBILITY_FILTERS)[number];
