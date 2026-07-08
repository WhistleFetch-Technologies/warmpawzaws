'use client';

import type { MouseEvent } from 'react';
import { BoardingVendorExpandableCard } from '@/components/customer/boarding/BoardingVendorExpandableCard';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export interface SearchTrainingVendorCardProps {
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

/** Search listing — reuses Services Training hub card (BoardingVendorExpandableCard). */
export function SearchTrainingVendorCard({
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
}: SearchTrainingVendorCardProps) {
  return (
    <div className={className}>
      <BoardingVendorExpandableCard
        v={vendor}
        serviceSlug="all"
        planBadgeLabel="Training"
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
