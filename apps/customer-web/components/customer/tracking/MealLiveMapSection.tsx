'use client';

import { LiveTrackingMapPanel } from '@/components/customer/tracking/LiveTrackingMapPanel';
import { shouldShowMealLiveMap, type MealDeliveryEffective } from '@warmpawz/shared-types';

type Coords = { lat: number; lng: number; address?: string };

export function MealLiveMapSection({
  logisticsPartner,
  logisticsType,
  logisticsStatus,
  orderEffectiveState,
  riderCoords,
  destination,
  etaMinutes,
  distanceRemainingKm,
}: {
  logisticsPartner?: string | null;
  logisticsType?: string | null;
  logisticsStatus?: string | null;
  orderEffectiveState?: MealDeliveryEffective;
  riderCoords: { lat: number; lng: number } | null;
  destination: Coords | null;
  etaMinutes?: number | null;
  distanceRemainingKm?: number | null;
}) {
  const show = shouldShowMealLiveMap({
    logisticsPartner,
    logisticsType,
    logisticsStatus,
    orderEffectiveState,
  });

  if (!show) return null;

  return (
    <LiveTrackingMapPanel
      variant="meal"
      deliveryAddress={destination}
      currentLocation={riderCoords}
      etaMinutes={etaMinutes}
      distanceRemainingKm={distanceRemainingKm}
    />
  );
}
