/**
 * Customer-service (Java) paginated list APIs: pets & addresses.
 * Optional query params: page, size (max 50), sort (default createdAt,desc).
 */

export type CustomerServiceListPaginationParams = {
  page?: number;
  size?: number;
  sort?: string;
};

export const CUSTOMER_SERVICE_LIST_SORT_DEFAULT = 'createdAt,desc' as const;

export const CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE = 50;

/** Pagination block on list responses (`pagination` alongside `pets` / `addresses`). */
export type CustomerServicePaginationMeta = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

/** Loose envelope for GET list responses (legacy fields preserved). */
export type CustomerServiceListEnvelope = {
  success?: boolean;
  data?: unknown;
  message?: string;
  pets?: unknown[];
  addresses?: unknown[];
  pagination?: CustomerServicePaginationMeta;
};

/**
 * Append page/size/sort to a path that may already include a query string (e.g. ?phone=...).
 */
export function withCustomerServiceListPagination(
  pathWithOptionalQuery: string,
  opts?: CustomerServiceListPaginationParams
): string {
  const page = opts?.page ?? 0;
  const rawSize =
    opts?.size ?? CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE;
  const size = Math.min(
    Math.max(Math.floor(Number(rawSize)) || 1, 1),
    CUSTOMER_SERVICE_LIST_MAX_PAGE_SIZE
  );
  const sort = opts?.sort ?? CUSTOMER_SERVICE_LIST_SORT_DEFAULT;
  const sep = pathWithOptionalQuery.includes('?') ? '&' : '?';
  return `${pathWithOptionalQuery}${sep}page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`;
}

export function parsePaginationFromCustomerServiceResponse(
  body: unknown
): CustomerServicePaginationMeta | undefined {
  if (body == null || typeof body !== 'object') return undefined;
  const p = (body as Record<string, unknown>).pagination;
  if (p == null || typeof p !== 'object') return undefined;
  const o = p as Record<string, unknown>;
  const page = typeof o.page === 'number' ? o.page : Number(o.page);
  const size = typeof o.size === 'number' ? o.size : Number(o.size);
  const totalElements =
    typeof o.totalElements === 'number'
      ? o.totalElements
      : Number(o.totalElements);
  const totalPages =
    typeof o.totalPages === 'number' ? o.totalPages : Number(o.totalPages);
  if ([page, size, totalElements, totalPages].some((n) => Number.isNaN(n))) {
    return undefined;
  }
  return {
    page,
    size,
    totalElements,
    totalPages,
    hasNext: Boolean(o.hasNext),
    hasPrevious: Boolean(o.hasPrevious),
  };
}
