'use client';

import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import {
  mapWalkerRowToVendorCardProps,
  type WalkerRowSource,
} from '@/lib/warmpawz-pay/map-boarding-list-vendor-to-vendor-card-props';
import { cn } from '@/components/ui/utils';

export type WalkerHubVendorCardProps = {
  walker: WalkerRowSource;
  onSelectSlot: (walker: WalkerRowSource, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenProfile: (event: MouseEvent<HTMLButtonElement>, walker: WalkerRowSource) => void;
  showPayCta?: boolean;
  className?: string;
};

export function WalkerHubVendorCard({
  walker,
  onSelectSlot,
  onOpenProfile,
  showPayCta = true,
  className,
}: WalkerHubVendorCardProps) {
  const router = useRouter();
  const cardProps = mapWalkerRowToVendorCardProps({
    walker,
    router,
    onSelectSlot,
    onOpenProfile,
    showPayCta,
  });

  return <WarmpawzPayVendorCard {...cardProps} className={cn(className)} />;
}
