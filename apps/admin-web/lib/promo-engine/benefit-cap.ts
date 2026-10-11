import { apiClient } from '@/lib/api-client';

const URL = '/admin/promo-engine/settings/benefit-cap';

export type BenefitCapWindowType = 'calendar' | 'rolling';
export type BenefitCapWindowUnit = 'hours' | 'days' | 'weeks';
export type BenefitCapBlock = 'discount' | 'cashback' | 'both';

/** Global per-customer cap on benefit payments; mirrors backend promo_engine_settings.benefit_cap. */
export interface BenefitCapConfig {
  enabled: boolean;
  max_benefit_payments: number;
  window_type: BenefitCapWindowType;
  window_length: number;
  window_unit: BenefitCapWindowUnit;
  reset_time: string;
  block: BenefitCapBlock;
  waive_platform_fee: boolean;
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

export const BENEFIT_CAP_MESSAGE_MAX = 300;
const UNIT_HOURS: Record<BenefitCapWindowUnit, number> = { hours: 1, days: 24, weeks: 168 };

export const DEFAULT_BENEFIT_CAP_MESSAGE =
  "You've used {cap} offer payments in this period. This payment won't get {blocked}.{fee} Offers resume {resume_at}.";

export async function fetchBenefitCapSettings(): Promise<{
  benefitCap: BenefitCapConfig;
  updatedBy: string | null;
  updatedAt: string | null;
}> {
  const res = await apiClient.get<{
    benefitCap?: BenefitCapConfig;
    updatedBy?: string | null;
    updatedAt?: string | null;
  }>(URL);
  return {
    benefitCap: { ...DEFAULT_BENEFIT_CAP, ...(res.benefitCap ?? {}) },
    updatedBy: res.updatedBy ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function saveBenefitCapSettings(cfg: BenefitCapConfig): Promise<BenefitCapConfig> {
  const res = await apiClient.put<{ benefitCap?: BenefitCapConfig; errors?: string[]; error?: string }>(URL, {
    benefitCap: cfg,
  });
  if (!res.benefitCap) throw new Error(res.errors?.join('. ') || res.error || 'Save failed');
  return res.benefitCap;
}

/** Same rules as the backend validator, so admins see errors before saving. */
export function validateBenefitCap(cfg: BenefitCapConfig): string[] {
  const errors: string[] = [];
  const max = cfg.max_benefit_payments;
  if (!Number.isInteger(max) || max < 1 || max > 100) errors.push('Max payments must be 1 to 100');
  const len = cfg.window_length;
  if (!Number.isInteger(len) || len < 1) errors.push('Window length must be 1 or more');
  else if (len * UNIT_HOURS[cfg.window_unit] > 720) errors.push('Window cannot be longer than 30 days');
  if (cfg.window_type === 'calendar' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cfg.reset_time)) {
    errors.push('Reset time must be HH:MM (24-hour, IST)');
  }
  if ((cfg.message ?? '').trim().length > BENEFIT_CAP_MESSAGE_MAX) {
    errors.push(`Message must be ${BENEFIT_CAP_MESSAGE_MAX} characters or fewer`);
  }
  return errors;
}

function blockedPhrase(block: BenefitCapBlock): string {
  if (block === 'both') return 'a discount, cashback or wallet use';
  if (block === 'discount') return 'a discount';
  return 'cashback or wallet use';
}

export function describeBenefitCapWindow(cfg: BenefitCapConfig): string {
  const unit = cfg.window_length === 1 ? cfg.window_unit.replace(/s$/, '') : cfg.window_unit;
  const span = `${cfg.window_length} ${unit}`;
  return cfg.window_type === 'calendar'
    ? `Fixed ${span} windows starting ${cfg.reset_time} IST`
    : `Rolling last ${span}`;
}

/** Customer message as rendered on a Pay Bill checkout (sample resume time). */
export function previewBenefitCapMessage(cfg: BenefitCapConfig): string {
  const vars: Record<string, string> = {
    cap: String(cfg.max_benefit_payments),
    used: String(cfg.max_benefit_payments),
    blocked: blockedPhrase(cfg.block),
    fee: cfg.waive_platform_fee ? ' The platform fee is waived on this payment.' : '',
    resume_at: 'on 10 Oct at 12:00 AM',
  };
  return (cfg.message?.trim() || DEFAULT_BENEFIT_CAP_MESSAGE)
    .replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? vars[key] : whole))
    .replace(/\s{2,}/g, ' ')
    .trim();
}
