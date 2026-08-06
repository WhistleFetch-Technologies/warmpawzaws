import { z } from 'zod';
import {
  assertReportDate,
  istMonthEndExclusiveYmd,
  istMonthStartYmd,
  parseYearMonthQuery,
} from '../../../../../utils/vendor-accrual-ist';

const MAX_DATE_RANGE_DAYS = 366;

export type WpayPaymentsMonthFilter = {
  readonly mode: 'month';
  readonly year: number;
  readonly month: number;
};

export type WpayPaymentsRangeFilter = {
  readonly mode: 'range';
  readonly fromDate: string;
  readonly toDate: string;
};

export type WpayPaymentsDateFilter =
  | WpayPaymentsMonthFilter
  | WpayPaymentsRangeFilter
  | { readonly mode: 'none' };

export const paymentsListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  })
  .transform((value, ctx) => {
    const dateFilter = resolvePaymentsDateFilter(value, ctx);
    return {
      page: value.page,
      pageSize: value.pageSize,
      dateFilter,
    };
  });

export const paymentsExportQuerySchema = z
  .object({
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  })
  .transform((value, ctx) => ({
    dateFilter: resolvePaymentsDateFilter(value, ctx),
  }));

export type PaymentsListQuery = z.infer<typeof paymentsListQuerySchema>;
export type PaymentsExportQuery = z.infer<typeof paymentsExportQuerySchema>;

function resolvePaymentsDateFilter(
  value: {
    year?: number;
    month?: number;
    fromDate?: string;
    toDate?: string;
  },
  ctx: z.RefinementCtx,
): WpayPaymentsDateFilter {
  const yearRaw = value.year != null ? String(value.year) : '';
  const monthRaw = value.month != null ? String(value.month) : '';
  const hasMonthParts = yearRaw !== '' && monthRaw !== '';
  const fromDate = value.fromDate?.trim() || '';
  const toDate = value.toDate?.trim() || '';
  const hasRangeParts = Boolean(fromDate || toDate);

  if (hasMonthParts) {
    const ym = parseYearMonthQuery(yearRaw, monthRaw);
    if (!ym) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid year/month filter',
        path: ['month'],
      });
      return { mode: 'none' };
    }
    return { mode: 'month', year: ym.year, month: ym.month };
  }

  if (hasRangeParts) {
    const from = assertReportDate(fromDate);
    const to = assertReportDate(toDate);
    if (!from || !to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fromDate and toDate must be YYYY-MM-DD',
        path: ['fromDate'],
      });
      return { mode: 'none' };
    }
    if (from > to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fromDate must be on or before toDate',
        path: ['fromDate'],
      });
      return { mode: 'none' };
    }
    const spanDays = inclusiveDaySpan(from, to);
    if (spanDays > MAX_DATE_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`,
        path: ['toDate'],
      });
      return { mode: 'none' };
    }
    return { mode: 'range', fromDate: from, toDate: to };
  }

  return { mode: 'none' };
}

function inclusiveDaySpan(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split('-').map((part) => parseInt(part, 10));
  const [ty, tm, td] = toDate.split('-').map((part) => parseInt(part, 10));
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.floor((toMs - fromMs) / 86_400_000) + 1;
}

export function parsePaymentsListQuery(
  query: Record<string, string | undefined>,
): PaymentsListQuery {
  return paymentsListQuerySchema.parse({
    page: query.page,
    pageSize: query.pageSize,
    year: query.year,
    month: query.month,
    fromDate: query.fromDate,
    toDate: query.toDate,
  });
}

export function parsePaymentsExportQuery(
  query: Record<string, string | undefined>,
): PaymentsExportQuery {
  return paymentsExportQuerySchema.parse({
    year: query.year,
    month: query.month,
    fromDate: query.fromDate,
    toDate: query.toDate,
  });
}

export function wpayPaymentsFilterLabel(filter: WpayPaymentsDateFilter): string {
  if (filter.mode === 'month') {
    return `${filter.year}-${String(filter.month).padStart(2, '0')}`;
  }
  if (filter.mode === 'range') {
    return `${filter.fromDate}_to_${filter.toDate}`;
  }
  return 'all';
}

export function wpayPaymentsMonthBounds(filter: WpayPaymentsMonthFilter): {
  start: string;
  endExclusive: string;
} {
  return {
    start: istMonthStartYmd(filter.year, filter.month),
    endExclusive: istMonthEndExclusiveYmd(filter.year, filter.month),
  };
}
