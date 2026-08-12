/**
 * LIMIT+1 pagination helpers for storefront product list (avoids COUNT(*) on hot path).
 */

export type StorefrontListPageResult<T> = {
  items: T[];
  hasMore: boolean;
};

/**
 * Given rows fetched with LIMIT = requestedLimit + 1, return at most requestedLimit items
 * and whether another page exists.
 */
export function sliceStorefrontListPage<T>(
  fetchedRows: T[],
  requestedLimit: number,
): StorefrontListPageResult<T> {
  const limit = Math.max(0, requestedLimit);
  if (limit === 0) {
    return { items: [], hasMore: false };
  }
  const hasMore = fetchedRows.length > limit;
  return {
    items: hasMore ? fetchedRows.slice(0, limit) : fetchedRows,
    hasMore,
  };
}

/** Internal fetch size when using LIMIT+1 strategy. */
export function storefrontListFetchLimit(requestedLimit: number): number {
  const limit = Math.max(1, requestedLimit);
  return limit + 1;
}
