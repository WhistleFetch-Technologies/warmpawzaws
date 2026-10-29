/** Cursor pages for GET /vendor/:id/earnings — 5 light rows, then infinite scroll. */

export const EARNINGS_CURSOR_PAGE_SIZE = 5;
export const EARNINGS_EXPORT_MAX_ROWS = 5000;

export type EarningsCursor = {
  t: string;
  id: string;
};

export function parseEarningsPageLimit(raw?: string | null): number {
  if (raw === '0') return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return EARNINGS_CURSOR_PAGE_SIZE;
  return Math.min(EARNINGS_CURSOR_PAGE_SIZE, Math.floor(parsed));
}

export function encodeEarningsCursor(realizedAt: string | null | undefined, id: string): string {
  return Buffer.from(JSON.stringify({ t: realizedAt || '', id }), 'utf8').toString('base64url');
}

export function decodeEarningsCursor(raw?: string | null): EarningsCursor | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<EarningsCursor>;
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id) return null;
    return { t: String(parsed.t || ''), id: parsed.id };
  } catch {
    return null;
  }
}

export function sliceEarningsByCursor<T extends { id: string; realizedAt?: string | null }>(
  items: readonly T[],
  cursorRaw: string | null | undefined,
  limit: number,
): { page: T[]; nextCursor: string | null; hasMore: boolean; totalCount: number } {
  const totalCount = items.length;
  if (limit <= 0) {
    return { page: [], nextCursor: null, hasMore: false, totalCount };
  }

  const cursor = decodeEarningsCursor(cursorRaw);
  let start = 0;
  if (cursor) {
    const exact = items.findIndex((item) => item.id === cursor.id);
    if (exact >= 0) {
      start = exact + 1;
    } else {
      const after = items.findIndex((item) => {
        const realized = String(item.realizedAt || '');
        return realized < cursor.t || (realized === cursor.t && item.id < cursor.id);
      });
      start = after < 0 ? items.length : after;
    }
  }

  const page = items.slice(start, start + limit);
  const last = page[page.length - 1];
  const hasMore = start + page.length < items.length;
  return {
    page,
    nextCursor: hasMore && last ? encodeEarningsCursor(last.realizedAt, last.id) : null,
    hasMore,
    totalCount,
  };
}
