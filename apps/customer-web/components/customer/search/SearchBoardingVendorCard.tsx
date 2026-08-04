'use client';

import type { MouseEvent } from 'react';
import { SearchHubVendorCard } from '@/components/customer/search/SearchHubVendorCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export interface SearchBoardingVendorCardProps {
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

/** Search listing — boarding hub card (WarmpawzPayVendorCard). */
export function SearchBoardingVendorCard({
  vendor,
  onOpenCenterDetails,
  className = '',
}: SearchBoardingVendorCardProps) {
  return (
    <SearchHubVendorCard
      vendor={vendor}
      category="boarding"
      categoryLabelFallback="Boarding"
      onOpenProfile={onOpenCenterDetails}
      className={className}
    />
  );
}
