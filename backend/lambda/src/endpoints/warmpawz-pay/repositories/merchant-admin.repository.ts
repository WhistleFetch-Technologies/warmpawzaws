import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import { DEFAULT_PAGE_SIZE, type MerchantSortField } from '../constants/merchant-limits';
import type { SortOrder } from '../constants/catalogue-limits';
import { PUBLISHED } from '../constants/publish-status';
import type {
  IMerchantAdminRepository,
  MerchantAdminFilters,
  MerchantAdminRow,
} from './interfaces/IMerchantAdminRepository';
import type { VendorCatalogDbClient } from './vendor-catalog.repository';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';

const MERCHANT_SELECT = `
  c.id,
  c.vendor_id,
  c.publish_status,
  c.published_at,
  c.created_at,
  c.updated_at,
  v.business_name,
  v.owner_name,
  v.city,
  v.phone,
  v.status AS vendor_status,
  v.pay_bill_enabled,
  v.bank_verified,
  v.is_deleted,
  v.is_active,
  COALESCE(v.is_online, true) AS is_online,
  v.vendor_type,
  COALESCE(v.is_solo_provider, false) AS is_solo_provider,
  v.category AS legacy_category,
  r.name AS role_name,
  r.category AS role_category,
  r.customer_service,
  r.config AS role_config
`;

const MERCHANT_FROM_JOIN = `
  FROM ${CATALOGUE_TABLE} c
  INNER JOIN vendors v ON v.id = c.vendor_id
  LEFT JOIN roles r ON r.id = v.role_id
`;

const ADMIN_BASE_WHERE = '(v.is_deleted IS NOT TRUE)';

const CUSTOMER_VISIBLE_PREDICATE = `
  (
    c.publish_status = '${PUBLISHED}'
    AND v.status IN ('approved', 'active')
    AND COALESCE(v.is_active, false) = true
    AND v.bank_verified = true
    AND v.pay_bill_enabled = true
  )
`;

const SORT_COLUMN_MAP: Readonly<Record<MerchantSortField, string>> = {
  updatedAt: 'c.updated_at',
  publishedAt: 'c.published_at',
  businessName: 'v.business_name',
  publishStatus: 'c.publish_status',
};

interface MerchantDbRow {
  readonly id: string;
  readonly vendor_id: string;
  readonly publish_status: string;
  readonly published_at: Date | string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly business_name: string;
  readonly owner_name: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendor_status: string;
  readonly pay_bill_enabled: boolean;
  readonly bank_verified: boolean;
  readonly is_deleted: boolean | null;
  readonly is_active: boolean | null;
  readonly is_online: boolean | null;
  readonly vendor_type: string | null;
  readonly is_solo_provider: boolean | null;
  readonly legacy_category: string | null;
  readonly role_name: string | null;
  readonly role_category: string | null;
  readonly customer_service: string | null;
  readonly role_config: unknown;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapMerchantRow(row: MerchantDbRow): MerchantAdminRow {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    publishStatus: row.publish_status === PUBLISHED ? PUBLISHED : 'draft',
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    businessName: row.business_name,
    ownerName: row.owner_name,
    city: row.city,
    phone: row.phone,
    vendorStatus: row.vendor_status,
    payBillEnabled: Boolean(row.pay_bill_enabled),
    bankVerified: Boolean(row.bank_verified),
    isDeleted: row.is_deleted === true,
    isActive: row.is_active !== false,
    isOnline: row.is_online !== false,
    vendorType: row.vendor_type,
    isSoloProvider: row.is_solo_provider === true,
    legacyCategory: row.legacy_category,
    roleName: row.role_name,
    roleCategory: row.role_category,
    customerService: row.customer_service,
    roleConfig: row.role_config,
  };
}

function resolveSortColumn(sortBy: MerchantSortField): string {
  return SORT_COLUMN_MAP[sortBy];
}

function resolveSortDirection(sortOrder: SortOrder): 'ASC' | 'DESC' {
  return sortOrder === 'asc' ? 'ASC' : 'DESC';
}

function buildMerchantWhereClause(filters: MerchantAdminFilters): {
  readonly whereSql: string;
  readonly params: unknown[];
} {
  const conditions: string[] = [ADMIN_BASE_WHERE];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(v.business_name ILIKE ${searchParam} OR v.owner_name ILIKE ${searchParam} OR v.city ILIKE ${searchParam} OR v.phone ILIKE ${searchParam})`,
    );
  }

  if (filters.category && filters.category !== 'all') {
    params.push(`%${filters.category}%`);
    const categoryParam = `$${params.length}`;
    conditions.push(
      `(
        r.category ILIKE ${categoryParam}
        OR r.customer_service ILIKE ${categoryParam}
        OR v.category ILIKE ${categoryParam}
        OR r.name ILIKE ${categoryParam}
      )`,
    );
  }

  if (filters.businessType && filters.businessType !== 'all') {
    if (filters.businessType === 'solo') {
      conditions.push(
        `(LOWER(COALESCE(v.vendor_type, '')) = 'solo' OR v.is_solo_provider = true OR LOWER(COALESCE(r.name, '')) LIKE '%solo%')`,
      );
    } else if (filters.businessType === 'center') {
      conditions.push(`LOWER(COALESCE(r.name, '')) LIKE '%center%'`);
    } else if (filters.businessType === 'business') {
      conditions.push(
        `(LOWER(COALESCE(v.vendor_type, '')) = 'business' AND LOWER(COALESCE(r.name, '')) NOT LIKE '%center%' AND COALESCE(v.is_solo_provider, false) = false)`,
      );
    }
  }

  if (filters.platformStatus && filters.platformStatus !== 'all') {
    switch (filters.platformStatus) {
      case 'approved':
        conditions.push(
          `(v.is_deleted IS NOT TRUE AND COALESCE(v.is_active, false) = true AND LOWER(v.status) IN ('approved', 'active'))`,
        );
        break;
      case 'pending':
        conditions.push(`(v.is_deleted IS NOT TRUE AND LOWER(v.status) = 'pending')`);
        break;
      case 'suspended':
        conditions.push(`(v.is_deleted IS NOT TRUE AND LOWER(v.status) = 'suspended')`);
        break;
      case 'inactive':
        conditions.push(
          `(v.is_deleted IS NOT TRUE AND (COALESCE(v.is_active, false) = false OR LOWER(v.status) = 'inactive'))`,
        );
        break;
      case 'deleted':
        conditions.push(`(v.is_deleted = true)`);
        break;
      default:
        break;
    }
  }

  if (filters.warmpawzPayStatus && filters.warmpawzPayStatus !== 'all') {
    if (filters.warmpawzPayStatus === 'draft') {
      conditions.push(`c.publish_status = 'draft'`);
    } else if (filters.warmpawzPayStatus === 'published') {
      conditions.push(`(c.publish_status = '${PUBLISHED}' AND ${CUSTOMER_VISIBLE_PREDICATE})`);
    } else if (filters.warmpawzPayStatus === 'hidden') {
      conditions.push(`(c.publish_status = '${PUBLISHED}' AND NOT ${CUSTOMER_VISIBLE_PREDICATE})`);
    }
  }

  if (filters.customerVisible && filters.customerVisible !== 'all') {
    if (filters.customerVisible === 'visible') {
      conditions.push(CUSTOMER_VISIBLE_PREDICATE);
    } else {
      conditions.push(`NOT ${CUSTOMER_VISIBLE_PREDICATE}`);
    }
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
  };
}

export class MerchantAdminRepository implements IMerchantAdminRepository {
  constructor(private readonly db: VendorCatalogDbClient = { query }) {}

  async listMerchants(filters: MerchantAdminFilters): Promise<readonly MerchantAdminRow[]> {
    const { whereSql, params } = buildMerchantWhereClause(filters);
    const sortColumn = resolveSortColumn(filters.sortBy);
    const sortDirection = resolveSortDirection(filters.sortOrder);
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const offset = (filters.page - 1) * filters.pageSize;

    const sql = `
      SELECT ${MERCHANT_SELECT}
      ${MERCHANT_FROM_JOIN}
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}, c.id ${sortDirection}
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const result = await this.db.query(sql, [...params, filters.pageSize, offset]);
    return (result.rows as MerchantDbRow[]).map(mapMerchantRow);
  }

  async countMerchants(filters: MerchantAdminFilters): Promise<number> {
    const { whereSql, params } = buildMerchantWhereClause(filters);
    const sql = `
      SELECT COUNT(*)::int AS total
      ${MERCHANT_FROM_JOIN}
      WHERE ${whereSql}
    `;
    const result = await this.db.query(sql, params);
    return Number(result.rows[0]?.total ?? 0);
  }
}

export const merchantAdminRepository = new MerchantAdminRepository();

export type { QueryResult };
