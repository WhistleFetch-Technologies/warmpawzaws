import type { PromoUsageCounts } from '../repos/promo-engine.repo';
import type { PromoEngineRuleRow } from '../types';

export type RangeLimitReason =
  | 'RANGE_BUDGET_EXHAUSTED'
  | 'RANGE_PER_USER_LIMIT'
  | 'RANGE_CAMPAIGN_LIMIT'
  | 'RANGE_DAILY_LIMIT';

function inRange(rule: PromoEngineRuleRow, amount: number): boolean {
  if (rule.min_amount != null && amount < rule.min_amount) return false;
  if (rule.max_amount != null && amount > rule.max_amount) return false;
  return true;
}

/**
 * The single range (rule row) that applies to this bill. Both edges are inclusive, and
 * rules arrive in bill order, so a bill exactly on a shared boundary goes to the lower range.
 * Pre-range rows have no min/max and match every bill.
 */
export function pickAmountRange(
  rules: PromoEngineRuleRow[],
  amount: number,
): PromoEngineRuleRow | null {
  for (const rule of rules) {
    if (!rule.is_active || rule.archived_at) continue;
    if (inRange(rule, amount)) return rule;
  }
  return null;
}

/** Pre-use check at evaluate time; usage counts exclude the current transaction. */
export function checkRangeLimits(
  rule: PromoEngineRuleRow,
  usage: PromoUsageCounts | undefined | null,
): { ok: boolean; reason?: RangeLimitReason } {
  if (rule.budget_limit != null && Number(rule.budget_consumed || 0) >= rule.budget_limit) {
    return { ok: false, reason: 'RANGE_BUDGET_EXHAUSTED' };
  }
  if (rule.per_user_limit != null && (usage?.user ?? 0) >= rule.per_user_limit) {
    return { ok: false, reason: 'RANGE_PER_USER_LIMIT' };
  }
  if (rule.campaign_limit != null && (usage?.campaign ?? 0) >= rule.campaign_limit) {
    return { ok: false, reason: 'RANGE_CAMPAIGN_LIMIT' };
  }
  if (rule.daily_limit != null && (usage?.daily ?? 0) >= rule.daily_limit) {
    return { ok: false, reason: 'RANGE_DAILY_LIMIT' };
  }
  return { ok: true };
}

/** Post-insert check at commit: counts include the row just written. */
export function rangeCountLimitExceededAfterInsert(
  rule: Pick<PromoEngineRuleRow, 'per_user_limit' | 'campaign_limit' | 'daily_limit'>,
  usage: PromoUsageCounts | undefined | null,
): RangeLimitReason | null {
  if (rule.per_user_limit != null && (usage?.user ?? 0) > rule.per_user_limit) {
    return 'RANGE_PER_USER_LIMIT';
  }
  if (rule.campaign_limit != null && (usage?.campaign ?? 0) > rule.campaign_limit) {
    return 'RANGE_CAMPAIGN_LIMIT';
  }
  if (rule.daily_limit != null && (usage?.daily ?? 0) > rule.daily_limit) {
    return 'RANGE_DAILY_LIMIT';
  }
  return null;
}

/** A rule carries range settings once it has a bound or a range-level limit/mode. */
export function isRangedRule(rule: PromoEngineRuleRow): boolean {
  return rule.min_amount != null || rule.max_amount != null || rule.benefit_mode != null;
}
