import type { Context } from 'hono';
import * as customer_customerid_bookings_getRepo from '../repos/customer_customerid_bookings_get.repo';
import { Hono } from 'hono';
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

export async function executecustomerCustomeridBookingsGet(c: Context) {
    try {
      let { customerId } = c.req.param();
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Check if customerId is a phone number (not a UUID) - support both formats
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
      if (!isUUID) {
        // Treat as phone number - look up customer by phone
        const customers = await customer_customerid_bookings_getRepo.dbCustomerCustomeridBookingsGet0(customerId)
        if (customers.length > 0) {
          customerId = customers[0].id;
        } else {
          // Return empty result if customer not found
          return c.json({
            success: true,
            bookings: [],
            stats: { total: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0 },
            total: 0
          });
        }
      }

      let bookingQuery = `
        SELECT b.*,
               ${SQL_PACKAGE_PURCHASE_SELECT.trim()},
               v.business_name as vendor_name,
               v.phone as vendor_phone,
               v.city as vendor_city,
               COALESCE(br_svc.br_name, s.name) AS list_svc_name,
               COALESCE(br_svc.br_category, s.category) AS list_svc_category,
               COALESCE(br_svc.br_description, s.description) AS list_svc_description,
               COALESCE(br_svc.br_duration, s.duration_minutes, b.duration_minutes, b.total_duration_minutes) AS list_svc_duration
        FROM bookings b
        LEFT JOIN vendors v ON b.vendor_id = v.id
        ${SQL_BOOKING_SERVICE_LATERAL}
        ${SQL_PACKAGE_PURCHASE_JOIN}
        LEFT JOIN services s ON s.id = b.service_id
        WHERE b.customer_id = executecustomerCustomeridBookingsGet
          AND COALESCE(b.is_package_session, false) = false
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (status) {
        bookingQuery += ` AND b.status = ${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      bookingQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`;
      params.push(limit, offset);

      const bookings = await customer_customerid_bookings_getRepo.dbCustomerCustomeridBookingsGet1(bookingQuery, params)

      // ✅ PAYMENT RECONCILIATION (2 tiers):
      //   Tier 1 – DB: pending booking with completed payment → mark paid
      //   Tier 2 – Razorpay API: pending payment with razorpay_order_id → check Razorpay if actually paid
      await reconcileBookingPayments(bookings.rows);

      const paymentSourcesByBooking = await resolveBookingPaymentSourcesBatch(
        bookings.rows.map((b: any) => ({ id: b.id, total_amount: b.total_amount }))
      );

      const statsQuery = await customer_customerid_bookings_getRepo.dbCustomerCustomeridBookingsGet2()

      const stats = statsQuery.rows[0];

      return c.json({
        success: true,
        bookings: bookings.rows.map((b: any) => ({
          id: b.id,
          bookingId: b.id,
          customerId: b.customer_id,
          vendorId: b.vendor_id,
          vendorName: b.vendor_name,
          vendorPhone: b.vendor_phone,
          vendorCity: b.vendor_city,
          serviceId: b.service_id,
          serviceName: b.list_svc_name ?? b.service_name,
          serviceCategory: b.list_svc_category ?? b.service_category,
          serviceDescription: b.list_svc_description ?? null,
          serviceDurationMinutes:
            b.list_svc_duration != null ? Number(b.list_svc_duration) : undefined,
          status: b.status,
          paymentStatus: b.payment_status,
          bookingDate: b.booking_date,
          bookingTime: b.booking_time,
          serviceType: b.service_type,
          serviceStyle: b.service_style || b.service_type,
          totalAmount: b.total_amount,
          basePrice: b.base_price,
          discountAmount: b.discount_amount,
          createdAt: b.created_at,
          completedAt: b.completed_at,
          cancelledAt: b.cancelled_at,
          // ✅ FIX: Include OTP code for paid bookings
          otpCode: b.otp_code,
          otpVerified: b.otp_verified,
          otpExpiresAt: b.otp_expires_at,
          // ✅ Include cancellation/refund info
          cancellationReason: b.cancellation_reason,
          rescheduledFromBookingId: b.rescheduled_from_booking_id,
          // ✅ FIX: Include notes field for diagnostic test names
          notes: b.notes,
          // Multi-service: list of services and total duration
          selectedServices: parseSelectedServices(b.selected_services),
          selected_services: b.selected_services, // ✅ FIX: Include raw selected_services for frontend parsing
          totalDurationMinutes: b.total_duration_minutes != null ? Number(b.total_duration_minutes) : undefined,
          paymentSources: paymentSourcesByBooking.get(b.id) || [],
          ...packageFieldsFromBookingRow(b),
        })),
        stats: {
          total: parseInt(stats?.total || '0', 10),
          confirmed: parseInt(stats?.confirmed || '0', 10),
          inProgress: parseInt(stats?.in_progress || '0', 10),
          completed: parseInt(stats?.completed || '0', 10),
          cancelled: parseInt(stats?.cancelled || '0', 10),
        },
        total: bookings.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer bookings:', error);
      return c.json({ error: error.message }, 500);
    }
}