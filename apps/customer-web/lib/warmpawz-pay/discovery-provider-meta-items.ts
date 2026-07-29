import { Clock, Navigation } from 'lucide-react';
import { formatDistanceDisplay } from '@/lib/distance-display';
import type { WarmpawzPayVendorCardMetaItem } from '@/components/warmpawz-pay/vendor-card/types';
import type { DiscoveryProviderCardSource } from '@/lib/warmpawz-pay/discovery-provider-card-source';

/** Discovery appointment list meta rows (distance, city, availability, experience). */
export function buildDiscoveryProviderMetaItems(
  provider: DiscoveryProviderCardSource,
): WarmpawzPayVendorCardMetaItem[] | undefined {
  const metaItems: WarmpawzPayVendorCardMetaItem[] = [];

  const distanceText = formatDistanceDisplay({
    distanceText: provider.distanceText,
    distance: provider.distance,
  });
  if (distanceText) {
    metaItems.push({
      id: 'distance',
      label: `${distanceText} away`,
      icon: Navigation,
      tone: 'accent',
    });
  }

  if (provider.city?.trim()) {
    metaItems.push({
      id: 'city',
      label: provider.city.trim(),
      tone: 'muted',
    });
  }

  if (provider.nextAvailableSlot) {
    metaItems.push({
      id: 'availability',
      label: `Next: ${provider.nextAvailableSlot}`,
      icon: Clock,
      tone: 'success',
    });
  }

  if (provider.experienceYears && provider.providerType !== 'vendor') {
    metaItems.push({
      id: 'experience',
      label: `${provider.experienceYears} years experience`,
      tone: 'muted',
    });
  }

  return metaItems.length > 0 ? metaItems : undefined;
}
