import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import { PUBLISHED } from '../constants/publish-status';
import type { IDashboardMetricsRepository } from './interfaces/IDashboardMetricsRepository';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';

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

  /**
   * Merchant Pricing is not implemented (Phase D).
   * Return a safe default — no pricing tables or fake aggregates.
   */
  async getAverageDiscountPercent(): Promise<number> {
    return 0;
  }
}

export const dashboardMetricsRepository = new DashboardMetricsRepository();
