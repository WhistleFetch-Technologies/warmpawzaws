import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import {
  PRICING_STATUS,
  type PricingDiscountType,
  type PricingStatus,
} from '../constants/merchant-pricing';
import type {
  CreatePricingInput,
  IMerchantPricingRepository,
  PricingAdminFilters,
  PricingRow,
  PricingRowWithMerchant,
  UpdatePricingInput,
} from './interfaces/IMerchantPricingRepository';
import type { VendorCatalogDbClient } from './vendor-catalog.repository';

const PRICING_TABLE = 'warmpawz_pay_merchant_pricing';
const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';

const PRICING_COLUMNS = `
  p.id,
  p.vendor_id,
  p.catalogue_id,
  p.discount_type,
  p.discount_value,
  p.status,
  p.effective_from,
  p.effective_until,
  p.created_by,
  p.created_at,
  p.updated_at
`;

const MERCHANT_JOIN_SELECT = `
  v.business_name,
  v.owner_name,
  v.category AS legacy_category,
  r.category AS role_category,
  r.customer_service,
  r.config AS role_config
`;

const PRICING_FROM_JOIN = `
  FROM ${PRICING_TABLE} p
  INNER JOIN ${CATALOGUE_TABLE} c ON c.vendor_id = p.vendor_id
  INNER JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN roles r ON r.id = v.role_id
`;

const ACTIVE_PRICING_PREDICATE = `
  p.status = '${PRICING_STATUS.ACTIVE}'
  AND p.effective_from <= NOW()
  AND (p.effective_until IS NULL OR p.effective_until >= NOW())
`;

interface PricingDbRow {
  readonly id: string;
  readonly vendor_id: string;
  readonly catalogue_id: string | null;
  readonly discount_type: string;
  readonly discount_value: string | number;
  readonly status: string;
  readonly effective_from: Date | string;
  readonly effective_until: Date | string | null;
  readonly created_by: string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

interface PricingWithMerchantDbRow extends PricingDbRow {
  readonly business_name: string;
  readonly owner_name: string | null;
  readonly legacy_category: string | null;
  readonly role_category: string | null;
  readonly customer_service: string | null;
  readonly role_config: unknown;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function mapPricingRow(row: PricingDbRow): PricingRow {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    catalogueId: row.catalogue_id,
    discountType: row.discount_type as PricingDiscountType,
    discountValue: toNumber(row.discount_value),
    status: row.status as PricingStatus,
    effectiveFrom: toDate(row.effective_from),
    effectiveUntil: row.effective_until ? toDate(row.effective_until) : null,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapPricingRowWithMerchant(row: PricingWithMerchantDbRow): PricingRowWithMerchant {
  return {
    ...mapPricingRow(row),
    businessName: row.business_name,
    ownerName: row.owner_name,
    legacyCategory: row.legacy_category,
    roleCategory: row.role_category,
    customerService: row.customer_service,
    roleConfig: row.role_config,
  };
}

function buildWhereClause(filters: PricingAdminFilters): {
  readonly whereSql: string;
  readonly params: unknown[];
} {
  const conditions: string[] = ['(v.is_deleted IS NOT TRUE)'];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(v.business_name ILIKE ${searchParam} OR v.owner_name ILIKE ${searchParam})`,
    );
  }

  if (filters.category) {
    params.push(`%${filters.category}%`);
    const categoryParam = `$${params.length}`;
    conditions.push(
      `(r.category ILIKE ${categoryParam} OR r.customer_service ILIKE ${categoryParam} OR v.category ILIKE ${categoryParam})`,
    );
  }

  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`p.status = $${params.length}`);
  }

  if (filters.discountType && filters.discountType !== 'all') {
    params.push(filters.discountType);
    conditions.push(`p.discount_type = $${params.length}`);
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
  };
}

function resolveSortColumn(sortBy: string): string {
  if (sortBy === 'effectiveFrom') return 'p.effective_from';
  if (sortBy === 'businessName') return 'v.business_name';
  return 'p.updated_at';
}

export class MerchantPricingRepository implements IMerchantPricingRepository {
  constructor(private readonly db: VendorCatalogDbClient = { query }) {}

  async listAdmin(filters: PricingAdminFilters): Promise<readonly PricingRowWithMerchant[]> {
    const { whereSql, params } = buildWhereClause(filters);
    const sortColumn = resolveSortColumn(filters.sortBy);
    const sortDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const offset = (filters.page - 1) * filters.pageSize;

    const sql = `
      SELECT ${PRICING_COLUMNS}, ${MERCHANT_JOIN_SELECT}
      ${PRICING_FROM_JOIN}
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}, p.id ${sortDirection}
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const result = await this.db.query(sql, [...params, filters.pageSize, offset]);
    return (result.rows as PricingWithMerchantDbRow[]).map(mapPricingRowWithMerchant);
  }

  async countAdmin(filters: PricingAdminFilters): Promise<number> {
    const { whereSql, params } = buildWhereClause(filters);
    const sql = `
      SELECT COUNT(*)::int AS total
      ${PRICING_FROM_JOIN}
      WHERE ${whereSql}
    `;
    const result = await this.db.query(sql, params);
    return Number(result.rows[0]?.total ?? 0);
  }

  async findByVendorId(vendorId: string): Promise<PricingRowWithMerchant | null> {
    const sql = `
      SELECT ${PRICING_COLUMNS}, ${MERCHANT_JOIN_SELECT}
      ${PRICING_FROM_JOIN}
      WHERE p.vendor_id = $1 AND (v.is_deleted IS NOT TRUE)
    `;
    const result = await this.db.query(sql, [vendorId]);
    const row = result.rows[0] as PricingWithMerchantDbRow | undefined;
    return row ? mapPricingRowWithMerchant(row) : null;
  }

  async findRowByVendorId(vendorId: string): Promise<PricingRow | null> {
    const sql = `
      SELECT ${PRICING_COLUMNS.replace(/\bp\./g, 'p.')}
      FROM ${PRICING_TABLE} p
      WHERE p.vendor_id = $1
    `;
    const result = await this.db.query(sql, [vendorId]);
    const row = result.rows[0] as PricingDbRow | undefined;
    return row ? mapPricingRow(row) : null;
  }

  async insert(input: CreatePricingInput, catalogueId: string | null): Promise<PricingRow> {
    const sql = `
      INSERT INTO ${PRICING_TABLE} (
        vendor_id,
        catalogue_id,
        discount_type,
        discount_value,
        status,
        effective_from,
        effective_until,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING
        id,
        vendor_id,
        catalogue_id,
        discount_type,
        discount_value,
        status,
        effective_from,
        effective_until,
        created_by,
        created_at,
        updated_at
    `;

    const result = await this.db.query(sql, [
      input.vendorId,
      catalogueId,
      input.discountType,
      input.discountValue,
      input.status,
      input.effectiveFrom,
      input.effectiveUntil,
      input.createdBy,
    ]);

    const row = result.rows[0] as PricingDbRow;
    return mapPricingRow(row);
  }

  async update(vendorId: string, input: UpdatePricingInput): Promise<PricingRow | null> {
    const assignments: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [vendorId];

    if (input.discountType !== undefined) {
      params.push(input.discountType);
      assignments.push(`discount_type = $${params.length}`);
    }
    if (input.discountValue !== undefined) {
      params.push(input.discountValue);
      assignments.push(`discount_value = $${params.length}`);
    }
    if (input.status !== undefined) {
      params.push(input.status);
      assignments.push(`status = $${params.length}`);
    }
    if (input.effectiveFrom !== undefined) {
      params.push(input.effectiveFrom);
      assignments.push(`effective_from = $${params.length}`);
    }
    if (input.effectiveUntil !== undefined) {
      params.push(input.effectiveUntil);
      assignments.push(`effective_until = $${params.length}`);
    }

    const sql = `
      UPDATE ${PRICING_TABLE}
      SET ${assignments.join(', ')}
      WHERE vendor_id = $1
      RETURNING
        id,
        vendor_id,
        catalogue_id,
        discount_type,
        discount_value,
        status,
        effective_from,
        effective_until,
        created_by,
        created_at,
        updated_at
    `;

    const result = await this.db.query(sql, params);
    const row = result.rows[0] as PricingDbRow | undefined;
    return row ? mapPricingRow(row) : null;
  }

  async disable(vendorId: string): Promise<PricingRow | null> {
    return this.update(vendorId, { status: PRICING_STATUS.DISABLED });
  }

  async hasActiveConfiguredPricing(vendorId: string): Promise<boolean> {
    const sql = `
      SELECT EXISTS(
        SELECT 1
        FROM ${PRICING_TABLE} p
        WHERE p.vendor_id = $1
          AND ${ACTIVE_PRICING_PREDICATE}
      ) AS exists
    `;
    const result = await this.db.query(sql, [vendorId]);
    return Boolean(result.rows[0]?.exists);
  }

  async getActiveConfiguredVendorIds(
    vendorIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (vendorIds.length === 0) {
      return new Set();
    }

    const sql = `
      SELECT p.vendor_id
      FROM ${PRICING_TABLE} p
      WHERE p.vendor_id = ANY($1::uuid[])
        AND ${ACTIVE_PRICING_PREDICATE}
    `;
    const result = await this.db.query(sql, [vendorIds]);
    return new Set(
      (result.rows as { vendor_id: string }[]).map((row) => row.vendor_id),
    );
  }

  async getAverageActiveDiscountPercent(): Promise<number> {
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

  async assertCatalogueVendor(vendorId: string): Promise<{ catalogueId: string } | null> {
    const sql = `
      SELECT c.id AS catalogue_id
      FROM ${CATALOGUE_TABLE} c
      INNER JOIN vendors v ON v.id = c.vendor_id
      WHERE c.vendor_id = $1 AND (v.is_deleted IS NOT TRUE)
      LIMIT 1
    `;
    const result = await this.db.query(sql, [vendorId]);
    const row = result.rows[0] as { catalogue_id: string } | undefined;
    return row ? { catalogueId: row.catalogue_id } : null;
  }
}

export const merchantPricingRepository = new MerchantPricingRepository();

export type { QueryResult };
