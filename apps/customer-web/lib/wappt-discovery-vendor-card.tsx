import type { MouseEvent } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { mapDiscoveryProviderToVendorCardProps } from '@/lib/warmpawz-pay/map-discovery-provider-to-vendor-card-props';
import type { DiscoveryProviderCardSource } from '@/lib/warmpawz-pay/discovery-provider-card-source';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import { mapServiceKeyToWpayCategory } from '@/lib/commerce-switch-routing/map-service-to-wpay-category';

export type WapptDiscoveryVendorCardSource = DiscoveryProviderCardSource & {
  providerId?: string;
  vendorId?: string;
};

export type BuildWapptDiscoveryVendorCardPropsOpts = {
  provider: WapptDiscoveryVendorCardSource;
  subtitle: string;
  address: string;
  category: string;
  serviceKey?: string;
  onPrimary: (event: MouseEvent<HTMLButtonElement>) => void;
  onProfileClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  router: AppRouterInstance;
  primaryLabel?: string;
  secondaryLabel?: string;
  showPayCta?: boolean;
};

/** Shared Book Appointment + Pay with Warmpawz card props for WAPPT discovery lists. */
export function buildWapptDiscoveryVendorCardProps(opts: BuildWapptDiscoveryVendorCardPropsOpts) {
  const {
    provider,
    subtitle,
    address,
    category,
    serviceKey,
    onPrimary,
    onProfileClick,
    router,
    primaryLabel = 'Select Slot for Appointment',
    secondaryLabel = 'Pay with Warmpawz',
    showPayCta = true,
  } = opts;
  const wpayCategory = mapServiceKeyToWpayCategory(serviceKey ?? category, category);
  const vendorId = String(provider.vendorId || provider.providerId || '').trim();

  const base = mapDiscoveryProviderToVendorCardProps({
    provider: {
      name: provider.name,
      photo: provider.photo,
      isVerified: provider.isVerified,
      rating: provider.rating,
      reviewCount: provider.reviewCount,
      distance: provider.distance,
      distanceText: provider.distanceText,
      nextAvailableSlot: provider.nextAvailableSlot,
      experienceYears: provider.experienceYears,
      providerType: provider.providerType,
      city: provider.city,
    },
    subtitle,
    address,
    footerHint: provider.nextAvailableSlot
      ? `Next: ${provider.nextAvailableSlot}`
      : 'Tap to view profile & book',
    profileAriaLabel: `View profile: ${provider.name}`,
    verifiedAriaLabel: 'Verified provider',
    primaryActionClassName: 'text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10',
    primaryLabel,
    onPrimary,
    onProfileClick: onProfileClick ?? onPrimary,
    secondaryLabel,
    onSecondary: showPayCta
      ? (e) => {
          e.stopPropagation();
          if (!vendorId) return;
          launchWarmpawzPayServiceBooking({
            router,
            serviceKey: serviceKey ?? category,
            category: wpayCategory,
            vendorId,
          });
        }
      : undefined,
  });

  if (!showPayCta) {
    return { ...base, secondaryAction: undefined };
  }
  return base;
}
