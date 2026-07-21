import { decodeDiscoveryCursor, encodeDiscoveryCursor } from './discovery-cursor';
import { DISCOVERY_LIST_DEFAULT_MAX } from './discovery-list-enrich';

export const DISCOVERY_VENDOR_PAGE_DEFAULT = 3;
export const DISCOVERY_VENDOR_PAGE_MAX = 20;
export const DISCOVERY_SERVICE_PAGE_DEFAULT = 5;
export const DISCOVERY_SERVICE_PAGE_MAX = 50;

const VENDOR_SQL_OVERFETCH = 4;

export function parseDiscoveryPageLimit(
  rawLimit: string | undefined,
  defaultLimit: number,
  maxLimit: number
): number {
  const n = parseInt(String(rawLimit || ''), 10);
  if (!Number.isFinite(n) || n <= 0) return defaultLimit;
  return Math.min(maxLimit, Math.max(1, n));
}

export type DiscoveryVendorSqlPage = {
  sqlOffset: number;
  resultOffset: number;
  sqlLimit: number;
  pageSize: number;
};

export function resolveVendorListSqlPage(
  limitRaw: string | undefined,
  cursorRaw: string | undefined
): DiscoveryVendorSqlPage {
  const pageSize = parseDiscoveryPageLimit(
    limitRaw,
    DISCOVERY_VENDOR_PAGE_DEFAULT,
    DISCOVERY_VENDOR_PAGE_MAX
  );
  const { o: resultOffset, s: sqlOffset } = decodeDiscoveryCursor(cursorRaw);
  const sqlLimit = Math.min(
    DISCOVERY_LIST_DEFAULT_MAX * 3,
    Math.max(pageSize * VENDOR_SQL_OVERFETCH, pageSize + 5)
  );
  return { sqlOffset, resultOffset, sqlLimit, pageSize };
}

export function paginateEnrichedVendorPage<T>(
  items: T[],
  pageSize: number,
  resultOffset: number,
  sqlRowCount: number,
  sqlLimit: number,
  sqlOffset: number
): { page: T[]; nextCursor: string | null } {
  const page = items.slice(resultOffset, resultOffset + pageSize);
  const hasMoreInMemory = resultOffset + pageSize < items.length;
  const hasMoreInDb = sqlRowCount >= sqlLimit;

  let nextCursor: string | null = null;
  if (hasMoreInMemory) {
    nextCursor = encodeDiscoveryCursor({ o: resultOffset + pageSize, s: sqlOffset });
  } else if (hasMoreInDb) {
    nextCursor = encodeDiscoveryCursor({ o: 0, s: sqlOffset + sqlLimit });
  }
  return { page, nextCursor };
}

export type DiscoveryServiceSqlPage = {
  offset: number;
  limit: number;
  pageSize: number;
  cardMode: boolean;
};

export function resolveServiceListPage(
  limitRaw: string | undefined,
  cursorRaw: string | undefined
): DiscoveryServiceSqlPage {
  const hasPaging = !!(limitRaw?.trim() || cursorRaw?.trim());
  const pageSize = parseDiscoveryPageLimit(
    limitRaw,
    DISCOVERY_SERVICE_PAGE_DEFAULT,
    DISCOVERY_SERVICE_PAGE_MAX
  );
  const { o: offset } = decodeDiscoveryCursor(cursorRaw);
  return {
    offset,
    limit: pageSize + 1,
    pageSize,
    cardMode: hasPaging,
  };
}

export function paginateServiceCardPage<T>(
  items: T[],
  pageSize: number,
  offset: number,
  fetchedExtra: boolean
): { page: T[]; nextCursor: string | null } {
  const page = items.slice(0, pageSize);
  const nextCursor = fetchedExtra
    ? encodeDiscoveryCursor({ o: offset + pageSize, s: 0 })
    : null;
  return { page, nextCursor };
}
