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
import { select, query } from '../../../database/rds-connection';
import { normalizeDbRows, buildBookingResponse, parseSelectedServices } from '../../../utils/entity-extractor';
import { reconcileBookingPayments } from '../../../utils/payments/payment-reconciliation';
import { resolveBookingPaymentSources, resolveBookingPaymentSourcesBatch } from '../../../utils/payments/booking-payment-sources';
import { normalizeBooking, isValidUUID } from '../../../types/entities';
import { getDiscoveryRules } from '../../../lib/rule-engine';
import {
  bookingUsesDedicatedEndSessionOtp,
  ensureDedicatedEndSessionOtp,
} from '../../../lib/booking-dedicated-end-otp';
import {
  breakdownFromFeeBreakdownJson,
  breakdownFromPaymentColumns,
  hasMeaningfulCustomerPaidBreakdown,
} from '../../../utils/vendor-accrual-fee-breakdown';
import {
  packageFieldsFromBookingRow,
  SQL_PACKAGE_PURCHASE_JOIN,
  SQL_PACKAGE_PURCHASE_SELECT,
} from '../../../utils/customer-booking-package-fields';

async function loadCustomerPaymentFeeFields(bookingId: string): Promise<Record<string, number>> {
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
const SQL_BOOKING_SERVICE_LATERAL = `
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

export function registerCustomerBookingHistoryEndpoints(app: Hono) {
  /**
   * GET /customer/:customerId/bookings
   * Get all bookings for a customer
   */
  app.get("/customer/:customerId/bookings", async (c) => {
    try {
      let { customerId } = c.req.param();
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Check if customerId is a phone number (not a UUID) - support both formats
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
      if (!isUUID) {
        // Treat as phone number - look up customer by phone
        const customers = await select('customers', { phone: customerId });
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
        WHERE b.customer_id = $1
          AND COALESCE(b.is_package_session, false) = false
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (status) {
        bookingQuery += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      bookingQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const bookings = await query(bookingQuery, params);

      // ✅ PAYMENT RECONCILIATION (2 tiers):
      //   Tier 1 – DB: pending booking with completed payment → mark paid
      //   Tier 2 – Razorpay API: pending payment with razorpay_order_id → check Razorpay if actually paid
      await reconcileBookingPayments(bookings.rows);

      const paymentSourcesByBooking = await resolveBookingPaymentSourcesBatch(
        bookings.rows.map((b: any) => ({ id: b.id, total_amount: b.total_amount }))
      );

      const statsQuery = await query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
           COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
         FROM bookings
         WHERE customer_id = $1`,
        [customerId]
      );

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
  });

  /**
   * GET /customer/bookings/:bookingId
   * Get detailed booking information (convenience endpoint)
   */
  app.get("/customer/bookings/:bookingId", async (c) => {
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
  });

  /**
   * GET /customer/:customerId/bookings/:bookingId
   * Get detailed booking information
   */
  app.get("/customer/:customerId/bookings/:bookingId", async (c) => {
    try {
      const { customerId, bookingId } = c.req.param();

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
         WHERE b.id = $1 AND b.customer_id = $2`,
        [bookingId, customerId]
      );

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
      const prescriptions = await query(
        'SELECT * FROM prescriptions WHERE booking_id = $1',
        [bookingId]
      );

      // Get review if exists
      const reviews = await query(
        'SELECT * FROM reviews WHERE booking_id = $1 AND customer_id = $2',
        [bookingId, customerId]
      );

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
  });

  /**
   * GET /customer/:customerId/bookings/follow-up-eligible
   * Get bookings eligible for follow-up (completed within N days from rule engine)
   */
  app.get("/customer/:customerId/bookings/follow-up-eligible", async (c) => {
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
  });
}

