'use client';

import type { ReactNode } from 'react';
import { MarketplaceTracking } from '@/components/customer/marketplace/MarketplaceTracking';
import { MealTrackingHeader } from '@/components/customer/tracking/MealTrackingHeader';

export { mealKitchenProgress, mealHeroHeadline, type MealKitchenProgressOptions } from '@/lib/meal-kitchen-progress';

export function formatMealOrderDisplayId(order: {
  order_number?: string;
  orderNumber?: string;
  id?: string;
}): string {
  const raw = (order.order_number || order.orderNumber || '').trim();
  if (raw) return raw.startsWith('#') ? raw : `#${raw}`;
  const id = order.id?.replace(/-/g, '') ?? '';
  const tail = id.length >= 8 ? id.slice(-10) : id || '—';
  return `#${tail}`;
}

export interface MealPlanOrderTrackingUIProps {
  orderDisplayId: string;
  backSlot: ReactNode;
  onSupport?: () => void;
  onShare?: () => void;
  headerExtra?: ReactNode;
  statusHero: ReactNode;
  refundReviewCard?: ReactNode;
  deliveryOtpBanner?: ReactNode;
  liveTrackingMap?: ReactNode;
  deliveryProgressTimeline: ReactNode;
  deliveryPartnerCard?: ReactNode;
  deliveryAddressCard: ReactNode;
  orderDetailsCard: ReactNode;
  paymentSummaryCard: ReactNode;
  supportCard: ReactNode;
  ratingFooter?: ReactNode;
}

export function MealPlanOrderTrackingUI({
  orderDisplayId,
  backSlot,
  onSupport,
  onShare,
  headerExtra,
  statusHero,
  refundReviewCard,
  deliveryOtpBanner,
  liveTrackingMap,
  deliveryProgressTimeline,
  deliveryPartnerCard,
  deliveryAddressCard,
  orderDetailsCard,
  paymentSummaryCard,
  supportCard,
  ratingFooter,
}: MealPlanOrderTrackingUIProps) {
  return (
    <MarketplaceTracking
      header={
        <MealTrackingHeader
          orderDisplayId={orderDisplayId}
          backSlot={backSlot}
          onSupport={onSupport}
          onShare={onShare}
          headerExtra={headerExtra}
        />
      }
      statusHero={statusHero}
      timeline={deliveryProgressTimeline}
      footer={ratingFooter}
    >
      {refundReviewCard}
      {deliveryOtpBanner}
      {liveTrackingMap}
      {deliveryPartnerCard}
      {deliveryAddressCard}
      {orderDetailsCard}
      {paymentSummaryCard}
      {supportCard}
    </MarketplaceTracking>
  );
}
