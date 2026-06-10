import { describe, expect, test } from '@jest/globals';
import {
  assertYearMonth,
  istDayEndExclusiveYmd,
  istMonthEndExclusiveYmd,
  istMonthStartYmd,
  listIstMonthDays,
  parseYearMonthQuery,
} from '../vendor-accrual-ist';

describe('vendor-accrual-ist', () => {
  test('assertYearMonth rejects invalid values', () => {
    expect(assertYearMonth(2026, 6)).toEqual({ year: 2026, month: 6 });
    expect(assertYearMonth(2026, 0)).toBeNull();
    expect(assertYearMonth(2026, 13)).toBeNull();
    expect(assertYearMonth(1999, 6)).toBeNull();
  });

  test('parseYearMonthQuery parses query strings', () => {
    expect(parseYearMonthQuery('2026', '6')).toEqual({ year: 2026, month: 6 });
    expect(parseYearMonthQuery('2026', '06')).toEqual({ year: 2026, month: 6 });
    expect(parseYearMonthQuery('bad', '6')).toBeNull();
  });

  test('istMonthStartYmd and end exclusive for June 2026', () => {
    expect(istMonthStartYmd(2026, 6)).toBe('2026-06-01');
    expect(istMonthEndExclusiveYmd(2026, 6)).toBe('2026-07-01');
  });

  test('istMonthEndExclusiveYmd rolls year at December', () => {
    expect(istMonthStartYmd(2025, 12)).toBe('2025-12-01');
    expect(istMonthEndExclusiveYmd(2025, 12)).toBe('2026-01-01');
  });

  test('listIstMonthDays returns full month length', () => {
    const feb2024 = listIstMonthDays(2024, 2);
    expect(feb2024).toHaveLength(29);
    expect(feb2024[0]).toBe('2024-02-01');
    expect(feb2024[feb2024.length - 1]).toBe('2024-02-29');

    const jun2026 = listIstMonthDays(2026, 6);
    expect(jun2026).toHaveLength(30);
    expect(jun2026[0]).toBe('2026-06-01');
    expect(jun2026[jun2026.length - 1]).toBe('2026-06-30');
  });

  test('istDayEndExclusiveYmd is next calendar day', () => {
    expect(istDayEndExclusiveYmd('2026-06-01')).toBe('2026-06-02');
    expect(istDayEndExclusiveYmd('2026-12-31')).toBe('2027-01-01');
    expect(istDayEndExclusiveYmd('bad')).toBeNull();
  });
});
