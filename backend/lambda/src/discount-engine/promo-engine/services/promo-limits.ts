import type { PromoUsageCounts } from '../repos/promo-engine.repo';
import type { PromoEngineLimitsRow, PromoEnginePromotionRow } from '../types';

export type PromoLimitReason =
  | 'BUDGET_EXHAUSTED'
  | 'PER_USER_LIMIT'
  | 'CAMPAIGN_LIMIT'
  | 'DAILY_LIMIT'
  | 'PER_TRANSACTION_LIMIT';

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Midnight Asia/Kolkata for the given instant (daily limits reset at IST midnight, not UTC). */
export function istDayStart(now: Date): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export function effectiveBudgetCap(
  promo: Pick<PromoEnginePromotionRow, 'budget_limit'>,
  limits: PromoEngineLimitsRow | undefined | null,
): number | null {
  const cap = limits?.budget_limit ?? promo.budget_limit;
  return cap != null && Number.isFinite(Number(cap)) ? Number(cap) : null;
}

/**
 * Pre-use check at evaluate time: usage counts exclude the current transaction,
 * so a count equal to the limit means the limit is already used up.
 */
export function checkPromoLimits(opts: {
  promo: PromoEnginePromotionRow;
  limits: PromoEngineLimitsRow | undefined | null;
  usage: PromoUsageCounts | undefined | null;
}): { ok: boolean; reason?: PromoLimitReason } {
  const budgetCap = effectiveBudgetCap(opts.promo, opts.limits);
  if (budgetCap != null && Number(opts.promo.budget_consumed || 0) >= budgetCap) {
    return { ok: false, reason: 'BUDGET_EXHAUSTED' };
  }
  const l = opts.limits;
  const u = opts.usage;
  if (l?.per_user != null && (u?.user ?? 0) >= l.per_user) {
    return { ok: false, reason: 'PER_USER_LIMIT' };
  }
  if (l?.campaign_limit != null && (u?.campaign ?? 0) >= l.campaign_limit) {
    return { ok: false, reason: 'CAMPAIGN_LIMIT' };
  }
  if (l?.daily_limit != null && (u?.daily ?? 0) >= l.daily_limit) {
    return { ok: false, reason: 'DAILY_LIMIT' };
  }
  if (l?.per_transaction != null && l.per_transaction <= 0) {
    return { ok: false, reason: 'PER_TRANSACTION_LIMIT' };
  }
  return { ok: true };
}

/**
 * Post-insert check at commit: counts include the usage row just written,
 * so only a count strictly above the limit means this commit overshot it (race between payments).
 */
export function countLimitExceededAfterInsert(
  limits: PromoEngineLimitsRow | undefined | null,
  usage: PromoUsageCounts | undefined | null,
): PromoLimitReason | null {
  if (!limits) return null;
  if (limits.per_user != null && (usage?.user ?? 0) > limits.per_user) return 'PER_USER_LIMIT';
  if (limits.campaign_limit != null && (usage?.campaign ?? 0) > limits.campaign_limit) {
    return 'CAMPAIGN_LIMIT';
  }
  if (limits.daily_limit != null && (usage?.daily ?? 0) > limits.daily_limit) return 'DAILY_LIMIT';
  return null;
}

/**
 * Cashback that may still be credited once the budget update has landed.
 * Discount is already baked into the captured payment, so only cashback can be withheld.
 */
export function cashbackAllowedWithinBudget(opts: {
  budgetCap: number | null;
  consumedAfter: number;
  cashback: number;
}): number {
  if (opts.budgetCap == null) return opts.cashback;
  const overshoot = Math.round((opts.consumedAfter - opts.budgetCap) * 100) / 100;
  if (overshoot <= 0) return opts.cashback;
  return Math.max(0, Math.round((opts.cashback - overshoot) * 100) / 100);
}

const LIMIT_INT_KEYS = ['per_user', 'per_transaction', 'daily_limit', 'campaign_limit'] as const;

export type PromoLimitsInput = {
  per_user?: number | null;
  per_transaction?: number | null;
  daily_limit?: number | null;
  campaign_limit?: number | null;
  budget_limit?: number | null;
};

/** Validates admin limit input before anything is written. Returns error strings. */
export function validatePromoLimitsInput(limits: unknown): string[] {
  if (limits == null) return [];
  if (typeof limits !== 'object' || Array.isArray(limits)) return ['Limits must be an object'];
  const l = limits as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of LIMIT_INT_KEYS) {
    const v = l[key];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors.push(`${key} must be a whole number of 0 or more`);
    }
  }
  const budget = l.budget_limit;
  if (budget != null && budget !== '') {
    const n = Number(budget);
    if (!Number.isFinite(n) || n < 0) errors.push('budget_limit must be 0 or more');
  }
  return errors;
}

/** Normalises '' / undefined to null and numeric strings to numbers (after validation). */
export function normalizePromoLimitsInput(limits: PromoLimitsInput): Required<PromoLimitsInput> {
  const pick = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
  return {
    per_user: pick(limits.per_user),
    per_transaction: pick(limits.per_transaction),
    daily_limit: pick(limits.daily_limit),
    campaign_limit: pick(limits.campaign_limit),
    budget_limit: pick(limits.budget_limit),
  };
}
