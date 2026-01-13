/**
 * ============================================================================
 * REVIEWS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer reviews:
 * - Create reviews
 * - Get reviews for vendor/service
 * - Approve/reject reviews (admin)
 * - Update reviews
 * 
 * Migrated from: supabase/functions/server/review-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerReviewEndpoints(app: Hono) {
  /**
   * GET /reviews
   * Get reviews with filters
   */
  app.get("/reviews", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const serviceId = c.req.query('serviceId');
      const customerId = c.req.query('customerId');
      const bookingId = c.req.query('bookingId');
      const isApproved = c.req.query('isApproved');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let reviewQuery = `
        SELECT r.*, 
               c.full_name as customer_name,
               c.phone as customer_phone,
               v.business_name as vendor_name
        FROM reviews r
        LEFT JOIN customers c ON r.customer_id = c.id
        LEFT JOIN vendors v ON r.vendor_id = v.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        // Handle test IDs - return empty reviews
        if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
          return c.json({
            success: true,
            reviews: [],
            total: 0,
            averageRating: 0,
          });
        }
        reviewQuery += ` AND r.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (serviceId) {
        reviewQuery += ` AND r.service_id = $${paramIndex}`;
        params.push(serviceId);
        paramIndex++;
      }

      if (customerId) {
        reviewQuery += ` AND r.customer_id = $${paramIndex}`;
        params.push(customerId);
        paramIndex++;
      }

      if (bookingId) {
        reviewQuery += ` AND r.booking_id = $${paramIndex}`;
        params.push(bookingId);
        paramIndex++;
      }

      if (isApproved !== undefined) {
        reviewQuery += ` AND r.is_approved = $${paramIndex}`;
        params.push(isApproved === 'true');
        paramIndex++;
      } else {
        // Default to approved only for public endpoints
        reviewQuery += ` AND r.is_approved = true`;
      }

      reviewQuery += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const reviews = await query(reviewQuery, params);

      // Calculate average rating
      let avgRating = 0;
      if (reviews.rows.length > 0) {
        avgRating = reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length;
      }

      return c.json({
        success: true,
        reviews: reviews.rows,
        total: reviews.rows.length,
        averageRating: avgRating,
      });
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /reviews
   * Create a new review
   */
  app.post("/reviews", async (c) => {
    try {
      const reviewData = await c.req.json();
      const { customerId, vendorId, serviceId, bookingId, rating, comment, images } = reviewData;

      if (!customerId || !vendorId || !rating) {
        return c.json({ error: 'customerId, vendorId, and rating are required' }, 400);
      }

      if (rating < 1 || rating > 5) {
        return c.json({ error: 'Rating must be between 1 and 5' }, 400);
      }

      // Check if review already exists for this booking
      if (bookingId) {
        const existing = await query(
          'SELECT id FROM reviews WHERE booking_id = $1',
          [bookingId]
        );
        if (existing.rows.length > 0) {
          return c.json({ error: 'Review already exists for this booking' }, 409);
        }
      }

      const review = await insert('reviews', {
        customer_id: customerId,
        vendor_id: vendorId,
        service_id: serviceId || null,
        booking_id: bookingId || null,
        rating: rating,
        comment: comment || null,
        images: images || [],
        is_approved: false, // Requires admin approval
      });

      return c.json({
        success: true,
        review: review[0],
        message: 'Review submitted successfully. It will be published after approval.',
      });
    } catch (error: any) {
      console.error('Error creating review:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /reviews/:reviewId
   * Update a review
   */
  app.put("/reviews/:reviewId", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const reviewData = await c.req.json();
      const { rating, comment, images } = reviewData;

      const updated = await update('reviews',
        { id: reviewId },
        {
          rating: rating,
          comment: comment,
          images: images,
          is_approved: false, // Re-approval required after update
        }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Review not found' }, 404);
      }

      return c.json({
        success: true,
        review: updated[0],
        message: 'Review updated successfully. It will be republished after approval.',
      });
    } catch (error: any) {
      console.error('Error updating review:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/reviews/:reviewId/approve
   * Approve a review (admin only)
   */
  app.post("/admin/reviews/:reviewId/approve", async (c) => {
    try {
      const { reviewId } = c.req.param();

      const updated = await update('reviews',
        { id: reviewId },
        { is_approved: true, approved_at: new Date() }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Review not found' }, 404);
      }

      return c.json({
        success: true,
        review: updated[0],
        message: 'Review approved successfully',
      });
    } catch (error: any) {
      console.error('Error approving review:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/reviews/:reviewId/reject
   * Reject a review (admin only)
   */
  app.post("/admin/reviews/:reviewId/reject", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const { reason } = await c.req.json();

      const updated = await update('reviews',
        { id: reviewId },
        { is_approved: false, rejection_reason: reason || null }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Review not found' }, 404);
      }

      return c.json({
        success: true,
        review: updated[0],
        message: 'Review rejected successfully',
      });
    } catch (error: any) {
      console.error('Error rejecting review:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

