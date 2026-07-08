'use client';

import type { MouseEvent } from 'react';
import { BoardingVendorExpandableCard } from '@/components/customer/boarding/BoardingVendorExpandableCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export interface SearchBoardingVendorCardProps {
  vendor: BoardingListVendor;
  expanded: boolean;
  fetchingPlansFor: string | null;
  minPrice: number | null;
  onToggleHeader: () => void;
  onViewServices: (e: MouseEvent) => void;
  onDetails: (e: MouseEvent, vendorId: string) => void;
  onBookPlan: (v: BoardingListVendor, plan: BoardingPlanRow) => void;
  onOpenCenterDetails: (e: MouseEvent, vendorId: string) => void;
  className?: string;
}

/** Search listing — reuses Services Boarding hub card (BoardingVendorExpandableCard). */
export function SearchBoardingVendorCard({
  vendor,
  expanded,
  fetchingPlansFor,
  minPrice,
  onToggleHeader,
  onViewServices,
  onDetails,
  onBookPlan,
  onOpenCenterDetails,
  className = '',
}: SearchBoardingVendorCardProps) {
  return (
    <div className={className}>
      <BoardingVendorExpandableCard
        v={vendor}
        serviceSlug="all"
        planBadgeLabel="Boarding"
        expanded={expanded}
        fetchingPlansFor={fetchingPlansFor}
        minPrice={minPrice}
        onToggleHeader={onToggleHeader}
        onViewServices={onViewServices}
        onDetails={onDetails}
        onBookPlan={onBookPlan}
        onOpenCenterDetails={onOpenCenterDetails}
      />
    </div>
  );
}
