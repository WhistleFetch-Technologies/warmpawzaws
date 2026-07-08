'use client';

import type { MouseEvent } from 'react';
import { BoardingVendorExpandableCard } from '@/components/customer/boarding/BoardingVendorExpandableCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export interface SearchWalkerVendorCardProps {
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

/** Search listing — walker hub card (BoardingVendorExpandableCard, walker chevron/profile parity). */
export function SearchWalkerVendorCard({
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
}: SearchWalkerVendorCardProps) {
  return (
    <div className={className}>
      <BoardingVendorExpandableCard
        v={vendor}
        serviceSlug="all"
        planBadgeLabel="Walking"
        expanded={expanded}
        fetchingPlansFor={fetchingPlansFor}
        minPrice={minPrice}
        chevronProfileAriaLabel="View walker profile"
        onToggleHeader={onToggleHeader}
        onViewServices={onViewServices}
        onDetails={onDetails}
        onBookPlan={onBookPlan}
        onOpenCenterDetails={onOpenCenterDetails}
      />
    </div>
  );
}
