/**
 * ============================================================================
 * REVIEWS ENDPOINTS
 * ============================================================================
 * 
 * Handles reviews and ratings:
 * - Submit review for a booking
 * - Get pending reviews for a customer
 * - Get reviews for a vendor/staff
 * 
 * Fixes GAP: CC-4 - Rating/Review Popup After Completion
 * 
 * Date: 2026-01-21
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { getDiscoveryRules } from '../lib/rule-engine';
import { sendRatingRequest, sendEventNotification } from '../aws/aws-sns-notification-service';

export function registerReviewEndpoints(app: Hono) {

  /**
   * POST /reviews/submit
   * Submit a review for a completed booking
   */
  app.post("/reviews/submit", async (c) => {
    try {
      const { bookingId, rating, review, customerId } = await c.req.json();

      if (!bookingId || !rating) {
        return c.json({ error: 'bookingId and rating are required' }, 400);
      }

      if (rating < 1 || rating > 5) {
        return c.json({ error: 'Rating must be between 1 and 5' }, 400);
      }

      // Get booking to verify it's completed
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      if (booking.status !== 'completed') {
        return c.json({ error: 'Can only review completed bookings' }, 400);
      }

      // Check if review already exists
      const existingReviews = await query(
        `SELECT id FROM reviews WHERE booking_id = $1`,
        [bookingId]
      );

      if ((existingReviews as any).rows.length > 0) {
        return c.json({ error: 'Review already submitted for this booking' }, 400);
      }

      // Create review (is_approved so discovery/rating queries show it)
      const reviewResult = await insert('reviews', {
        booking_id: bookingId,
        customer_id: customerId || booking.customer_id,
        vendor_id: booking.vendor_id,
        staff_id: booking.staff_id,
        rating,
        review: review?.trim() || null,
        created_at: new Date().toISOString(),
        is_approved: true,
      });

      // Update booking to mark as reviewed
      await update('bookings', { id: bookingId }, {
        has_review: true,
        review_id: reviewResult[0]?.id,
      });

      // Update vendor/staff average rating
      try {
        if (booking.staff_id) {
          await query(
            `UPDATE staff SET 
              average_rating = (SELECT AVG(rating) FROM reviews WHERE staff_id = $1 AND rating IS NOT NULL),
              review_count = (SELECT COUNT(*) FROM reviews WHERE staff_id = $1)
             WHERE id = $1`,
            [booking.staff_id]
          );
        }

        if (booking.vendor_id) {
          await query(
            `UPDATE vendors SET 
              average_rating = (SELECT AVG(rating) FROM reviews WHERE vendor_id = $1 AND rating IS NOT NULL),
              review_count = (SELECT COUNT(*) FROM reviews WHERE vendor_id = $1)
             WHERE id = $1`,
            [booking.vendor_id]
          );
        }
      } catch (updateError) {
        console.warn('Failed to update rating averages:', updateError);
      }

      // Notify vendor about new review
      try {
        const customers = await select('customers', { id: booking.customer_id });
        const customerName = customers[0]?.name || 'A customer';

        await sendEventNotification({
          eventType: 'review_received',
          recipientId: booking.staff_id || booking.vendor_id,
          recipientType: booking.staff_id ? 'staff' : 'vendor',
          relatedId: bookingId,
          data: {
            customerName,
            rating,
            bookingId,
          },
        });
      } catch (notifError) {
        console.warn('Failed to notify vendor about review:', notifError);
      }

      return c.json({
        success: true,
        review: reviewResult[0],
        message: 'Thank you for your feedback!',
      });

    } catch (error: any) {
      console.error('Error submitting review:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /reviews/pending
   * Get bookings pending review for a customer
   * Used to show rating popup on home screen
   */
  app.get("/reviews/pending", async (c) => {
    try {
      const phone = c.req.query('phone');
      const customerId = c.req.query('customerId');

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      let customerIdToUse = customerId;

      if (phone && !customerId) {
        // Get customer by phone
        const customers = await query(
          `SELECT id FROM customers WHERE phone = $1`,
          [phone.replace(/\D/g, '')]
        );
        if ((customers as any).rows.length > 0) {
          customerIdToUse = (customers as any).rows[0].id;
        }
      }

      if (!customerIdToUse) {
        return c.json({ success: true, pendingBookings: [] });
      }

      const rules = await getDiscoveryRules('all', 'reviews');
      const reviewEligibleDays = rules.review_eligible_days ?? 7;

      const pendingBookings = await query(
        `SELECT b.*, 
                COALESCE(v.business_name, s.name) as vendor_name,
                sv.name as service_name,
                p.name as pet_name
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN staff s ON b.staff_id = s.id
         LEFT JOIN services sv ON b.service_id = sv.id
         LEFT JOIN pets p ON b.pet_id = p.id
         WHERE b.customer_id = $1
         AND b.status = 'completed'
         AND b.has_review IS NOT TRUE
         AND b.completed_at > NOW() - ($2::text || ' days')::interval
         ORDER BY b.completed_at DESC
         LIMIT 3`,
        [customerIdToUse, reviewEligibleDays]
      );

      return c.json({
        success: true,
        pendingBookings: (pendingBookings as any).rows.map((b: any) => ({
          id: b.id,
          bookingId: b.id,
          vendorName: b.vendor_name,
          serviceName: b.service_name || 'Service',
          bookingDate: b.booking_date,
          petName: b.pet_name,
        })),
      });

    } catch (error: any) {
      console.error('Error fetching pending reviews:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /reviews/vendor/:vendorId
   * Get reviews for a vendor
   */
  app.get("/reviews/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      const reviews = await query(
        `SELECT r.*, 
                c.full_name as customer_name,
                c.profile_photo_url as customer_photo,
                sv.name as service_name,
                b.booking_date
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         LEFT JOIN bookings b ON r.booking_id = b.id
         LEFT JOIN services sv ON b.service_id = sv.id
         WHERE r.vendor_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [vendorId, limit, offset]
      );

      // Get aggregates
      const aggregates = await query(
        `SELECT 
           COUNT(*) as total,
           AVG(rating) as average,
           COUNT(*) FILTER (WHERE rating = 5) as five_star,
           COUNT(*) FILTER (WHERE rating = 4) as four_star,
           COUNT(*) FILTER (WHERE rating = 3) as three_star,
           COUNT(*) FILTER (WHERE rating = 2) as two_star,
           COUNT(*) FILTER (WHERE rating = 1) as one_star
         FROM reviews WHERE vendor_id = $1`,
        [vendorId]
      );

      const agg = (aggregates as any).rows[0] || {};

      return c.json({
        success: true,
        reviews: (reviews as any).rows || [],
        aggregates: {
          total: parseInt(agg.total || '0'),
          average: parseFloat(agg.average || '0').toFixed(1),
          distribution: {
            5: parseInt(agg.five_star || '0'),
            4: parseInt(agg.four_star || '0'),
            3: parseInt(agg.three_star || '0'),
            2: parseInt(agg.two_star || '0'),
            1: parseInt(agg.one_star || '0'),
          },
        },
      });

    } catch (error: any) {
      console.error('Error fetching vendor reviews:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /reviews/staff/:staffId
   * Get reviews for a staff member
   */
  app.get("/reviews/staff/:staffId", async (c) => {
    try {
      const { staffId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      const reviews = await query(
        `SELECT r.*, 
                c.full_name as customer_name,
                c.profile_photo_url as customer_photo,
                sv.name as service_name,
                b.booking_date
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         LEFT JOIN bookings b ON r.booking_id = b.id
         LEFT JOIN services sv ON b.service_id = sv.id
         WHERE r.staff_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [staffId, limit, offset]
      );

      const aggregates = await query(
        `SELECT 
           COUNT(*) as total,
           AVG(rating) as average
         FROM reviews WHERE staff_id = $1`,
        [staffId]
      );

      const agg = (aggregates as any).rows[0] || {};

      return c.json({
        success: true,
        reviews: (reviews as any).rows || [],
        aggregates: {
          total: parseInt(agg.total || '0'),
          average: parseFloat(agg.average || '0').toFixed(1),
        },
      });

    } catch (error: any) {
      console.error('Error fetching staff reviews:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /reviews/request-rating
   * Trigger a rating request notification for a completed booking
   * Called by the system after booking completion
   */
  app.post("/reviews/request-rating", async (c) => {
    try {
      const { bookingId } = await c.req.json();

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get vendor/staff name
      let vendorName = 'Service Provider';
      if (booking.staff_id) {
        const staff = await select('staff', { id: booking.staff_id });
        vendorName = staff[0]?.name || vendorName;
      } else if (booking.vendor_id) {
        const vendors = await select('vendors', { id: booking.vendor_id });
        vendorName = vendors[0]?.business_name || vendorName;
      }

      // Get service name
      let serviceName = 'Service';
      if (booking.service_id) {
        const services = await select('services', { id: booking.service_id });
        serviceName = services[0]?.name || serviceName;
      }

      // Send rating request notification
      await sendRatingRequest(
        booking.customer_id,
        bookingId,
        vendorName,
        serviceName
      );

      return c.json({
        success: true,
        message: 'Rating request sent',
      });

    } catch (error: any) {
      console.error('Error requesting rating:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
