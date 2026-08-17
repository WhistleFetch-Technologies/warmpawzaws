'use client';

import type { MouseEvent, ReactNode } from 'react';
import { BoardingVendorExpandableCard } from '../boarding/BoardingVendorExpandableCard';
import {
  ServiceHubVendorCard,
  resolveServiceHubVendorProfileKey,
} from './ServiceHubVendorCard';
import { shouldUseWapptPayVendorCardUi } from '@/lib/commerce-switch-routing';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';

export type HubFeaturedVendorDiscoveryState = {
  selectedVendorId: string | null;
  setSelectedVendorId: (id: string | null) => void;
  toggleVendor: (id: string) => void;
  fetchingPlansFor: string | null;
};

export type HubFeaturedVendorListProps = {
  category: string;
  vendors: BoardingListVendor[];
  categoryLabelFallback?: string;
  planBadgeLabel?: string;
  serviceSlug?: BoardingServiceSlug;
  serviceCategory?: string;
  customerId?: string;
  marketplaceDiscovery: HubFeaturedVendorDiscoveryState;
  onPaySelectSlot: (vendor: BoardingListVendor) => void;
  onPayOpenProfile: (vendor: BoardingListVendor) => void;
  onMarketplaceOpenProfile: (e: MouseEvent, profileKey: string) => void;
  onMarketplaceBookPlan?: (vendor: BoardingListVendor, plan: BoardingPlanRow) => void;
  emptyState?: ReactNode;
};

export function HubFeaturedVendorList({
  category,
  vendors,
  categoryLabelFallback,
  planBadgeLabel = categoryLabelFallback ?? 'Service',
  serviceSlug = 'all',
  serviceCategory,
  customerId,
  marketplaceDiscovery,
  onPaySelectSlot,
  onPayOpenProfile,
  onMarketplaceOpenProfile,
  onMarketplaceBookPlan,
  emptyState,
}: HubFeaturedVendorListProps) {
  const wapptHubEnabled = shouldUseWapptPayVendorCardUi(category);
  const resolvedServiceCategory = serviceCategory ?? category;

  if (vendors.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <>
      {vendors.map((v) => {
        if (wapptHubEnabled) {
          return (
            <ServiceHubVendorCard
              key={v.id}
              vendor={v}
              category={category}
              categoryLabelFallback={categoryLabelFallback}
              onSelectSlot={(vendor, e) => {
                e.stopPropagation();
                onPaySelectSlot(vendor);
              }}
              onOpenProfile={(e, vendor) => {
                e.stopPropagation();
                onPayOpenProfile(vendor);
              }}
            />
          );
        }

        const expanded = marketplaceDiscovery.selectedVendorId === v.id;
        const minP = minPriceForVendor(v);

        return (
          <BoardingVendorExpandableCard
            key={v.id}
            v={v}
            serviceSlug={serviceSlug}
            planBadgeLabel={planBadgeLabel}
            expanded={expanded}
            fetchingPlansFor={marketplaceDiscovery.fetchingPlansFor}
            minPrice={minP}
            onToggleHeader={() => marketplaceDiscovery.toggleVendor(v.id)}
            onViewServices={(e) => {
              e.stopPropagation();
              marketplaceDiscovery.setSelectedVendorId(v.id);
            }}
            onDetails={onMarketplaceOpenProfile}
            onBookPlan={(vendor, plan) => {
              if (onMarketplaceBookPlan) onMarketplaceBookPlan(vendor, plan);
            }}
            onOpenCenterDetails={onMarketplaceOpenProfile}
            customerId={customerId}
            serviceCategory={resolvedServiceCategory}
          />
        );
      })}
    </>
  );
}

export { resolveServiceHubVendorProfileKey };
