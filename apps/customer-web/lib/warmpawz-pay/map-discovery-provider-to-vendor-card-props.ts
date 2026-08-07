import type { MouseEvent } from 'react';
import type { WarmpawzPayVendorCardProps } from '@/components/warmpawz-pay/vendor-card/types';
import type { DiscoveryProviderCardSource } from '@/lib/warmpawz-pay/discovery-provider-card-source';
import {
  DISCOVERY_VENDOR_CARD_PRIMARY_CTA,
  DISCOVERY_VENDOR_CARD_SECONDARY_CTA,
} from '@/lib/warmpawz-pay/discovery-vendor-card-cta-meta';
import { formatDistanceDisplay } from '@/lib/distance-display';
import {
  normalizeWpayVendorCardAddress,
  resolveWpayVendorCardRating,
} from '@/lib/warmpawz-pay/wpay-vendor-card-map-utils';
import {
  extractImageFieldsFromRow,
  logDiscoveryImageStage,
} from '@/lib/warmpawz-pay/debug-log-discovery-image';

export type { DiscoveryProviderCardSource } from '@/lib/warmpawz-pay/discovery-provider-card-source';

export type MapDiscoveryProviderToVendorCardOpts = {
  provider: DiscoveryProviderCardSource;
  subtitle: string;
  address: string;
  footerHint?: string;
  primaryLabel: string;
  onPrimary: (event: MouseEvent<HTMLButtonElement>) => void;
  secondaryLabel?: string;
  onSecondary?: (event: MouseEvent<HTMLButtonElement>) => void;
  onProfileClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  profileAriaLabel?: string;
  verifiedAriaLabel?: string;
  primaryActionClassName?: string;
  secondaryActionClassName?: string;
};

function resolveDiscoveryAvailabilityText(provider: DiscoveryProviderCardSource): string | undefined {
  const slot = provider.nextAvailableSlot?.trim();
  if (slot) return `Next: ${slot}`;
  const text = provider.availabilityText?.trim();
  return text || undefined;
}

function buildRichDiscoveryActions(opts: MapDiscoveryProviderToVendorCardOpts) {
  const {
    primaryLabel,
    onPrimary,
    secondaryLabel,
    onSecondary,
    primaryActionClassName,
    secondaryActionClassName,
  } = opts;
  return {
    secondaryAction:
      onSecondary && secondaryLabel
        ? {
            label: secondaryLabel,
            subtitle: DISCOVERY_VENDOR_CARD_SECONDARY_CTA.subtitle,
            icon: DISCOVERY_VENDOR_CARD_SECONDARY_CTA.icon,
            variant: 'outline' as const,
            className: secondaryActionClassName,
            onClick: onSecondary,
          }
        : undefined,
    primaryAction: {
      label: primaryLabel,
      subtitle: DISCOVERY_VENDOR_CARD_PRIMARY_CTA.subtitle,
      icon: DISCOVERY_VENDOR_CARD_PRIMARY_CTA.icon,
      variant: 'outline' as const,
      className: primaryActionClassName,
      onClick: onPrimary,
    },
  };
}

function resolveDiscoveryDistanceText(provider: DiscoveryProviderCardSource): string | undefined {
  if (provider.distanceText?.trim()) {
    return provider.distanceText.trim();
  }
  const formatted = formatDistanceDisplay({ distance: provider.distance });
  if (!formatted) return undefined;
  return formatted.toLowerCase().includes('away') ? formatted : `${formatted} away`;
}

export function mapDiscoveryProviderToVendorCardProps(
  opts: MapDiscoveryProviderToVendorCardOpts,
): WarmpawzPayVendorCardProps {
  const {
    provider,
    subtitle,
    address,
    footerHint,
    onProfileClick,
    profileAriaLabel,
    verifiedAriaLabel,
  } = opts;

  const experienceText =
    provider.experienceYears && provider.providerType !== 'vendor'
      ? `${provider.experienceYears} years experience`
      : undefined;

  const actions = buildRichDiscoveryActions(opts);

  const imageUrl = provider.photo ?? null;

  if (/bindu vet clinic/i.test(provider.name || '')) {
    logDiscoveryImageStage('mapDiscoveryProviderToVendorCardProps.input', {
      vendorName: provider.name,
      providerPhoto: provider.photo ?? null,
      providerRawImageFields: extractImageFieldsFromRow(provider as unknown as Record<string, unknown>),
    });
    logDiscoveryImageStage('mapDiscoveryProviderToVendorCardProps.output', {
      vendorName: provider.name,
      imageUrl,
      imageLostAt: imageUrl ? null : 'provider.photo was null/undefined → imageUrl set to null at map-discovery-provider-to-vendor-card-props.ts imageUrl assignment',
    });
  }

  return {
    variant: 'rich',
    name: provider.name,
    imageUrl,
    subtitle,
    categoryLabel: subtitle,
    showVerified: provider.isVerified,
    rating: resolveWpayVendorCardRating(provider.rating, provider.reviewCount),
    address: normalizeWpayVendorCardAddress(address),
    city: provider.city?.trim() || undefined,
    distanceText: resolveDiscoveryDistanceText(provider),
    availabilityText: resolveDiscoveryAvailabilityText(provider),
    experienceText,
    footerHint,
    profileAriaLabel,
    verifiedAriaLabel,
    onProfileClick: onProfileClick ?? opts.onPrimary,
    ...actions,
  };
}
