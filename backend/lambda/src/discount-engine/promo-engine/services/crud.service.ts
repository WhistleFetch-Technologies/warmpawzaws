import { persistIstDateTime, toDatetimeLocalIst, normalizePromoCategory } from '../dsl/category-aliases';
import {
  dbCreatePromotion,
  dbGetPromotion,
  dbListPromotions,
  dbListRules,
  dbUpdatePromotion,
  dbUpsertPrimaryRule,
  dbUpsertLimits,
  dbGetLimits,
  dbUsageByPromotion,
  dbInsertAudit,
} from '../repos/promo-engine.repo';
import type {
  PromoEngineBenefit,
  PromoEngineConditionGroup,
  PromoEngineStatus,
  PromoFundingType,
  PromoRuleType,
  StackingPolicy,
} from '../types';

export interface PromoDraftPayload {
  name: string;
  code?: string;
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
  condition_json?: PromoEngineConditionGroup;
  benefit_json?: PromoEngineBenefit[];
  rule_type?: PromoRuleType;
  limits?: {
    per_user?: number | null;
    per_transaction?: number | null;
    daily_limit?: number | null;
    campaign_limit?: number | null;
    budget_limit?: number | null;
  };
  metadata?: Record<string, unknown>;
}

/** Map admin UI draft (camelCase basics) into create/update payload */
export function mapAdminDraftToPayload(body: Record<string, unknown>): PromoDraftPayload {
  const basics = (body.basics || body) as Record<string, unknown>;
  const fundingSplit = basics.fundingSplit || basics.funding_split;
  return {
    name: String(basics.name || body.name || 'Untitled'),
    code: basics.code != null ? String(basics.code) : undefined,
    status: (body.status as PromoEngineStatus) || 'DRAFT',
    priority: Number(basics.priority ?? 50),
    start_at: persistIstDateTime(basics.startAt || basics.start_at || null),
    end_at: persistIstDateTime(basics.endAt || basics.end_at || null),
    stacking_policy: (basics.stackingPolicy || basics.stacking_policy || null) as StackingPolicy | null,
    funding_type: (basics.fundingType || basics.funding_type || null) as PromoFundingType | null,
    funding_split: fundingSplit
      ? {
          warmpawz_percent:
            (fundingSplit as Record<string, number>).warmpawzPercent ??
            (fundingSplit as Record<string, number>).warmpawz_percent,
          vendor_percent:
            (fundingSplit as Record<string, number>).vendorPercent ??
            (fundingSplit as Record<string, number>).vendor_percent,
        }
      : null,
    commercial_campaign_id: (basics.commercialCampaignId ||
      basics.commercial_campaign_id ||
      null) as string | null,
    service_categories: ((basics.serviceCategories ||
      basics.service_categories ||
      []) as string[])
      .map((s) => normalizePromoCategory(s) || String(s).trim())
      .filter(Boolean),
    condition_json: (body.conditionJson || body.condition_json) as PromoEngineConditionGroup | undefined,
    benefit_json: (body.benefitJson || body.benefit_json) as PromoEngineBenefit[] | undefined,
    rule_type: (body.ruleType || body.rule_type || 'GENERIC') as PromoRuleType,
    limits: (body.limits as PromoDraftPayload['limits']) || undefined,
    metadata: mergeVcfMetadata(body),
    budget_limit:
      body.budget_limit != null
        ? Number(body.budget_limit)
        : body.limits && (body.limits as { budget_limit?: number }).budget_limit != null
          ? Number((body.limits as { budget_limit?: number }).budget_limit)
          : null,
  };
}

function mergeVcfMetadata(body: Record<string, unknown>): Record<string, unknown> {
  const base =
    body.metadata && typeof body.metadata === 'object'
      ? { ...(body.metadata as Record<string, unknown>) }
      : {};
  const vcf = body.vcf ?? (body.metadata as Record<string, unknown> | undefined)?.vcf;
  if (vcf && typeof vcf === 'object') {
    base.vcf = fillRedeemIdsFromAudience(vcf as Record<string, unknown>);
  }
  return base;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Persist Same vendor / Same category IDs from publish, then visit source — only when redeem lists empty. */
function fillRedeemIdsFromAudience(vcf: Record<string, unknown>): Record<string, unknown> {
  const redeem = asRecord(vcf.redeem);
  const letter = String(redeem.letter || '').toUpperCase();
  if (!letter || letter === 'F') return vcf;
  const publish = asRecord(vcf.publish);
  const visit = asRecord(vcf.visitSource);

  const existingVendorIds = [
    ...(Array.isArray(redeem.vendorIds) ? redeem.vendorIds.map(String) : []),
    redeem.vendorId ? String(redeem.vendorId) : '',
  ].filter(Boolean);
  const existingCategoryIds = [
    ...(Array.isArray(redeem.categoryIds) ? redeem.categoryIds.map(String) : []),
    redeem.categoryId ? String(redeem.categoryId) : '',
  ].filter(Boolean);

  if (letter === 'V') {
    if (existingVendorIds.length) {
      const uniq = [...new Set(existingVendorIds)];
      return {
        ...vcf,
        redeem: {
          ...redeem,
          vendorIds: uniq,
          vendorId: uniq[0],
          categoryId: undefined,
          categoryIds: undefined,
        },
      };
    }
    const vendorId =
      String(publish.letter || '').toUpperCase() === 'V' && publish.vendorId
        ? String(publish.vendorId)
        : String(visit.letter || '').toUpperCase() === 'V' && visit.vendorId
          ? String(visit.vendorId)
          : undefined;
    return {
      ...vcf,
      redeem: {
        ...redeem,
        vendorId,
        vendorIds: vendorId ? [vendorId] : undefined,
        categoryId: undefined,
        categoryIds: undefined,
      },
    };
  }

  if (existingCategoryIds.length) {
    const uniq = [...new Set(existingCategoryIds)];
    return {
      ...vcf,
      redeem: {
        ...redeem,
        categoryIds: uniq,
        categoryId: uniq[0],
        vendorId: undefined,
        vendorIds: undefined,
      },
    };
  }
  const categoryId =
    String(publish.letter || '').toUpperCase() === 'C' && publish.categoryId
      ? String(publish.categoryId)
      : String(visit.letter || '').toUpperCase() === 'C' && visit.categoryId
        ? String(visit.categoryId)
        : undefined;
  return {
    ...vcf,
    redeem: {
      ...redeem,
      categoryId,
      categoryIds: categoryId ? [categoryId] : undefined,
      vendorId: undefined,
      vendorIds: undefined,
    },
  };
}

export async function createPromotionFromDraft(payload: PromoDraftPayload) {
  const promo = await dbCreatePromotion({
    name: payload.name,
    code: payload.code || null,
    status: payload.status || 'DRAFT',
    priority: payload.priority,
    start_at: payload.start_at,
    end_at: payload.end_at,
    stacking_policy: payload.stacking_policy,
    funding_type: payload.funding_type,
    funding_split: payload.funding_split,
    budget_limit: payload.budget_limit,
    commercial_campaign_id: payload.commercial_campaign_id,
    service_categories: payload.service_categories,
    metadata: payload.metadata,
  });

  if (payload.condition_json || payload.benefit_json) {
    await dbUpsertPrimaryRule({
      promotionId: promo.id,
      condition_json: payload.condition_json || { operator: 'AND', conditions: [] },
      benefit_json: payload.benefit_json || [],
      rule_type: payload.rule_type,
    });
  }

  if (payload.limits) {
    await dbUpsertLimits(promo.id, {
      promotion_id: promo.id,
      ...payload.limits,
    });
  }

  await dbInsertAudit({
    promotion_id: promo.id,
    event_type: 'STATUS_CHANGED',
    payload: { to: promo.status, action: 'CREATE' },
  });

  return getPromotionDetail(promo.id);
}

export async function updatePromotionFromDraft(id: string, payload: PromoDraftPayload) {
  const updated = await dbUpdatePromotion(id, {
    name: payload.name,
    code: payload.code || null,
    priority: payload.priority,
    start_at: payload.start_at,
    end_at: payload.end_at,
    stacking_policy: payload.stacking_policy,
    funding_type: payload.funding_type,
    funding_split: payload.funding_split,
    budget_limit: payload.budget_limit,
    commercial_campaign_id: payload.commercial_campaign_id || null,
    service_categories: payload.service_categories || [],
    metadata: payload.metadata || {},
  });
  if (!updated) return null;

  if (payload.condition_json || payload.benefit_json) {
    await dbUpsertPrimaryRule({
      promotionId: id,
      condition_json: payload.condition_json || { operator: 'AND', conditions: [] },
      benefit_json: payload.benefit_json || [],
      rule_type: payload.rule_type,
    });
  }
  if (payload.limits) {
    await dbUpsertLimits(id, { promotion_id: id, ...payload.limits });
  }
  return getPromotionDetail(id);
}

export async function patchPromotionStatus(id: string, status: PromoEngineStatus) {
  const updated = await dbUpdatePromotion(id, { status });
  if (!updated) return null;
  await dbInsertAudit({
    promotion_id: id,
    event_type: 'STATUS_CHANGED',
    payload: { to: status },
  });
  return updated;
}

export async function softDeletePromotion(id: string) {
  return patchPromotionStatus(id, 'ARCHIVED');
}

export async function listPromotions(filters?: {
  status?: string;
  service?: string;
  q?: string;
}) {
  const promos = await dbListPromotions(filters);
  const items = [];
  for (const p of promos) {
    const rules = await dbListRules(p.id);
    const usage = await dbUsageByPromotion(p.id, 1);
    items.push({
      id: p.id,
      name: p.name,
      code: p.code || '',
      status: p.status,
      serviceCategories: p.service_categories,
      ruleType: rules[0]?.rule_type || 'GENERIC',
      fundingType: p.funding_type || 'WARMPAWZ',
      usageCount: usage.length ? undefined : 0,
      startAt: p.start_at || '',
      endAt: p.end_at || '',
      updatedAt: p.updated_at,
      priority: p.priority,
    });
  }
  // usage counts properly
  for (let i = 0; i < promos.length; i++) {
    const res = await dbUsageByPromotion(promos[i].id, 500);
    items[i].usageCount = res.length;
  }
  return items;
}

export async function getPromotionDetail(id: string) {
  const promo = await dbGetPromotion(id);
  if (!promo) return null;
  const rules = await dbListRules(id);
  const limits = await dbGetLimits(id);
  return {
    ...promo,
    rules,
    limits,
    basics: {
      name: promo.name,
      code: promo.code || '',
      priority: promo.priority,
      startAt: toDatetimeLocalIst(promo.start_at),
      endAt: toDatetimeLocalIst(promo.end_at),
      stackingPolicy: promo.stacking_policy || 'SERVICE_LEVEL',
      fundingType: promo.funding_type || 'WARMPAWZ',
      fundingSplit: {
        warmpawzPercent:
          Number((promo.funding_split as { warmpawz_percent?: number })?.warmpawz_percent) || 70,
        vendorPercent:
          Number((promo.funding_split as { vendor_percent?: number })?.vendor_percent) || 30,
      },
      commercialCampaignId: promo.commercial_campaign_id || '',
      serviceCategories: promo.service_categories,
    },
    conditionJson: rules[0]?.condition_json || { operator: 'AND', conditions: [] },
    benefitJson: rules[0]?.benefit_json || [],
    ruleType: rules[0]?.rule_type || 'GENERIC',
    vcf: (promo.metadata || {}).vcf || null,
    metadata: promo.metadata || {},
  };
}
