import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import type {
  IVendorEligibilityRepository,
  VendorCandidateFilters,
  VendorCandidateRow,
  VendorEligibilitySnapshot,
  VendorExistenceResult,
} from './interfaces/IVendorEligibilityRepository';
import {
  MERCHANT_ROLE_CATEGORY_EXPR,
  MERCHANT_SOLO_PROVIDER_EXPR,
  merchantCategoryFilterSql,
} from '../shared/merchant/merchant-role-sql';
import {
  VENDOR_APPROVED_ACTIVE_SQL,
  WPAY_VENDOR_PAY_BILL_READY_SQL,
} from '../shared/merchant/merchant-eligibility-sql';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';

const VENDORS_TABLE = 'vendors';

const NOT_DELETED_PREDICATE = '(v.is_deleted IS NOT TRUE)';

const NOT_IN_CATALOGUE_PREDICATE = `
  NOT EXISTS (
    SELECT 1
    FROM ${CATALOGUE_TABLE} c
    WHERE c.vendor_id = v.id
  )
`;

export interface VendorEligibilityDbClient {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
}

interface VendorSnapshotDbRow {
  readonly id: string;
  readonly business_name: string;
  readonly owner_name: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly status: string;
  readonly is_active: boolean | null;
  readonly bank_verified: boolean;
  readonly is_deleted: boolean | null;
}

interface VendorCandidateDbRow {
  readonly id: string;
  readonly business_name: string;
  readonly owner_name: string | null;
  readonly vendor_type: string | null;
  readonly is_solo_provider: boolean | null;
  readonly city: string | null;
  readonly status: string;
  readonly is_active: boolean | null;
  readonly bank_verified: boolean;
  readonly is_deleted: boolean | null;
  readonly legacy_category: string | null;
  readonly role_name: string | null;
  readonly role_category: string | null;
  readonly customer_service: string | null;
  readonly role_config: unknown;
}

interface VendorExistenceDbRow {
  readonly id: string;
  readonly is_deleted: boolean | null;
}

type CandidateFilterInput = Pick<
  VendorCandidateFilters,
  'q' | 'status' | 'category' | 'vendorId' | 'eligibility'
>;

function mapSnapshot(row: VendorSnapshotDbRow): VendorEligibilitySnapshot {
  return {
    vendorId: row.id,
    businessName: row.business_name,
    ownerName: row.owner_name,
    city: row.city,
    phone: row.phone,
    vendorStatus: row.status,
    isActive: row.is_active !== false,
    bankVerified: Boolean(row.bank_verified),
    isDeleted: row.is_deleted === true,
  };
}

function mapCandidate(row: VendorCandidateDbRow): VendorCandidateRow {
  return {
    vendorId: row.id,
    businessName: row.business_name,
    ownerName: row.owner_name,
    vendorType: row.vendor_type,
    roleName: row.role_name,
    isSoloProvider: row.is_solo_provider === true,
    city: row.city,
    status: row.status,
    isActive: row.is_active !== false,
    bankVerified: Boolean(row.bank_verified),
    isDeleted: row.is_deleted === true,
    legacyCategory: row.legacy_category,
    roleCategory: row.role_category,
    customerService: row.customer_service,
    roleConfig: row.role_config,
  };
}

function buildCandidateWhereClause(filters: CandidateFilterInput): {
  readonly whereSql: string;
  readonly params: unknown[];
} {
  const conditions: string[] = [NOT_DELETED_PREDICATE, NOT_IN_CATALOGUE_PREDICATE];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`v.status = $${params.length}`);
  }

  if (filters.vendorId) {
    params.push(filters.vendorId);
    conditions.push(`v.id = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(v.business_name ILIKE ${searchParam} OR v.owner_name ILIKE ${searchParam} OR v.city ILIKE ${searchParam} OR v.phone ILIKE ${searchParam})`,
    );
  }

  if (filters.eligibility === 'customer_visible') {
    conditions.push(WPAY_VENDOR_PAY_BILL_READY_SQL);
  } else if (filters.eligibility === 'not_customer_visible') {
    conditions.push(`NOT ${WPAY_VENDOR_PAY_BILL_READY_SQL}`);
  }

  if (filters.category) {
    params.push(`%${filters.category}%`);
    conditions.push(merchantCategoryFilterSql(`$${params.length}`));
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
  };
}

const CANDIDATE_FROM_JOIN = `
  FROM ${VENDORS_TABLE} v
  LEFT JOIN roles r ON r.id = v.role_id
`;

export class VendorEligibilityRepository implements IVendorEligibilityRepository {
  constructor(private readonly db: VendorEligibilityDbClient = { query }) {}

  async getSnapshot(vendorId: string): Promise<VendorEligibilitySnapshot | null> {
    const sql = `
      SELECT
        v.id,
        v.business_name,
        v.owner_name,
        v.city,
        v.phone,
        v.status,
        COALESCE(v.is_active, true) AS is_active,
        v.bank_verified,
        v.is_deleted
      FROM ${VENDORS_TABLE} v
      WHERE v.id = $1
    `;

    const result = await this.db.query(sql, [vendorId]);
    const row = result.rows[0] as VendorSnapshotDbRow | undefined;
    return row ? mapSnapshot(row) : null;
  }

  async searchCandidates(
    filters: VendorCandidateFilters,
  ): Promise<readonly VendorCandidateRow[]> {
    const { whereSql, params } = buildCandidateWhereClause(filters);
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const offset = (filters.page - 1) * filters.pageSize;

    const sql = `
      SELECT
        v.id,
        v.business_name,
        v.owner_name,
        v.vendor_type,
        ${MERCHANT_SOLO_PROVIDER_EXPR} AS is_solo_provider,
        v.city,
        v.status,
        COALESCE(v.is_active, true) AS is_active,
        v.bank_verified,
        v.is_deleted,
        v.category AS legacy_category,
        r.name AS role_name,
        ${MERCHANT_ROLE_CATEGORY_EXPR} AS role_category,
        r.customer_service,
        r.config AS role_config
      ${CANDIDATE_FROM_JOIN}
      WHERE ${whereSql}
      ORDER BY v.business_name ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const result = await this.db.query(sql, [...params, filters.pageSize, offset]);
    return (result.rows as VendorCandidateDbRow[]).map(mapCandidate);
  }

  async countCandidates(filters: VendorCandidateFilters): Promise<number> {
    const { whereSql, params } = buildCandidateWhereClause(filters);

    const sql = `
      SELECT COUNT(*)::int AS total
      ${CANDIDATE_FROM_JOIN}
      WHERE ${whereSql}
    `;

    const result = await this.db.query(sql, params);
    return Number(result.rows[0]?.total ?? 0);
  }

  async assertVendorExists(vendorId: string): Promise<VendorExistenceResult | null> {
    const sql = `
      SELECT v.id, v.is_deleted
      FROM ${VENDORS_TABLE} v
      WHERE v.id = $1
    `;

    const result = await this.db.query(sql, [vendorId]);
    const row = result.rows[0] as VendorExistenceDbRow | undefined;
    if (!row) {
      return null;
    }

    return {
      vendorId: row.id,
      isDeleted: row.is_deleted === true,
    };
  }
}

export const vendorEligibilityRepository = new VendorEligibilityRepository();

// Exported for tests / reuse
export { VENDOR_APPROVED_ACTIVE_SQL };
