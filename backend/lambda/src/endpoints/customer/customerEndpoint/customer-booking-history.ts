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
import { normalizeBooking, isValidUUID } from '../../../types/entities';
import { getDiscoveryRules } from '../../../lib/rule-engine';

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
               v.business_name as vendor_name,
               v.phone as vendor_phone,
               v.city as vendor_city,
               s.name as service_name,
               s.category as service_category
        FROM bookings b
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.customer_id = $1
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

      // ✅ PAYMENT RECONCILIATION: Check pending bookings against completed payments
      const pendingBookings = bookings.rows.filter(
        (b: any) => b.payment_status !== 'paid' && ['pending', 'pending_payment'].includes(b.status)
      );

      if (pendingBookings.length > 0) {
        try {
          const pendingIds = pendingBookings.map((b: any) => b.id);
          const completedPayments = await query(
            `SELECT DISTINCT booking_id FROM payments WHERE booking_id = ANY($1) AND payment_status = 'completed'`,
            [pendingIds]
          );
          const paidBookingIds = new Set(completedPayments.rows.map((p: any) => p.booking_id));

          if (paidBookingIds.size > 0) {
            console.log(`[BOOKINGS-RECONCILE] Reconciling ${paidBookingIds.size} bookings with completed payments`);
            for (const bookingId of paidBookingIds) {
              query(
                `UPDATE bookings SET 
                   payment_status = 'paid',
                   status = CASE WHEN status IN ('pending', 'pending_payment') THEN 'confirmed' ELSE status END,
                   updated_at = NOW()
                 WHERE id = $1 AND payment_status != 'paid'`,
                [bookingId]
              ).catch((err: any) => console.error(`[BOOKINGS-RECONCILE] Update failed for ${bookingId}:`, err));
            }
            for (const row of bookings.rows) {
              if (paidBookingIds.has(row.id)) {
                row.payment_status = 'paid';
                if (row.status === 'pending' || row.status === 'pending_payment') {
                  row.status = 'confirmed';
                }
              }
            }
          }
        } catch (reconcileErr: any) {
          console.error('[BOOKINGS-RECONCILE] Error:', reconcileErr);
        }
      }

      // Get statistics
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
          serviceName: b.service_name,
          serviceCategory: b.service_category,
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
                v.business_name as vendor_name,
                v.owner_name as vendor_owner,
                v.phone as vendor_phone,
                v.email as vendor_email,
                v.address as vendor_address,
                v.city as vendor_city,
                v.state as vendor_state,
                v.pincode as vendor_pincode,
                s.name as service_name,
                s.description as service_description,
                s.category as service_category,
                s.duration_minutes as service_duration,
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
         LEFT JOIN services s ON b.service_id = s.id
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
          completionOTP: booking.completion_otp || null,
          completion_otp: booking.completion_otp || null,
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
                v.business_name as vendor_name,
                v.owner_name as vendor_owner,
                v.phone as vendor_phone,
                v.email as vendor_email,
                v.address as vendor_address,
                v.city as vendor_city,
                v.state as vendor_state,
                v.pincode as vendor_pincode,
                s.name as service_name,
                s.description as service_description,
                s.category as service_category,
                s.duration_minutes as service_duration,
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
         LEFT JOIN services s ON b.service_id = s.id
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
          cancellationReason: booking.cancellation_reason,
          createdAt: booking.created_at,
          completedAt: booking.completed_at,
          cancelledAt: booking.cancelled_at,
          // Multi-service: list of services and total duration
          selectedServices: parseSelectedServices(booking.selected_services).length > 0 ? parseSelectedServices(booking.selected_services) : undefined,
          totalDurationMinutes: booking.total_duration_minutes != null ? Number(booking.total_duration_minutes) : undefined,
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
                s.name as service_name
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN services s ON b.service_id = s.id
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
            serviceName: booking.service_name,
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

