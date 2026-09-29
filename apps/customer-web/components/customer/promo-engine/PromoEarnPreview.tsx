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
};

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
  if (!data?.eligible && !(Number(data?.pendingCashback) > 0) && !(Number(data?.engineDiscount) > 0)) {
    return null;
  }
  const cashback = Math.max(0, Number(data?.pendingCashback) || 0);
  const discount = Math.max(0, Number(data?.engineDiscount) || 0);
  if (cashback <= 0 && discount <= 0) return null;

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

  return (
    <div
      className={`rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 ${className}`}
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
  };
}
