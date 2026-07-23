import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import type {
  IVendorEligibilityRepository,
  VendorCandidateFilters,
  VendorCandidateRow,
  VendorEligibilitySnapshot,
  VendorExistenceResult,
} from './interfaces/IVendorEligibilityRepository';

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
  readonly pay_bill_enabled: boolean;
  readonly bank_verified: boolean;
  readonly is_deleted: boolean | null;
}

interface VendorCandidateDbRow {
  readonly id: string;
  readonly business_name: string;
  readonly city: string | null;
  readonly status: string;
  readonly pay_bill_enabled: boolean;
  readonly bank_verified: boolean;
}

interface VendorExistenceDbRow {
  readonly id: string;
  readonly is_deleted: boolean | null;
}

type CandidateFilterInput = Pick<VendorCandidateFilters, 'q' | 'status'>;

function mapSnapshot(row: VendorSnapshotDbRow): VendorEligibilitySnapshot {
  return {
    vendorId: row.id,
    businessName: row.business_name,
    ownerName: row.owner_name,
    city: row.city,
    phone: row.phone,
    vendorStatus: row.status,
    payBillEnabled: Boolean(row.pay_bill_enabled),
    bankVerified: Boolean(row.bank_verified),
    isDeleted: row.is_deleted === true,
  };
}

function mapCandidate(row: VendorCandidateDbRow): VendorCandidateRow {
  return {
    vendorId: row.id,
    businessName: row.business_name,
    city: row.city,
    status: row.status,
    payBillEnabled: Boolean(row.pay_bill_enabled),
    bankVerified: Boolean(row.bank_verified),
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

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(v.business_name ILIKE ${searchParam} OR v.city ILIKE ${searchParam} OR v.phone ILIKE ${searchParam})`,
    );
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
  };
}

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
        v.pay_bill_enabled,
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
        v.city,
        v.status,
        v.pay_bill_enabled,
        v.bank_verified
      FROM ${VENDORS_TABLE} v
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
      FROM ${VENDORS_TABLE} v
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
