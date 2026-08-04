'use client';

import type { MouseEvent } from 'react';
import { SearchHubVendorCard } from '@/components/customer/search/SearchHubVendorCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export interface SearchWalkerVendorCardProps {
  vendor: BoardingListVendor;
  expanded?: boolean;
  fetchingPlansFor?: string | null;
  minPrice?: number | null;
  onToggleHeader?: () => void;
  onViewServices?: (e: MouseEvent) => void;
  onDetails: (e: MouseEvent, vendorId: string) => void;
  onBookPlan?: (v: BoardingListVendor, plan: BoardingPlanRow) => void;
  onOpenCenterDetails: (e: MouseEvent, vendorId: string) => void;
  headerTapExpandsServices?: boolean;
  chevronProfileAriaLabel?: string;
  className?: string;
}

/** Search listing — walker hub card (WarmpawzPayVendorCard). */
export function SearchWalkerVendorCard({
  vendor,
  onOpenCenterDetails,
  className = '',
}: SearchWalkerVendorCardProps) {
  return (
    <SearchHubVendorCard
      vendor={vendor}
      category="walker"
      categoryLabelFallback="Pet Walker"
      onOpenProfile={onOpenCenterDetails}
      className={className}
    />
  );
}
