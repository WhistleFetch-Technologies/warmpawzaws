import {
  dbArchiveRules,
  dbInsertRangeRule,
  dbListRules,
  dbRuleUsageSummary,
  dbUpdateRangeRule,
  type RangeRuleWrite,
} from '../repos/promo-engine.repo';
import { parseCustomerCopy, validateCustomerCopy } from '../customer-copy';
import { isRangedRule } from '../vcf/amount-range';
import type {
  PromoBenefitMode,
  PromoEngineBenefit,
  PromoEngineConditionGroup,
  PromoEngineRuleRow,
  PromoRuleType,
} from '../types';

export const MAX_RANGES_PER_PROMO = 20;

/** One bill-amount range as sent by the admin wizard (camelCase). */
export interface PromoRangeInput {
  id?: string;
  label: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  active: boolean;
  benefitJson: PromoEngineBenefit[];
  customerCopy: Record<string, string> | null;
  limits: {
    perUser: number | null;
    dailyLimit: number | null;
    campaignLimit: number | null;
    budgetLimit: number | null;
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function benefitValue(list: PromoEngineBenefit[], type: 'DISCOUNT' | 'CASHBACK'): number {
  return Number(list.find((b) => b.type === type)?.value) || 0;
}

/** Mode follows what the range actually gives, so it can never disagree with its values. */
export function rangeBenefitMode(benefits: PromoEngineBenefit[]): PromoBenefitMode | null {
  const d = benefitValue(benefits, 'DISCOUNT') > 0;
  const c = benefitValue(benefits, 'CASHBACK') > 0;
  if (d && c) return 'both';
  if (d) return 'discount';
  if (c) return 'cashback';
  return null;
}

/** `undefined` = the request did not send ranges (older clients keep the single-rule path). */
export function parseRangesInput(body: Record<string, unknown>): PromoRangeInput[] | undefined {
  const raw = body.ranges;
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => {
    const r = rec(item);
    const limits = rec(r.limits);
    const copy = parseCustomerCopy({ customerCopy: r.customerCopy });
    return {
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : undefined,
      label: typeof r.label === 'string' && r.label.trim() ? r.label.trim().slice(0, 60) : null,
      minAmount: numOrNull(r.minAmount),
      maxAmount: numOrNull(r.maxAmount),
      active: r.active !== false,
      benefitJson: (Array.isArray(r.benefitJson) ? r.benefitJson : []).filter(
        (b): b is PromoEngineBenefit =>
          !!b && typeof b === 'object' && (b.type === 'DISCOUNT' || b.type === 'CASHBACK'),
      ),
      customerCopy: copy as Record<string, string> | null,
      limits: {
        perUser: numOrNull(limits.perUser),
        dailyLimit: numOrNull(limits.dailyLimit),
        campaignLimit: numOrNull(limits.campaignLimit),
        budgetLimit: numOrNull(limits.budgetLimit),
      },
    };
  });
}

function rangeName(i: number, r: PromoRangeInput): string {
  return r.label ? `Range ${i + 1} (${r.label})` : `Range ${i + 1}`;
}

/** Ranges sorted by floor; a missing floor counts as ₹0. */
export function sortRanges<T extends { minAmount: number | null }>(ranges: T[]): T[] {
  return [...ranges].sort((a, b) => (a.minAmount ?? 0) - (b.minAmount ?? 0));
}

/** Returns human-readable errors; empty when the ranges can be saved. */
export function validateRangesInput(ranges: PromoRangeInput[]): string[] {
  const errors: string[] = [];
  if (ranges.length > MAX_RANGES_PER_PROMO) {
    errors.push(`At most ${MAX_RANGES_PER_PROMO} ranges per promotion`);
  }
  const ids = ranges.map((r) => r.id).filter(Boolean) as string[];
  if (new Set(ids).size !== ids.length) errors.push('Ranges have duplicate ids');
  if (ids.some((id) => !UUID_RE.test(id))) errors.push('Range id is not valid');

  // Names follow the order the admin entered; bounds are checked in bill order.
  const sorted = sortRanges(ranges.map((r, idx) => ({ ...r, idx })));
  sorted.forEach((r, i) => {
    const name = rangeName(r.idx, r);
    const min = r.minAmount;
    const max = r.maxAmount;
    if (Number.isNaN(min) || Number.isNaN(max)) {
      errors.push(`${name}: minimum and maximum must be numbers`);
      return;
    }
    if (min != null && min < 0) errors.push(`${name}: minimum must be 0 or more`);
    if (max != null && max <= (min ?? 0)) errors.push(`${name}: maximum must be above the minimum`);
    if (max == null && i < sorted.length - 1) {
      errors.push(`${name}: only the last range can have no maximum`);
    }
    const prev = sorted[i - 1];
    if (prev && prev.maxAmount != null && (min ?? 0) < prev.maxAmount) {
      errors.push(`${name} overlaps ${rangeName(prev.idx, prev)}`);
    }

    for (const b of r.benefitJson) {
      const v = Number(b.value);
      if (!Number.isFinite(v) || v < 0) errors.push(`${name}: ${b.type.toLowerCase()} value must be 0 or more`);
      const isPercent = String(b.mode || b.value_type || '').toUpperCase().startsWith('PERCENT');
      if (isPercent && v > 100) errors.push(`${name}: ${b.type.toLowerCase()} % cannot exceed 100`);
      const cap = b.maxAmount ?? b.max_amount;
      if (cap != null && (!Number.isFinite(Number(cap)) || Number(cap) < 0)) {
        errors.push(`${name}: max ${b.type.toLowerCase()} must be 0 or more`);
      }
    }
    if (r.active && !rangeBenefitMode(r.benefitJson)) {
      errors.push(`${name}: add a discount or cashback (or switch the range off)`);
    }

    const { perUser, dailyLimit, campaignLimit, budgetLimit } = r.limits;
    for (const [label, v] of [
      ['per-customer limit', perUser],
      ['daily limit', dailyLimit],
      ['total uses', campaignLimit],
    ] as const) {
      if (v != null && (!Number.isInteger(v) || v < 0)) {
        errors.push(`${name}: ${label} must be a whole number of 0 or more`);
      }
    }
    if (budgetLimit != null && (!Number.isFinite(budgetLimit) || budgetLimit < 0)) {
      errors.push(`${name}: budget must be 0 or more`);
    }
    errors.push(...validateCustomerCopy(r.customerCopy).map((e) => `${name}: ${e}`));
  });
  return errors;
}

function toWrite(r: PromoRangeInput, sortOrder: number): RangeRuleWrite {
  return {
    label: r.label,
    sort_order: sortOrder,
    min_amount: r.minAmount,
    max_amount: r.maxAmount,
    benefit_mode: rangeBenefitMode(r.benefitJson),
    benefit_json: r.benefitJson,
    customer_copy: r.customerCopy,
    per_user_limit: r.limits.perUser,
    daily_limit: r.limits.dailyLimit,
    campaign_limit: r.limits.campaignLimit,
    budget_limit: r.limits.budgetLimit,
    is_active: r.active,
  };
}

type RuleWriteTarget = {
  promotionId: string;
  condition_json: PromoEngineConditionGroup;
  rule_type: PromoRuleType;
};

/** Known ids update in place (keeping used budget), others insert; unlisted live rules archive. */
async function writeRules(
  target: RuleWriteTarget,
  entries: Array<{ id?: string; write: RangeRuleWrite }>,
): Promise<void> {
  const existing = await dbListRules(target.promotionId);
  const existingIds = new Set(existing.map((r) => r.id));
  const kept = new Set<string>();

  for (const entry of entries) {
    if (entry.id && existingIds.has(entry.id)) {
      const updated = await dbUpdateRangeRule({
        ruleId: entry.id,
        promotionId: target.promotionId,
        condition_json: target.condition_json,
        rule_type: target.rule_type,
        range: entry.write,
      });
      if (updated) {
        kept.add(updated.id);
        continue;
      }
    }
    const inserted = await dbInsertRangeRule({
      promotionId: target.promotionId,
      condition_json: target.condition_json,
      rule_type: target.rule_type,
      range: entry.write,
    });
    kept.add(inserted.id);
  }

  await dbArchiveRules(
    target.promotionId,
    existing.filter((r) => !kept.has(r.id)).map((r) => r.id),
  );
}

/** Write the wizard's ranges in bill order. */
export async function syncPromotionRanges(
  opts: RuleWriteTarget & { ranges: PromoRangeInput[] },
): Promise<void> {
  const sorted = sortRanges(opts.ranges);
  await writeRules(
    opts,
    sorted.map((r, i) => ({ id: r.id, write: toWrite(r, i + 1) })),
  );
}

/**
 * Wizard saved with no ranges: one open rule carrying `benefit_json`, with range columns cleared
 * so promo-level mode, cap and expiry apply as before. Reuses the first live rule so its usage
 * history stays attached; other live rules are archived.
 */
export async function collapseToSingleRule(
  opts: RuleWriteTarget & { benefit_json: PromoEngineBenefit[] },
): Promise<void> {
  const existing = await dbListRules(opts.promotionId);
  await writeRules(opts, [
    {
      id: existing[0]?.id,
      write: {
        label: null,
        sort_order: null,
        min_amount: null,
        max_amount: null,
        benefit_mode: null,
        benefit_json: opts.benefit_json,
        customer_copy: null,
        per_user_limit: null,
        daily_limit: null,
        campaign_limit: null,
        budget_limit: null,
        is_active: true,
      },
    },
  ]);
}

export interface PromoRangeView {
  id: string;
  label: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  active: boolean;
  benefitMode: PromoBenefitMode | null;
  benefitJson: PromoEngineBenefit[];
  customerCopy: Record<string, unknown> | null;
  limits: {
    perUser: number | null;
    dailyLimit: number | null;
    campaignLimit: number | null;
    budgetLimit: number | null;
  };
  budgetConsumed: number;
  usage: { uses: number; discount: number; cashback: number };
}

/** Ranges for the admin detail view; empty when the promotion has a single open rule. */
export async function loadRangeViews(
  promotionId: string,
  rules: PromoEngineRuleRow[],
): Promise<PromoRangeView[]> {
  if (!rules.some(isRangedRule)) return [];
  const usage = await dbRuleUsageSummary(promotionId);
  return rules.map((r) => ({
    id: r.id,
    label: r.label ?? null,
    minAmount: r.min_amount ?? null,
    maxAmount: r.max_amount ?? null,
    active: r.is_active,
    benefitMode: r.benefit_mode ?? null,
    benefitJson: r.benefit_json || [],
    customerCopy: r.customer_copy ?? null,
    limits: {
      perUser: r.per_user_limit ?? null,
      dailyLimit: r.daily_limit ?? null,
      campaignLimit: r.campaign_limit ?? null,
      budgetLimit: r.budget_limit ?? null,
    },
    budgetConsumed: Number(r.budget_consumed || 0),
    usage: usage.get(r.id) || { uses: 0, discount: 0, cashback: 0 },
  }));
}
