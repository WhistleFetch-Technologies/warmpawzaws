/**
 * Batched price/count aggregates for discovery list cards.
 * WHERE for style + discoverable must stay aligned with list card eligibility.
 */
import {
  sqlVendorServiceDiscoverable,
  WALKER_HUB_ROLE_SQL_IN_LIST,
} from '../lib/discovery-vendor-query';

export type DiscoveryListVendorStats = {
  serviceCount: number;
  priceMin?: number;
  priceMax?: number;
};

export type DiscoveryListStatsFilter = {
  acceptableStyles: string[];
  /** Exclude at_home rows (clinic / at_center lists). */
  isAtCenter?: boolean;
  /** Sitting-style loose match (null style allowed). */
  sittingStyleLoose?: boolean;
  /** Skip enabled/publish null-enabled relaxation (sitter bypass). */
  allowNullEnabled?: boolean;
  catTextExact?: string[];
  catTextLike?: string[];
  catUUIDs?: string[];
  /** Walker hub at_home: count services for walker-role vendors even when vs.category is blank. */
  walkerHubAtHome?: boolean;
  /** Extra AND clause fragment (already spaced); uses nextParamIndex+… if needed via embed. */
  extraAndSql?: string;
};

/**
 * Shared WHERE core for list stats / row eligibility (style + discoverable + optional category).
 * Param layout when category present:
 *   $1 vendor ids (uuid[]), $2 styles (text[]), $3 cat exact, $4 cat like, $5 cat uuids
 * Without category: $1 ids, $2 styles
 */
export function buildDiscoveryListStatsWhere(filter: DiscoveryListStatsFilter): {
  whereSql: string;
  paramsTail: unknown[];
  /** Canonical fingerprint for tests (style + discoverable + category shape). */
  whereFingerprint: string;
} {
  const styleMatch =
    filter.sittingStyleLoose && !filter.isAtCenter
      ? `(vs.service_style = ANY($2::text[]) OR vs.service_style IS NULL OR TRIM(COALESCE(vs.service_style, '')) = '')`
      : `vs.service_style = ANY($2::text[])`;
  const discoverable = sqlVendorServiceDiscoverable('vs', !!filter.allowNullEnabled);
  const atCenterSql = filter.isAtCenter ? ` AND vs.service_style != 'at_home'` : '';

  const catExact = filter.catTextExact || [];
  const catLike = filter.catTextLike || [];
  const catUUIDs = filter.catUUIDs || [];
  const hasCat = catExact.length + catUUIDs.length > 0;

  const walkerHubRoleBypassOr =
    filter.walkerHubAtHome && !filter.isAtCenter
      ? ` OR EXISTS (
          SELECT 1 FROM vendors v_hub
          JOIN roles r_hub ON r_hub.id = v_hub.role_id
          WHERE v_hub.id = vs.vendor_id
            AND LOWER(COALESCE(TRIM(r_hub.name), '')) IN (${WALKER_HUB_ROLE_SQL_IN_LIST})
        )`
      : '';

  let categorySql = '';
  const paramsTail: unknown[] = [];
  if (hasCat) {
    categorySql = `
      AND (
        ${catExact.length > 0 ? `LOWER(COALESCE(vs.category,'')) = ANY($3::text[]) OR LOWER(COALESCE(vs.category,'')) LIKE ANY($4::text[])` : `FALSE`}
        ${catExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
        ${catUUIDs.length > 0 ? `COALESCE(vs.category,'') = ANY($5::text[])` : ``}
        ${walkerHubRoleBypassOr}
      )`;
    if (catExact.length > 0) {
      paramsTail.push(catExact, catLike);
      if (catUUIDs.length > 0) paramsTail.push(catUUIDs);
    } else {
      paramsTail.push([], [], catUUIDs);
    }
  }

  const extra = filter.extraAndSql ? ` ${filter.extraAndSql}` : '';
  const whereSql = `
    vs.vendor_id = ANY($1::uuid[])
    AND ${styleMatch}
    ${atCenterSql}
    ${categorySql}
    ${extra}
    AND ${discoverable}
  `;

  const whereFingerprint = [
    filter.sittingStyleLoose ? 'style:loose' : 'style:strict',
    filter.isAtCenter ? 'at_center' : 'any_style',
    filter.allowNullEnabled ? 'null_enabled' : 'strict_enabled',
    hasCat ? 'cat:yes' : 'cat:no',
    filter.walkerHubAtHome ? 'walker_hub:at_home' : 'walker_hub:no',
    discoverable,
  ].join('|');

  return { whereSql, paramsTail, whereFingerprint };
}

export function buildDiscoveryListStatsQuery(filter: DiscoveryListStatsFilter): {
  sql: string;
  buildParams: (vendorIds: string[]) => unknown[];
  whereFingerprint: string;
} {
  const { whereSql, paramsTail, whereFingerprint } = buildDiscoveryListStatsWhere(filter);
  const sql = `
    SELECT
      vs.vendor_id::text AS vendor_id,
      COUNT(*)::int AS service_count,
      MIN(COALESCE(vs.custom_price, vs.price))
        FILTER (WHERE COALESCE(vs.custom_price, vs.price) > 0) AS price_min,
      MAX(COALESCE(vs.custom_price, vs.price))
        FILTER (WHERE COALESCE(vs.custom_price, vs.price) > 0) AS price_max
    FROM vendor_services vs
    WHERE ${whereSql}
    GROUP BY vs.vendor_id
  `;
  return {
    sql,
    buildParams: (vendorIds: string[]) => [vendorIds, filter.acceptableStyles, ...paramsTail],
    whereFingerprint,
  };
}

export async function fetchDiscoveryListStatsForVendors(
  queryFn: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  vendorIds: string[],
  filter: DiscoveryListStatsFilter
): Promise<Map<string, DiscoveryListVendorStats>> {
  const out = new Map<string, DiscoveryListVendorStats>();
  const ids = [...new Set(vendorIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) return out;

  const { sql, buildParams } = buildDiscoveryListStatsQuery(filter);
  try {
    const res = await queryFn(sql, buildParams(ids));
    for (const row of res.rows || []) {
      const id = String(row.vendor_id || '');
      if (!id) continue;
      const serviceCount = parseInt(String(row.service_count ?? 0), 10) || 0;
      const priceMinRaw = row.price_min != null ? Number(row.price_min) : NaN;
      const priceMaxRaw = row.price_max != null ? Number(row.price_max) : NaN;
      out.set(id, {
        serviceCount,
        priceMin: Number.isFinite(priceMinRaw) && priceMinRaw > 0 ? priceMinRaw : undefined,
        priceMax: Number.isFinite(priceMaxRaw) && priceMaxRaw > 0 ? priceMaxRaw : undefined,
      });
    }
  } catch (err: any) {
    console.warn('[discovery-list-stats] batch failed:', err?.message || err);
  }
  return out;
}

/** Thin wrapper — prefer batch API on list endpoints. */
export async function fetchDiscoveryListStats(
  queryFn: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  vendorId: string,
  filter: DiscoveryListStatsFilter
): Promise<DiscoveryListVendorStats | null> {
  const map = await fetchDiscoveryListStatsForVendors(queryFn, [vendorId], filter);
  return map.get(String(vendorId)) || null;
}

/** Parse services list `limit` — finite int ⇒ preview mode; else unlimited. */
export function parseVendorServicesLimit(limitRaw: string | undefined | null): number | null {
  if (limitRaw == null || String(limitRaw).trim() === '') return null;
  const n = parseInt(String(limitRaw), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(1, n));
}

/** Slim row for paginated preview/profile pages. */
export function toPreviewServiceRow(row: Record<string, any>): Record<string, unknown> {
  const short =
    row.shortDescription != null
      ? String(row.shortDescription)
      : row.description != null
        ? String(row.description).length > 200
          ? String(row.description).slice(0, 200) + '…'
          : String(row.description)
        : '';
  const out: Record<string, unknown> = {
    id: row.id,
    serviceId: row.serviceId ?? row.service_id,
    name: row.name ?? row.service_name,
    price: row.price,
    duration: row.duration ?? row.durationMinutes,
    category: row.category ?? row.categoryName,
    serviceStyle: row.serviceStyle ?? row.service_style ?? null,
    isPackage: !!row.isPackage,
    shortDescription: short,
    inActivePackage: !!row.inActivePackage,
  };
  if (out.isPackage && row.packageDetails != null) {
    out.packageDetails = row.packageDetails;
  }
  if (out.inActivePackage && row.activePackagePurchaseId != null) {
    out.activePackagePurchaseId = row.activePackagePurchaseId;
  }
  return out;
}
