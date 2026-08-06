import type { WpayPaymentsDateFilter } from '../admin/payments/dto/payments.requests';
import { wpayPaymentsMonthBounds } from '../admin/payments/dto/payments.requests';

export function buildWpayPaymentsDateFilterSql(
  filter: WpayPaymentsDateFilter,
  startParamIndex: number,
): { sql: string; params: unknown[]; nextParamIndex: number } {
  if (filter.mode === 'none') {
    return { sql: '', params: [], nextParamIndex: startParamIndex };
  }

  if (filter.mode === 'month') {
    const { start, endExclusive } = wpayPaymentsMonthBounds(filter);
    return {
      sql: ` AND (p.completed_at AT TIME ZONE 'Asia/Kolkata')::date >= $${startParamIndex}::date
             AND (p.completed_at AT TIME ZONE 'Asia/Kolkata')::date < $${startParamIndex + 1}::date`,
      params: [start, endExclusive],
      nextParamIndex: startParamIndex + 2,
    };
  }

  return {
    sql: ` AND (p.completed_at AT TIME ZONE 'Asia/Kolkata')::date >= $${startParamIndex}::date
           AND (p.completed_at AT TIME ZONE 'Asia/Kolkata')::date <= $${startParamIndex + 1}::date`,
    params: [filter.fromDate, filter.toDate],
    nextParamIndex: startParamIndex + 2,
  };
}
