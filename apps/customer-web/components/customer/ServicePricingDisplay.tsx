'use client';

/**
 * ============================================================================
 * SERVICE PRICING DISPLAY COMPONENT
 * ============================================================================
 * 
 * Displays service pricing with vendor and platform discount distinction
 * - Vendor discounts shown at service listing level
 * - Platform discounts shown only at payment page
 * 
 * Fixes GAP-7.1: Vendor Discount vs Platform Discount Distinction
 * Date: 2026-01-28
 * ============================================================================
 */

import { Badge } from '@/components/ui/badge';

interface ServicePricingDisplayProps {
  basePrice: number;
  vendorDiscount?: number; // Percentage discount from vendor
  vendorDiscountAmount?: number; // Fixed discount amount
  discountedPrice?: number; // Price after vendor discount
  platformDiscount?: number; // Platform discount (only shown at payment)
  showPlatformDiscount?: boolean; // Whether to show platform discount (default: false)
  currency?: string;
  className?: string;
}

export function ServicePricingDisplay({
  basePrice,
  vendorDiscount,
  vendorDiscountAmount,
  discountedPrice,
  platformDiscount,
  showPlatformDiscount = false,
  currency = '₹',
  className = '',
}: ServicePricingDisplayProps) {
  // Calculate final price
  const finalVendorPrice = discountedPrice || 
    (vendorDiscount 
      ? basePrice * (1 - vendorDiscount / 100)
      : vendorDiscountAmount
        ? basePrice - vendorDiscountAmount
        : basePrice);

  const hasVendorDiscount = vendorDiscount !== undefined || vendorDiscountAmount !== undefined;
  const finalPrice = showPlatformDiscount && platformDiscount
    ? finalVendorPrice * (1 - platformDiscount / 100)
    : finalVendorPrice;

  return (
    <div className={`flex min-w-0 max-w-full flex-col gap-1 ${className}`}>
      {/* Price Display — flex-wrap so strike + sale price never push past narrow columns */}
      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
        {hasVendorDiscount && (
          <>
            {/* Original Price - Strikethrough */}
            <span className="line-through text-gray-400 text-sm">
              {currency}{basePrice.toFixed(0)}
            </span>
            {/* Discounted Price */}
            <span className="text-[#FF8C42] font-bold text-lg">
              {currency}{finalVendorPrice.toFixed(0)}
            </span>
          </>
        )}
        {!hasVendorDiscount && (
          <span className="text-gray-900 font-semibold text-lg">
            {currency}{basePrice.toFixed(0)}
          </span>
        )}
      </div>

      {/* Vendor Discount Badge */}
      {hasVendorDiscount && (
        <Badge className="bg-orange-100 text-orange-700 rounded-full px-2 py-1 text-xs w-fit">
          {vendorDiscount 
            ? `Vendor Discount ${vendorDiscount}%`
            : vendorDiscountAmount
              ? `Vendor Discount ${currency}${vendorDiscountAmount}`
              : 'Vendor Discount'}
        </Badge>
      )}

      {/* Platform Discount (only shown at payment page) */}
      {showPlatformDiscount && platformDiscount && (
        <div className="text-blue-600 text-sm mt-1">
          Platform Discount: -{currency}{((finalVendorPrice * platformDiscount) / 100).toFixed(0)}
        </div>
      )}
    </div>
  );
}

export default ServicePricingDisplay;
