/**
 * ============================================================================
 * REVIEWS ENHANCED ENDPOINTS
 * ============================================================================
 * 
 * Handles customer reviews and ratings for bookings
 * - Create reviews with tags
 * - Get reviews for vendors/staff
 * - Calculate average ratings
 * - Track review skips
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

// ============================================================================
// CREATE REVIEW HANDLER
// ============================================================================

class CreateReviewHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      bookingId,
      vendorId,
      staffId,
      customerId,
      customerPhone,
      rating,
      review,
      tags,
      serviceStyle,
    } = body;

    if (!bookingId || !vendorId || !rating) {
      return this.error('Booking ID, Vendor ID, and rating are required', 400);
    }

    if (rating < 1 || rating > 5) {
      return this.error('Rating must be between 1 and 5', 400);
    }

    try {
      // Check if review already exists for this booking
      const existing = await select('reviews', { booking_id: bookingId });
      if (existing.length > 0) {
        return this.error('Review already submitted for this booking', 400);
      }

      // Create review
      const [newReview] = await insert('reviews', {
        booking_id: bookingId,
        vendor_id: vendorId,
        staff_id: staffId || null,
        customer_id: customerId || null,
        customer_phone: customerPhone,
        rating,
        review: review || null,
        tags: tags || [],
        service_style: serviceStyle || 'at_center',
        status: 'published',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Update vendor's average rating
      await this.updateVendorRating(vendorId);

      // Update staff's average rating if applicable
      if (staffId) {
        await this.updateStaffRating(staffId);
      }

      // Update booking as reviewed
      await update('bookings', { id: bookingId }, {
        has_review: true,
        review_id: newReview.id,
        updated_at: new Date(),
      }).catch(() => {});

      return this.success({
        success: true,
        reviewId: newReview.id,
        message: 'Review submitted successfully',
      });
    } catch (error: any) {
      console.error('Error creating review:', error);
      return this.error(error.message || 'Failed to submit review', 500);
    }
  }

  private async updateVendorRating(vendorId: string): Promise<void> {
    try {
      const { rows } = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
         FROM reviews 
         WHERE vendor_id = $1 AND status = 'published'`,
        [vendorId]
      );

      if (rows.length > 0) {
        await update('vendors', { id: vendorId }, {
          average_rating: parseFloat(rows[0].avg_rating) || 0,
          total_reviews: parseInt(rows[0].total_reviews) || 0,
          updated_at: new Date(),
        });
      }
    } catch (error) {
      console.error('Error updating vendor rating:', error);
    }
  }

  private async updateStaffRating(staffId: string): Promise<void> {
    try {
      const { rows } = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
         FROM reviews 
         WHERE staff_id = $1 AND status = 'published'`,
        [staffId]
      );

      if (rows.length > 0) {
        await update('staff', { id: staffId }, {
          average_rating: parseFloat(rows[0].avg_rating) || 0,
          total_reviews: parseInt(rows[0].total_reviews) || 0,
          updated_at: new Date(),
        });
      }
    } catch (error) {
      console.error('Error updating staff rating:', error);
    }
  }
}

// ============================================================================
// SKIP REVIEW HANDLER
// ============================================================================

class SkipReviewHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId, vendorId, customerId, customerPhone } = body;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      // Log the skip
      await insert('review_skips', {
        booking_id: bookingId,
        vendor_id: vendorId || null,
        customer_id: customerId || null,
        customer_phone: customerPhone || null,
        skipped_at: new Date(),
      }).catch(() => {
        // Table might not exist
      });

      // Update booking
      await update('bookings', { id: bookingId }, {
        review_skipped: true,
        updated_at: new Date(),
      }).catch(() => {});

      return this.success({
        success: true,
        message: 'Review skipped',
      });
    } catch (error: any) {
      console.error('Error skipping review:', error);
      return this.success({ success: true }); // Don't fail on skip
    }
  }
}

// ============================================================================
// GET VENDOR REVIEWS HANDLER
// ============================================================================

class GetVendorReviewsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const limit = parseInt(context.event.queryStringParameters?.limit || '20');
    const offset = parseInt(context.event.queryStringParameters?.offset || '0');
    const minRating = context.event.queryStringParameters?.minRating;

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    try {
      let queryStr = `
        SELECT 
          r.id,
          r.booking_id,
          r.rating,
          r.review,
          r.tags,
          r.service_style,
          r.created_at,
          c.full_name as customer_name,
          c.profile_photo_url as customer_photo,
          vs.service_name as service_name
        FROM reviews r
        LEFT JOIN customers c ON c.id = r.customer_id
        LEFT JOIN bookings b ON b.id = r.booking_id
        LEFT JOIN vendor_services vs ON vs.id = b.service_id
        WHERE r.vendor_id = $1 AND r.status = 'published'
      `;
      const params: any[] = [vendorId];

      if (minRating) {
        params.push(parseInt(minRating));
        queryStr += ` AND r.rating >= $${params.length}`;
      }

      queryStr += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const { rows: reviews } = await query(queryStr, params);

      // Get total count
      const { rows: countResult } = await query(
        `SELECT COUNT(*) as total FROM reviews WHERE vendor_id = $1 AND status = 'published'`,
        [vendorId]
      );

      // Get rating distribution
      const { rows: distribution } = await query(
        `SELECT rating, COUNT(*) as count 
         FROM reviews 
         WHERE vendor_id = $1 AND status = 'published'
         GROUP BY rating
         ORDER BY rating DESC`,
        [vendorId]
      );

      // Get average rating
      const { rows: avgResult } = await query(
        `SELECT AVG(rating) as average, COUNT(*) as total
         FROM reviews 
         WHERE vendor_id = $1 AND status = 'published'`,
        [vendorId]
      );

      return this.success({
        success: true,
        reviews: reviews.map(r => ({
          id: r.id,
          bookingId: r.booking_id,
          rating: r.rating,
          review: r.review,
          tags: r.tags || [],
          serviceStyle: r.service_style,
          customerName: r.customer_name || 'Customer',
          customerPhoto: r.customer_photo,
          serviceName: r.service_name,
          createdAt: r.created_at,
        })),
        pagination: {
          total: parseInt(countResult[0]?.total) || 0,
          limit,
          offset,
          hasMore: offset + reviews.length < (parseInt(countResult[0]?.total) || 0),
        },
        summary: {
          averageRating: parseFloat(avgResult[0]?.average) || 0,
          totalReviews: parseInt(avgResult[0]?.total) || 0,
          distribution: distribution.reduce((acc: any, d: any) => {
            acc[d.rating] = parseInt(d.count);
            return acc;
          }, {}),
        },
      });
    } catch (error: any) {
      console.error('Error getting vendor reviews:', error);
      return this.error(error.message || 'Failed to get reviews', 500);
    }
  }
}

// ============================================================================
// GET PENDING REVIEW HANDLER
// ============================================================================

class GetPendingReviewHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const customerPhone = context.event.queryStringParameters?.phone;

    if (!customerId && !customerPhone) {
      return this.error('Customer ID or phone is required', 400);
    }

    try {
      // Find completed bookings without reviews
      // Use NOT EXISTS to check for existing reviews instead of relying on has_review column
      let queryStr = `
        SELECT 
          b.id as booking_id,
          b.vendor_id,
          b.staff_id,
          b.service_type as service_style,
          b.completed_at,
          v.business_name as vendor_name,
          s.name as staff_name,
          COALESCE(vs.service_name, srv.name, 'Service') as service_name
        FROM bookings b
        LEFT JOIN vendors v ON v.id = b.vendor_id
        LEFT JOIN staff s ON s.id = b.staff_id
        LEFT JOIN vendor_services vs ON vs.id = b.service_id
        LEFT JOIN services srv ON srv.id = b.service_id
        WHERE b.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
          AND b.completed_at > NOW() - INTERVAL '7 days'
      `;
      const params: any[] = [];

      if (customerId) {
        params.push(customerId);
        queryStr += ` AND b.customer_id = $${params.length}`;
      } else if (customerPhone) {
        params.push(customerPhone);
        queryStr += ` AND b.customer_phone = $${params.length}`;
      }

      queryStr += ` ORDER BY b.completed_at DESC LIMIT 1`;

      const { rows } = await query(queryStr, params);

      if (rows.length === 0) {
        return this.success({
          success: true,
          hasPending: false,
          booking: null,
        });
      }

      const booking = rows[0];

      return this.success({
        success: true,
        hasPending: true,
        booking: {
          bookingId: booking.booking_id,
          vendorId: booking.vendor_id,
          vendorName: booking.vendor_name,
          staffId: booking.staff_id,
          staffName: booking.staff_name,
          serviceName: booking.service_name,
          serviceStyle: booking.service_style,
          completedAt: booking.completed_at,
        },
      });
    } catch (error: any) {
      console.error('Error getting pending review:', error);
      return this.error(error.message || 'Failed to get pending review', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerReviewsEnhancedEndpoints(app: Hono) {
  const createHandler = new CreateReviewHandler();
  const skipHandler = new SkipReviewHandler();
  const getVendorReviewsHandler = new GetVendorReviewsHandler();
  const getPendingHandler = new GetPendingReviewHandler();

  // Create review
  app.post('/reviews/create', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/reviews/create',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'reviews', functionVersion: '$LATEST' };
    const result = await createHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Skip review
  app.post('/reviews/skip', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/reviews/skip',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'reviews', functionVersion: '$LATEST' };
    const result = await skipHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get vendor reviews
  app.get('/reviews/vendor/:vendorId', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/reviews/vendor/${c.req.param('vendorId')}`,
      headers: {},
      body: '',
      pathParameters: { vendorId: c.req.param('vendorId') },
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'reviews', functionVersion: '$LATEST' };
    const result = await getVendorReviewsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get pending review for customer
  app.get('/reviews/pending/:customerId', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/reviews/pending/${c.req.param('customerId')}`,
      headers: {},
      body: '',
      pathParameters: { customerId: c.req.param('customerId') },
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'reviews', functionVersion: '$LATEST' };
    const result = await getPendingHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
