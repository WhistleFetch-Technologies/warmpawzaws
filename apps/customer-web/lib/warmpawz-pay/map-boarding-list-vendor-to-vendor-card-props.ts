import type { MouseEvent } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { pickCustomerVendorAccountId, pickWalkerVendorId } from '@warmpawz/shared-types';
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

export type WalkerRowSource = Record<string, unknown> & {
  id?: string;
  vendorId?: string;
  name?: string;
  businessName?: string;
  business_name?: string;
  photo?: string;
  profileImage?: string;
  profile_image?: string;
  rating?: number;
  reviewCount?: number;
  reviewsCount?: number;
  totalReviews?: number;
  address?: string;
  city?: string;
  location?: { address?: string };
  isVerified?: boolean;
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

export type MapWalkerRowToVendorCardOpts = {
  walker: WalkerRowSource;
  router: AppRouterInstance;
  onSelectSlot: (walker: WalkerRowSource, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenProfile: (event: MouseEvent<HTMLButtonElement>, walker: WalkerRowSource) => void;
  showPayCta?: boolean;
};

export function resolveWalkerRowName(walker: WalkerRowSource): string {
  return String(walker.name || walker.businessName || walker.business_name || 'Pet Walker').trim();
}

export function resolveWalkerRowAddress(walker: WalkerRowSource): string {
  const loc = walker.location as { address?: string } | undefined;
  const raw = String(loc?.address || walker.address || walker.city || '').trim();
  return raw || 'Location on booking';
}

export function walkerRowToDiscoverySource(walker: WalkerRowSource): BoardingListVendorDiscoverySource {
  const name = resolveWalkerRowName(walker);
  const vendorId = pickWalkerVendorId(walker) || String(walker.id || walker.vendorId || '').trim();
  const reviewCount =
    Number(walker.reviewCount ?? walker.reviewsCount ?? walker.totalReviews ?? 0) || 0;
  const ratingRaw = walker.rating != null ? Number(walker.rating) : NaN;
  const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : undefined;
  const photo =
    (typeof walker.photo === 'string' && walker.photo) ||
    (typeof walker.profileImage === 'string' && walker.profileImage) ||
    (typeof walker.profile_image === 'string' && walker.profile_image) ||
    undefined;
  const nextSlot = resolveNextAvailableLabel(walker);

  return {
    name,
    photo,
    isVerified: Boolean(walker.isVerified),
    rating,
    reviewCount: reviewCount > 0 ? reviewCount : undefined,
    nextAvailableSlot: nextSlot ?? undefined,
    providerType: 'vendor',
    city: typeof walker.city === 'string' ? walker.city : undefined,
    vendorId: vendorId || undefined,
  };
}

export function mapWalkerRowToVendorCardProps(
  opts: MapWalkerRowToVendorCardOpts,
): WarmpawzPayVendorCardProps {
  const { walker, router, onSelectSlot, onOpenProfile, showPayCta = true } = opts;
  const provider = walkerRowToDiscoverySource(walker);
  const vendorId = String(provider.vendorId || '').trim();
  const name = resolveWalkerRowName(walker);
  const address = resolveWalkerRowAddress(walker);
  const nextSlot = provider.nextAvailableSlot;

  return mapDiscoveryProviderToVendorCardProps({
    provider,
    subtitle: 'Pet Walker',
    address,
    footerHint: nextSlot ? `Next: ${nextSlot}` : 'Tap to view profile & book',
    profileAriaLabel: `View profile: ${name}`,
    verifiedAriaLabel: 'Verified provider',
    primaryActionClassName: 'text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10',
    primaryLabel: 'Select Slot for Appointment',
    onPrimary: (e) => onSelectSlot(walker, e),
    onProfileClick: (e) => onOpenProfile(e, walker),
    secondaryLabel: showPayCta ? 'Pay with Warmpawz' : undefined,
    onSecondary:
      showPayCta && vendorId
        ? (e) => {
            e.stopPropagation();
            launchWarmpawzPayServiceBooking({
              router,
              serviceKey: 'walker',
              category: 'walking',
              vendorId,
            });
          }
        : undefined,
  });
}
