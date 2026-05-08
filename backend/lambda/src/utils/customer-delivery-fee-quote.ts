import {
  calculateCustomerDeliveryFee,
  fetchCustomerDeliveryFeePolicy,
} from './customer-delivery-fee-policy';

const DEFAULT_DELIVERY_FEE_INR = 50;

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function finiteOrNull(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function deriveDistanceKmFromLocations(input: {
  pickupLat?: unknown;
  pickupLng?: unknown;
  dropLat?: unknown;
  dropLng?: unknown;
  fallbackKm?: number;
}): number {
  const pickupLat = finiteOrNull(input.pickupLat);
  const pickupLng = finiteOrNull(input.pickupLng);
  const dropLat = finiteOrNull(input.dropLat);
  const dropLng = finiteOrNull(input.dropLng);

  if (
    pickupLat != null &&
    pickupLng != null &&
    dropLat != null &&
    dropLng != null
  ) {
    return calculateDistanceKm(pickupLat, pickupLng, dropLat, dropLng);
  }

  return Math.max(0, Number(input.fallbackKm || 0));
}

export async function computePolicyDeliveryFeeForOrder(input: {
  orderSubtotalInr: number;
  distanceKm: number;
  logisticsType?: string;
  weekend?: boolean;
  festival?: boolean;
  rain?: boolean;
}): Promise<{
  deliveryFeeInr: number;
  policyVersion: number;
  zone: 'zone_a' | 'zone_b' | 'out_of_coverage';
  usedFallback: boolean;
  message?: string;
}> {
  if ((input.logisticsType || 'warmpawz') !== 'warmpawz') {
    return {
      deliveryFeeInr: 0,
      policyVersion: 0,
      zone: 'zone_a',
      usedFallback: false,
      message: 'Own logistics selected; delivery fee from policy skipped.',
    };
  }

  const policy = await fetchCustomerDeliveryFeePolicy();
  const calculation = calculateCustomerDeliveryFee({
    policy,
    orderSubtotalInr: Math.max(0, Number(input.orderSubtotalInr || 0)),
    distanceKm: Math.max(0, Number(input.distanceKm || 0)),
    weekend: !!input.weekend,
    festival: !!input.festival,
    rain: !!input.rain,
  });

  if (calculation.success) {
    return {
      deliveryFeeInr: calculation.totalDeliveryFeeInr,
      policyVersion: policy.version,
      zone: calculation.zone,
      usedFallback: false,
    };
  }

  return {
    deliveryFeeInr: DEFAULT_DELIVERY_FEE_INR,
    policyVersion: policy.version,
    zone: calculation.zone,
    usedFallback: true,
    message: calculation.message || 'Policy calculation failed; fallback fee used.',
  };
}
