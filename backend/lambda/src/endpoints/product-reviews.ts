/**
 * ============================================================================
 * PRODUCT REVIEWS ENDPOINTS
 * ============================================================================
 * 
 * Features:
 * - Create product reviews (verified purchases only)
 * - Get product reviews with ratings
 * - Review photos support
 * - Helpful votes
 * - Admin moderation
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';

export function registerProductReviewEndpoints(app: Hono) {

  // ============================================================================
  // GET PRODUCT REVIEWS
  // ============================================================================

  app.get('/products/:productId/reviews', async (c) => {
    try {
      const productId = c.req.param('productId');
      const limit = parseInt(c.req.query('limit') || '10');
      const offset = parseInt(c.req.query('offset') || '0');
      const sortBy = c.req.query('sort') || 'recent'; // recent, helpful, rating_high, rating_low
      const rating = c.req.query('rating'); // Filter by specific rating

      // Build query
      let orderBy = 'pr.created_at DESC';
      if (sortBy === 'helpful') orderBy = 'pr.helpful_count DESC, pr.created_at DESC';
      if (sortBy === 'rating_high') orderBy = 'pr.rating DESC, pr.created_at DESC';
      if (sortBy === 'rating_low') orderBy = 'pr.rating ASC, pr.created_at DESC';

      let whereClause = `WHERE pr.product_id = $1 AND pr.status = 'published'`;
      const params: any[] = [productId];
      let paramIdx = 2;

      if (rating) {
        whereClause += ` AND pr.rating = $${paramIdx++}`;
        params.push(parseInt(rating));
      }

      const reviewsQuery = `
        SELECT 
          pr.id,
          pr.rating,
          pr.title,
          pr.review,
          pr.photos,
          pr.verified_purchase,
          pr.helpful_count,
          pr.created_at,
          c.full_name as customer_name,
          c.profile_photo_url as customer_photo,
          oi.variant_info
        FROM product_reviews pr
        LEFT JOIN customers c ON pr.customer_id = c.id
        LEFT JOIN order_items oi ON pr.order_item_id = oi.id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIdx++} OFFSET $${paramIdx}
      `;
      params.push(limit, offset);

      const reviews = await query(reviewsQuery, params);

      // Get summary statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_reviews,
          ROUND(AVG(rating)::numeric, 1) as average_rating,
          COUNT(*) FILTER (WHERE rating = 5) as five_star,
          COUNT(*) FILTER (WHERE rating = 4) as four_star,
          COUNT(*) FILTER (WHERE rating = 3) as three_star,
          COUNT(*) FILTER (WHERE rating = 2) as two_star,
          COUNT(*) FILTER (WHERE rating = 1) as one_star,
          COUNT(*) FILTER (WHERE verified_purchase = true) as verified_count,
          COUNT(*) FILTER (WHERE photos IS NOT NULL AND photos != '[]') as with_photos
        FROM product_reviews
        WHERE product_id = $1 AND status = 'published'
      `;
      const stats = await query(statsQuery, [productId]);

      const summary = stats.rows[0] || {
        total_reviews: 0,
        average_rating: 0,
        five_star: 0,
        four_star: 0,
        three_star: 0,
        two_star: 0,
        one_star: 0,
        verified_count: 0,
        with_photos: 0,
      };

      return c.json({
        success: true,
        reviews: (reviews.rows || []).map((r: any) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          review: r.review,
          photos: typeof r.photos === 'string' ? JSON.parse(r.photos || '[]') : (r.photos || []),
          verifiedPurchase: r.verified_purchase,
          helpfulCount: parseInt(r.helpful_count) || 0,
          customerName: r.customer_name || 'Anonymous',
          customerPhoto: r.customer_photo,
          variantInfo: r.variant_info,
          createdAt: r.created_at,
        })),
        summary: {
          totalReviews: parseInt(summary.total_reviews) || 0,
          averageRating: parseFloat(summary.average_rating) || 0,
          distribution: {
            5: parseInt(summary.five_star) || 0,
            4: parseInt(summary.four_star) || 0,
            3: parseInt(summary.three_star) || 0,
            2: parseInt(summary.two_star) || 0,
            1: parseInt(summary.one_star) || 0,
          },
          verifiedCount: parseInt(summary.verified_count) || 0,
          withPhotos: parseInt(summary.with_photos) || 0,
        },
        pagination: {
          limit,
          offset,
          hasMore: (reviews.rows?.length || 0) === limit,
        },
      });
    } catch (error: any) {
      console.error('Error fetching product reviews:', error);
      return c.json({ success: false, error: error.message, reviews: [], summary: {} }, 500);
    }
  });

  // ============================================================================
  // CREATE PRODUCT REVIEW
  // ============================================================================

  app.post('/products/:productId/reviews', async (c) => {
    try {
      const productId = c.req.param('productId');
      const body = await c.req.json();
      const {
        customerId,
        orderId,
        orderItemId,
        rating,
        title,
        review,
        photos = [],
      } = body;

      // Validate required fields
      if (!customerId) {
        return c.json({ success: false, error: 'Customer ID is required' }, 400);
      }

      if (!rating || rating < 1 || rating > 5) {
        return c.json({ success: false, error: 'Rating must be between 1 and 5' }, 400);
      }

      // Check if product exists
      const products = await select('products', { id: productId });
      if (products.length === 0) {
        return c.json({ success: false, error: 'Product not found' }, 404);
      }

      // Check if customer already reviewed this product
      const existingReview = await query(
        `SELECT id FROM product_reviews WHERE product_id = $1 AND customer_id = $2`,
        [productId, customerId]
      );
      if (existingReview.rows.length > 0) {
        return c.json({ success: false, error: 'You have already reviewed this product' }, 400);
      }

      // Check if verified purchase
      let verifiedPurchase = false;
      if (orderId) {
        const orderCheck = await query(
          `SELECT oi.id FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE o.id = $1 
             AND o.customer_id = $2 
             AND oi.product_id = $3
             AND o.order_status = 'delivered'`,
          [orderId, customerId, productId]
        );
        verifiedPurchase = orderCheck.rows.length > 0;
      } else {
        // Check any delivered order
        const anyOrder = await query(
          `SELECT oi.id FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE o.customer_id = $1 
             AND oi.product_id = $2
             AND o.order_status = 'delivered'
           LIMIT 1`,
          [customerId, productId]
        );
        verifiedPurchase = anyOrder.rows.length > 0;
      }

      // Create review
      const [newReview] = await insert('product_reviews', {
        product_id: productId,
        customer_id: customerId,
        order_id: orderId || null,
        order_item_id: orderItemId || null,
        rating,
        title: title?.trim() || null,
        review: review?.trim() || null,
        photos: JSON.stringify(photos),
        verified_purchase: verifiedPurchase,
        helpful_count: 0,
        status: 'published', // Or 'pending' for moderation
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Update product's average rating
      await updateProductRating(productId);

      return c.json({
        success: true,
        reviewId: newReview.id,
        verifiedPurchase,
        message: 'Review submitted successfully',
      });
    } catch (error: any) {
      console.error('Error creating product review:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // MARK REVIEW AS HELPFUL
  // ============================================================================

  app.post('/products/reviews/:reviewId/helpful', async (c) => {
    try {
      const reviewId = c.req.param('reviewId');
      const body = await c.req.json();
      const { customerId } = body;

      if (!customerId) {
        return c.json({ success: false, error: 'Customer ID is required' }, 400);
      }

      // Check if already marked
      const existing = await query(
        `SELECT id FROM review_helpful_votes WHERE review_id = $1 AND customer_id = $2`,
        [reviewId, customerId]
      );

      if (existing.rows.length > 0) {
        // Remove vote
        await query(
          `DELETE FROM review_helpful_votes WHERE review_id = $1 AND customer_id = $2`,
          [reviewId, customerId]
        );
        await query(
          `UPDATE product_reviews SET helpful_count = helpful_count - 1 WHERE id = $1`,
          [reviewId]
        );
        return c.json({ success: true, action: 'removed', message: 'Vote removed' });
      }

      // Add vote
      await insert('review_helpful_votes', {
        review_id: reviewId,
        customer_id: customerId,
        created_at: new Date().toISOString(),
      });

      await query(
        `UPDATE product_reviews SET helpful_count = helpful_count + 1 WHERE id = $1`,
        [reviewId]
      );

      return c.json({ success: true, action: 'added', message: 'Marked as helpful' });
    } catch (error: any) {
      console.error('Error marking review helpful:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // GET CUSTOMER'S PENDING PRODUCT REVIEWS
  // ============================================================================

  app.get('/customer/:customerId/product-reviews/pending', async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // Find delivered orders with products not yet reviewed
      const pendingReviews = await query(
        `SELECT DISTINCT ON (oi.product_id)
           o.id as order_id,
           o.order_number,
           o.delivered_at,
           oi.id as order_item_id,
           oi.product_id,
           p.name as product_name,
           p.images as product_images
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN product_reviews pr ON pr.product_id = oi.product_id AND pr.customer_id = o.customer_id
         WHERE o.customer_id = $1
           AND o.order_status = 'delivered'
           AND o.delivered_at > NOW() - INTERVAL '30 days'
           AND pr.id IS NULL
         ORDER BY oi.product_id, o.delivered_at DESC
         LIMIT 10`,
        [customerId]
      );

      return c.json({
        success: true,
        pendingReviews: (pendingReviews.rows || []).map((r: any) => ({
          orderId: r.order_id,
          orderNumber: r.order_number,
          orderItemId: r.order_item_id,
          productId: r.product_id,
          productName: r.product_name,
          productImage: typeof r.product_images === 'string' 
            ? (JSON.parse(r.product_images || '[]')[0]) 
            : (r.product_images?.[0]),
          deliveredAt: r.delivered_at,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching pending reviews:', error);
      return c.json({ success: false, error: error.message, pendingReviews: [] }, 500);
    }
  });

  // ============================================================================
  // ADMIN: GET ALL REVIEWS (MODERATION)
  // ============================================================================

  app.get('/admin/product-reviews', async (c) => {
    try {
      const status = c.req.query('status') || 'all';
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      let whereClause = '';
      const params: any[] = [];
      let paramIdx = 1;

      if (status !== 'all') {
        whereClause = `WHERE pr.status = $${paramIdx++}`;
        params.push(status);
      }

      const reviewsQuery = `
        SELECT 
          pr.*,
          p.name as product_name,
          v.business_name as vendor_name,
          c.full_name as customer_name
        FROM product_reviews pr
        JOIN products p ON pr.product_id = p.id
        LEFT JOIN vendors v ON p.vendor_id = v.id
        LEFT JOIN customers c ON pr.customer_id = c.id
        ${whereClause}
        ORDER BY pr.created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx}
      `;
      params.push(limit, offset);

      const reviews = await query(reviewsQuery, params);

      return c.json({
        success: true,
        reviews: reviews.rows || [],
        pagination: { limit, offset },
      });
    } catch (error: any) {
      console.error('Error fetching admin reviews:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // ADMIN: MODERATE REVIEW
  // ============================================================================

  app.put('/admin/product-reviews/:reviewId', async (c) => {
    try {
      const reviewId = c.req.param('reviewId');
      const body = await c.req.json();
      const { status, moderationNote } = body;

      if (!['published', 'hidden', 'rejected'].includes(status)) {
        return c.json({ success: false, error: 'Invalid status' }, 400);
      }

      await update('product_reviews', { id: reviewId }, {
        status,
        moderation_note: moderationNote || null,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Update product rating if status changed
      const review = await select('product_reviews', { id: reviewId });
      if (review.length > 0) {
        await updateProductRating(review[0].product_id);
      }

      return c.json({
        success: true,
        message: `Review ${status}`,
      });
    } catch (error: any) {
      console.error('Error moderating review:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function updateProductRating(productId: string): Promise<void> {
  try {
    const result = await query(
      `SELECT 
         ROUND(AVG(rating)::numeric, 1) as avg_rating,
         COUNT(*) as review_count
       FROM product_reviews
       WHERE product_id = $1 AND status = 'published'`,
      [productId]
    );

    const { avg_rating, review_count } = result.rows[0] || { avg_rating: 0, review_count: 0 };

    await update('products', { id: productId }, {
      rating: parseFloat(avg_rating) || 0,
      review_count: parseInt(review_count) || 0,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
}
