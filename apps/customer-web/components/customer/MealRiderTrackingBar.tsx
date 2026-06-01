'use client';

/**
 * Compact footer bar for meal orders in rider delivery phase (above tab navigation).
 */

import { Navigation, Bike } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type MealRiderActiveOrder = {
  orderId?: string;
  id?: string;
  orderNumber?: string;
  vendorName?: string;
  riderName?: string;
  riderMessage?: string | null;
  logisticsStatus?: string | null;
};

interface MealRiderTrackingBarProps {
  order: MealRiderActiveOrder;
  onTrack: () => void;
}

export function MealRiderTrackingBar({ order, onTrack }: MealRiderTrackingBarProps) {
  const headline =
    order.riderMessage ||
    (order.riderName ? `${order.riderName} is on the way` : 'Your meal is on the way');
  const subline = order.vendorName
    ? `From ${order.vendorName}${order.orderNumber ? ` · #${order.orderNumber}` : ''}`
    : order.orderNumber
      ? `Order #${order.orderNumber}`
      : 'Track your delivery';

  return (
    <div
      className="fixed left-0 right-0 z-[95] max-w-customer mx-auto bottom-[var(--customer-tabbed-nav-offset)] px-3 pb-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-orange-200 bg-white px-4 py-3 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#FF8C42]">
          <Bike className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{headline}</p>
          <p className="truncate text-xs text-gray-600">{subline}</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onTrack}
          className="shrink-0 bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
        >
          <Navigation className="mr-1.5 h-4 w-4" aria-hidden />
          Track
        </Button>
      </div>
    </div>
  );
}
