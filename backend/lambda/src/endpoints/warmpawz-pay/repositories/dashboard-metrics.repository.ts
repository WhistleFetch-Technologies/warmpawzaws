import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import { PUBLISHED } from '../constants/publish-status';
import type {
  IDashboardMetricsRepository,
  WpayDashboardMoneyTotals,
} from './interfaces/IDashboardMetricsRepository';
import type { IWpayConvenienceSettingsRepository } from './interfaces/IWpayConvenienceSettingsRepository';
import { wpayConvenienceSettingsRepository } from './wpay-convenience-settings.repository';
import { dbWpayAdminPaymentsDashboardTotals } from './wpay-payments-admin.repository';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';
const PRICING_TABLE = 'warmpawz_pay_merchant_pricing';
const TIERS_TABLE = 'vendor_tiers';

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

function asCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export class DashboardMetricsRepository implements IDashboardMetricsRepository {
  private readonly convenienceSettings: Pick<
    IWpayConvenienceSettingsRepository,
    'getConvenienceSettings'
  >;
  private readonly paymentTotals: (
    db: DashboardMetricsDbClient,
  ) => Promise<WpayDashboardMoneyTotals>;

  constructor(
    private readonly db: DashboardMetricsDbClient = { query },
    convenienceSettings?: Pick<IWpayConvenienceSettingsRepository, 'getConvenienceSettings'>,
    paymentTotals?: (db: DashboardMetricsDbClient) => Promise<WpayDashboardMoneyTotals>,
  ) {
    this.convenienceSettings = convenienceSettings ?? wpayConvenienceSettingsRepository;
    this.paymentTotals = paymentTotals ?? dbWpayAdminPaymentsDashboardTotals;
  }

  async countPublishedMerchants(): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS total
      FROM ${CATALOGUE_TABLE}
      WHERE publish_status = $1
    `;

    const result = await this.db.query(sql, [PUBLISHED]);
    const row = result.rows[0] as CountRow | undefined;
    return asCount(row?.total);
  }

  async countDraftUnpublished(): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS total
      FROM ${CATALOGUE_TABLE}
      WHERE publish_status IS DISTINCT FROM $1
    `;

    const result = await this.db.query(sql, [PUBLISHED]);
    const row = result.rows[0] as CountRow | undefined;
    return asCount(row?.total);
  }

  async countPayEnabledTiers(): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS total
      FROM ${TIERS_TABLE}
      WHERE warmpawz_pay_enabled = true
    `;

    const result = await this.db.query(sql);
    const row = result.rows[0] as CountRow | undefined;
    return asCount(row?.total);
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

  async getPayBillMoneyTotals(): Promise<WpayDashboardMoneyTotals> {
    return this.paymentTotals(this.db);
  }

  async getBurnMode(): Promise<boolean> {
    const settings = await this.convenienceSettings.getConvenienceSettings();
    return settings.burnMode === true;
  }
}

export const dashboardMetricsRepository = new DashboardMetricsRepository();
