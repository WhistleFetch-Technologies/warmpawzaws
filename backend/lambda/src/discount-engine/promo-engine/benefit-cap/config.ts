/**
 * Global per-customer benefit cap (promo_engine_settings.benefit_cap).
 * Applies to every promotion and checkout channel; it never edits promotions.
 */

export type BenefitCapWindowType = 'calendar' | 'rolling';
export type BenefitCapWindowUnit = 'hours' | 'days' | 'weeks';
/** discount = no instant discount; cashback = no cashback earned and no wallet spend; both = neither. */
export type BenefitCapBlock = 'discount' | 'cashback' | 'both';

export interface BenefitCapConfig {
  enabled: boolean;
  max_benefit_payments: number;
  window_type: BenefitCapWindowType;
  window_length: number;
  window_unit: BenefitCapWindowUnit;
  /** Calendar windows only — IST wall clock "HH:MM" each window starts at. */
  reset_time: string;
  block: BenefitCapBlock;
  /** Pay Bill platform fee (+ its GST) is waived on a capped payment. */
  waive_platform_fee: boolean;
  /** Optional admin text; placeholders {cap} {used} {blocked} {fee} {resume_at}. */
  message: string | null;
}

export const DEFAULT_BENEFIT_CAP: BenefitCapConfig = {
  enabled: false,
  max_benefit_payments: 3,
  window_type: 'calendar',
  window_length: 1,
  window_unit: 'days',
  reset_time: '00:00',
  block: 'both',
  waive_platform_fee: true,
  message: null,
};

export const BENEFIT_CAP_MAX_WINDOW_HOURS = 30 * 24;
export const BENEFIT_CAP_MAX_PAYMENTS = 100;
export const BENEFIT_CAP_MESSAGE_MAX = 300;

const UNIT_HOURS: Record<BenefitCapWindowUnit, number> = { hours: 1, days: 24, weeks: 24 * 7 };
const RESET_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function benefitCapWindowHours(cfg: Pick<BenefitCapConfig, 'window_length' | 'window_unit'>): number {
  return cfg.window_length * UNIT_HOURS[cfg.window_unit];
}

function asInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

/** Validates admin input. Returns error strings; empty means valid. */
export function validateBenefitCapInput(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['Settings must be an object'];
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];
  const max = asInt(r.max_benefit_payments);
  if (max == null || max < 1 || max > BENEFIT_CAP_MAX_PAYMENTS) {
    errors.push(`Max benefit payments must be a whole number from 1 to ${BENEFIT_CAP_MAX_PAYMENTS}`);
  }
  if (r.window_type !== 'calendar' && r.window_type !== 'rolling') {
    errors.push('Window type must be calendar or rolling');
  }
  const unit = r.window_unit;
  if (unit !== 'hours' && unit !== 'days' && unit !== 'weeks') {
    errors.push('Window unit must be hours, days or weeks');
  }
  const len = asInt(r.window_length);
  if (len == null || len < 1) {
    errors.push('Window length must be a whole number of 1 or more');
  } else if (unit === 'hours' || unit === 'days' || unit === 'weeks') {
    if (benefitCapWindowHours({ window_length: len, window_unit: unit }) > BENEFIT_CAP_MAX_WINDOW_HOURS) {
      errors.push('Window cannot be longer than 30 days');
    }
  }
  if (r.window_type === 'calendar' && !RESET_RE.test(String(r.reset_time ?? ''))) {
    errors.push('Reset time must be HH:MM (24-hour, IST)');
  }
  if (r.block !== 'discount' && r.block !== 'cashback' && r.block !== 'both') {
    errors.push('Block must be discount, cashback or both');
  }
  if (r.message != null && typeof r.message !== 'string') {
    errors.push('Message must be text');
  } else if (typeof r.message === 'string' && r.message.trim().length > BENEFIT_CAP_MESSAGE_MAX) {
    errors.push(`Message must be ${BENEFIT_CAP_MESSAGE_MAX} characters or fewer`);
  }
  return errors;
}

/** Lenient read of the stored JSON: anything invalid falls back to the default value. */
export function normalizeBenefitCapConfig(raw: unknown): BenefitCapConfig {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_BENEFIT_CAP;
  const max = asInt(r.max_benefit_payments);
  const unit: BenefitCapWindowUnit =
    r.window_unit === 'hours' || r.window_unit === 'days' || r.window_unit === 'weeks'
      ? r.window_unit
      : d.window_unit;
  let len = asInt(r.window_length);
  if (len == null || len < 1) len = d.window_length;
  if (benefitCapWindowHours({ window_length: len, window_unit: unit }) > BENEFIT_CAP_MAX_WINDOW_HOURS) {
    len = Math.floor(BENEFIT_CAP_MAX_WINDOW_HOURS / UNIT_HOURS[unit]);
  }
  const message = typeof r.message === 'string' && r.message.trim() ? r.message.trim() : null;
  return {
    enabled: r.enabled === true,
    max_benefit_payments:
      max != null && max >= 1 && max <= BENEFIT_CAP_MAX_PAYMENTS ? max : d.max_benefit_payments,
    window_type: r.window_type === 'rolling' ? 'rolling' : 'calendar',
    window_length: len,
    window_unit: unit,
    reset_time: RESET_RE.test(String(r.reset_time ?? '')) ? String(r.reset_time) : d.reset_time,
    block: r.block === 'discount' || r.block === 'cashback' || r.block === 'both' ? r.block : d.block,
    waive_platform_fee: r.waive_platform_fee !== false,
    message: message ? message.slice(0, BENEFIT_CAP_MESSAGE_MAX) : null,
  };
}

export function blockedBenefits(block: BenefitCapBlock): {
  discount: boolean;
  cashback: boolean;
  wallet: boolean;
} {
  return {
    discount: block === 'discount' || block === 'both',
    cashback: block === 'cashback' || block === 'both',
    wallet: block === 'cashback' || block === 'both',
  };
}
