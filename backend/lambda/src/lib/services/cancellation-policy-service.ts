/**
 * Cancellation policy service: applies vendor_refund_tiers by who cancels (pet_parent vs provider).
 * Used when a customer or vendor/platform cancels a booking to compute refund % and fees.
 */

import { query } from '../../database/rds-connection';

export type CancelledBy = 'pet_parent' | 'provider';

export interface RefundTierResult {
  refundPercentage: number;
  cancellationFee: number;
  maxPartialRefundPercentage: number | null;
  tierId?: string;
  tierName?: string;
}

export interface BookingForPolicy {
  id: string;
  vendor_id?: string | null;
  service_id?: string | null;
  service_type?: string | null;
  booking_date: string;
  booking_time: string;
  total_amount: number | string;
}

/**
 * Map booking.service_type to vendor_refund_tiers.service_location.
 * DB: home, clinic, tele, both, all. Booking: at_home, at_center, at_vendor, tele.
 */
function serviceTypeToLocation(serviceType: string | null | undefined): string {
  const t = (serviceType || '').toLowerCase();
  if (t === 'at_home') return 'home';
  if (t === 'at_center' || t === 'at_vendor') return 'clinic';
  if (t === 'tele') return 'tele';
  return 'all'; // default match "all" tiers
}

/**
 * Get the best-matching vendor_refund_tier for this cancellation.
 * Customer: matches by hours_before_service <= hoursUntilBooking (and optional cancellation_window).
 * Provider: matches by cancelled_by=provider; optional vendor_cancellation_reason when provided.
 */
export async function getRefundTierForCancellation(
  booking: BookingForPolicy,
  cancelledBy: CancelledBy,
  options?: { vendorCancellationReason?: string | null }
): Promise<RefundTierResult | null> {
  const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
  const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const serviceLocation = serviceTypeToLocation(booking.service_type);

  // Resolve vendor role name for vendor_types matching
  let vendorRoleName: string | null = null;
  if (booking.vendor_id) {
    const vendorRoleResult = await query(
      `SELECT r.name AS role_name
       FROM vendors v
       JOIN roles r ON r.id = v.role_id
       WHERE v.id = $1 AND r.is_active = true
       LIMIT 1`,
      [booking.vendor_id]
    ).catch(() => ({ rows: [] }));
    const rows = Array.isArray(vendorRoleResult) ? vendorRoleResult : (vendorRoleResult as any).rows || [];
    vendorRoleName = rows[0]?.role_name ?? null;
  }

  const cancelledByParam = cancelledBy === 'pet_parent' ? 'pet_parent' : 'provider';

  if (cancelledBy === 'provider') {
    // Vendor cancels: full refund or reschedule; match by vendor_cancellation_reason if provided
    const vendorReason = options?.vendorCancellationReason ? String(options.vendorCancellationReason).toLowerCase() : null;
    const tiersResult = await query(
      `SELECT id, name, refund_percentage, cancellation_fee, max_partial_refund_percentage, hours_before_service
       FROM vendor_refund_tiers
       WHERE is_active = true
         AND cancelled_by = 'provider'
         AND (vendor_cancellation_reason IS NULL OR vendor_cancellation_reason = $1 OR $1 IS NULL)
         AND (
           service_location = 'all'
           OR service_location = $2
           OR (service_location = 'both' AND $2 IN ('home', 'clinic'))
         )
         AND (
           COALESCE(array_length(vendor_types, 1), 0) = 0
           OR ($3 IS NOT NULL AND $3 != '' AND $3 = ANY(COALESCE(vendor_types, ARRAY[]::text[])))
         )
       ORDER BY vendor_cancellation_reason DESC NULLS LAST
       LIMIT 1`,
      [vendorReason, serviceLocation, vendorRoleName || null]
    ).catch(() => ({ rows: [] }));
    const rows = Array.isArray(tiersResult) ? tiersResult : (tiersResult as any).rows || [];
    const tier = rows[0];
    if (!tier) return null;
    return {
      refundPercentage: Number(tier.refund_percentage ?? 100),
      cancellationFee: Number(tier.cancellation_fee ?? 0),
      maxPartialRefundPercentage: tier.max_partial_refund_percentage != null ? Number(tier.max_partial_refund_percentage) : null,
      tierId: tier.id,
      tierName: tier.name,
    };
  }

  // Customer cancels: match by preset (hours_before_service <= hours) OR flexible rule (hours_operator + hours_threshold)
  const h = Math.max(0, hoursUntilBooking);
  const tiersResult = await query(
    `SELECT id, name, refund_percentage, cancellation_fee, max_partial_refund_percentage, hours_before_service
     FROM vendor_refund_tiers
     WHERE is_active = true
       AND cancelled_by = 'pet_parent'
       AND (
         (hours_operator IS NOT NULL AND hours_threshold IS NOT NULL AND (
           (hours_operator = 'gte' AND $1 >= hours_threshold) OR
           (hours_operator = 'lte' AND $1 <= hours_threshold) OR
           (hours_operator = 'gt' AND $1 > hours_threshold) OR
           (hours_operator = 'lt' AND $1 < hours_threshold)
         ))
         OR
         ((hours_operator IS NULL OR hours_threshold IS NULL) AND hours_before_service <= $1)
       )
       AND (
         service_location = 'all'
         OR service_location = $2
         OR (service_location = 'both' AND $2 IN ('home', 'clinic'))
       )
       AND (
         COALESCE(array_length(vendor_types, 1), 0) = 0
         OR ($3 IS NOT NULL AND $3 != '' AND $3 = ANY(COALESCE(vendor_types, ARRAY[]::text[])))
       )
     ORDER BY COALESCE(hours_threshold, hours_before_service) DESC NULLS LAST
     LIMIT 1`,
    [h, serviceLocation, vendorRoleName || null]
  ).catch(() => ({ rows: [] }));

  const rows = Array.isArray(tiersResult) ? tiersResult : (tiersResult as any).rows || [];
  const tier = rows[0];
  if (!tier) return null;

  const refundPercentage = Number(tier.refund_percentage ?? 75);
  const cancellationFee = Number(tier.cancellation_fee ?? 0);
  const maxPartial = tier.max_partial_refund_percentage != null ? Number(tier.max_partial_refund_percentage) : null;

  return {
    refundPercentage,
    cancellationFee,
    maxPartialRefundPercentage: Number.isFinite(maxPartial) ? maxPartial : null,
    tierId: tier.id,
    tierName: tier.name,
  };
}

/**
 * Compute refund amount from tier (or fallback defaults).
 * Applies max_partial_refund_percentage cap if set.
 */
export function computeRefundFromTier(
  totalAmount: number,
  tier: RefundTierResult | null,
  fallbackPercentage: number = 100,
  fallbackFee: number = 0
): { refundAmount: number; refundPercentage: number; cancellationFee: number } {
  const refundPercentage = tier ? tier.refundPercentage : fallbackPercentage;
  const cancellationFee = tier ? tier.cancellationFee : fallbackFee;
  let effectivePercentage = refundPercentage;
  if (tier?.maxPartialRefundPercentage != null && effectivePercentage > tier.maxPartialRefundPercentage) {
    effectivePercentage = tier.maxPartialRefundPercentage;
  }
  const refundAmount = Math.max(0, (totalAmount * effectivePercentage) / 100 - cancellationFee);
  return {
    refundAmount,
    refundPercentage: effectivePercentage,
    cancellationFee,
  };
}
