'use client';

import {
  ServiceHubVendorCard,
  resolveServiceHubVendorProfileKey,
} from '../shared/ServiceHubVendorCard';
import type { BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';
import type { MouseEvent } from 'react';

export type SearchHubVendorCardProps = {
  vendor: BoardingListVendor;
  category: string;
  serviceKey?: string;
  categoryLabelFallback?: string;
  onOpenProfile: (e: MouseEvent, vendorId: string) => void;
  className?: string;
};

/** Search listing — shared WarmpawzPayVendorCard hub layout. */
export function SearchHubVendorCard({
  vendor,
  category,
  serviceKey,
  categoryLabelFallback,
  onOpenProfile,
  className,
}: SearchHubVendorCardProps) {
  const openProfile = (e: MouseEvent<HTMLButtonElement>, v: BoardingListVendor) => {
    onOpenProfile(e, resolveServiceHubVendorProfileKey(v));
  };

  return (
    <div className={className}>
      <ServiceHubVendorCard
        vendor={vendor}
        category={category}
        serviceKey={serviceKey}
        categoryLabelFallback={categoryLabelFallback}
        onSelectSlot={(v, e) => openProfile(e, v)}
        onOpenProfile={openProfile}
      />
    </div>
  );
}
