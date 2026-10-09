'use client';

/**
 * Earn-preview card for Promotion Engine pending cashback / discount.
 * Shown on booking, ecom, WPay, and package checkouts (Phase 4).
 * Lines can be overridden per promotion from admin (metadata.customerCopy → customer_copy).
 */

export type PromoCustomerCopy = Partial<
  Record<
    | 'earnLine'
    | 'discountLine'
    | 'redeemLine'
    | 'termsLine'
    | 'savingsLine'
    | 'creditedTitle'
    | 'creditedBody',
    string
  >
>;

export type PromoEngineEarnPreviewData = {
  evaluationId?: string | null;
  pendingCashback?: number | null;
  engineDiscount?: number | null;
  eligible?: boolean | null;
  redeemScope?: string[] | null;
  redeemLabel?: string | null;
  expiryDays?: number | null;
  customerCopy?: PromoCustomerCopy | null;
  /** Set when the customer is over the global benefit payment cap for this window. */
  benefitCap?: PromoBenefitCapNotice | null;
};

export type PromoBenefitCapNotice = {
  code: string;
  cap: number;
  used: number;
  blocked: { discount: boolean; cashback: boolean; wallet: boolean };
  platformFeeWaived: boolean;
  resumeAt: string | null;
  message: string;
};

export function readBenefitCapNotice(raw: unknown): PromoBenefitCapNotice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const message = typeof r.message === 'string' ? r.message.trim() : '';
  if (!message) return null;
  const b = (r.blocked && typeof r.blocked === 'object' ? r.blocked : {}) as Record<string, unknown>;
  return {
    code: String(r.code || 'BENEFIT_CAP_REACHED'),
    cap: Number(r.cap) || 0,
    used: Number(r.used) || 0,
    blocked: { discount: b.discount === true, cashback: b.cashback === true, wallet: b.wallet === true },
    platformFeeWaived: r.platformFeeWaived === true,
    resumeAt: typeof r.resumeAt === 'string' ? r.resumeAt : null,
    message,
  };
}

export function BenefitCapNotice({
  notice,
  className = '',
}: {
  notice: PromoBenefitCapNotice | null | undefined;
  className?: string;
}) {
  if (!notice?.message) return null;
  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ${className}`}
      data-testid="benefit-cap-notice"
    >
      {notice.message}
    </div>
  );
}

export const DEFAULT_PROMO_COPY = {
  earnLine: 'Earn ₹{amount} cashback after payment',
  discountLine: 'Instant discount of ₹{discount} applied',
  redeemLine: 'Use it {redeemLabel} · valid {expiryDays} days',
  redeemLineNoExpiry: 'Use it {redeemLabel}',
  termsLine: 'Credited to your Warmpawz Wallet only after successful payment.',
  savingsLine: 'You save ₹{discount} with this offer!',
} as const;

function formatAmount(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

function scopeLabel(scope?: string[] | null): string {
  if (!scope?.length) return 'on any eligible service';
  return `on ${scope
    .map((s) =>
      String(s)
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(', ')}`;
}

export function renderPromoCopy(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => {
      const v = vars[key];
      return v == null || v === '' ? '' : String(v);
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pick(copy: PromoCustomerCopy | null | undefined, key: keyof PromoCustomerCopy): string | null {
  const v = copy?.[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

export function PromoEarnPreview({
  data,
  className = '',
  showSavingsLine = false,
}: {
  data: PromoEngineEarnPreviewData | null | undefined;
  className?: string;
  /** Adds a highlighted "You save ₹X" line when an instant discount applies. */
  showSavingsLine?: boolean;
}) {
  const capNotice = data?.benefitCap ? (
    <BenefitCapNotice notice={data.benefitCap} className={className} />
  ) : null;
  if (!data?.eligible && !(Number(data?.pendingCashback) > 0) && !(Number(data?.engineDiscount) > 0)) {
    return capNotice;
  }
  const cashback = Math.max(0, Number(data?.pendingCashback) || 0);
  const discount = Math.max(0, Number(data?.engineDiscount) || 0);
  if (cashback <= 0 && discount <= 0) return capNotice;

  const copy = data?.customerCopy ?? null;
  const expiryDays = data?.expiryDays != null && data.expiryDays > 0 ? data.expiryDays : null;
  const vars = {
    amount: formatAmount(cashback),
    discount: formatAmount(discount),
    expiryDays,
    expiryDate: null,
    redeemLabel: data?.redeemLabel || scopeLabel(data?.redeemScope),
  };
  const redeemTemplate =
    pick(copy, 'redeemLine') ??
    (expiryDays ? DEFAULT_PROMO_COPY.redeemLine : DEFAULT_PROMO_COPY.redeemLineNoExpiry);

  const card = (
    <div
      className={`rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 ${capNotice ? 'mt-2 ' : ''}${className}`}
      data-testid="promo-earn-preview"
    >
      {discount > 0 && showSavingsLine ? (
        <p className="font-semibold text-emerald-800" data-testid="promo-savings-line">
          {renderPromoCopy(pick(copy, 'savingsLine') ?? DEFAULT_PROMO_COPY.savingsLine, vars)}
        </p>
      ) : null}
      {cashback > 0 ? (
        <p className="flex items-center gap-1.5 font-medium">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-900 shadow-sm ring-1 ring-amber-500/50"
          >
            ₹
          </span>
          {renderPromoCopy(pick(copy, 'earnLine') ?? DEFAULT_PROMO_COPY.earnLine, vars)}
        </p>
      ) : null}
      {discount > 0 && !showSavingsLine ? (
        <p className={cashback > 0 ? 'mt-0.5 text-xs text-emerald-800' : 'font-medium'}>
          {renderPromoCopy(pick(copy, 'discountLine') ?? DEFAULT_PROMO_COPY.discountLine, vars)}
        </p>
      ) : null}
      {cashback > 0 ? (
        <>
          <p className="mt-1 text-xs text-emerald-800/90">{renderPromoCopy(redeemTemplate, vars)}</p>
          <p className="mt-0.5 text-[11px] text-emerald-800/80">
            {renderPromoCopy(pick(copy, 'termsLine') ?? DEFAULT_PROMO_COPY.termsLine, vars)}
          </p>
        </>
      ) : null}
    </div>
  );
  return capNotice ? (
    <>
      {capNotice}
      {card}
    </>
  ) : (
    card
  );
}

export function readPromoCustomerCopy(raw: unknown): PromoCustomerCopy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: PromoCustomerCopy = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) (out as Record<string, string>)[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function readPromoEngineFromQuote(raw: unknown): PromoEngineEarnPreviewData | null {
  if (!raw || typeof raw !== 'object') return null;
  const pe = (raw as { promoEngine?: Record<string, unknown> }).promoEngine;
  if (!pe || typeof pe !== 'object') return null;
  return {
    evaluationId: pe.evaluationId != null ? String(pe.evaluationId) : null,
    pendingCashback: Number(pe.pendingCashback ?? 0) || 0,
    engineDiscount: Number(pe.engineDiscount ?? 0) || 0,
    eligible: Boolean(pe.eligible),
    redeemScope: Array.isArray(pe.redeemScope)
      ? pe.redeemScope.map(String)
      : Array.isArray(pe.redeem_scope)
        ? (pe.redeem_scope as unknown[]).map(String)
        : null,
    expiryDays:
      pe.expiryDays != null
        ? Number(pe.expiryDays)
        : pe.expiry_days != null
          ? Number(pe.expiry_days)
          : null,
    customerCopy: readPromoCustomerCopy(pe.customerCopy ?? pe.customer_copy),
    benefitCap: readBenefitCapNotice(pe.benefitCap ?? pe.benefit_cap),
  };
}
