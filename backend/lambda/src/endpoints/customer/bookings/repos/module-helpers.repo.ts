/**
 * ============================================================================
 * CUSTOMER BOOKING HISTORY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer booking history:
 * - Get all bookings for a customer
 * - Get follow-up eligible bookings
 * - Get booking details with vendor/service info
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../../../../database/rds-connection';
import { normalizeDbRows, buildBookingResponse, parseSelectedServices } from '../../../../utils/entity-extractor';
import { reconcileBookingPayments } from '../../../../utils/payments/payment-reconciliation';
import { resolveBookingPaymentSources, resolveBookingPaymentSourcesBatch } from '../../../../utils/payments/booking-payment-sources';
import { normalizeBooking, isValidUUID } from '../../../../types/entities';
import { getDiscoveryRules } from '../../../../lib/rule-engine';
import {
  bookingUsesDedicatedEndSessionOtp,
  ensureDedicatedEndSessionOtp,
} from '../../../../lib/booking-dedicated-end-otp';
import {
  breakdownFromFeeBreakdownJson,
  breakdownFromPaymentColumns,
  hasMeaningfulCustomerPaidBreakdown,
} from '../../../../utils/vendor-accrual-fee-breakdown';
import {
  packageFieldsFromBookingRow,
  SQL_PACKAGE_PURCHASE_JOIN,
  SQL_PACKAGE_PURCHASE_SELECT,
} from '../../../../utils/customer-booking-package-fields';

/** Module helpers (move-only). */

export async function loadCustomerPaymentFeeFields(bookingId: string): Promise<Record<string, number>> {
  try {
    const pr = await query(
      `SELECT amount, total_amount, platform_fee, convenience_fee, delivery_fee, cgst_amount, sgst_amount, igst_amount, gst_amount, fee_breakdown
       FROM payments
       WHERE booking_id = $1::uuid
         AND LOWER(TRIM(COALESCE(payment_status, ''))) IN ('completed', 'paid', 'success')
       ORDER BY created_at DESC
       LIMIT 1`,
      [bookingId]
    );
    const row = pr.rows?.[0];
    if (!row) return {};

    let breakdown = breakdownFromPaymentColumns(row);
    if (!hasMeaningfulCustomerPaidBreakdown(breakdown)) {
      breakdown = breakdownFromFeeBreakdownJson(row.fee_breakdown);
    }

    const paidAmount = parseFloat(String(row.total_amount ?? row.amount ?? 0)) || 0;
    const out: Record<string, number> = {};
    if (paidAmount > 0) out.paid_amount = paidAmount;

    if (!hasMeaningfulCustomerPaidBreakdown(breakdown)) return out;

    return {
      ...out,
      platform_fee: breakdown.platformFee,
      convenience_fee: breakdown.convenienceFee,
      delivery_fee: breakdown.deliveryFee,
      cgst_amount: breakdown.cgstAmount,
      sgst_amount: breakdown.sgstAmount,
      igst_amount: breakdown.igstAmount,
      gst_amount: breakdown.gstTotal,
    };
  } catch {
    return {};
  }
}

/**
 * bookings.service_id usually references vendor_services.id (FK).
 * Resolve display fields via vendor_services + service_catalog (+ legacy services).
 */
export const SQL_BOOKING_SERVICE_LATERAL = `
LEFT JOIN LATERAL (
  SELECT
    COALESCE(sc.service_name, s_direct.name, vp.service_name) AS br_name,
    COALESCE(sc.description, s_direct.description, vp.custom_description) AS br_description,
    COALESCE(sc.category_name, s_direct.category::text, vp.category::text) AS br_category,
    COALESCE(vp.custom_duration, vp.duration_minutes, sc.duration_minutes, s_direct.duration_minutes) AS br_duration
  FROM vendor_services vp
  LEFT JOIN service_catalog sc ON sc.id = COALESCE(vp.service_id, b.service_id)
  LEFT JOIN services s_direct ON s_direct.id = COALESCE(vp.service_id, b.service_id) AND sc.id IS NULL
  WHERE vp.vendor_id = b.vendor_id
    AND (vp.service_id = b.service_id OR vp.id = b.service_id)
  ORDER BY
    CASE WHEN vp.service_id = b.service_id THEN 0 WHEN vp.id = b.service_id THEN 1 ELSE 2 END,
    vp.updated_at DESC NULLS LAST
  LIMIT 1
) br_svc ON true`;

