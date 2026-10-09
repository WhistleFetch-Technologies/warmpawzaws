import type { AppliedBenefit, EvaluateResult } from '../types';
import { blockedBenefits, type BenefitCapConfig } from './config';
import { formatIstResumeTime } from './window';

export const BENEFIT_CAP_CODE = 'BENEFIT_CAP_REACHED' as const;

/** Customer-facing notice attached to quotes once the customer is over the cap. */
export interface BenefitCapNotice {
  code: typeof BENEFIT_CAP_CODE;
  cap: number;
  used: number;
  blocked: { discount: boolean; cashback: boolean; wallet: boolean };
  platformFeeWaived: boolean;
  resumeAt: string | null;
  window: {
    type: BenefitCapConfig['window_type'];
    length: number;
    unit: BenefitCapConfig['window_unit'];
    resetTime: string | null;
  };
  message: string;
}

export const DEFAULT_BENEFIT_CAP_MESSAGE =
  "You've used {cap} offer payments in this period. This payment won't get {blocked}.{fee} Offers resume {resume_at}.";

function blockedPhrase(b: BenefitCapNotice['blocked']): string {
  if (b.discount && b.cashback) return 'a discount, cashback or wallet use';
  if (b.discount) return 'a discount';
  return 'cashback or wallet use';
}

export function renderBenefitCapMessage(
  template: string | null,
  n: Omit<BenefitCapNotice, 'message'>,
): string {
  const vars: Record<string, string> = {
    cap: String(n.cap),
    used: String(n.used),
    blocked: blockedPhrase(n.blocked),
    fee: n.platformFeeWaived ? ' The platform fee is waived on this payment.' : '',
    resume_at: n.resumeAt ? `on ${formatIstResumeTime(new Date(n.resumeAt))}` : 'soon',
  };
  return (template || DEFAULT_BENEFIT_CAP_MESSAGE)
    .replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? vars[key] : whole))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildBenefitCapNotice(opts: {
  cfg: BenefitCapConfig;
  used: number;
  resumeAt: Date | null;
  channel?: string | null;
}): BenefitCapNotice {
  const base: Omit<BenefitCapNotice, 'message'> = {
    code: BENEFIT_CAP_CODE,
    cap: opts.cfg.max_benefit_payments,
    used: opts.used,
    blocked: blockedBenefits(opts.cfg.block),
    // Pay Bill is the only channel whose platform fee the server owns.
    platformFeeWaived: opts.cfg.waive_platform_fee && opts.channel === 'paybill',
    resumeAt: opts.resumeAt ? opts.resumeAt.toISOString() : null,
    window: {
      type: opts.cfg.window_type,
      length: opts.cfg.window_length,
      unit: opts.cfg.window_unit,
      resetTime: opts.cfg.window_type === 'calendar' ? opts.cfg.reset_time : null,
    },
  };
  return { ...base, message: renderBenefitCapMessage(opts.cfg.message, base) };
}

export function isBenefitBlocked(b: Pick<AppliedBenefit, 'benefit_type'>, notice: BenefitCapNotice): boolean {
  return b.benefit_type === 'DISCOUNT' ? notice.blocked.discount : notice.blocked.cashback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Drops the blocked benefits from an evaluate result and recomputes its summary.
 * Promotions, ranges and limits were already resolved; this only removes the payout.
 */
export function applyBenefitCapToResult<T extends Omit<EvaluateResult, 'evaluation_id'>>(
  body: T,
  notice: BenefitCapNotice,
): T {
  const kept = body.benefits.filter((b) => !isBenefitBlocked(b, notice));
  const discount = round2(kept.filter((b) => b.benefit_type === 'DISCOUNT').reduce((s, b) => s + b.amount, 0));
  const cashback = round2(kept.filter((b) => b.benefit_type === 'CASHBACK').reduce((s, b) => s + b.amount, 0));
  const gross = Number(body.summary.gross_amount) || 0;
  const anyKept = kept.length > 0;
  const capped = body.winner_promotion_id && kept.length < body.benefits.length;
  return {
    ...body,
    eligible: anyKept,
    winner_promotion_id: anyKept ? body.winner_promotion_id : null,
    customer_copy: anyKept ? body.customer_copy ?? null : null,
    benefits: kept,
    summary: {
      gross_amount: gross,
      discount,
      payable: round2(Math.max(0, gross - discount)),
      cashback,
    },
    explain: {
      ...body.explain,
      rejected_promotions: capped
        ? [
            ...body.explain.rejected_promotions,
            { promotion_id: String(body.winner_promotion_id), reason: BENEFIT_CAP_CODE },
          ]
        : body.explain.rejected_promotions,
    },
    benefit_cap: notice,
  };
}
