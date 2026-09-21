'use client';

/**
 * Earn-preview card for Promotion Engine pending cashback / discount.
 * Shown on booking, ecom, WPay, and package checkouts (Phase 4).
 */

export type PromoEngineEarnPreviewData = {
  evaluationId?: string | null;
  pendingCashback?: number | null;
  engineDiscount?: number | null;
  eligible?: boolean | null;
  redeemScope?: string[] | null;
  redeemLabel?: string | null;
  expiryDays?: number | null;
};

function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function scopeLabel(scope?: string[] | null): string {
  if (!scope?.length) return 'any eligible service';
  return scope
    .map((s) =>
      String(s)
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(', ');
}

export function PromoEarnPreview({
  data,
  className = '',
}: {
  data: PromoEngineEarnPreviewData | null | undefined;
  className?: string;
}) {
  if (!data?.eligible && !(Number(data?.pendingCashback) > 0) && !(Number(data?.engineDiscount) > 0)) {
    return null;
  }
  const cashback = Math.max(0, Number(data?.pendingCashback) || 0);
  const discount = Math.max(0, Number(data?.engineDiscount) || 0);
  if (cashback <= 0 && discount <= 0) return null;

  return (
    <div
      className={`rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 ${className}`}
      data-testid="promo-earn-preview"
    >
      {cashback > 0 ? (
        <p className="font-medium">
          Earn {formatInr(cashback)} cashback after payment
        </p>
      ) : null}
      {discount > 0 ? (
        <p className={cashback > 0 ? 'mt-0.5 text-xs text-emerald-800' : 'font-medium'}>
          Extra engine discount up to {formatInr(discount)}
        </p>
      ) : null}
      {cashback > 0 ? (
        <p className="mt-1 text-xs text-emerald-800/90">
          Redeem on {data?.redeemLabel || scopeLabel(data?.redeemScope)}
          {data?.expiryDays != null && data.expiryDays > 0
            ? ` · expires in ${data.expiryDays} days`
            : ''}
          . Credited only after successful payment — not before.
        </p>
      ) : null}
    </div>
  );
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
  };
}
