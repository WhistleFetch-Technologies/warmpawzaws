import type { Context } from 'hono';
import * as customer_customerid_bookings_bookingid_getRepo from '../repos/customer_customerid_bookings_bookingid_get.repo';
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
import { loadCustomerPaymentFeeFields } from '../repos/module-helpers.repo';

export async function executecustomerCustomeridBookingsBookingidGet(c: Context) {
    try {
      const { customerId, bookingId } = c.req.param();

      const bookingQuery = await customer_customerid_bookings_bookingid_getRepo.dbCustomerCustomeridBookingsBookingidGet0(bookingId, customerId)

      if (bookingQuery.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingQuery.rows[0];

      // ✅ FIX: Extract pet_id from multiple sources
      let petIdToUse = booking.pet_id || booking.pet_id_from_table;
      if (!petIdToUse && booking.notes) {
        const petIdMatch = booking.notes.match(/Pet ID:\s*([a-f0-9-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
        }
      }

      // Get prescription if exists
      const prescriptions = await customer_customerid_bookings_bookingid_getRepo.dbCustomerCustomeridBookingsBookingidGet1(bookingId)

      // Get review if exists
      const reviews = await customer_customerid_bookings_bookingid_getRepo.dbCustomerCustomeridBookingsBookingidGet2(bookingId, customerId)

      const paymentFeeFields = await loadCustomerPaymentFeeFields(bookingId);

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          // ✅ FIX: Ensure all IDs are at top level
          customerId: booking.customer_id,
          customer_id: booking.customer_id,
          vendorId: booking.vendor_id,
          vendor_id: booking.vendor_id,
          staffId: booking.staff_id || null,
          staff_id: booking.staff_id || null,
          petId: petIdToUse || null,
          pet_id: petIdToUse || null,
          serviceId: booking.service_id,
          service_id: booking.service_id,
          vendor: {
            id: booking.vendor_id,
            businessName: booking.vendor_name,
            ownerName: booking.vendor_owner,
            phone: booking.vendor_phone,
            email: booking.vendor_email,
            address: booking.vendor_address,
            city: booking.vendor_city,
            state: booking.vendor_state,
            pincode: booking.vendor_pincode,
          },
          service: {
            id: booking.service_id,
            name: booking.service_name,
            description: booking.service_description,
            category: booking.service_category,
            duration: booking.service_duration,
          },
          staff: booking.staff_id ? {
            id: booking.staff_id,
            name: booking.staff_name,
            phone: booking.staff_phone,
          } : null,
          // ✅ FIX: Pet information
          pet: (booking.pet_id_from_table || petIdToUse) ? {
            id: booking.pet_id_from_table || petIdToUse,
            name: booking.pet_name_from_table,
            species: booking.pet_species_from_table,
            breed: booking.pet_breed_from_table,
            age: booking.pet_age_from_table,
            weight: booking.pet_weight_from_table,
            photo_url: booking.pet_photo_from_table,
          } : null,
          petName: booking.pet_name_from_table || null,
          petBreed: booking.pet_breed_from_table || null,
          petType: booking.pet_species_from_table || null,
          petAge: booking.pet_age_from_table || null,
          petPhoto: booking.pet_photo_from_table || null,
          status: booking.status,
          paymentStatus: booking.payment_status,
          // ✅ FIX: Schedule information - ensure all formats are included
          bookingDate: booking.booking_date,
          booking_date: booking.booking_date,
          bookingTime: booking.booking_time,
          booking_time: booking.booking_time,
          scheduledDate: booking.booking_date, // Alias for frontend compatibility
          scheduledTime: booking.booking_time, // Alias for frontend compatibility
          schedule: booking.booking_time, // Alias for frontend compatibility
          startDate: booking.booking_date, // Alias for frontend compatibility
          serviceType: booking.service_type,
          address: booking.address,
          city: booking.city,
          state: booking.state,
          pincode: booking.pincode,
          totalAmount: booking.total_amount,
          basePrice: booking.base_price,
          discountAmount: booking.discount_amount,
          taxAmount: booking.tax_amount,
          loyaltyPointsUsed: booking.loyalty_points_used,
          couponCode: booking.coupon_code,
          notes: booking.notes,
          ...paymentFeeFields,
          cancellationReason: booking.cancellation_reason,
          createdAt: booking.created_at,
          completedAt: booking.completed_at,
          cancelledAt: booking.cancelled_at,
          // Multi-service: list of services and total duration
          selectedServices: parseSelectedServices(booking.selected_services).length > 0 ? parseSelectedServices(booking.selected_services) : undefined,
          totalDurationMinutes: booking.total_duration_minutes != null ? Number(booking.total_duration_minutes) : undefined,
          ...packageFieldsFromBookingRow(booking),
        },
        prescription: prescriptions.rows[0] || null,
        review: reviews.rows[0] || null,
      });
    } catch (error: any) {
      console.error('Error fetching booking details:', error);
      return c.json({ error: error.message }, 500);
    }
}