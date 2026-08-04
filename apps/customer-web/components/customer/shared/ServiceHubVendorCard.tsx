'use client';

import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import type { BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';
import { mapBoardingListVendorToVendorCardProps } from '@/lib/warmpawz-pay/map-boarding-list-vendor-to-vendor-card-props';
import { cn } from '@/components/ui/utils';

export type ServiceHubVendorCardProps = {
  vendor: BoardingListVendor;
  category: string;
  serviceKey?: string;
  categoryLabelFallback?: string;
  onSelectSlot: (vendor: BoardingListVendor, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenProfile: (event: MouseEvent<HTMLButtonElement>, vendor: BoardingListVendor) => void;
  showPayCta?: boolean;
  className?: string;
};

export function resolveServiceHubVendorProfileKey(vendor: BoardingListVendor): string {
  const raw = (vendor.raw ?? {}) as Record<string, unknown>;
  return pickCustomerVendorAccountId(raw) || vendor.id;
}

export function ServiceHubVendorCard({
  vendor,
  category,
  serviceKey,
  categoryLabelFallback,
  onSelectSlot,
  onOpenProfile,
  showPayCta = true,
  className,
}: ServiceHubVendorCardProps) {
  const router = useRouter();
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
