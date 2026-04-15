/**
 * Single source of truth for **service bookings** (not e-commerce orders):
 * - Refund policy (refund %, fees) → `vendor_refund_tiers`
 * - Cancellation policy (who cancels, time windows / rules) → same rows (`cancelled_by`, `hours_*`, `cancellation_window`, …)
 * - Rescheduling eligibility (per tier) → `policy_extensions.rescheduleAllowed`
 * - No-show rules (per tier) → `policy_extensions.noShowPolicy`
 *
 * E-commerce returns/cancellation stay in the ecommerce policy path only.
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
  booking_datetime?: string | null;
  scheduled_at?: string | null;
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
  options?: { vendorCancellationReason?: string | null; hoursUntilBooking?: number }
): Promise<RefundTierResult | null> {
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
  let computedHours: number | null = null;
  if (typeof options?.hoursUntilBooking === 'number' && Number.isFinite(options.hoursUntilBooking)) {
    computedHours = options.hoursUntilBooking;
  } else {
    // booking_date from DB may be ISO format (e.g. "2026-03-26T00:00:00.000Z")
    // Extract just YYYY-MM-DD to avoid malformed concatenation
    const dateOnly = String(booking.booking_date || '').split('T')[0];
    const rawDateTime =
      (booking.booking_datetime ? new Date(booking.booking_datetime) : null) ||
      (booking.scheduled_at ? new Date(booking.scheduled_at) : null) ||
      new Date(`${dateOnly}T${booking.booking_time}`);
    if (!isNaN(rawDateTime.getTime())) {
      computedHours = (rawDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    }
  }

  if (computedHours == null || !Number.isFinite(computedHours)) {
    console.warn('[RefundTier] Unable to compute hours until booking for tier evaluation:', booking.id);
    return null;
  }

  const h = Math.max(0, computedHours);
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

export type RefundSource = 'vendor_refund_tiers' | 'booking_cancellation_rules' | 'default';

/**
 * Unified preview for customer cancellation refunds.
 * Order of precedence:
 *   1) vendor_refund_tiers (policyApplied = true, source='vendor_refund_tiers')
 *   2) booking_cancellation_rules (legacy, policyApplied = true, source='booking_cancellation_rules')
 *   3) default fallback (policyApplied = false, source='default')
 */
export async function previewCustomerCancellationRefund(booking: BookingForPolicy): Promise<{
  refundAmount: number;
  refundPercentage: number;
  cancellationFee: number;
  source: RefundSource;
  policyApplied: boolean;
  meta?: { tierId?: string; tierName?: string };
}> {
  const total = parseFloat(String(booking.total_amount || 0));
  // Compute hours until booking
  let hoursUntilBooking = 0;
  if (booking.booking_datetime) {
    const dt = new Date(booking.booking_datetime);
    if (!isNaN(dt.getTime())) hoursUntilBooking = Math.max(0, (dt.getTime() - Date.now()) / (1000 * 60 * 60));
  } else if (booking.scheduled_at) {
    const dt = new Date(booking.scheduled_at);
    if (!isNaN(dt.getTime())) hoursUntilBooking = Math.max(0, (dt.getTime() - Date.now()) / (1000 * 60 * 60));
  } else if (booking.booking_date && booking.booking_time) {
    // booking_date from DB may be ISO format (e.g. "2026-03-26T00:00:00.000Z")
    // Extract just the YYYY-MM-DD portion to avoid malformed concatenation
    const dateOnly = String(booking.booking_date).split('T')[0];
    const dt = new Date(`${dateOnly}T${booking.booking_time}`);
    if (!isNaN(dt.getTime())) hoursUntilBooking = Math.max(0, (dt.getTime() - Date.now()) / (1000 * 60 * 60));
  }

  // 1) Preferred: vendor_refund_tiers
  const tier = await getRefundTierForCancellation(booking, 'pet_parent', { hoursUntilBooking });
  if (tier) {
    const computed = computeRefundFromTier(total, tier, 100, 0);
    return {
      refundAmount: computed.refundAmount,
      refundPercentage: computed.refundPercentage,
      cancellationFee: computed.cancellationFee,
      source: 'vendor_refund_tiers',
      policyApplied: true,
      meta: { tierId: tier.tierId, tierName: tier.tierName },
    };
  }

  // 2) Fallback: booking_cancellation_rules
  let rule: any = null;
  try {
    const rulesResult = await query(
      `SELECT * FROM booking_cancellation_rules
       WHERE (vendor_id = $1 OR vendor_id IS NULL)
         AND (service_id = $2 OR service_id IS NULL)
       ORDER BY vendor_id DESC NULLS LAST, service_id DESC NULLS LAST
       LIMIT 1`,
      [booking.vendor_id || null, booking.service_id || null]
    );
    rule = (rulesResult as any).rows?.[0] || null;
  } catch {
    // ignore
  }

  if (rule) {
    const fullRefundHours = rule.full_refund_before_hours ?? 48;
    const partialRefundHours = rule.partial_refund_before_hours ?? 24;
    const partialRefundPct = Number(rule.partial_refund_percentage ?? 50);
    const cutoffHours = rule.cancellation_cutoff_hours ?? 12;

    let pct = 0;
    if (hoursUntilBooking >= fullRefundHours) pct = 100;
    else if (hoursUntilBooking >= partialRefundHours) pct = partialRefundPct;
    else if (hoursUntilBooking >= cutoffHours) pct = partialRefundPct;
    else pct = 0;

    const fee = pct === 0 ? total * 0.1 : 0;
    return {
      refundAmount: Math.max(0, (total * pct) / 100 - fee),
      refundPercentage: pct,
      cancellationFee: Math.round(fee * 100) / 100,
      source: 'booking_cancellation_rules',
      policyApplied: true,
    };
  }

  // 3) Default: no configured policy
  const pct = hoursUntilBooking < 24 ? 50 : 100;
  return {
    refundAmount: Math.round(((total * pct) / 100) * 100) / 100,
    refundPercentage: pct,
    cancellationFee: 0,
    source: 'default',
    policyApplied: false,
  };
}