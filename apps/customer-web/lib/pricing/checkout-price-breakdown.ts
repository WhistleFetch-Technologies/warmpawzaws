import type { PriceBreakdownLine } from './types';

export type CheckoutTaxBreakdown = {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  taxRate: number;
  isInterState: boolean;
};

export type CheckoutPlatformFees = {
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  packagingFee: number;
};

export type BuildCheckoutPriceLinesParams = {
  subtotalLabel: string;
  subtotal: number;
  vendorDiscount?: number;
  vendorDiscountLabel?: string;
  platformDiscount?: number;
  couponDiscount?: number;
  couponCode?: string;
  taxBreakdown: CheckoutTaxBreakdown;
  platformFees: CheckoutPlatformFees;
  includeDeliveryFee?: boolean;
  razorpayOffer?: { title: string; amount: number };
  walletAmount?: number;
  finalAmount: number;
  /** When set and discounts apply, inserts a subtotal row after discounts and before taxes/fees. */
  subtotalAfterDiscounts?: number;
};

export function buildCheckoutPriceLines(params: BuildCheckoutPriceLinesParams): PriceBreakdownLine[] {
  const {
    subtotalLabel,
    subtotal,
    vendorDiscount = 0,
    vendorDiscountLabel = 'Discount',
    platformDiscount = 0,
    couponDiscount = 0,
    couponCode,
    taxBreakdown,
    platformFees,
    includeDeliveryFee = true,
    razorpayOffer,
    walletAmount = 0,
    finalAmount,
    subtotalAfterDiscounts,
  } = params;

  const lines: PriceBreakdownLine[] = [
    { kind: 'base', label: subtotalLabel, amount: subtotal, emphasis: 'default' },
  ];

  if (vendorDiscount > 0) {
    lines.push({
      kind: 'vendor_discount',
      label: vendorDiscountLabel,
      amount: -vendorDiscount,
      emphasis: 'discount',
    });
  }
  if (platformDiscount > 0) {
    lines.push({
      kind: 'platform_discount',
      label: 'Platform offer',
      amount: -platformDiscount,
      emphasis: 'discount',
    });
  }
  if (couponDiscount > 0) {
    lines.push({
      kind: 'coupon',
      label: couponCode ? `Coupon (${couponCode})` : 'Coupon',
      amount: -couponDiscount,
      emphasis: 'discount',
    });
  }

  const promoSavings = vendorDiscount + platformDiscount + couponDiscount;
  if (promoSavings > 0) {
    lines.push({
      kind: 'savings',
      label: 'Promotion savings',
      amount: -promoSavings,
      emphasis: 'discount',
      indent: true,
    });
  }

  if (
    subtotalAfterDiscounts != null &&
    subtotalAfterDiscounts > 0 &&
    promoSavings > 0 &&
    subtotalAfterDiscounts < subtotal
  ) {
    lines.push({
      kind: 'subtotal',
      label: 'Subtotal',
      amount: subtotalAfterDiscounts,
      emphasis: 'default',
    });
  }

  if (taxBreakdown.isInterState) {
    lines.push({
      kind: 'tax',
      label: `IGST (${taxBreakdown.taxRate}%)`,
      amount: taxBreakdown.igst,
      emphasis: 'muted',
    });
  } else {
    if (taxBreakdown.cgst > 0) {
      lines.push({
        kind: 'tax',
        label: `CGST (${taxBreakdown.taxRate / 2}%)`,
        amount: taxBreakdown.cgst,
        emphasis: 'muted',
      });
    }
    if (taxBreakdown.sgst > 0) {
      lines.push({
        kind: 'tax',
        label: `SGST (${taxBreakdown.taxRate / 2}%)`,
        amount: taxBreakdown.sgst,
        emphasis: 'muted',
      });
    }
  }

  const splitTax = taxBreakdown.cgst + taxBreakdown.sgst + taxBreakdown.igst;
  if (taxBreakdown.totalTax > 0 && splitTax <= 0) {
    lines.push({
      kind: 'tax',
      label: 'Total tax',
      amount: taxBreakdown.totalTax,
      emphasis: 'muted',
    });
  } else if (taxBreakdown.totalTax > 0 && splitTax > 0 && splitTax !== taxBreakdown.totalTax) {
    lines.push({
      kind: 'tax',
      label: 'Total tax',
      amount: taxBreakdown.totalTax,
      emphasis: 'muted',
      indent: true,
    });
  }

  if (platformFees.platformFee > 0) {
    lines.push({
      kind: 'platform_fee',
      label: 'Platform fee',
      amount: platformFees.platformFee,
      emphasis: 'muted',
    });
  }
  if (platformFees.convenienceFee > 0) {
    lines.push({
      kind: 'convenience_fee',
      label: 'Convenience fee',
      amount: platformFees.convenienceFee,
      emphasis: 'muted',
    });
  }
  if (includeDeliveryFee && platformFees.deliveryFee > 0) {
    lines.push({
      kind: 'delivery_fee',
      label: 'Delivery fee',
      amount: platformFees.deliveryFee,
      emphasis: 'muted',
    });
  }
  if (platformFees.packagingFee > 0) {
    lines.push({
      kind: 'packaging_fee',
      label: 'Packaging fee',
      amount: platformFees.packagingFee,
      emphasis: 'muted',
    });
  }

  if (razorpayOffer && razorpayOffer.amount > 0) {
    lines.push({
      kind: 'other_discount',
      label: razorpayOffer.title,
      amount: -razorpayOffer.amount,
      emphasis: 'discount',
    });
  }
  if (walletAmount > 0) {
    lines.push({
      kind: 'wallet',
      label: 'Wallet',
      amount: -walletAmount,
      emphasis: 'discount',
    });
  }

  lines.push({
    kind: 'final',
    label: 'Final amount',
    amount: finalAmount,
    emphasis: 'total',
  });

  return lines;
}

export function checkoutTotalSavings(params: {
  vendorDiscount?: number;
  platformDiscount?: number;
  couponDiscount?: number;
  walletAmount?: number;
  razorpayOfferAmount?: number;
}): number {
  return (
    (params.vendorDiscount ?? 0) +
    (params.platformDiscount ?? 0) +
    (params.couponDiscount ?? 0) +
    (params.walletAmount ?? 0) +
    (params.razorpayOfferAmount ?? 0)
  );
}
