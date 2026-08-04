'use client';

import { formatInr } from '@/lib/pricing/format';
import type { BookingCardPriceView } from '@/lib/pricing/booking-financial';
import { PromotionOfferBadge } from './PromotionOfferBadge';
import { SavingsBadge } from './SavingsBadge';

export type BookingListCardPricingProps = {
  view: BookingCardPriceView;
  couponCode?: string;
  isPaid?: boolean;
};

export function BookingListCardPricing({
  view,
  couponCode,
  isPaid = false,
}: BookingListCardPricingProps) {
  const {
    servicePrice,
    serviceAfterDiscount,
    serviceDiscountPercent,
    platformFee,
    convenienceFee,
    deliveryFee,
    totalTax,
    totalPayable,
    serviceSavings,
    hasServiceDiscount,
  } = view;

  if (!hasServiceDiscount) {
    return (
      <span className="text-base font-bold text-gray-900">{formatInr(totalPayable)}</span>
    );
  }

  const feeLines: { label: string; amount: number }[] = [];
  if (totalTax > 0.009) feeLines.push({ label: 'GST', amount: totalTax });
  if (platformFee > 0.009) feeLines.push({ label: 'Platform fee', amount: platformFee });
  if (convenienceFee > 0.009) feeLines.push({ label: 'Convenience fee', amount: convenienceFee });
  if (deliveryFee > 0.009) feeLines.push({ label: 'Delivery fee', amount: deliveryFee });

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          Service
        </span>
        <span className="text-xs text-slate-400 cw-price-strike">{formatInr(servicePrice)}</span>
        <span className="text-sm font-semibold text-[#FF8C42]">
          {formatInr(serviceAfterDiscount)}
        </span>
        {serviceDiscountPercent != null && serviceDiscountPercent > 0 && (
          <PromotionOfferBadge variant="percent" value={serviceDiscountPercent} size="sm" />
        )}
      </div>

      {feeLines.map((line) => (
        <div key={line.label} className="flex items-center gap-2 text-[10px] text-slate-600">
          <span>{line.label}</span>
          <span className="font-medium text-slate-700">{formatInr(line.amount)}</span>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          {isPaid ? 'Total paid' : 'Total payable'}
        </span>
        <span className="text-sm font-bold text-[#FF8C42]">{formatInr(totalPayable)}</span>
      </div>

      {serviceSavings > 0.009 && (
        <p className="text-[10px] text-emerald-600">
          You save {formatInr(serviceSavings)} on service
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        <SavingsBadge variant="save_amount" amount={serviceSavings} />
        {couponCode ? (
          <SavingsBadge variant="coupon_applied" label={`Coupon: ${couponCode}`} />
        ) : (
          <SavingsBadge variant="auto_applied" />
        )}
      </div>
    </div>
  );
}
