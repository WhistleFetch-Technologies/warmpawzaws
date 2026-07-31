'use client';

import {
  formatInrAmount,
  resolveVendorOrderMoney,
  type VendorOrderMoneyInput,
} from '@/lib/vendor-order-money';

type VendorOrderMoneySummaryProps = {
  order: VendorOrderMoneyInput;
  className?: string;
};

/**
 * Vendor settlement-oriented breakdown.
 * Catalog base is always shown; platform discounts do not reduce vendor goods value.
 */
export function VendorOrderMoneySummary({
  order,
  className = '',
}: VendorOrderMoneySummaryProps) {
  const money = resolveVendorOrderMoney(order);

  return (
    <div
      className={`bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 space-y-2 ${className}`}
    >
      <div className="flex justify-between text-slate-600">
        <span>Item total (your catalog price)</span>
        <span className="font-medium text-slate-900 tabular-nums">
          {formatInrAmount(money.catalogSubtotal)}
        </span>
      </div>

      {/* Only show promo when the vendor funded it — platform promos are hidden. */}
      {money.isVendorFunded && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 space-y-1">
          <div className="flex justify-between text-sm text-amber-900">
            <span>Your promotion (you fund this)</span>
            <span className="tabular-nums">−{formatInrAmount(money.discountAmount)}</span>
          </div>
          <div className="flex justify-between text-sm text-amber-900 font-medium">
            <span>Your goods after promotion</span>
            <span className="tabular-nums">{formatInrAmount(money.vendorGoodsAmount)}</span>
          </div>
        </div>
      )}

      {money.taxIncluded > 0 && (
        <div className="flex justify-between text-slate-500 text-sm">
          <span>GST (included in catalog price)</span>
          <span className="tabular-nums">{formatInrAmount(money.taxIncluded)}</span>
        </div>
      )}

      <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 space-y-1.5 mt-1">
        <div className="flex justify-between text-sm font-semibold text-slate-900">
          <span>Settlement base (your goods)</span>
          <span className="tabular-nums text-orange-600">
            {formatInrAmount(money.vendorGoodsAmount)}
          </span>
        </div>
        {money.commissionAmount != null && money.commissionAmount > 0 && (
          <>
            <div className="flex justify-between text-sm text-slate-600">
              <span>
                Platform commission
                {!money.hasMixedCommissionRates &&
                money.commissionRate != null &&
                money.commissionRate > 0
                  ? ` (${money.commissionRate}%)`
                  : money.hasMixedCommissionRates
                    ? ' (mixed rates)'
                    : ''}
              </span>
              <span className="tabular-nums">−{formatInrAmount(money.commissionAmount)}</span>
            </div>
            {money.hasMixedCommissionRates && money.commissionLines.length > 0 && (
              <div className="space-y-1 pl-2 border-l-2 border-slate-200">
                {money.commissionLines.map((line, idx) => (
                  <div
                    key={`${line.productId ?? 'line'}-${idx}`}
                    className="flex justify-between text-xs text-slate-500"
                  >
                    <span>
                      {line.label} — {line.rate}%
                    </span>
                    <span className="tabular-nums">−{formatInrAmount(line.commission)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {money.vendorPayoutAmount != null && (
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100">
            <span>Your payout</span>
            <span className="tabular-nums text-emerald-700">
              {formatInrAmount(money.vendorPayoutAmount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
