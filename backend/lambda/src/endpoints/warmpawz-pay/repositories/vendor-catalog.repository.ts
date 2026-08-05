import type { QueryResult } from 'pg';
import { query } from '../../../database/rds-connection';
import { DEFAULT_PAGE_SIZE, type CatalogueSortField } from '../constants/catalogue-limits';
import { DRAFT, PUBLISHED, type PublishStatus } from '../constants/publish-status';
import { CatalogueErrorCode } from '../admin/catalogue/dto/catalogue.errors';
import type {
  CatalogueAdminFilters,
  CatalogueAdminListRow,
  CatalogueRow,
  CatalogueRowWithVendor,
  IVendorCatalogRepository,
  PublishedEligibleFilters,
  PublishedVendorRow,
  UpdatePublishStatusParams,
} from './interfaces/IVendorCatalogRepository';
import { toOptionalAdminActorUuid } from '../admin/catalogue/utils/admin-actor-id';
import {
  MERCHANT_ROLE_CATEGORY_EXPR,
  MERCHANT_SOLO_PROVIDER_EXPR,
  merchantServiceCategoryFilterSql,
} from '../shared/merchant/merchant-role-sql';
import { expandServiceCategoryFilterTokens } from '../shared/merchant/merchant-service-category.resolver';
import { wpayCatalogueCustomerVisibleSql, VENDOR_APPROVED_ACTIVE_SQL } from '../shared/merchant/merchant-eligibility-sql';
import { resolveMerchantDisplayName } from '../shared/merchant/merchant-display-name.resolver';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';
const PRICING_TABLE = 'warmpawz_pay_merchant_pricing';

const CATALOGUE_COLUMNS =
  'id, vendor_id, publish_status, published_at, created_by, created_at, updated_at';

const CATALOGUE_SELECT = `
  c.id,
  c.vendor_id,
  c.publish_status,
  c.published_at,
  c.created_by,
  c.created_at,
  c.updated_at
`;

const VENDOR_JOIN_SELECT = `
  v.business_name,
  v.owner_name,
  v.city,
  v.phone,
  v.status AS vendor_status,
  v.bank_verified,
  v.is_deleted,
  COALESCE(v.is_active, false) AS is_active,
  COALESCE(v.is_online, true) AS is_online,
  v.vendor_type,
  ${MERCHANT_SOLO_PROVIDER_EXPR} AS is_solo_provider,
  v.category AS legacy_category,
  r.name AS role_name,
  r.display_name AS role_display_name,
  ${MERCHANT_ROLE_CATEGORY_EXPR} AS role_category,
  r.customer_service,
  r.config AS role_config,
  p.id AS pricing_id,
  p.discount_type AS pricing_discount_type,
  p.discount_value AS pricing_discount_value,
  p.platform_withhold_percent AS pricing_platform_withhold_percent,
  p.status AS pricing_status,
  p.effective_from AS pricing_effective_from,
  p.effective_until AS pricing_effective_until
`;

const ADMIN_LIST_SELECT = `
  c.id,
  v.id AS vendor_id,
  c.publish_status,
  c.published_at,
  c.created_by,
  c.created_at,
  c.updated_at,
  v.updated_at AS vendor_updated_at,
  v.business_name,
  v.owner_name,
  v.city,
  v.phone,
  v.status AS vendor_status,
  v.bank_verified,
  v.is_deleted,
  COALESCE(v.is_active, false) AS is_active,
  COALESCE(v.is_online, true) AS is_online,
  v.vendor_type,
  ${MERCHANT_SOLO_PROVIDER_EXPR} AS is_solo_provider,
  v.category AS legacy_category,
  r.name AS role_name,
  r.display_name AS role_display_name,
  ${MERCHANT_ROLE_CATEGORY_EXPR} AS role_category,
  r.customer_service,
  r.config AS role_config,
  p.id AS pricing_id,
  p.discount_type AS pricing_discount_type,
  p.discount_value AS pricing_discount_value,
  p.platform_withhold_percent AS pricing_platform_withhold_percent,
  p.status AS pricing_status,
  p.effective_from AS pricing_effective_from,
  p.effective_until AS pricing_effective_until
`;

const CATALOGUE_DETAIL_FROM_JOIN = `
  FROM ${CATALOGUE_TABLE} c
  INNER JOIN vendors v ON v.id = c.vendor_id
  LEFT JOIN roles r ON r.id = v.role_id
  LEFT JOIN ${PRICING_TABLE} p ON p.vendor_id = c.vendor_id
`;

const ADMIN_LIST_FROM_JOIN = `
  FROM vendors v
  LEFT JOIN ${CATALOGUE_TABLE} c ON c.vendor_id = v.id
  LEFT JOIN roles r ON r.id = v.role_id
  LEFT JOIN ${PRICING_TABLE} p ON p.vendor_id = v.id
`;

const ADMIN_LIST_BASE_WHERE = VENDOR_APPROVED_ACTIVE_SQL.trim();

const CUSTOMER_VISIBLE_PREDICATE = wpayCatalogueCustomerVisibleSql('c');

const SORT_COLUMN_MAP: Readonly<Record<CatalogueSortField, string>> = {
  updatedAt: 'COALESCE(c.updated_at, v.updated_at)',
  publishedAt: 'c.published_at',
  businessName: 'v.business_name',
  publishStatus: 'c.publish_status',
};

const DEFAULT_PUBLISHED_ELIGIBLE_LIMIT = DEFAULT_PAGE_SIZE;

export interface VendorCatalogDbClient {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
}

export class CatalogueRepositoryError extends Error {
  readonly code: CatalogueErrorCode;

  constructor(code: CatalogueErrorCode, message: string) {
    super(message);
    this.name = 'CatalogueRepositoryError';
    this.code = code;
  }
}

interface CatalogueDbRow {
  readonly id: string;
  readonly vendor_id: string;
  readonly publish_status: string;
  readonly published_at: Date | string | null;
  readonly created_by: string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

interface AdminListDbRow {
  readonly id: string | null;
  readonly vendor_id: string;
  readonly publish_status: string | null;
  readonly published_at: Date | string | null;
  readonly created_by: string | null;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
  readonly vendor_updated_at: Date | string;
  readonly business_name: string;
  readonly owner_name: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendor_status: string;
  readonly bank_verified: boolean;
  readonly is_deleted: boolean | null;
  readonly is_active: boolean | null;
  readonly is_online: boolean | null;
  readonly vendor_type: string | null;
  readonly is_solo_provider: boolean | null;
  readonly legacy_category: string | null;
  readonly role_name: string | null;
  readonly role_display_name: string | null;
  readonly role_category: string | null;
  readonly customer_service: string | null;
  readonly role_config: unknown;
  readonly pricing_id: string | null;
  readonly pricing_discount_type: string | null;
  readonly pricing_discount_value: string | number | null;
  readonly pricing_platform_withhold_percent: string | number | null;
  readonly pricing_status: string | null;
  readonly pricing_effective_from: Date | string | null;
  readonly pricing_effective_until: Date | string | null;
}

interface CatalogueWithVendorDbRow extends CatalogueDbRow {
  readonly business_name: string;
  readonly owner_name: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly vendor_status: string;
  readonly bank_verified: boolean;
  readonly is_deleted: boolean | null;
  readonly is_active: boolean | null;
  readonly is_online: boolean | null;
  readonly vendor_type: string | null;
  readonly is_solo_provider: boolean | null;
  readonly legacy_category: string | null;
  readonly role_name: string | null;
  readonly role_display_name: string | null;
  readonly role_category: string | null;
  readonly customer_service: string | null;
  readonly role_config: unknown;
  readonly pricing_id: string | null;
  readonly pricing_discount_type: string | null;
  readonly pricing_discount_value: string | number | null;
  readonly pricing_platform_withhold_percent: string | number | null;
  readonly pricing_status: string | null;
  readonly pricing_effective_from: Date | string | null;
  readonly pricing_effective_until: Date | string | null;
}

interface PublishedVendorDbRow {
  readonly catalogue_id: string;
  readonly vendor_id: string;
  readonly business_name: string;
  readonly city: string | null;
  readonly phone: string | null;
  readonly published_at: Date | string | null;
}

interface PublishedEligibleCursor {
  readonly businessName: string;
  readonly catalogueId: string;
}

type AdminFilterInput = Pick<
  CatalogueAdminFilters,
  'publishStatus' | 'q' | 'city' | 'vendorId' | 'eligibility' | 'serviceCategory' | 'category'
>;

function toOptionalNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'number' ? value : Number(value);
}

function isPgError(error: unknown): error is { code?: string; message?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function rethrowMappedPgError(error: unknown): never {
  if (isPgError(error)) {
    if (error.code === '23505') {
      throw new CatalogueRepositoryError(
        CatalogueErrorCode.DUPLICATE_CATALOGUE_ENTRY,
        'A catalogue entry already exists for this vendor',
      );
    }
    if (error.code === '23503') {
      throw new CatalogueRepositoryError(
        CatalogueErrorCode.VENDOR_NOT_FOUND,
        'Vendor not found',
      );
    }
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error('Unexpected database error');
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function asPublishStatus(value: string): PublishStatus {
  return value === PUBLISHED ? PUBLISHED : DRAFT;
}

function mapCatalogueRow(row: CatalogueDbRow): CatalogueRow {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    publishStatus: asPublishStatus(row.publish_status),
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapAdminListRow(row: AdminListDbRow): CatalogueAdminListRow {
  const isSoloProvider = row.is_solo_provider === true;
  const inCatalogue = row.id !== null && row.publish_status !== null;
  return {
    inCatalogue,
    id: row.id,
    vendorId: row.vendor_id,
    publishStatus: row.publish_status ? asPublishStatus(row.publish_status) : null,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    createdBy: row.created_by,
    createdAt: row.created_at ? toDate(row.created_at) : null,
    updatedAt: row.updated_at ? toDate(row.updated_at) : null,
    vendorUpdatedAt: toDate(row.vendor_updated_at),
    businessName: resolveMerchantDisplayName({
      businessName: row.business_name,
      ownerName: row.owner_name,
      vendorType: row.vendor_type,
      isSoloProvider,
      roleName: row.role_name,
    }),
    ownerName: row.owner_name,
    city: row.city,
    phone: row.phone,
    vendorStatus: row.vendor_status,
    bankVerified: Boolean(row.bank_verified),
    isDeleted: row.is_deleted === true,
    isActive: row.is_active !== false,
    isOnline: row.is_online !== false,
    vendorType: row.vendor_type,
    isSoloProvider,
    legacyCategory: row.legacy_category,
    roleName: row.role_name,
    roleDisplayName: row.role_display_name,
    roleCategory: row.role_category,
    customerService: row.customer_service,
    roleConfig: row.role_config,
    pricingId: row.pricing_id,
    pricingDiscountType: row.pricing_discount_type,
    pricingDiscountValue: toOptionalNumber(row.pricing_discount_value),
    pricingPlatformWithholdPercent: toOptionalNumber(row.pricing_platform_withhold_percent),
    pricingStatus: row.pricing_status,
    pricingEffectiveFrom: row.pricing_effective_from
      ? toDate(row.pricing_effective_from)
      : null,
    pricingEffectiveUntil: row.pricing_effective_until
      ? toDate(row.pricing_effective_until)
      : null,
  };
}

function mapCatalogueRowWithVendor(row: CatalogueWithVendorDbRow): CatalogueRowWithVendor {
  const isSoloProvider = row.is_solo_provider === true;
  return {
    ...mapCatalogueRow(row),
    businessName: resolveMerchantDisplayName({
      businessName: row.business_name,
      ownerName: row.owner_name,
      vendorType: row.vendor_type,
      isSoloProvider,
      roleName: row.role_name,
    }),
    ownerName: row.owner_name,
    city: row.city,
    phone: row.phone,
    vendorStatus: row.vendor_status,
    bankVerified: Boolean(row.bank_verified),
    isDeleted: row.is_deleted === true,
    isActive: row.is_active !== false,
    isOnline: row.is_online !== false,
    vendorType: row.vendor_type,
    isSoloProvider,
    legacyCategory: row.legacy_category,
    roleName: row.role_name,
    roleDisplayName: row.role_display_name,
    roleCategory: row.role_category,
    customerService: row.customer_service,
    roleConfig: row.role_config,
    pricingId: row.pricing_id,
    pricingDiscountType: row.pricing_discount_type,
    pricingDiscountValue: toOptionalNumber(row.pricing_discount_value),
    pricingPlatformWithholdPercent: toOptionalNumber(row.pricing_platform_withhold_percent),
    pricingStatus: row.pricing_status,
    pricingEffectiveFrom: row.pricing_effective_from
      ? toDate(row.pricing_effective_from)
      : null,
    pricingEffectiveUntil: row.pricing_effective_until
      ? toDate(row.pricing_effective_until)
      : null,
  };
}

function mapPublishedVendorRow(row: PublishedVendorDbRow): PublishedVendorRow {
  return {
    catalogueId: row.catalogue_id,
    vendorId: row.vendor_id,
    businessName: row.business_name,
    city: row.city,
    phone: row.phone,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
  };
}

function resolveSortColumn(sortBy: CatalogueSortField): string {
  return SORT_COLUMN_MAP[sortBy];
}

function resolveSortDirection(sortOrder: CatalogueAdminFilters['sortOrder']): 'ASC' | 'DESC' {
  return sortOrder === 'asc' ? 'ASC' : 'DESC';
}

function decodePublishedEligibleCursor(cursor: string): PublishedEligibleCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<PublishedEligibleCursor>;
    if (
      typeof parsed.businessName === 'string' &&
      typeof parsed.catalogueId === 'string' &&
      parsed.catalogueId.length > 0
    ) {
      return {
        businessName: parsed.businessName,
        catalogueId: parsed.catalogueId,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function buildAdminWhereClause(filters: AdminFilterInput): {
  readonly whereSql: string;
  readonly params: unknown[];
} {
  const conditions: string[] = [ADMIN_LIST_BASE_WHERE];
  const params: unknown[] = [];

  if (filters.publishStatus && filters.publishStatus !== 'all') {
    if (filters.publishStatus === 'not_in_catalogue') {
      conditions.push('c.id IS NULL');
    } else {
      params.push(filters.publishStatus);
      conditions.push(`c.publish_status = $${params.length}`);
    }
  }

  if (filters.vendorId) {
    params.push(filters.vendorId);
    conditions.push(`v.id = $${params.length}`);
  }

  if (filters.city) {
    params.push(`%${filters.city}%`);
    conditions.push(`v.city ILIKE $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const searchParam = `$${params.length}`;
    conditions.push(
      `(v.business_name ILIKE ${searchParam} OR v.owner_name ILIKE ${searchParam} OR v.city ILIKE ${searchParam} OR v.phone ILIKE ${searchParam})`,
    );
  }

  if (filters.eligibility === 'customer_visible') {
    conditions.push(CUSTOMER_VISIBLE_PREDICATE);
  } else if (filters.eligibility === 'not_customer_visible') {
    conditions.push(`NOT ${CUSTOMER_VISIBLE_PREDICATE}`);
  }

  const serviceCategory = filters.serviceCategory ?? filters.category;
  if (serviceCategory) {
    const tokens = expandServiceCategoryFilterTokens(serviceCategory);
    if (tokens.length > 0) {
      params.push(tokens);
      conditions.push(merchantServiceCategoryFilterSql(`$${params.length}`));
    }
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
  };
}

export class VendorCatalogRepository implements IVendorCatalogRepository {
  constructor(private readonly db: VendorCatalogDbClient = { query }) {}

  async insertDraft(vendorId: string, createdBy: string | null): Promise<CatalogueRow> {
    const sql = `
      INSERT INTO ${CATALOGUE_TABLE} (
        vendor_id,
        publish_status,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING ${CATALOGUE_COLUMNS}
    `;

    try {
      const result = await this.db.query(sql, [vendorId, DRAFT, toOptionalAdminActorUuid(createdBy)]);
      const row = result.rows[0] as CatalogueDbRow | undefined;
      if (!row) {
        throw new Error('Insert did not return a catalogue row');
      }
      return mapCatalogueRow(row);
    } catch (error) {
      rethrowMappedPgError(error);
    }
  }

  async updatePublishStatus(params: UpdatePublishStatusParams): Promise<CatalogueRow | null> {
    const sql = `
      UPDATE ${CATALOGUE_TABLE}
      SET
        publish_status = $2,
        published_at = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${CATALOGUE_COLUMNS}
    `;

    const result = await this.db.query(sql, [
      params.catalogueId,
      params.publishStatus,
      params.publishedAt,
    ]);

    const row = result.rows[0] as CatalogueDbRow | undefined;
    return row ? mapCatalogueRow(row) : null;
  }

  async deleteById(catalogueId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ${CATALOGUE_TABLE} WHERE id = $1`,
      [catalogueId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findById(catalogueId: string): Promise<CatalogueRowWithVendor | null> {
    const sql = `
      SELECT
        ${CATALOGUE_SELECT},
        ${VENDOR_JOIN_SELECT}
      ${CATALOGUE_DETAIL_FROM_JOIN}
      WHERE c.id = $1 AND (v.is_deleted IS NOT TRUE)
    `;

    const result = await this.db.query(sql, [catalogueId]);
    const row = result.rows[0] as CatalogueWithVendorDbRow | undefined;
    return row ? mapCatalogueRowWithVendor(row) : null;
  }

  async findByVendorId(vendorId: string): Promise<CatalogueRow | null> {
    const sql = `
      SELECT
        id,
        vendor_id,
        publish_status,
        published_at,
        created_by,
        created_at,
        updated_at
      FROM ${CATALOGUE_TABLE}
      WHERE vendor_id = $1
    `;

    const result = await this.db.query(sql, [vendorId]);
    const row = result.rows[0] as CatalogueDbRow | undefined;
    return row ? mapCatalogueRow(row) : null;
  }

  async existsForVendor(vendorId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT EXISTS(
         SELECT 1
         FROM ${CATALOGUE_TABLE}
         WHERE vendor_id = $1
       ) AS exists`,
      [vendorId],
    );

    return Boolean(result.rows[0]?.exists);
  }

  async listAdmin(filters: CatalogueAdminFilters): Promise<readonly CatalogueAdminListRow[]> {
    const { whereSql, params } = buildAdminWhereClause(filters);
    const sortColumn = resolveSortColumn(filters.sortBy);
    const sortDirection = resolveSortDirection(filters.sortOrder);
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const offset = (filters.page - 1) * filters.pageSize;

    const sql = `
      SELECT
        ${ADMIN_LIST_SELECT}
      ${ADMIN_LIST_FROM_JOIN}
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, v.id ${sortDirection}
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const result = await this.db.query(sql, [...params, filters.pageSize, offset]);
    return (result.rows as AdminListDbRow[]).map(mapAdminListRow);
  }

  async countAdmin(filters: CatalogueAdminFilters): Promise<number> {
    const { whereSql, params } = buildAdminWhereClause(filters);

    const sql = `
      SELECT COUNT(*)::int AS total
      ${ADMIN_LIST_FROM_JOIN}
      WHERE ${whereSql}
    `;

    const result = await this.db.query(sql, params);
    return Number(result.rows[0]?.total ?? 0);
  }

  async listPublishedEligible(
    filters: PublishedEligibleFilters,
  ): Promise<readonly PublishedVendorRow[]> {
    const conditions: string[] = [
      '(v.is_deleted IS NOT TRUE)',
      wpayCatalogueCustomerVisibleSql('c'),
    ];
    const params: unknown[] = [];

    if (filters.city) {
      params.push(`%${filters.city}%`);
      conditions.push(`v.city ILIKE $${params.length}`);
    }

    if (filters.q) {
      params.push(`%${filters.q}%`);
      const searchParam = `$${params.length}`;
      conditions.push(
        `(v.business_name ILIKE ${searchParam} OR v.owner_name ILIKE ${searchParam} OR v.city ILIKE ${searchParam} OR v.phone ILIKE ${searchParam})`,
      );
    }

    if (filters.cursor) {
      const decodedCursor = decodePublishedEligibleCursor(filters.cursor);
      if (decodedCursor) {
        params.push(decodedCursor.businessName, decodedCursor.catalogueId);
        conditions.push(
          `(v.business_name, c.id) > ($${params.length - 1}, $${params.length})`,
        );
      }
    }

    const limit = filters.limit ?? DEFAULT_PUBLISHED_ELIGIBLE_LIMIT;
    params.push(limit);
    const limitParam = params.length;

    const sql = `
      SELECT
        c.id AS catalogue_id,
        c.vendor_id,
        v.business_name,
        v.city,
        v.phone,
        c.published_at
      ${CATALOGUE_DETAIL_FROM_JOIN}
      WHERE ${conditions.join(' AND ')}
      ORDER BY v.business_name ASC, c.id ASC
      LIMIT $${limitParam}
    `;

    const result = await this.db.query(sql, params);
    return (result.rows as PublishedVendorDbRow[]).map(mapPublishedVendorRow);
  }
}

export const vendorCatalogRepository = new VendorCatalogRepository();
