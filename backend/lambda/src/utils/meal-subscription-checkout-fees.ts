/**
 * Subscription meal checkout: delivery = (per-session quote) × session count.
 * Per-session quote uses the same policy/distance inputs as one-time via computePolicyDeliveryFeeForOrder,
 * with orderSubtotalInr = one session's food value (cycle food ÷ deliveries per billing cycle).
 */

import { query } from '../database/rds-connection';
import { getFeeGlobalsMap } from './admin-fee-settings-db';
import {
  computePolicyDeliveryFeeForOrder,
  deriveDistanceKmFromLocations,
} from './customer-delivery-fee-quote';
import { fetchCustomerDeliveryFeePolicy } from './customer-delivery-fee-policy';
import { resolveMealPurchaseSubtotalInr } from './meal-order-pricing';
import {
  billingCyclesFromSessions,
  deliveriesPerBillingCycle,
} from './meal-subscription-schedule-utils';

export type MealSubscriptionCheckoutFeeInput = {
  plan: Record<string, unknown>;
  vendorId: string;
  quantity: number;
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  schedule: Record<string, unknown>;
  totalSessionsUsed: number;
  customerLat: number | null;
  customerLng: number | null;
  logisticsType: string;
  weekend?: boolean;
  festival?: boolean;
  rain?: boolean;
};

export type MealSubscriptionCheckoutFeeResult = {
  subtotalPerCycle: number;
  deliveriesPerBillingCycle: number;
  billingCycles: number;
  totalSessionsUsed: number;
  perSessionFoodSubtotal: number;
  perSessionDeliveryFee: number | null;
  totalDeliveryFeeUpfront: number | null;
  platformFeePerCycle: number;
  convenienceFeePerCycle: number;
  nonDeliveryPackagePerCycle: number;
  /** Full upfront including delivery × sessions */
  upfrontTotalAmount: number;
  deliveryFeePendingAddress: boolean;
  platformFeePerSession: number;
  convenienceFeePerSession: number;
};

function weekendIndiaNow(): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
  return weekday === 'Sat' || weekday === 'Sun';
}

export async function computeMealSubscriptionCheckoutFees(
  input: MealSubscriptionCheckoutFeeInput,
): Promise<MealSubscriptionCheckoutFeeResult> {
  const pt = input.purchaseType;
  const dpc = Math.max(1, deliveriesPerBillingCycle(pt, input.schedule));
  const weeklyEff = pt === 'WEEKLY_PLAN' ? dpc : undefined;
  const subtotalPerCycle = resolveMealPurchaseSubtotalInr(input.plan, input.quantity, {
    weeklyEffectiveDeliveryDays: weeklyEff,
  });

  const totalSessionsUsed = Math.max(1, Math.min(500, Math.floor(Number(input.totalSessionsUsed) || 1)));
  const billingCycles = billingCyclesFromSessions(totalSessionsUsed, dpc);
  const perSessionFoodSubtotal =
    dpc > 0 ? Math.round((subtotalPerCycle / dpc) * 100) / 100 : Math.round(subtotalPerCycle * 100) / 100;

  const feeMap = await getFeeGlobalsMap().catch(() => ({} as Record<string, string>));
  const platformFeePercentage = parseFloat(feeMap['platform_fee_percentage'] || '2');
  const maxPlatformFee = parseFloat(feeMap['max_platform_fee'] || '500');
  let platformFeePerCycle = Math.round(subtotalPerCycle * (platformFeePercentage / 100));
  if (maxPlatformFee > 0 && platformFeePerCycle > maxPlatformFee) {
    platformFeePerCycle = maxPlatformFee;
  }
  const convenienceFeePerCycle = parseFloat(
    feeMap['convenience_fee'] || feeMap['convenience_fee_booking'] || '0',
  );
  const nonDeliveryPackagePerCycle = subtotalPerCycle + platformFeePerCycle + convenienceFeePerCycle;

  const platformFeePerSession =
    dpc > 0 ? Math.round((platformFeePerCycle / dpc) * 100) / 100 : platformFeePerCycle;
  const convenienceFeePerSession =
    dpc > 0 ? Math.round((convenienceFeePerCycle / dpc) * 100) / 100 : convenienceFeePerCycle;

  const lat = input.customerLat;
  const lng = input.customerLng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    const upfrontTotalAmount = Math.round(nonDeliveryPackagePerCycle * billingCycles * 100) / 100;
    return {
      subtotalPerCycle,
      deliveriesPerBillingCycle: dpc,
      billingCycles,
      totalSessionsUsed,
      perSessionFoodSubtotal,
      perSessionDeliveryFee: null,
      totalDeliveryFeeUpfront: null,
      platformFeePerCycle,
      convenienceFeePerCycle,
      nonDeliveryPackagePerCycle,
      upfrontTotalAmount,
      deliveryFeePendingAddress: true,
      platformFeePerSession,
      convenienceFeePerSession,
    };
  }

  const policy = await fetchCustomerDeliveryFeePolicy().catch(() => ({ runtimeSignals: {} as Record<string, unknown> }));
  const vendors = await query(
    `SELECT latitude, longitude, metadata FROM vendors WHERE id = $1 LIMIT 1`,
    [input.vendorId],
  ).catch(() => ({ rows: [] }));

  const vendor = vendors.rows?.[0] || {};
  const vendorMeta = (typeof vendor.metadata === 'object' && vendor.metadata) || {};
  const distanceKm = deriveDistanceKmFromLocations({
    pickupLat: vendor.latitude ?? (vendorMeta as { lat?: number }).lat ?? (vendorMeta as { latitude?: number }).latitude,
    pickupLng: vendor.longitude ?? (vendorMeta as { lng?: number }).lng ?? (vendorMeta as { longitude?: number }).longitude,
    dropLat: lat,
    dropLng: lng,
    fallbackKm: 0,
  });

  const weekend = input.weekend ?? weekendIndiaNow();
  const festival =
    input.festival ?? Boolean((policy as { runtimeSignals?: { festivalActive?: boolean } }).runtimeSignals?.festivalActive);
  const rain =
    input.rain ?? Boolean((policy as { runtimeSignals?: { rainActive?: boolean } }).runtimeSignals?.rainActive);

  const deliveryQuote = await computePolicyDeliveryFeeForOrder({
    orderSubtotalInr: perSessionFoodSubtotal,
    distanceKm,
    logisticsType: input.logisticsType || 'warmpawz',
    weekend,
    festival,
    rain,
  });

  const perSessionDeliveryFee = deliveryQuote.deliveryFeeInr;
  const totalDeliveryFeeUpfront =
    Math.round(perSessionDeliveryFee * totalSessionsUsed * 100) / 100;

  const upfrontTotalAmount =
    Math.round(nonDeliveryPackagePerCycle * billingCycles * 100) / 100 + totalDeliveryFeeUpfront;

  return {
    subtotalPerCycle,
    deliveriesPerBillingCycle: dpc,
    billingCycles,
    totalSessionsUsed,
    perSessionFoodSubtotal,
    perSessionDeliveryFee,
    totalDeliveryFeeUpfront,
    platformFeePerCycle,
    convenienceFeePerCycle,
    nonDeliveryPackagePerCycle,
    upfrontTotalAmount,
    deliveryFeePendingAddress: false,
    platformFeePerSession,
    convenienceFeePerSession,
  };
}
