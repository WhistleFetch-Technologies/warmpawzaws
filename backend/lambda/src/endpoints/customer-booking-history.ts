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
 * Migrated from: supabase/functions/make-server-customer/customer-booking-history.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { normalizeDbRows, buildBookingResponse } from '../utils/entity-extractor';
import { normalizeBooking, isValidUUID } from '../types/entities';

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
          totalAmount: b.total_amount,
          basePrice: b.base_price,
          discountAmount: b.discount_amount,
          createdAt: b.created_at,
          completedAt: b.completed_at,
          cancelledAt: b.cancelled_at,
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
                st.phone as staff_phone
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN staff st ON b.staff_id = st.id
         WHERE b.id = $1 AND b.customer_id = $2`,
        [bookingId, customerId]
      );

      if (bookingQuery.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingQuery.rows[0];

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
          customerId: booking.customer_id,
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
          status: booking.status,
          paymentStatus: booking.payment_status,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
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
   * Get bookings eligible for follow-up (completed within 7 days)
   */
  app.get("/customer/:customerId/bookings/follow-up-eligible", async (c) => {
    try {
      const { customerId } = c.req.param();

      // Get completed bookings within last 7 days
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
         AND b.completed_at >= NOW() - INTERVAL '7 days'
         ORDER BY b.completed_at DESC`,
        [customerId]
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

