'use client';

/**
 * Service pricing display — delegates to unified PriceDisplay / ServiceListingPrice.
 * Preserves legacy props for existing call sites.
 */

import { PriceDisplay } from '@/components/customer/pricing/PriceDisplay';
import { ServiceListingPrice } from '@/components/customer/pricing/ServiceListingPrice';
import { SavingsBadge } from '@/components/customer/pricing/SavingsBadge';
import { hasEffectivePriceReduction } from '@warmpawz/shared-types';

interface ServicePricingDisplayProps {
  basePrice: number;
  vendorDiscount?: number;
  vendorDiscountAmount?: number;
  discountedPrice?: number;
  platformDiscount?: number;
  showPlatformDiscount?: boolean;
  vendorId?: string;
  serviceId?: string;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
  usePromoQuote?: boolean;
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
  vendorId,
  serviceId,
  customerId,
  serviceStyle,
  serviceCategory,
  usePromoQuote = false,
  className = '',
}: ServicePricingDisplayProps) {
  if (usePromoQuote && vendorId) {
    return (
      <ServiceListingPrice
        basePrice={basePrice}
        vendorId={vendorId}
        serviceId={serviceId}
        customerId={customerId}
        serviceStyle={serviceStyle}
        serviceCategory={serviceCategory}
        vendorDiscount={vendorDiscount}
        vendorDiscountAmount={vendorDiscountAmount}
        className={className}
      />
    );
  }

  const finalVendorPrice =
    discountedPrice ??
    (vendorDiscount
      ? basePrice * (1 - vendorDiscount / 100)
      : vendorDiscountAmount
        ? basePrice - vendorDiscountAmount
        : basePrice);

  const showVendorDiscountChrome = hasEffectivePriceReduction(basePrice, finalVendorPrice);
  const finalPrice =
    showPlatformDiscount && platformDiscount
      ? finalVendorPrice * (1 - platformDiscount / 100)
      : finalVendorPrice;

  return (
    <div className={`flex min-w-0 max-w-[11rem] flex-col items-end gap-1 text-right ${className}`}>
      <PriceDisplay
        originalPrice={basePrice}
        currentPrice={finalPrice}
        size="md"
        showSavings={false}
        align="end"
      />
      {showVendorDiscountChrome && (
        <SavingsBadge variant="vendor_offer" className="w-fit" />
      )}
      {showPlatformDiscount && platformDiscount != null && platformDiscount > 0 && (
        <SavingsBadge variant="platform_offer" className="w-fit" />
      )}
    </div>
  );
}

export default ServicePricingDisplay;
