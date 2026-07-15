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

export async function customerBookingsBookingidGetHandler(c: Context) {
    try {
      const { bookingId } = c.req.param();

      const bookingQuery = await query(
        `SELECT b.*,
                ${SQL_PACKAGE_PURCHASE_SELECT.trim()},
                v.business_name as vendor_name,
                v.owner_name as vendor_owner,
                v.phone as vendor_phone,
                v.email as vendor_email,
                v.address as vendor_address,
                v.city as vendor_city,
                v.state as vendor_state,
                v.pincode as vendor_pincode,
                COALESCE(br_svc.br_name, s.name) AS service_name,
                COALESCE(br_svc.br_description, s.description) AS service_description,
                COALESCE(br_svc.br_category, s.category) AS service_category,
                COALESCE(br_svc.br_duration, s.duration_minutes, b.duration_minutes, b.total_duration_minutes) AS service_duration,
                st.name as staff_name,
                st.phone as staff_phone,
                p.id as pet_id_from_table,
                p.name as pet_name_from_table,
                p.species as pet_species_from_table,
                p.breed as pet_breed_from_table,
                p.age_years as pet_age_from_table,
                p.weight_kg as pet_weight_from_table,
                p.profile_photo_url as pet_photo_from_table
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         ${SQL_BOOKING_SERVICE_LATERAL}
         ${SQL_PACKAGE_PURCHASE_JOIN}
         LEFT JOIN services s ON s.id = b.service_id
         LEFT JOIN staff st ON b.staff_id = st.id
         LEFT JOIN LATERAL (
           SELECT id, name, species, breed, age_years, weight_kg, profile_photo_url
           FROM pets
           WHERE (
             (b.notes IS NOT NULL AND b.notes LIKE '%Pet ID:%' AND id::text = SUBSTRING(b.notes FROM 'Pet ID:\\s*([a-f0-9-]+)'))
           )
           LIMIT 1
         ) p ON true
         WHERE b.id = $1`,
        [bookingId]
      );

      if (bookingQuery.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingQuery.rows[0];

      const atHomeBooking =
        booking.service_style === 'at_home' || booking.service_type === 'at_home';
      const dedicatedWalk = await bookingUsesDedicatedEndSessionOtp(bookingId);

      let resolvedCompletionOtp = booking.completion_otp ?? null;
      if (booking.status === 'in_progress' && booking.otp_verified && !resolvedCompletionOtp) {
        const endRes = await query(
          `SELECT otp_code FROM otp_tokens
           WHERE metadata->>'bookingId' = $1
             AND metadata->>'action' = 'end'
             AND is_used = false
             AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY created_at DESC
           LIMIT 1`,
          [bookingId]
        ).catch(() => ({ rows: [] }));
        resolvedCompletionOtp = (endRes as any).rows?.[0]?.otp_code ?? null;
      }
      if (
        !resolvedCompletionOtp &&
        booking.status === 'in_progress' &&
        booking.otp_verified &&
        atHomeBooking &&
        booking.otp_code
      ) {
        if (!dedicatedWalk) {
          resolvedCompletionOtp = booking.otp_code;
        }
      }

      // Walk/sitter bookings: never leave completion OTP equal to start (repair older rows / missed start hook)
      if (
        atHomeBooking &&
        booking.status === 'in_progress' &&
        booking.otp_verified &&
        dedicatedWalk
      ) {
        const startO = String(booking.otp_code || '').trim();
        const cur = String(resolvedCompletionOtp ?? '').trim();
        if (!cur || cur === startO) {
          try {
            await ensureDedicatedEndSessionOtp(bookingId);
          } catch {
            /* non-fatal */
          }
          const cap = await query(`SELECT completion_otp FROM bookings WHERE id = $1`, [bookingId]).catch(() => ({
            rows: [],
          }));
          const newCo = (cap as any).rows?.[0]?.completion_otp;
          if (newCo != null && String(newCo).trim()) {
            resolvedCompletionOtp = String(newCo).trim();
          } else {
            const er = await query(
              `SELECT otp_code FROM otp_tokens
               WHERE metadata->>'bookingId' = $1
                 AND metadata->>'action' = 'end'
                 AND is_used = false
               ORDER BY created_at DESC
               LIMIT 1`,
              [bookingId]
            ).catch(() => ({ rows: [] }));
            resolvedCompletionOtp = String((er as any).rows?.[0]?.otp_code || '').trim() || null;
          }
        }
      }

      // ✅ FIX: Extract pet_id from multiple sources
      let petIdToUse = booking.pet_id || booking.pet_id_from_table;
      if (!petIdToUse && booking.notes) {
        const petIdMatch = booking.notes.match(/Pet ID:\s*([a-f0-9-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
        }
      }

      // Get prescription if exists
      const prescriptions = await query(
        'SELECT * FROM prescriptions WHERE booking_id = $1',
        [bookingId]
      );

      // Get review if exists
      const reviews = await query(
        'SELECT * FROM reviews WHERE booking_id = $1 AND customer_id = $2',
        [bookingId, booking.customer_id]
      );

      await reconcileBookingPayments([booking]);

      const totalAmountNum =
        booking.total_amount != null ? parseFloat(String(booking.total_amount)) : undefined;
      const paymentSources = await resolveBookingPaymentSources(bookingId, totalAmountNum);
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
          address: booking.address,
          city: booking.city,
          state: booking.state,
          pincode: booking.pincode,
          notes: booking.notes,
          createdAt: booking.created_at,
          updatedAt: booking.updated_at,
          // ✅ OTP fields for service verification
          otpCode: booking.otp_code || null,
          otp_code: booking.otp_code || null,
          completionOTP: resolvedCompletionOtp || null,
          completion_otp: resolvedCompletionOtp || null,
          startOTP: booking.start_otp || null,
          start_otp: booking.start_otp || null,
          otpVerified: booking.otp_verified || false,
          otp_verified: booking.otp_verified || false,
          serviceStyle: booking.service_style || null,
          service_style: booking.service_style || null,
          serviceType: booking.service_type || null,
          service_type: booking.service_type || null,
          prescription: prescriptions.rows.length > 0 ? prescriptions.rows[0] : null,
          review: reviews.rows.length > 0 ? reviews.rows[0] : null,
          // Multi-service: list of services and total duration
          selectedServices: parseSelectedServices(booking.selected_services).length > 0 ? parseSelectedServices(booking.selected_services) : undefined,
          totalDurationMinutes: booking.total_duration_minutes != null ? Number(booking.total_duration_minutes) : undefined,
          // Price/amount for booking details (fix ₹0 on customer and mobile)
          amount: booking.total_amount != null ? parseFloat(booking.total_amount) : undefined,
          total_amount: booking.total_amount != null ? parseFloat(booking.total_amount) : undefined,
          totalAmount: booking.total_amount != null ? parseFloat(booking.total_amount) : undefined,
          price: booking.total_amount != null ? parseFloat(booking.total_amount) : (booking.base_price != null ? parseFloat(booking.base_price) : undefined),
          base_price: booking.base_price != null ? parseFloat(booking.base_price) : undefined,
          basePrice: booking.base_price != null ? parseFloat(booking.base_price) : undefined,
          discount_amount: booking.discount_amount != null ? parseFloat(booking.discount_amount) : undefined,
          discountAmount: booking.discount_amount != null ? parseFloat(booking.discount_amount) : undefined,
          tax_amount: booking.tax_amount != null ? parseFloat(booking.tax_amount) : undefined,
          taxAmount: booking.tax_amount != null ? parseFloat(booking.tax_amount) : undefined,
          coupon_code: booking.coupon_code ?? undefined,
          couponCode: booking.coupon_code ?? undefined,
          ...paymentFeeFields,
          paymentSources,
          ...packageFieldsFromBookingRow(booking),
        }
      });
    } catch (error: any) {
      console.error('Error fetching booking:', error);
      return c.json({ error: error.message }, 500);
    }
}
