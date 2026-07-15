import type { Context } from 'hono';
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

export async function customerCustomeridBookingsFollowupeligibleGetHandler(c: Context) {
    try {
      const { customerId } = c.req.param();
      const rules = await getDiscoveryRules('all', 'booking');
      const followUpDays = rules.follow_up_days ?? 7;

      const eligibleBookings = await query(
        `SELECT b.*,
                v.business_name as vendor_name,
                v.phone as vendor_phone,
                COALESCE(br_svc.br_name, s.name) AS list_svc_name
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         ${SQL_BOOKING_SERVICE_LATERAL}
         LEFT JOIN services s ON s.id = b.service_id
         WHERE b.customer_id = $1
         AND b.status = 'completed'
         AND b.completed_at IS NOT NULL
         AND b.completed_at >= NOW() - ($2::text || ' days')::interval
         ORDER BY b.completed_at DESC`,
        [customerId, followUpDays]
      );

      // Enrich with prescription and review status
      const enrichedBookings = await Promise.all(
        eligibleBookings.rows.map(async (booking: any) => {
          const prescription = await query(
            'SELECT id FROM prescriptions WHERE booking_id = $1',
            [booking.id]
          );

          const review = await query(
            'SELECT id FROM reviews WHERE booking_id = $1',
            [booking.id]
          );

          return {
            id: booking.id,
            bookingId: booking.id,
            vendorId: booking.vendor_id,
            vendorName: booking.vendor_name,
            vendorPhone: booking.vendor_phone,
            serviceId: booking.service_id,
            serviceName: booking.list_svc_name ?? booking.service_name,
            bookingDate: booking.booking_date,
            bookingTime: booking.booking_time,
            completedAt: booking.completed_at,
            totalAmount: booking.total_amount,
            hasPrescription: prescription.rows.length > 0,
            hasReview: review.rows.length > 0,
            isEligibleForFollowUp: !review.rows.length, // Eligible if no review yet
          };
        })
      );

      return c.json({
        success: true,
        bookings: enrichedBookings,
        total: enrichedBookings.length,
      });
    } catch (error: any) {
      console.error('Error fetching follow-up eligible bookings:', error);
      return c.json({ error: error.message }, 500);
    }
}
