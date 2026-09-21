import { query, select, insert, update } from '../../../database/rds-connection';
import { expandPromoCategoryAliases } from '../dsl/category-aliases';
import type {
  PromoEngineLimitsRow,
  PromoEnginePromotionRow,
  PromoEngineRuleRow,
  PromoEngineStatus,
  PromoEngineBenefit,
  PromoEngineConditionGroup,
  PromoRuleType,
  StackingPolicy,
  PromoFundingType,
} from '../types';

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function parseJsonObject(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function mapPromotion(row: Record<string, unknown>): PromoEnginePromotionRow {
  return {
    id: String(row.id),
    code: row.code != null ? String(row.code) : null,
    name: String(row.name),
    status: row.status as PromoEngineStatus,
    priority: Number(row.priority ?? 50),
    start_at: row.start_at ? new Date(row.start_at as string).toISOString() : null,
    end_at: row.end_at ? new Date(row.end_at as string).toISOString() : null,
    stacking_policy: (row.stacking_policy as StackingPolicy) || null,
    funding_type: (row.funding_type as PromoFundingType) || null,
    funding_split: parseJsonObject(row.funding_split),
    budget_limit: row.budget_limit != null ? Number(row.budget_limit) : null,
    budget_consumed: Number(row.budget_consumed ?? 0),
    commercial_campaign_id: row.commercial_campaign_id
      ? String(row.commercial_campaign_id)
      : null,
    service_categories: asStringArray(row.service_categories),
    metadata: parseJsonObject(row.metadata),
    created_at: new Date(row.created_at as string).toISOString(),
    updated_at: new Date(row.updated_at as string).toISOString(),
  };
}

function mapRule(row: Record<string, unknown>): PromoEngineRuleRow {
  const benefitRaw = row.benefit_json;
  const benefits = Array.isArray(benefitRaw)
    ? (benefitRaw as PromoEngineBenefit[])
    : typeof benefitRaw === 'string'
      ? (JSON.parse(benefitRaw) as PromoEngineBenefit[])
      : [];
  const conditionRaw = row.condition_json;
  const conditions =
    typeof conditionRaw === 'string'
      ? (JSON.parse(conditionRaw) as PromoEngineConditionGroup)
      : (conditionRaw as PromoEngineConditionGroup);

  return {
    id: String(row.id),
    promotion_id: String(row.promotion_id),
    priority: Number(row.priority ?? 100),
    condition_json: conditions,
    benefit_json: benefits,
    rule_type: (row.rule_type as PromoRuleType) || 'GENERIC',
    is_active: row.is_active !== false,
  };
}

export async function dbListPromotions(filters?: {
  status?: string;
  service?: string;
  q?: string;
}): Promise<PromoEnginePromotionRow[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (filters?.status && filters.status !== 'ALL') {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }
  if (filters?.service) {
    params.push(filters.service);
    where.push(`$${params.length} = ANY(service_categories)`);
  }
  if (filters?.q) {
    params.push(`%${filters.q}%`);
    where.push(`(name ILIKE $${params.length} OR COALESCE(code, '') ILIKE $${params.length})`);
  }
  const sql = `
    SELECT * FROM promo_engine_promotions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC
    LIMIT 200`;
  const res = await query(sql, params);
  return (res.rows || []).map((r) => mapPromotion(r as Record<string, unknown>));
}

export async function dbGetPromotion(id: string): Promise<PromoEnginePromotionRow | null> {
  const rows = await select('promo_engine_promotions', { id });
  if (!rows.length) return null;
  return mapPromotion(rows[0] as Record<string, unknown>);
}

export async function dbCreatePromotion(input: {
  name: string;
  code?: string | null;
  status?: PromoEngineStatus;
  priority?: number;
  start_at?: string | null;
  end_at?: string | null;
  stacking_policy?: StackingPolicy | null;
  funding_type?: PromoFundingType | null;
  funding_split?: Record<string, unknown> | null;
  budget_limit?: number | null;
  commercial_campaign_id?: string | null;
  service_categories?: string[];
  metadata?: Record<string, unknown>;
}): Promise<PromoEnginePromotionRow> {
  const rows = await insert('promo_engine_promotions', {
    name: input.name,
    code: input.code || null,
    status: input.status || 'DRAFT',
    priority: input.priority ?? 50,
    start_at: input.start_at || null,
    end_at: input.end_at || null,
    stacking_policy: input.stacking_policy || null,
    funding_type: input.funding_type || null,
    funding_split: input.funding_split ? JSON.stringify(input.funding_split) : null,
    budget_limit: input.budget_limit ?? null,
    commercial_campaign_id: input.commercial_campaign_id || null,
    service_categories: input.service_categories || [],
    metadata: JSON.stringify(input.metadata || {}),
  });
  return mapPromotion(rows[0] as Record<string, unknown>);
}

export async function dbUpdatePromotion(
  id: string,
  patch: Record<string, unknown>
): Promise<PromoEnginePromotionRow | null> {
  const data: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'funding_split' || k === 'metadata') {
      data[k] = typeof v === 'string' ? v : JSON.stringify(v ?? {});
    } else {
      data[k] = v;
    }
  }
  const rows = await update('promo_engine_promotions', { id }, data);
  if (!rows.length) return null;
  return mapPromotion(rows[0] as Record<string, unknown>);
}

export async function dbListRules(promotionId: string): Promise<PromoEngineRuleRow[]> {
  const res = await query(
    `SELECT * FROM promo_engine_rules WHERE promotion_id = $1 ORDER BY priority ASC`,
    [promotionId]
  );
  return (res.rows || []).map((r) => mapRule(r as Record<string, unknown>));
}

export async function dbUpsertPrimaryRule(opts: {
  promotionId: string;
  condition_json: PromoEngineConditionGroup;
  benefit_json: PromoEngineBenefit[];
  rule_type?: PromoRuleType;
  priority?: number;
}): Promise<PromoEngineRuleRow> {
  const existing = await dbListRules(opts.promotionId);
  if (existing.length) {
    const id = existing[0].id;
    const rows = await update(
      'promo_engine_rules',
      { id },
      {
        condition_json: JSON.stringify(opts.condition_json),
        benefit_json: JSON.stringify(opts.benefit_json),
        rule_type: opts.rule_type || existing[0].rule_type,
        priority: opts.priority ?? existing[0].priority,
        updated_at: new Date().toISOString(),
      },
    );
    return mapRule(rows[0] as Record<string, unknown>);
  }
  const rows = await insert('promo_engine_rules', {
    promotion_id: opts.promotionId,
    condition_json: JSON.stringify(opts.condition_json),
    benefit_json: JSON.stringify(opts.benefit_json),
    rule_type: opts.rule_type || 'GENERIC',
    priority: opts.priority ?? 100,
    is_active: true,
  });
  return mapRule(rows[0] as Record<string, unknown>);
}

export async function dbGetLimits(promotionId: string): Promise<PromoEngineLimitsRow | null> {
  const rows = await select('promo_engine_limits', { promotion_id: promotionId });
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    promotion_id: String(r.promotion_id),
    per_user: r.per_user != null ? Number(r.per_user) : null,
    per_transaction: r.per_transaction != null ? Number(r.per_transaction) : null,
    daily_limit: r.daily_limit != null ? Number(r.daily_limit) : null,
    campaign_limit: r.campaign_limit != null ? Number(r.campaign_limit) : null,
    budget_limit: r.budget_limit != null ? Number(r.budget_limit) : null,
  };
}

export async function dbUpsertLimits(
  promotionId: string,
  limits: Partial<PromoEngineLimitsRow>
): Promise<void> {
  const existing = await dbGetLimits(promotionId);
  if (existing) {
    await update(
      'promo_engine_limits',
      { promotion_id: promotionId },
      {
        per_user: limits.per_user ?? existing.per_user,
        per_transaction: limits.per_transaction ?? existing.per_transaction,
        daily_limit: limits.daily_limit ?? existing.daily_limit,
        campaign_limit: limits.campaign_limit ?? existing.campaign_limit,
        budget_limit: limits.budget_limit ?? existing.budget_limit,
        updated_at: new Date().toISOString(),
      },
    );
    return;
  }
  await insert('promo_engine_limits', {
    promotion_id: promotionId,
    per_user: limits.per_user ?? null,
    per_transaction: limits.per_transaction ?? null,
    daily_limit: limits.daily_limit ?? null,
    campaign_limit: limits.campaign_limit ?? null,
    budget_limit: limits.budget_limit ?? null,
  });
}

export async function dbFindActiveCandidates(opts: {
  now: Date;
  serviceCategory?: string;
  vendorId?: string;
  categoryId?: string;
}): Promise<PromoEnginePromotionRow[]> {
  const params: unknown[] = [opts.now.toISOString()];
  let legacyServiceMatch = 'TRUE';
  if (opts.serviceCategory) {
    const aliases = expandPromoCategoryAliases(opts.serviceCategory);
    params.push(aliases.length ? aliases : [opts.serviceCategory]);
    legacyServiceMatch = `(
      service_categories = '{}'
      OR EXISTS (
        SELECT 1 FROM unnest(service_categories) AS cat
        WHERE lower(trim(cat)) = ANY(
          SELECT lower(trim(a)) FROM unnest($${params.length}::text[]) AS a
        )
      )
    )`;
  }
  params.push(opts.vendorId ? String(opts.vendorId) : null);
  const vendorParam = params.length;
  params.push(opts.categoryId ? String(opts.categoryId) : null);
  const categoryParam = params.length;

  const res = await query(
    `SELECT * FROM promo_engine_promotions
     WHERE status = 'ACTIVE'
       AND (start_at IS NULL OR start_at <= $1::timestamptz)
       AND (end_at IS NULL OR end_at >= $1::timestamptz)
       AND (
         (
           (
             metadata->'vcf' IS NULL
             OR jsonb_typeof(metadata->'vcf') = 'null'
             OR COALESCE(metadata->'vcf'->'publish'->>'letter', '') = ''
           )
           AND ${legacyServiceMatch}
         )
         OR (
           metadata->'vcf'->'publish'->>'letter' = 'F'
           OR (
             metadata->'vcf'->'publish'->>'letter' = 'V'
             AND $${vendorParam}::text IS NOT NULL
             AND metadata->'vcf'->'publish'->>'vendorId' = $${vendorParam}::text
           )
           OR (
             metadata->'vcf'->'publish'->>'letter' = 'C'
             AND $${categoryParam}::text IS NOT NULL
             AND metadata->'vcf'->'publish'->>'categoryId' = $${categoryParam}::text
           )
         )
       )
     ORDER BY priority DESC`,
    params
  );
  return (res.rows || []).map((r) => mapPromotion(r as Record<string, unknown>));
}

export async function dbLoadServiceCategories(): Promise<
  Array<{ id: string; vendor_roles: unknown }>
> {
  const res = await query(
    `SELECT id::text AS id, vendor_roles
     FROM service_categories
     WHERE COALESCE(is_active, true) = true`,
    []
  );
  return (res.rows || []).map((r) => ({
    id: String((r as { id: string }).id),
    vendor_roles: (r as { vendor_roles: unknown }).vendor_roles,
  }));
}

export async function dbLoadVendorRole(
  vendorId: string
): Promise<{ roleId: string | null; roleName: string | null } | null> {
  if (!vendorId) return null;
  const res = await query(
    `SELECT v.role_id::text AS role_id, r.name AS role_name
     FROM vendors v
     LEFT JOIN roles r ON r.id = v.role_id
     WHERE v.id::text = $1 AND (v.is_deleted IS NOT TRUE)
     LIMIT 1`,
    [vendorId]
  );
  const row = res.rows?.[0] as { role_id?: string; role_name?: string } | undefined;
  if (!row) return null;
  return {
    roleId: row.role_id ? String(row.role_id) : null,
    roleName: row.role_name ? String(row.role_name) : null,
  };
}

export async function dbListRulesForPromotions(
  promotionIds: string[],
): Promise<Map<string, PromoEngineRuleRow[]>> {
  const map = new Map<string, PromoEngineRuleRow[]>();
  if (!promotionIds.length) return map;
  const res = await query(
    `SELECT * FROM promo_engine_rules
     WHERE promotion_id = ANY($1::uuid[])
     ORDER BY priority ASC`,
    [promotionIds],
  );
  for (const raw of res.rows || []) {
    const row = mapRule(raw as Record<string, unknown>);
    const list = map.get(row.promotion_id) || [];
    list.push(row);
    map.set(row.promotion_id, list);
  }
  return map;
}

export async function dbGetLimitsForPromotions(
  promotionIds: string[],
): Promise<Map<string, PromoEngineLimitsRow>> {
  const map = new Map<string, PromoEngineLimitsRow>();
  if (!promotionIds.length) return map;
  const res = await query(
    `SELECT * FROM promo_engine_limits WHERE promotion_id = ANY($1::uuid[])`,
    [promotionIds],
  );
  for (const raw of res.rows || []) {
    const r = raw as Record<string, unknown>;
    const id = String(r.promotion_id);
    map.set(id, {
      promotion_id: id,
      per_user: r.per_user != null ? Number(r.per_user) : null,
      per_transaction: r.per_transaction != null ? Number(r.per_transaction) : null,
      daily_limit: r.daily_limit != null ? Number(r.daily_limit) : null,
      campaign_limit: r.campaign_limit != null ? Number(r.campaign_limit) : null,
      budget_limit: r.budget_limit != null ? Number(r.budget_limit) : null,
    });
  }
  return map;
}

export type PromoUsageCounts = {
  user: number;
  campaign: number;
  daily: number;
};

export async function dbCountUsageBatch(opts: {
  promotionIds: string[];
  userId: string;
  since?: Date;
}): Promise<Map<string, PromoUsageCounts>> {
  const map = new Map<string, PromoUsageCounts>();
  if (!opts.promotionIds.length) return map;
  const params: unknown[] = [opts.promotionIds, opts.userId];
  const dailyExpr = opts.since
    ? (params.push(opts.since.toISOString()),
      'COUNT(*) FILTER (WHERE created_at >= $3::timestamptz)::int')
    : '0::int';
  const res = await query(
    `SELECT promotion_id::text AS promotion_id,
            COUNT(*) FILTER (WHERE user_id = $2)::int AS user_count,
            COUNT(*)::int AS campaign_count,
            ${dailyExpr} AS daily_count
     FROM promo_engine_usage
     WHERE promotion_id = ANY($1::uuid[])
     GROUP BY promotion_id`,
    params,
  );
  for (const raw of res.rows || []) {
    const r = raw as Record<string, unknown>;
    map.set(String(r.promotion_id), {
      user: Number(r.user_count ?? 0),
      campaign: Number(r.campaign_count ?? 0),
      daily: Number(r.daily_count ?? 0),
    });
  }
  return map;
}

export async function dbCountUsage(opts: {
  promotionId: string;
  userId?: string;
  since?: Date;
}): Promise<number> {
  const params: unknown[] = [opts.promotionId];
  let sql = `SELECT COUNT(*)::int AS c FROM promo_engine_usage WHERE promotion_id = $1`;
  if (opts.userId) {
    params.push(opts.userId);
    sql += ` AND user_id = $${params.length}`;
  }
  if (opts.since) {
    params.push(opts.since.toISOString());
    sql += ` AND created_at >= $${params.length}::timestamptz`;
  }
  const res = await query(sql, params);
  return Number(res.rows?.[0]?.c ?? 0);
}

export async function dbInsertUsage(row: {
  promotion_id: string;
  user_id: string;
  transaction_id: string;
  transaction_type: string;
  evaluation_id: string;
  discount_amount: number;
  cashback_amount: number;
  idempotency_key: string;
}): Promise<{ inserted: boolean }> {
  try {
    await insert('promo_engine_usage', row);
    return { inserted: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return { inserted: false };
    throw err;
  }
}

export async function dbInsertEvaluation(row: {
  user_id: string;
  request_json: unknown;
  result_json: unknown;
  explain_json: unknown;
  expires_at?: string | null;
}): Promise<string> {
  const rows = await insert('promo_engine_evaluations', {
    user_id: row.user_id,
    request_json: JSON.stringify(row.request_json),
    result_json: JSON.stringify(row.result_json),
    explain_json: JSON.stringify(row.explain_json),
    expires_at: row.expires_at || null,
  });
  return String((rows[0] as Record<string, unknown>).id);
}

export async function dbGetEvaluation(id: string): Promise<Record<string, unknown> | null> {
  const rows = await select('promo_engine_evaluations', { id });
  if (!rows.length) return null;
  return rows[0] as Record<string, unknown>;
}

export async function dbInsertAudit(row: {
  promotion_id?: string | null;
  evaluation_id?: string | null;
  event_type: string;
  payload: unknown;
}): Promise<void> {
  await insert('promo_engine_audit_log', {
    promotion_id: row.promotion_id || null,
    evaluation_id: row.evaluation_id || null,
    event_type: row.event_type,
    payload: JSON.stringify(row.payload ?? {}),
  });
}

export async function dbGetBehaviour(userId: string): Promise<Record<string, unknown> | null> {
  const rows = await select('customer_behaviour_profiles', { user_id: userId });
  if (!rows.length) return null;
  return rows[0] as Record<string, unknown>;
}

export async function dbUpsertBehaviour(opts: {
  userId: string;
  overall: Record<string, unknown>;
  services: Record<string, unknown>;
}): Promise<void> {
  const existing = await dbGetBehaviour(opts.userId);
  if (existing) {
    await update(
      'customer_behaviour_profiles',
      { user_id: opts.userId },
      {
        overall: JSON.stringify(opts.overall),
        services: JSON.stringify(opts.services),
        updated_at: new Date().toISOString(),
      },
    );
    return;
  }
  await insert('customer_behaviour_profiles', {
    user_id: opts.userId,
    overall: JSON.stringify(opts.overall),
    services: JSON.stringify(opts.services),
  });
}

export async function dbAppendBehaviourEvent(opts: {
  userId: string;
  eventType: string;
  serviceKey?: string | null;
  payload?: unknown;
}): Promise<void> {
  await insert('customer_behaviour_events', {
    user_id: opts.userId,
    event_type: opts.eventType,
    service_key: opts.serviceKey || null,
    payload: JSON.stringify(opts.payload ?? {}),
  });
}

export async function dbUsageByPromotion(promotionId: string, limit = 50) {
  const res = await query(
    `SELECT * FROM promo_engine_usage WHERE promotion_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [promotionId, limit]
  );
  return res.rows || [];
}

export async function dbFindUsageByTransaction(transactionId: string) {
  const res = await query(
    `SELECT * FROM promo_engine_usage WHERE transaction_id = $1 ORDER BY created_at ASC`,
    [transactionId]
  );
  return res.rows || [];
}
