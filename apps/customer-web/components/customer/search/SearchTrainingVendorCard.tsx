'use client';

import type { MouseEvent } from 'react';
import { SearchHubVendorCard } from '@/components/customer/search/SearchHubVendorCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export interface SearchTrainingVendorCardProps {
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

/** Search listing — training hub card (WarmpawzPayVendorCard). */
export function SearchTrainingVendorCard({
  vendor,
  onOpenCenterDetails,
  className = '',
}: SearchTrainingVendorCardProps) {
  return (
    <SearchHubVendorCard
      vendor={vendor}
      category="training"
      categoryLabelFallback="Training"
      onOpenProfile={onOpenCenterDetails}
      className={className}
    />
  );
}
