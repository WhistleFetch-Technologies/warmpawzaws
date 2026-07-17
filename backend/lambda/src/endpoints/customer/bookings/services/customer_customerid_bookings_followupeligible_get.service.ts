import type { Context } from 'hono';
import * as customer_customerid_bookings_followupeligible_getRepo from '../repos/customer_customerid_bookings_followupeligible_get.repo';
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

export async function executecustomerCustomeridBookingsFollowupeligibleGet(c: Context) {
    try {
      const { customerId } = c.req.param();
      const rules = await getDiscoveryRules('all', 'booking');
      const followUpDays = rules.follow_up_days ?? 7;

      const eligibleBookings = await customer_customerid_bookings_followupeligible_getRepo.dbCustomerCustomeridBookingsFollowupeligibleGet0(customerId, followUpDays)

      // Enrich with prescription and review status
      const enrichedBookings = await Promise.all(
        eligibleBookings.rows.map(async (booking: any) => {
          const prescription = await customer_customerid_bookings_followupeligible_getRepo.dbCustomerCustomeridBookingsFollowupeligibleGet1(booking)

          const review = await customer_customerid_bookings_followupeligible_getRepo.dbCustomerCustomeridBookingsFollowupeligibleGet2(booking)

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