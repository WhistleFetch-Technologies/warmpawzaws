/**
 * Service **booking** cancellation refund preview (not e-commerce orders).
 * - Refund policy (refund %, fees) → `vendor_refund_tiers`
 * - Cancellation policy (who cancels, time windows / rules) → same rows (`cancelled_by`, `hours_*`, `cancellation_window`, …)
 * - Rescheduling eligibility (per tier) → `policy_extensions.rescheduleAllowed`
 * - No-show rules (per tier) → `policy_extensions.noShowPolicy`
 *
 * E-commerce returns/cancellation stay in the ecommerce policy path only.
 */

import { query } from '../../database/rds-connection';
import { sqlRefundTierVendorTypesMatch } from '../refund-tier-vendor-types-match';
import { computeHoursUntilBookingStart } from '../utils/booking-start-wall-time';
import { getRefundableCustomerPaidBreakdown, clampRefundToCustomerPaidBase } from './refundable-base';
import {
  isWapptPolicyEligibleBooking,
  WAPPT_COMMERCE_MODE,
} from '../../endpoints/warmpawz-appointments/shared/wappt-policy.constants';

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
  /** Vendor IANA zone for wall-clock date+time (matches bookings.vendor_timezone / DB trigger). */
  vendor_timezone?: string | null;
  total_amount: number | string;
  /** When set (or loaded from DB), used with total_amount if no completed payments sum exists. */
  discount_amount?: number | string | null;
  commerce_mode?: string | null;
  /** WAPPT hub slug: vet, grooming, training, … */
  booking_category?: string | null;
  service_category?: string | null;
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

function resolveBookingCategory(booking: BookingForPolicy): string | null {
  const raw = booking.booking_category ?? booking.service_category ?? null;
  return raw != null && String(raw).trim() ? String(raw).trim().toLowerCase() : null;
}

function usesWapptPolicyTiers(booking: BookingForPolicy): boolean {
  return isWapptPolicyEligibleBooking({
    commerce_mode: booking.commerce_mode,
    service_type: booking.service_type,
  });
}

function mapTierRow(tier: Record<string, unknown>): RefundTierResult {
  return {
    refundPercentage: Number(tier.refund_percentage ?? 100),
    cancellationFee: Number(tier.cancellation_fee ?? 0),
    maxPartialRefundPercentage:
      tier.max_partial_refund_percentage != null
        ? Number(tier.max_partial_refund_percentage)
        : null,
    tierId: tier.id != null ? String(tier.id) : undefined,
    tierName: tier.name != null ? String(tier.name) : undefined,
  };
}

async function queryProviderRefundTier(
  serviceLocation: string,
  vendorRoleName: string | null,
  vendorRoleId: string | null,
  vendorReason: string | null,
  commerceModeFilter: 'marketplace' | 'wappt',
  policyScope?: 'platform' | 'category',
  serviceCategory?: string | null,
): Promise<RefundTierResult | null> {
  const vendorMatchProv = sqlRefundTierVendorTypesMatch(3, 4);
  const commerceClause =
    commerceModeFilter === 'wappt'
      ? `commerce_mode = '${WAPPT_COMMERCE_MODE}'`
      : `(commerce_mode IS NULL OR commerce_mode = 'marketplace')`;
  let scopeClause = '';
  const params: unknown[] = [vendorReason, serviceLocation, vendorRoleName || null, vendorRoleId || null];
  if (commerceModeFilter === 'wappt' && policyScope === 'category' && serviceCategory) {
    scopeClause = ` AND policy_scope = 'category' AND LOWER(TRIM(service_category)) = LOWER(TRIM($5))`;
    params.push(serviceCategory);
  } else if (commerceModeFilter === 'wappt') {
    scopeClause = ` AND policy_scope = 'platform' AND (service_category IS NULL OR TRIM(service_category) = '')`;
  }
  const tiersResult = await query(
    `SELECT id, name, refund_percentage, cancellation_fee, max_partial_refund_percentage, hours_before_service
     FROM vendor_refund_tiers
     WHERE is_active = true
       AND cancelled_by = 'provider'
       AND ${commerceClause}
       ${scopeClause}
       AND (vendor_cancellation_reason IS NULL OR vendor_cancellation_reason = $1 OR $1 IS NULL)
       AND (
         service_location = 'all'
         OR service_location = $2
         OR (service_location = 'both' AND $2 IN ('home', 'clinic'))
       )
       AND ${vendorMatchProv}
     ORDER BY vendor_cancellation_reason DESC NULLS LAST
     LIMIT 1`,
    params,
  ).catch(() => ({ rows: [] }));
  const rows = Array.isArray(tiersResult) ? tiersResult : (tiersResult as any).rows || [];
  const tier = rows[0];
  return tier ? mapTierRow(tier) : null;
}

async function queryCustomerRefundTier(
  hoursUntil: number,
  serviceLocation: string,
  vendorRoleName: string | null,
  vendorRoleId: string | null,
  commerceModeFilter: 'marketplace' | 'wappt',
  policyScope?: 'platform' | 'category',
  serviceCategory?: string | null,
): Promise<RefundTierResult | null> {
  const h = Math.max(0, hoursUntil);
  const vendorMatchPet = sqlRefundTierVendorTypesMatch(3, 4);
  const commerceClause =
    commerceModeFilter === 'wappt'
      ? `commerce_mode = '${WAPPT_COMMERCE_MODE}'`
      : `(commerce_mode IS NULL OR commerce_mode = 'marketplace')`;
  let scopeClause = '';
  const params: unknown[] = [h, serviceLocation, vendorRoleName || null, vendorRoleId || null];
  if (commerceModeFilter === 'wappt' && policyScope === 'category' && serviceCategory) {
    scopeClause = ` AND policy_scope = 'category' AND LOWER(TRIM(service_category)) = LOWER(TRIM($5))`;
    params.push(serviceCategory);
  } else if (commerceModeFilter === 'wappt') {
    scopeClause = ` AND policy_scope = 'platform' AND (service_category IS NULL OR TRIM(service_category) = '')`;
  }
  const tiersResult = await query(
    `SELECT id, name, refund_percentage, cancellation_fee, max_partial_refund_percentage, hours_before_service
     FROM vendor_refund_tiers
     WHERE is_active = true
       AND cancelled_by = 'pet_parent'
       AND ${commerceClause}
       ${scopeClause}
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
       AND ${vendorMatchPet}
     ORDER BY COALESCE(hours_threshold, hours_before_service) DESC NULLS LAST
     LIMIT 1`,
    params,
  ).catch(() => ({ rows: [] }));
  const rows = Array.isArray(tiersResult) ? tiersResult : (tiersResult as any).rows || [];
  const tier = rows[0];
  return tier ? mapTierRow(tier) : null;
}

async function resolveWapptRefundTier(
  fetcher: (scope: 'category' | 'platform') => Promise<RefundTierResult | null>,
  serviceCategory: string | null,
): Promise<RefundTierResult | null> {
  if (serviceCategory) {
    const categoryTier = await fetcher('category');
    if (categoryTier) return categoryTier;
  }
  return fetcher('platform');
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
  const wapptBooking = usesWapptPolicyTiers(booking);
  const commerceFilter: 'marketplace' | 'wappt' = wapptBooking ? 'wappt' : 'marketplace';
  const bookingCategory = resolveBookingCategory(booking);

  // Resolve vendor role (canonical name + id) for vendor_types[] matching (admin stores name and/or UUID slug).
  let vendorRoleName: string | null = null;
  let vendorRoleId: string | null = null;
  if (booking.vendor_id) {
    const vendorRoleResult = await query(
      `SELECT r.id::text AS role_id, r.name AS role_name
       FROM vendors v
       JOIN roles r ON r.id = v.role_id
       WHERE v.id = $1 AND r.is_active = true
       LIMIT 1`,
      [booking.vendor_id]
    ).catch(() => ({ rows: [] }));
    const rows = Array.isArray(vendorRoleResult) ? vendorRoleResult : (vendorRoleResult as any).rows || [];
    vendorRoleName = rows[0]?.role_name != null ? String(rows[0].role_name).trim() || null : null;
    vendorRoleId = rows[0]?.role_id != null ? String(rows[0].role_id).trim() || null : null;
  }

  const cancelledByParam = cancelledBy === 'pet_parent' ? 'pet_parent' : 'provider';

  if (cancelledBy === 'provider') {
    const vendorReason = options?.vendorCancellationReason
      ? String(options.vendorCancellationReason).toLowerCase()
      : null;
    if (wapptBooking) {
      return resolveWapptRefundTier(
        (scope) =>
          queryProviderRefundTier(
            serviceLocation,
            vendorRoleName,
            vendorRoleId,
            vendorReason,
            commerceFilter,
            scope,
            bookingCategory,
          ),
        bookingCategory,
      );
    }
    const tier = await queryProviderRefundTier(
      serviceLocation,
      vendorRoleName,
      vendorRoleId,
      vendorReason,
      commerceFilter,
    );
    return tier;
  }

  // Customer cancels: match by preset (hours_before_service <= hours) OR flexible rule (hours_operator + hours_threshold)
  let computedHours: number | null = null;
  if (typeof options?.hoursUntilBooking === 'number' && Number.isFinite(options.hoursUntilBooking)) {
    computedHours = options.hoursUntilBooking;
  } else {
    const h = computeHoursUntilBookingStart(booking);
    computedHours = Number.isFinite(h) ? h : null;
  }

  if (computedHours == null || !Number.isFinite(computedHours)) {
    console.warn('[RefundTier] Unable to compute hours until booking for tier evaluation:', booking.id);
    return null;
  }

  const h = Math.max(0, computedHours);
  if (wapptBooking) {
    return resolveWapptRefundTier(
      (scope) =>
        queryCustomerRefundTier(
          h,
          serviceLocation,
          vendorRoleName,
          vendorRoleId,
          commerceFilter,
          scope,
          bookingCategory,
        ),
      bookingCategory,
    );
  }
  const tier = await queryCustomerRefundTier(
    h,
    serviceLocation,
    vendorRoleName,
    vendorRoleId,
    commerceFilter,
  );
  return tier;
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

export type RefundSource =
  | 'vendor_refund_tiers'
  | 'booking_cancellation_rules'
  | 'default'
  | 'wallet_full_refund';

export type CustomerCancellationRefundMethod = 'wallet' | 'original';

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
  /** Amount tier % / fees were applied to (net paid minus non-refundable platform/convenience fees; coupon net when no payments). */
  refundableCustomerPaidBase: number;
  /** Sum of platform_fee on completed payments; not part of refundable base. */
  platformFeeNonRefundable: number;
  /** Sum of convenience_fee on completed payments; not part of refundable base. */
  convenienceFeeNonRefundable: number;
  /** platformFeeNonRefundable + convenienceFeeNonRefundable. */
  nonRefundableFees: number;
  /** Hours from now until scheduled start (for display / calculate-refund). */
  hoursUntilBooking?: number;
}> {
  const paidBreakdown = await getRefundableCustomerPaidBreakdown(booking.id, booking);
  const refundableBase = paidBreakdown.refundableBase;
  const platformFeeNonRefundable = paidBreakdown.platformFeeNonRefundable;
  const convenienceFeeNonRefundable = paidBreakdown.convenienceFeeNonRefundable;
  const nonRefundableFees = paidBreakdown.nonRefundableFees;
  const total = refundableBase;
  // Hours until start: vendor-local wall clock first (vendor_timezone + date + time), same as DB trigger.
  // Avoid naive `new Date(YYYY-MM-DDTHH:mm)` on Lambda UTC — that mis-reads IST slots as UTC and can pick the wrong refund tier.
  const hoursRaw = computeHoursUntilBookingStart(booking);
  const hoursUntilBooking = Number.isFinite(hoursRaw) ? hoursRaw : 0;

  // 1) Preferred: vendor_refund_tiers
  const tier = await getRefundTierForCancellation(booking, 'pet_parent', { hoursUntilBooking });
  if (tier) {
    const computed = computeRefundFromTier(total, tier, 100, 0);
    const refundAmount = clampRefundToCustomerPaidBase(computed.refundAmount, refundableBase);
    return {
      refundAmount,
      refundPercentage: computed.refundPercentage,
      cancellationFee: computed.cancellationFee,
      source: 'vendor_refund_tiers',
      policyApplied: true,
      meta: { tierId: tier.tierId, tierName: tier.tierName },
      refundableCustomerPaidBase: refundableBase,
      platformFeeNonRefundable,
      convenienceFeeNonRefundable,
      nonRefundableFees,
      hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
    };
  }

  if (usesWapptPolicyTiers(booking)) {
    return {
      refundAmount: 0,
      refundPercentage: 0,
      cancellationFee: 0,
      source: 'vendor_refund_tiers',
      policyApplied: false,
      refundableCustomerPaidBase: refundableBase,
      platformFeeNonRefundable,
      convenienceFeeNonRefundable,
      nonRefundableFees,
      hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
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
    const rawRefund = Math.max(0, (total * pct) / 100 - fee);
    return {
      refundAmount: clampRefundToCustomerPaidBase(rawRefund, refundableBase),
      refundPercentage: pct,
      cancellationFee: Math.round(fee * 100) / 100,
      source: 'booking_cancellation_rules',
      policyApplied: true,
      refundableCustomerPaidBase: refundableBase,
      platformFeeNonRefundable,
      convenienceFeeNonRefundable,
      nonRefundableFees,
      hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
    };
  }

  // 3) Default: no configured policy
  const pct = hoursUntilBooking < 24 ? 50 : 100;
  const rawDefault = Math.round(((total * pct) / 100) * 100) / 100;
  return {
    refundAmount: clampRefundToCustomerPaidBase(rawDefault, refundableBase),
    refundPercentage: pct,
    cancellationFee: 0,
    source: 'default',
    policyApplied: false,
    refundableCustomerPaidBase: refundableBase,
    platformFeeNonRefundable,
    convenienceFeeNonRefundable,
    nonRefundableFees,
    hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
  };
}

/**
 * Wallet refunds on customer cancel: 100% of what the customer paid (no cancellation policy).
 * Adds back the non-refundable fees (platform + convenience) so wallet credit stays at 100%.
 */
export async function previewWalletFullCancellationRefund(booking: BookingForPolicy) {
  const paidBreakdown = await getRefundableCustomerPaidBreakdown(booking.id, booking);
  const fullAmount = Math.round(
    (paidBreakdown.refundableBase + paidBreakdown.nonRefundableFees) * 100
  ) / 100;
  const hoursRaw = computeHoursUntilBookingStart(booking);
  const hoursUntilBooking = Number.isFinite(hoursRaw) ? hoursRaw : 0;

  return {
    refundAmount: fullAmount,
    refundPercentage: 100,
    cancellationFee: 0,
    source: 'wallet_full_refund' as RefundSource,
    policyApplied: false,
    refundableCustomerPaidBase: fullAmount,
    platformFeeNonRefundable: 0,
    convenienceFeeNonRefundable: 0,
    nonRefundableFees: 0,
    hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
  };
}

export function normalizeCustomerCancellationRefundMethod(
  value: unknown
): CustomerCancellationRefundMethod {
  return String(value || 'original').toLowerCase() === 'wallet' ? 'wallet' : 'original';
}

export async function previewCustomerCancellationRefundByMethod(
  booking: BookingForPolicy,
  refundMethod: CustomerCancellationRefundMethod
) {
  if (refundMethod === 'wallet') {
    return previewWalletFullCancellationRefund(booking);
  }
  return previewCustomerCancellationRefund(booking);
}

/**
 * Provider cancels: refund % and fee from vendor_refund_tiers (cancelled_by = provider,
 * optional vendor_cancellation_reason slug: emergency | operational | technical).
 * Refund base uses the same customer-paid breakdown as customer cancellation.
 */
export async function previewProviderCancellationRefund(
  booking: BookingForPolicy,
  vendorCancellationReason: string | null | undefined
): Promise<{
  refundAmount: number;
  refundPercentage: number;
  cancellationFee: number;
  source: RefundSource;
  policyApplied: boolean;
  meta?: { tierId?: string; tierName?: string };
  refundableCustomerPaidBase: number;
  platformFeeNonRefundable: number;
  convenienceFeeNonRefundable: number;
  nonRefundableFees: number;
}> {
  const paidBreakdown = await getRefundableCustomerPaidBreakdown(booking.id, booking);
  const refundableBase = paidBreakdown.refundableBase;
  const platformFeeNonRefundable = paidBreakdown.platformFeeNonRefundable;
  const convenienceFeeNonRefundable = paidBreakdown.convenienceFeeNonRefundable;
  const nonRefundableFees = paidBreakdown.nonRefundableFees;
  const total = refundableBase;
  const reasonNorm =
    vendorCancellationReason && String(vendorCancellationReason).trim()
      ? String(vendorCancellationReason).toLowerCase().trim()
      : null;

  const tier = await getRefundTierForCancellation(booking, 'provider', {
    vendorCancellationReason: reasonNorm ?? undefined,
  });

  if (tier) {
    const computed = computeRefundFromTier(total, tier, 100, 0);
    const refundAmount = clampRefundToCustomerPaidBase(computed.refundAmount, refundableBase);
    return {
      refundAmount,
      refundPercentage: computed.refundPercentage,
      cancellationFee: computed.cancellationFee,
      source: 'vendor_refund_tiers',
      policyApplied: true,
      meta: { tierId: tier.tierId, tierName: tier.tierName },
      refundableCustomerPaidBase: refundableBase,
      platformFeeNonRefundable,
      convenienceFeeNonRefundable,
      nonRefundableFees,
    };
  }

  const computed = computeRefundFromTier(total, null, 100, 0);
  const refundAmount = clampRefundToCustomerPaidBase(computed.refundAmount, refundableBase);
  return {
    refundAmount,
    refundPercentage: 100,
    cancellationFee: 0,
    source: 'default',
    policyApplied: false,
    refundableCustomerPaidBase: refundableBase,
    platformFeeNonRefundable,
    convenienceFeeNonRefundable,
    nonRefundableFees,
  };
}