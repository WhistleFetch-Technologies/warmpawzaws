import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import { PUBLISHED } from '../constants/publish-status';
import type { IDashboardMetricsRepository } from './interfaces/IDashboardMetricsRepository';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';
const PRICING_TABLE = 'warmpawz_pay_merchant_pricing';

const ACTIVE_PRICING_PREDICATE = `
  p.status = 'active'
  AND p.effective_from <= NOW()
  AND (p.effective_until IS NULL OR p.effective_until >= NOW())
`;

export interface DashboardMetricsDbClient {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
}

interface CountRow {
  readonly total: number | string;
}

export class DashboardMetricsRepository implements IDashboardMetricsRepository {
  constructor(private readonly db: DashboardMetricsDbClient = { query }) {}

  async countPublishedMerchants(): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS total
      FROM ${CATALOGUE_TABLE}
      WHERE publish_status = $1
    `;

    const result = await this.db.query(sql, [PUBLISHED]);
    const row = result.rows[0] as CountRow | undefined;
    return Number(row?.total ?? 0);
  }

  async getAverageDiscountPercent(): Promise<number> {
    const sql = `
      SELECT COALESCE(AVG(p.discount_value), 0)::float AS average_discount
      FROM ${PRICING_TABLE} p
      WHERE p.discount_type = 'percentage'
        AND ${ACTIVE_PRICING_PREDICATE}
    `;
    const result = await this.db.query(sql);
    const value = Number(result.rows[0]?.average_discount ?? 0);
    return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
  }
}

export const dashboardMetricsRepository = new DashboardMetricsRepository();
