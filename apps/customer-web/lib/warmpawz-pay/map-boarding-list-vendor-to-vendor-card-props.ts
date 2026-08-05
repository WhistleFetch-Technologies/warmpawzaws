import type { MouseEvent } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import type { WarmpawzPayVendorCardProps } from '@/components/warmpawz-pay/vendor-card/types';
import type { BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import { mapServiceKeyToWpayCategory } from '@/lib/commerce-switch-routing/map-service-to-wpay-category';
import type { DiscoveryProviderCardSource } from '@/lib/warmpawz-pay/discovery-provider-card-source';
import { mapDiscoveryProviderToVendorCardProps } from '@/lib/warmpawz-pay/map-discovery-provider-to-vendor-card-props';

export type BoardingListVendorDiscoverySource = DiscoveryProviderCardSource & {
  vendorId?: string;
};

export function boardingListVendorToDiscoverySource(
  v: BoardingListVendor,
): BoardingListVendorDiscoverySource {
  const raw = (v.raw ?? {}) as Record<string, unknown>;
  const nextSlot = resolveNextAvailableLabel(raw);
  const city =
    typeof raw.city === 'string'
      ? raw.city
      : typeof raw.vendorCity === 'string'
        ? raw.vendorCity
        : undefined;

  return {
    name: v.name,
    photo: v.photo,
    isVerified: v.isVerified,
    rating: v.rating,
    reviewCount: v.review_count,
    distance: v.distanceKm,
    distanceText: typeof v.distance === 'string' ? v.distance : undefined,
    nextAvailableSlot: nextSlot ?? undefined,
    providerType: 'vendor',
    city,
    vendorId: pickCustomerVendorAccountId(raw) || v.id,
  };
}

export function resolveBoardingListVendorSubtitle(
  v: BoardingListVendor,
  fallback?: string,
): string {
  const raw = (v.raw ?? {}) as Record<string, unknown>;
  const roleLabel = String(
    raw.roleDisplayName || raw.roleName || raw.vendorType || '',
  ).trim();
  return roleLabel || fallback || '';
}

export function resolveBoardingListVendorAddress(v: BoardingListVendor): string {
  if (typeof v.address === 'string' && v.address.trim()) {
    return v.address.trim();
  }
  return 'Location on booking';
}

export type MapBoardingListVendorToVendorCardOpts = {
  vendor: BoardingListVendor;
  category: string;
  serviceKey?: string;
  categoryLabelFallback?: string;
  router: AppRouterInstance;
  onSelectSlot: (vendor: BoardingListVendor, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenProfile: (event: MouseEvent<HTMLButtonElement>, vendor: BoardingListVendor) => void;
  showPayCta?: boolean;
};

export function mapBoardingListVendorToVendorCardProps(
  opts: MapBoardingListVendorToVendorCardOpts,
): WarmpawzPayVendorCardProps {
  const {
    vendor,
    category,
    serviceKey,
    categoryLabelFallback,
    router,
    onSelectSlot,
    onOpenProfile,
    showPayCta = true,
  } = opts;

  const provider = boardingListVendorToDiscoverySource(vendor);
  const vendorId = String(provider.vendorId || '').trim();
  const wpayCategory = mapServiceKeyToWpayCategory(serviceKey ?? category, category);
  const subtitle = resolveBoardingListVendorSubtitle(vendor, categoryLabelFallback);
  const address = resolveBoardingListVendorAddress(vendor);
  const nextSlot = provider.nextAvailableSlot;

  return mapDiscoveryProviderToVendorCardProps({
    provider,
    subtitle,
    address,
    footerHint: nextSlot ? `Next: ${nextSlot}` : 'Tap to view profile & book',
    profileAriaLabel: `View profile: ${vendor.name}`,
    verifiedAriaLabel: 'Verified provider',
    primaryActionClassName: 'text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10',
    primaryLabel: 'Select Slot for Appointment',
    onPrimary: (e) => onSelectSlot(vendor, e),
    onProfileClick: (e) => onOpenProfile(e, vendor),
    secondaryLabel: showPayCta ? 'Pay with Warmpawz' : undefined,
    onSecondary:
      showPayCta && vendorId
        ? (e) => {
            e.stopPropagation();
            launchWarmpawzPayServiceBooking({
              router,
              serviceKey: serviceKey ?? category,
              category: wpayCategory,
              vendorId,
            });
          }
        : undefined,
  });
}
