import {
  calculateCustomerDeliveryFee,
  fetchCustomerDeliveryFeePolicy,
} from './customer-delivery-fee-policy';

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

/** Null when pickup or drop coordinates are missing — callers must not quote zone pricing on fake distance. */
export function deriveDistanceKmFromLocations(input: {
  pickupLat?: unknown;
  pickupLng?: unknown;
  dropLat?: unknown;
  dropLng?: unknown;
}): number | null {
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

  return null;
}

export async function computePolicyDeliveryFeeForOrder(input: {
  orderSubtotalInr: number;
  distanceKm: number | null | undefined;
  logisticsType?: string;
  weekend?: boolean;
  festival?: boolean;
  rain?: boolean;
}): Promise<{
  success: boolean;
  deliveryFeeInr: number | null;
  policyVersion: number;
  zone: 'zone_a' | 'zone_b' | 'out_of_coverage';
  message?: string;
}> {
  if ((input.logisticsType || 'warmpawz') !== 'warmpawz') {
    return {
      success: true,
      deliveryFeeInr: 0,
      policyVersion: 0,
      zone: 'zone_a',
      message: 'Own logistics selected; delivery fee from policy skipped.',
    };
  }

  const policy = await fetchCustomerDeliveryFeePolicy();

  if (input.distanceKm == null || !Number.isFinite(Number(input.distanceKm))) {
    return {
      success: false,
      deliveryFeeInr: null,
      policyVersion: policy.version,
      zone: 'out_of_coverage',
      message: 'Delivery distance unavailable (missing vendor or customer coordinates).',
    };
  }

  const calculation = calculateCustomerDeliveryFee({
    policy,
    orderSubtotalInr: Math.max(0, Number(input.orderSubtotalInr || 0)),
    distanceKm: Math.max(0, Number(input.distanceKm)),
    weekend: !!input.weekend,
    festival: !!input.festival,
    rain: !!input.rain,
  });

  if (calculation.success) {
    return {
      success: true,
      deliveryFeeInr: calculation.totalDeliveryFeeInr,
      policyVersion: policy.version,
      zone: calculation.zone,
    };
  }

  return {
    success: false,
    deliveryFeeInr: null,
    policyVersion: policy.version,
    zone: calculation.zone,
    message: calculation.message || 'Delivery fee could not be computed from the active zone policy.',
  };
}
