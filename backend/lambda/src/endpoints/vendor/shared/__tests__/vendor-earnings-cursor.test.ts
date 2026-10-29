import {
  EARNINGS_CURSOR_PAGE_SIZE,
  encodeEarningsCursor,
  parseEarningsPageLimit,
  sliceEarningsByCursor,
} from '../vendor-earnings-cursor';

describe('vendor earnings cursor', () => {
  it('caps page size at 5 and treats 0 as summary-only', () => {
    expect(parseEarningsPageLimit(undefined)).toBe(EARNINGS_CURSOR_PAGE_SIZE);
    expect(parseEarningsPageLimit('50')).toBe(5);
    expect(parseEarningsPageLimit('0')).toBe(0);
  });

  it('returns the next 5 rows after a cursor', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `id-${String(index).padStart(2, '0')}`,
      realizedAt: `2026-10-${String(29 - index).padStart(2, '0')}T10:00:00.000Z`,
    }));
    const first = sliceEarningsByCursor(items, null, 5);
    expect(first.page).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    expect(first.totalCount).toBe(12);
    expect(first.nextCursor).toBe(encodeEarningsCursor(items[4].realizedAt, items[4].id));

    const second = sliceEarningsByCursor(items, first.nextCursor, 5);
    expect(second.page.map((row) => row.id)).toEqual([
      'id-05',
      'id-06',
      'id-07',
      'id-08',
      'id-09',
    ]);
    expect(second.hasMore).toBe(true);

    const last = sliceEarningsByCursor(items, second.nextCursor, 5);
    expect(last.page).toHaveLength(2);
    expect(last.hasMore).toBe(false);
    expect(last.nextCursor).toBeNull();
  });
});
