'use client';

import type { MouseEvent } from 'react';
import { SearchHubVendorCard } from '@/components/customer/search/SearchHubVendorCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export interface SearchSittingVendorCardProps {
  vendor: BoardingListVendor;
  expanded?: boolean;
  fetchingPlansFor?: string | null;
  minPrice?: number | null;
  onToggleHeader?: () => void;
  onViewServices?: (e: MouseEvent) => void;
  onDetails: (e: MouseEvent, vendorId: string) => void;
  onBookPlan?: (v: BoardingListVendor, plan: BoardingPlanRow) => void;
  onOpenCenterDetails: (e: MouseEvent, vendorId: string) => void;
  className?: string;
}

/** Search listing — sitting hub card (WarmpawzPayVendorCard). */
export function SearchSittingVendorCard({
  vendor,
  onOpenCenterDetails,
  className = '',
}: SearchSittingVendorCardProps) {
  return (
    <SearchHubVendorCard
      vendor={vendor}
      category="sitting"
      serviceKey="pet_sitting"
      categoryLabelFallback="Sitting"
      onOpenProfile={onOpenCenterDetails}
      className={className}
    />
  );
}
