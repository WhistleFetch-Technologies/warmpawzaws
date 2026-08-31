/**
 * Audience estimation and recipient resolution for notification campaigns.
 */

import { query } from '../database/rds-connection';
import { FCM_TOKEN_FRESH_EXISTS_SQL } from './device-token-hygiene';

export type TargetApp = 'CUSTOMER' | 'VENDOR';

export interface AudienceFilters {
  targeting_type?: string;
  target_app?: TargetApp;
  region_ids?: string[];
  city_names?: string[];
  user_ids?: string[];
  segment_ids?: string[];
  pet_type?: string;
  activity?: string;
  wallet_min?: number;
  loyalty_tier?: string;
  vendor_type?: string;
  vendor_status?: string;
  /** When true, only users/vendors with at least one active FCM token. */
  has_push_token?: boolean;
  /** Optional: ios | android | web */
  push_platform?: string;
}

export interface AudienceEstimateResult {
  estimatedRecipients: number;
  warnings: string[];
  sampleRecipients: Array<{ id: string; label: string }>;
}

const SEGMENT_NAME_HINTS: Record<string, Partial<AudienceFilters>> = {
  'Dog Owners': { pet_type: 'dog' },
  'Cat Owners': { pet_type: 'cat' },
  'Inactive 30 Days': { activity: 'inactive_30' },
  'Premium Members': { loyalty_tier: 'gold' },
  'Wallet Users': { wallet_min: 1 },
};

export function mergeAudienceFilters(
  base: AudienceFilters,
  extra: Partial<AudienceFilters>
): AudienceFilters {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(extra).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ),
  };
}

export async function enrichFiltersFromSegments(
  filters: AudienceFilters
): Promise<{ filters: AudienceFilters; warnings: string[] }> {
  const warnings: string[] = [];
  if (!filters.segment_ids?.length) {
    return { filters, warnings };
  }

  let merged = { ...filters };
  const segments = await query(
    `SELECT id, name FROM notification_segments WHERE id = ANY($1::uuid[]) AND is_active = true`,
    [filters.segment_ids]
  ).catch(() => ({ rows: [] }));

  for (const seg of segments.rows || []) {
    const hint = SEGMENT_NAME_HINTS[String(seg.name)];
    if (hint) merged = mergeAudienceFilters(merged, hint);
  }

  const rules = await query(
    `SELECT field_name, operator, comparison_value
     FROM notification_segment_rules
     WHERE segment_id = ANY($1::uuid[])`,
    [filters.segment_ids]
  ).catch(() => ({ rows: [] }));

  for (const rule of rules.rows || []) {
    const field = String(rule.field_name || '').toLowerCase();
    const value = String(rule.comparison_value || '');
    if (field === 'pet_type' || field === 'species') merged.pet_type = merged.pet_type || value;
    if (field === 'activity') merged.activity = merged.activity || value;
    if (field === 'wallet_min') merged.wallet_min = merged.wallet_min ?? Number(value);
    if (field === 'loyalty_tier') merged.loyalty_tier = merged.loyalty_tier || value;
    if (field === 'vendor_type') merged.vendor_type = merged.vendor_type || value;
    if (field === 'vendor_status') merged.vendor_status = merged.vendor_status || value;
  }

  if ((rules.rows || []).length === 0 && (segments.rows || []).length > 0) {
    warnings.push('Segment rules applied from segment names where configured.');
  }

  return { filters: merged, warnings };
}

interface SqlParts {
  conditions: string[];
  params: unknown[];
}

function appendPushTokenFilter(
  filters: AudienceFilters,
  conditions: string[],
  params: unknown[],
  userType: 'customer' | 'vendor',
  idColumn: string
): void {
  if (!filters.has_push_token) return;
  let platformClause = '';
  if (filters.push_platform) {
    params.push(filters.push_platform.toLowerCase());
    platformClause = ` AND dt.platform = $${params.length}`;
  }
  params.push(userType);
  // Fresh tokens only — ghosts stay is_active until register-device refreshes them.
  conditions.push(`EXISTS (
    SELECT 1 FROM device_tokens dt
    WHERE dt.user_id = ${idColumn}
      AND dt.user_type = $${params.length}
      AND ${FCM_TOKEN_FRESH_EXISTS_SQL}
      ${platformClause}
  )`);
}

function buildCustomerSqlParts(filters: AudienceFilters): SqlParts {
  const params: unknown[] = [];
  const conditions: string[] = ['c.id IS NOT NULL', 'COALESCE(c.is_active, true) = true'];
  const targetingType = (filters.targeting_type || 'BROADCAST').toUpperCase();

  if (targetingType === 'SPECIFIC_USERS' && filters.user_ids?.length) {
    params.push(filters.user_ids);
    conditions.push(`c.id = ANY($${params.length}::uuid[])`);
  } else if (targetingType === 'REGIONS' && filters.region_ids?.length) {
    params.push(filters.region_ids);
    conditions.push(`EXISTS (
      SELECT 1 FROM regions r
      WHERE r.id = ANY($${params.length}::uuid[])
        AND (
          LOWER(TRIM(COALESCE(c.state, ''))) = LOWER(r.name)
          OR LOWER(TRIM(COALESCE(c.state, ''))) = LOWER(r.code)
          OR LOWER(TRIM(COALESCE(c.city, ''))) = LOWER(r.name)
        )
    )`);
  } else if (targetingType === 'CITIES' && filters.city_names?.length) {
    params.push(filters.city_names.map((n) => n.toLowerCase().trim()));
    conditions.push(`LOWER(TRIM(COALESCE(c.city, ''))) = ANY($${params.length}::text[])`);
  }

  if (filters.pet_type) {
    params.push(filters.pet_type.toLowerCase());
    conditions.push(`EXISTS (
      SELECT 1 FROM pets p
      WHERE p.customer_id = c.id AND LOWER(p.species) = $${params.length}
    )`);
  }

  if (filters.activity === 'inactive_30') {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.customer_id = c.id AND b.created_at >= NOW() - INTERVAL '30 days'
    )`);
  } else if (filters.activity === 'inactive_60') {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.customer_id = c.id AND b.created_at >= NOW() - INTERVAL '60 days'
    )`);
  } else if (filters.activity === 'active') {
    conditions.push(`EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.customer_id = c.id AND b.created_at >= NOW() - INTERVAL '30 days'
    )`);
  }

  if (filters.wallet_min != null && filters.wallet_min > 0) {
    params.push(filters.wallet_min);
    conditions.push(`COALESCE((
      SELECT cw.balance FROM customer_wallets cw WHERE cw.customer_id = c.id LIMIT 1
    ), 0) >= $${params.length}`);
  }

  appendPushTokenFilter(filters, conditions, params, 'customer', 'c.id');

  return { conditions, params };
}

function buildVendorSqlParts(filters: AudienceFilters): SqlParts {
  const params: unknown[] = [];
  const conditions: string[] = ['v.id IS NOT NULL', 'COALESCE(v.is_active, true) = true'];
  const targetingType = (filters.targeting_type || 'BROADCAST').toUpperCase();

  if (targetingType === 'SPECIFIC_USERS' && filters.user_ids?.length) {
    params.push(filters.user_ids);
    conditions.push(`v.id = ANY($${params.length}::uuid[])`);
  } else if (targetingType === 'REGIONS' && filters.region_ids?.length) {
    params.push(filters.region_ids);
    conditions.push(`EXISTS (
      SELECT 1 FROM regions r
      WHERE r.id = ANY($${params.length}::uuid[])
        AND (
          LOWER(TRIM(COALESCE(v.state, ''))) = LOWER(r.name)
          OR LOWER(TRIM(COALESCE(v.state, ''))) = LOWER(r.code)
          OR LOWER(TRIM(COALESCE(v.city, ''))) = LOWER(r.name)
        )
    )`);
  } else if (targetingType === 'CITIES' && filters.city_names?.length) {
    params.push(filters.city_names.map((n) => n.toLowerCase().trim()));
    conditions.push(`LOWER(TRIM(COALESCE(v.city, ''))) = ANY($${params.length}::text[])`);
  }

  if (filters.vendor_type) {
    params.push(`%${filters.vendor_type.toLowerCase()}%`);
    conditions.push(`LOWER(COALESCE(v.category, '')) LIKE $${params.length}`);
  }

  if (filters.vendor_status) {
    params.push(filters.vendor_status.toLowerCase());
    conditions.push(`LOWER(COALESCE(v.status, '')) = $${params.length}`);
  }

  appendPushTokenFilter(filters, conditions, params, 'vendor', 'v.id');

  return { conditions, params };
}

export async function resolveCampaignRecipientIds(
  filters: AudienceFilters,
  maxRecipients = 5000
): Promise<string[]> {
  const targetApp = filters.target_app || 'CUSTOMER';
  const { filters: enriched } = await enrichFiltersFromSegments(filters);

  if (enriched.loyalty_tier) {
    // loyalty_members table not present in current schema — skip silently at resolve time
    delete enriched.loyalty_tier;
  }

  if (targetApp === 'CUSTOMER') {
    const { conditions, params } = buildCustomerSqlParts(enriched);
    const where = `WHERE ${conditions.join(' AND ')}`;
    params.push(maxRecipients);
    // No SELECT DISTINCT + ORDER BY non-selected columns (PostgreSQL rejects that).
    const result = await query(
      `SELECT c.id
       FROM customers c
       ${where}
       ORDER BY c.created_at DESC NULLS LAST
       LIMIT $${params.length}`,
      params
    );
    return (result.rows || []).map((r: { id: string }) => String(r.id));
  }

  const { conditions, params } = buildVendorSqlParts(enriched);
  const where = `WHERE ${conditions.join(' AND ')}`;
  params.push(maxRecipients);
  const result = await query(
    `SELECT v.id
     FROM vendors v
     ${where}
     ORDER BY v.created_at DESC NULLS LAST
     LIMIT $${params.length}`,
    params
  );
  return (result.rows || []).map((r: { id: string }) => String(r.id));
}

export async function estimateCampaignAudience(
  filters: AudienceFilters
): Promise<AudienceEstimateResult> {
  const warnings: string[] = [];
  const targetApp = filters.target_app || 'CUSTOMER';
  const { filters: enriched, warnings: segmentWarnings } = await enrichFiltersFromSegments(filters);
  warnings.push(...segmentWarnings);

  if (enriched.loyalty_tier) {
    warnings.push('Loyalty tier filter is not available until loyalty_members is deployed.');
    delete enriched.loyalty_tier;
  }

  if (enriched.has_push_token && enriched.push_platform) {
    const p = enriched.push_platform.toLowerCase();
    if (!['ios', 'android', 'web'].includes(p)) {
      warnings.push('push_platform must be ios, android, or web — filter ignored.');
      delete enriched.push_platform;
    }
  }

  const parts = targetApp === 'CUSTOMER'
    ? buildCustomerSqlParts(enriched)
    : buildVendorSqlParts(enriched);
  const where = parts.conditions.length ? `WHERE ${parts.conditions.join(' AND ')}` : '';
  const tableAlias = targetApp === 'CUSTOMER' ? 'c' : 'v';
  const table = targetApp === 'CUSTOMER' ? 'customers' : 'vendors';
  const labelExpr = targetApp === 'CUSTOMER'
    ? `COALESCE(c.full_name, c.phone, c.email, c.id::text)`
    : `COALESCE(v.business_name, v.phone, v.id::text)`;

  const countResult = await query(
    `SELECT COUNT(DISTINCT ${tableAlias}.id)::int AS count FROM ${table} ${tableAlias} ${where}`,
    parts.params
  ).catch(() => ({ rows: [{ count: 0 }] }));

  const sampleResult = await query(
    `SELECT ${tableAlias}.id, ${labelExpr} AS label
     FROM ${table} ${tableAlias}
     ${where}
     ORDER BY ${tableAlias}.created_at DESC NULLS LAST
     LIMIT 5`,
    parts.params
  ).catch(() => ({ rows: [] }));

  const estimatedRecipients = Number(countResult.rows?.[0]?.count || 0);
  if (estimatedRecipients === 0) {
    warnings.push('No recipients match selected filters.');
  }

  return {
    estimatedRecipients,
    warnings,
    sampleRecipients: (sampleResult.rows || []).map((r: { id: string; label: string }) => ({
      id: String(r.id),
      label: String(r.label || r.id),
    })),
  };
}

export function parseAudienceFilters(raw: unknown): AudienceFilters {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  return {
    pet_type: obj.pet_type ? String(obj.pet_type) : undefined,
    activity: obj.activity ? String(obj.activity) : undefined,
    wallet_min: obj.wallet_min != null ? Number(obj.wallet_min) : undefined,
    loyalty_tier: obj.loyalty_tier ? String(obj.loyalty_tier) : undefined,
    vendor_type: obj.vendor_type ? String(obj.vendor_type) : undefined,
    vendor_status: obj.vendor_status ? String(obj.vendor_status) : undefined,
    has_push_token: obj.has_push_token === true || obj.has_push_token === 'true',
    push_platform: obj.push_platform ? String(obj.push_platform) : undefined,
  };
}

export function buildAudienceFiltersPayload(body: Record<string, unknown>): AudienceFilters {
  const fromColumn = parseAudienceFilters(body.audience_filters);
  return mergeAudienceFilters(fromColumn, {
    pet_type: body.pet_type ? String(body.pet_type) : undefined,
    activity: body.activity ? String(body.activity) : undefined,
    wallet_min: body.wallet_min != null ? Number(body.wallet_min) : undefined,
    loyalty_tier: body.loyalty_tier ? String(body.loyalty_tier) : undefined,
    vendor_type: body.vendor_type ? String(body.vendor_type) : undefined,
    vendor_status: body.vendor_status ? String(body.vendor_status) : undefined,
    has_push_token:
      body.has_push_token === true ||
      body.has_push_token === 'true' ||
      body.has_push_token === 'on',
    push_platform: body.push_platform ? String(body.push_platform) : undefined,
  });
}

export function serializeAudienceFilters(filters: AudienceFilters): Record<string, unknown> {
  return {
    pet_type: filters.pet_type || null,
    activity: filters.activity || null,
    wallet_min: filters.wallet_min ?? null,
    loyalty_tier: filters.loyalty_tier || null,
    vendor_type: filters.vendor_type || null,
    vendor_status: filters.vendor_status || null,
    has_push_token: filters.has_push_token === true,
    push_platform: filters.push_platform || null,
  };
}

