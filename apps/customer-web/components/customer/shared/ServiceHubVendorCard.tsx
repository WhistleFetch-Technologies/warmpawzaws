'use client';

import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { BoardingVendorExpandableCard } from '@/components/customer/boarding/BoardingVendorExpandableCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import { mapServicesApiResponseToPlanRows } from '@/lib/boarding-vendor-discovery-map';
import { mapBoardingListVendorToVendorCardProps } from '@/lib/warmpawz-pay/map-boarding-list-vendor-to-vendor-card-props';
import { shouldUseWapptPayVendorCardUi } from '@/lib/commerce-switch-routing';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/components/ui/utils';

export type ServiceHubVendorCardProps = {
  vendor: BoardingListVendor;
  category: string;
  serviceKey?: string;
  categoryLabelFallback?: string;
  onSelectSlot: (vendor: BoardingListVendor, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenProfile: (event: MouseEvent<HTMLButtonElement>, vendor: BoardingListVendor) => void;
  /** Marketplace-only: inline Book on a service row */
  onBookPlan?: (vendor: BoardingListVendor, plan: BoardingPlanRow) => void;
  customerId?: string;
  showPayCta?: boolean;
  className?: string;
  /** Parent-managed expand state (hub featured lists). Omit for self-contained expand (search/lists). */
  marketplaceExpand?: {
    expanded: boolean;
    fetchingPlansFor: string | null;
    onToggleHeader: () => void;
    onViewServices: (e: MouseEvent) => void;
  };
};

type MarketplaceCardMeta = {
  servicesApiCategory: string;
  serviceStyle: string;
  planBadgeLabel: string;
  serviceSlug: BoardingServiceSlug;
};

const MARKETPLACE_CARD_META: Record<string, MarketplaceCardMeta> = {
  vet: { servicesApiCategory: 'vet', serviceStyle: 'at_center', planBadgeLabel: 'Vet', serviceSlug: 'all' },
  grooming: {
    servicesApiCategory: 'grooming',
    serviceStyle: 'at_center',
    planBadgeLabel: 'Grooming',
    serviceSlug: 'all',
  },
  training: {
    servicesApiCategory: 'training',
    serviceStyle: 'at_center',
    planBadgeLabel: 'Training',
    serviceSlug: 'all',
  },
  behaviorist: {
    servicesApiCategory: 'behaviorist',
    serviceStyle: 'at_center',
    planBadgeLabel: 'Behavior',
    serviceSlug: 'all',
  },
  boarding: {
    servicesApiCategory: 'boarding',
    serviceStyle: 'at_center',
    planBadgeLabel: 'Boarding',
    serviceSlug: 'all',
  },
  sitting: {
    servicesApiCategory: 'sitting',
    serviceStyle: 'at_home',
    planBadgeLabel: 'Sitting',
    serviceSlug: 'all',
  },
  walker: {
    servicesApiCategory: 'walker',
    serviceStyle: 'at_home',
    planBadgeLabel: 'Walker',
    serviceSlug: 'all',
  },
  nutrition: {
    servicesApiCategory: 'nutrition',
    serviceStyle: 'tele',
    planBadgeLabel: 'Nutrition',
    serviceSlug: 'all',
  },
  nutritionist: {
    servicesApiCategory: 'nutrition',
    serviceStyle: 'tele',
    planBadgeLabel: 'Nutrition',
    serviceSlug: 'all',
  },
};

function resolveMarketplaceCardMeta(category: string, categoryLabelFallback?: string): MarketplaceCardMeta {
  const key = category.trim().toLowerCase();
  return (
    MARKETPLACE_CARD_META[key] ?? {
      servicesApiCategory: key,
      serviceStyle: 'at_center',
      planBadgeLabel: categoryLabelFallback?.trim() || category,
      serviceSlug: 'all',
    }
  );
}

export function resolveServiceHubVendorProfileKey(vendor: BoardingListVendor): string {
  const raw = (vendor.raw ?? {}) as Record<string, unknown>;
  return pickCustomerVendorAccountId(raw) || vendor.id;
}

function ServiceHubMarketplaceVendorCard({
  vendor,
  category,
  categoryLabelFallback,
  onOpenProfile,
  onBookPlan,
  customerId,
  className,
  marketplaceExpand,
}: Omit<ServiceHubVendorCardProps, 'onSelectSlot' | 'showPayCta' | 'serviceKey'>) {
  const meta = resolveMarketplaceCardMeta(category, categoryLabelFallback);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [fetchingPlansFor, setFetchingPlansFor] = useState<string | null>(null);
  const [vendorState, setVendorState] = useState(vendor);

  useEffect(() => {
    setVendorState(vendor);
  }, [vendor]);

  const expanded = marketplaceExpand?.expanded ?? internalExpanded;
  const activeFetching = marketplaceExpand?.fetchingPlansFor ?? fetchingPlansFor;
  const displayVendor = vendorState.id === vendor.id ? vendorState : vendor;

  const fetchVendorPlans = useCallback(async () => {
    const vendorId = resolveServiceHubVendorProfileKey(displayVendor);
    setFetchingPlansFor(vendorId);
    try {
      const servicesResponse = await apiClient
        .get(
          `/customer/vendor/${vendorId}/services?category=${encodeURIComponent(meta.servicesApiCategory)}`
        )
        .catch(() =>
          apiClient.get(
            `/customer/vendor/${vendorId}/services?serviceStyle=${encodeURIComponent(meta.serviceStyle)}`
          )
        );
      const rows = mapServicesApiResponseToPlanRows(servicesResponse);
      setVendorState((prev) =>
        prev.id === displayVendor.id ? { ...prev, planRows: rows, needsServiceFetch: false } : prev
      );
    } catch (e) {
      console.error('[ServiceHubVendorCard] vendor services fetch failed', e);
    } finally {
      setFetchingPlansFor(null);
    }
  }, [displayVendor, meta.servicesApiCategory, meta.serviceStyle]);

  useEffect(() => {
    if (marketplaceExpand) return;
    if (!internalExpanded) return;
    if (!displayVendor.needsServiceFetch || displayVendor.planRows.length > 0) return;
    if (fetchingPlansFor === displayVendor.id) return;
    void fetchVendorPlans();
  }, [
    marketplaceExpand,
    internalExpanded,
    displayVendor,
    fetchingPlansFor,
    fetchVendorPlans,
  ]);

  const openProfileByKey = (e: MouseEvent, profileKey: string) => {
    onOpenProfile(e as MouseEvent<HTMLButtonElement>, displayVendor);
  };

  const handleBookPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    if (onBookPlan) {
      onBookPlan(v, plan);
      return;
    }
    onOpenProfile({ stopPropagation: () => {} } as MouseEvent<HTMLButtonElement>, v);
  };

  const minP = minPriceForVendor(displayVendor);

  return (
    <BoardingVendorExpandableCard
      v={displayVendor}
      serviceSlug={meta.serviceSlug}
      planBadgeLabel={meta.planBadgeLabel}
      expanded={expanded}
      fetchingPlansFor={activeFetching}
      minPrice={minP}
      onToggleHeader={
        marketplaceExpand?.onToggleHeader ??
        (() => {
          setInternalExpanded((prev) => !prev);
        })
      }
      onViewServices={
        marketplaceExpand?.onViewServices ??
        ((e) => {
          e.stopPropagation();
          setInternalExpanded(true);
        })
      }
      onDetails={openProfileByKey}
      onBookPlan={handleBookPlan}
      onOpenCenterDetails={openProfileByKey}
      customerId={customerId}
      serviceCategory={meta.servicesApiCategory}
    />
  );
}

export function ServiceHubVendorCard({
  vendor,
  category,
  serviceKey,
  categoryLabelFallback,
  onSelectSlot,
  onOpenProfile,
  onBookPlan,
  customerId,
  showPayCta = true,
  className,
  marketplaceExpand,
}: ServiceHubVendorCardProps) {
  const router = useRouter();
  const usePayCard = shouldUseWapptPayVendorCardUi(category);

  if (!usePayCard) {
    return (
      <ServiceHubMarketplaceVendorCard
        vendor={vendor}
        category={category}
        categoryLabelFallback={categoryLabelFallback}
        onOpenProfile={onOpenProfile}
        onBookPlan={onBookPlan}
        customerId={customerId}
        className={className}
        marketplaceExpand={marketplaceExpand}
      />
    );
  }

  const cardProps = mapBoardingListVendorToVendorCardProps({
    vendor,
    category,
    serviceKey,
    categoryLabelFallback,
    router,
    onSelectSlot,
    onOpenProfile,
    showPayCta,
  });

  return <WarmpawzPayVendorCard {...cardProps} className={cn(className)} />;
}
