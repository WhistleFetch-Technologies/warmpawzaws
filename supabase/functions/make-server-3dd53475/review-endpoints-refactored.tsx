/**
 * ============================================================================
 * REVIEW & RATING ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Review management endpoints:
 * - Create review (booking/product)
 * - Get review details
 * - Get product/vendor/customer reviews
 * - Vendor response to review
 * - Admin flag/hide review
 * - Vendor rating summary
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with repository calls
 * - All reviews stored in SQL reviews table
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient } from "../../lib/db.ts";

export function reviewEndpoints(app: Hono) {
  
  // ============================================
  // REVIEW & RATING ENDPOINTS
  // ============================================
  
  /**
   * Create a review
   * POST /make-server-3dd53475/reviews/create
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/reviews/create", async (c) => {
    try {
      const {
        bookingId,
        productId,
        customerId,
        vendorId,
        rating,
        review,
        serviceQuality,
        punctuality,
        cleanliness,
        valueForMoney,
        wouldRecommend,
        photos
      } = await c.req.json();

      // Validate required fields
      if ((!bookingId && !productId) || !customerId || !rating) {
        return sendError(c, 'Missing required fields', 400);
      }

      if (rating < 1 || rating > 5) {
        return sendError(c, 'Rating must be between 1 and 5', 400);
      }

      // ✅ SQL: Handling Booking Review
      if (bookingId) {
        const booking = await getBookingsRepository().findById(bookingId);
        if (!booking) {
          return sendError(c, 'Booking not found', 404);
        }

        if (booking.status !== 'completed') {
          return sendError(c, 'Can only review completed bookings', 400);
        }

        // ✅ SQL: Check if already reviewed
        const existingReview = await getReviewsRepository().findByBooking(bookingId);
        if (existingReview) {
          return sendError(c, 'Booking already reviewed', 400);
        }
      }

      // ✅ SQL: Handling Product Review
      if (productId) {
        const client = getDbClient();
        const { data: product } = await client
          .from('products')
          .select('*')
          .eq('id', productId)
          .maybeSingle();
        
        if (!product) {
          return sendError(c, 'Product not found', 404);
        }
      }

      // ✅ SQL: Get customer details
      const customer = await getCustomersRepository().findById(customerId);
      
      // ✅ SQL: Create review using repository
      const reviewRecord = await getReviewsRepository().create({
        booking_id: bookingId || null,
        product_id: productId || null,
        customer_id: customerId,
        vendor_id: vendorId || null,
        rating,
        review_text: review || '',
        service_quality: serviceQuality || rating,
        punctuality: punctuality || rating,
        cleanliness: cleanliness || rating,
        value_for_money: valueForMoney || rating,
        would_recommend: wouldRecommend !== false,
        photos: photos || [],
        status: 'published',
        is_verified: true,
      });

      // ✅ SQL: Update booking if applicable
      if (bookingId) {
        await getBookingsRepository().update(bookingId, {
          review_id: reviewRecord.id,
          reviewed_at: new Date().toISOString(),
        });
      }

      // ✅ SQL: Update product rating if applicable
      if (productId) {
        const client = getDbClient();
        const reviews = await getReviewsRepository().findByProduct(productId);
        
        const publishedReviews = reviews.filter(r => r.status === 'published');
        const avgRating = publishedReviews.length > 0
          ? publishedReviews.reduce((sum, r) => sum + r.rating, 0) / publishedReviews.length
          : 0;
        
        await client
          .from('products')
          .update({
            rating: parseFloat(avgRating.toFixed(1)),
            review_count: publishedReviews.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId);
      }

      // ✅ SQL: Update vendor rating if applicable
      if (vendorId) {
        const reviews = await getReviewsRepository().findByVendor(vendorId);
        const publishedReviews = reviews.filter(r => r.status === 'published');
        
        const avgRating = publishedReviews.length > 0
          ? publishedReviews.reduce((sum, r) => sum + r.rating, 0) / publishedReviews.length
          : 0;
        
        await getVendorsRepository().update(vendorId, {
          rating: parseFloat(avgRating.toFixed(2)),
          total_reviews: publishedReviews.length,
        });
      }

      console.log(`✅ Review created: ${reviewRecord.id}`);
      return sendSuccess(c, { reviewId: reviewRecord.id, review: reviewRecord });
    } catch (error) {
      console.error('Error creating review:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get review details
   * GET /make-server-3dd53475/reviews/:reviewId
   * 
   * REFACTORED: Uses SQL repository
   */
  app.get("/make-server-3dd53475/reviews/:reviewId", async (c) => {
    try {
      const { reviewId } = c.req.param();
      
      // ✅ SQL: Get review
      const review = await getReviewsRepository().findById(reviewId);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }
      
      return sendSuccess(c, { review });
    } catch (error) {
      console.error('Error getting review:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get product reviews
   * GET /make-server-3dd53475/reviews/product/:productId
   * 
   * REFACTORED: Uses SQL repository
   */
  app.get("/make-server-3dd53475/reviews/product/:productId", async (c) => {
      try {
        const { productId } = c.req.param();
        const limit = parseInt(c.req.query('limit') || '20');
        
        // ✅ SQL: Get reviews for product
        const reviews = await getReviewsRepository().findByProduct(productId, { limit });
        
        return sendSuccess(c, { reviews, total: reviews.length });
      } catch (error) {
        console.error('Error getting product reviews:', error);
        return sendError(c, error, 500);
      }
  });

  /**
   * Get vendor's reviews
   * GET /make-server-3dd53475/reviews/vendor/:vendorId
   * 
   * REFACTORED: Uses SQL repository
   */
  app.get("/make-server-3dd53475/reviews/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status') || 'published';
      const limit = parseInt(c.req.query('limit') || '50');
      
      // ✅ SQL: Get reviews for vendor
      let reviews = await getReviewsRepository().findByVendor(vendorId, { limit });
      
      // Filter by status if provided
      if (status) {
        reviews = reviews.filter(r => r.status === status);
      }
      
      return sendSuccess(c, { reviews, total: reviews.length });
    } catch (error) {
      console.error('Error getting vendor reviews:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get customer's reviews
   * GET /make-server-3dd53475/reviews/customer/:customerId
   * 
   * REFACTORED: Uses SQL repository
   */
  app.get("/make-server-3dd53475/reviews/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      // ✅ SQL: Get reviews for customer
      const reviews = await getReviewsRepository().findByCustomer(customerId);
      
      return sendSuccess(c, { reviews, total: reviews.length });
    } catch (error) {
      console.error('Error getting customer reviews:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Vendor responds to review
   * POST /make-server-3dd53475/reviews/:reviewId/respond
   * 
   * REFACTORED: Uses SQL repository
   */
  app.post("/make-server-3dd53475/reviews/:reviewId/respond", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const { vendorId, response } = await c.req.json();

      // ✅ SQL: Get review
      const review = await getReviewsRepository().findById(reviewId);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }

      if (review.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Update review with vendor response
      const updatedReview = await getReviewsRepository().update(reviewId, {
        vendor_response: response,
        vendor_responded_at: new Date().toISOString(),
      });

      console.log(`✅ Vendor responded to review: ${reviewId}`);
      return sendSuccess(c, { review: updatedReview });
    } catch (error) {
      console.error('Error responding to review:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Flag review (Admin)
   * POST /make-server-3dd53475/reviews/:reviewId/flag
   * 
   * REFACTORED: Uses SQL repository
   */
  app.post("/make-server-3dd53475/reviews/:reviewId/flag", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const { reason, flaggedBy } = await c.req.json();

      // ✅ SQL: Get review
      const review = await getReviewsRepository().findById(reviewId);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }

      // ✅ SQL: Update review status
      const updatedReview = await getReviewsRepository().update(reviewId, {
        status: 'flagged',
        flag_reason: reason,
        flagged_by: flaggedBy,
        flagged_at: new Date().toISOString(),
      });

      console.log(`⚠️ Review flagged: ${reviewId}`);
      return sendSuccess(c, { review: updatedReview });
    } catch (error) {
      console.error('Error flagging review:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Hide review (Admin)
   * POST /make-server-3dd53475/reviews/:reviewId/hide
   * 
   * REFACTORED: Uses SQL repository
   */
  app.post("/make-server-3dd53475/reviews/:reviewId/hide", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const { reason, hiddenBy } = await c.req.json();

      // ✅ SQL: Get review
      const review = await getReviewsRepository().findById(reviewId);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }

      // ✅ SQL: Update review status
      await getReviewsRepository().update(reviewId, {
        status: 'hidden',
        hide_reason: reason,
        hidden_by: hiddenBy,
        hidden_at: new Date().toISOString(),
      });

      // ✅ SQL: Recalculate vendor rating without this review
      if (review.vendor_id) {
        const reviews = await getReviewsRepository().findByVendor(review.vendor_id);
        const publishedReviews = reviews.filter(r => r.status === 'published');
        
        const avgRating = publishedReviews.length > 0
          ? publishedReviews.reduce((sum, r) => sum + r.rating, 0) / publishedReviews.length
          : 0;
        
        await getVendorsRepository().update(review.vendor_id, {
          rating: parseFloat(avgRating.toFixed(2)),
          total_reviews: publishedReviews.length,
        });
      }

      console.log(`🙈 Review hidden: ${reviewId}`);
      return sendSuccess(c, { message: 'Review hidden successfully' });
    } catch (error) {
      console.error('Error hiding review:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get vendor rating summary
   * GET /make-server-3dd53475/reviews/vendor/:vendorId/summary
   * 
   * REFACTORED: Uses SQL repository
   */
  app.get("/make-server-3dd53475/reviews/vendor/:vendorId/summary", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get all published reviews for vendor
      const reviews = await getReviewsRepository().findByVendor(vendorId);
      const publishedReviews = reviews.filter(r => r.status === 'published');
      
      let totalRating = 0;
      let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalServiceQuality = 0;
      let totalPunctuality = 0;
      let totalCleanliness = 0;
      let totalValueForMoney = 0;
      let wouldRecommendCount = 0;
      
      for (const review of publishedReviews) {
        totalRating += review.rating;
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
        
        totalServiceQuality += review.service_quality || review.rating;
        totalPunctuality += review.punctuality || review.rating;
        totalCleanliness += review.cleanliness || review.rating;
        totalValueForMoney += review.value_for_money || review.rating;
        
        if (review.would_recommend) wouldRecommendCount++;
      }
      
      const count = publishedReviews.length;
      const averageRating = count > 0 ? totalRating / count : 0;
      const recommendationRate = count > 0 ? (wouldRecommendCount / count) * 100 : 0;
      
      return sendSuccess(c, {
        summary: {
          averageRating: parseFloat(averageRating.toFixed(2)),
          totalReviews: count,
          ratingDistribution,
          detailedRatings: {
            serviceQuality: count > 0 ? parseFloat((totalServiceQuality / count).toFixed(2)) : 0,
            punctuality: count > 0 ? parseFloat((totalPunctuality / count).toFixed(2)) : 0,
            cleanliness: count > 0 ? parseFloat((totalCleanliness / count).toFixed(2)) : 0,
            valueForMoney: count > 0 ? parseFloat((totalValueForMoney / count).toFixed(2)) : 0
          },
          recommendationRate: parseFloat(recommendationRate.toFixed(2))
        }
      });
    } catch (error) {
      console.error('Error getting review summary:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Review endpoints registered (SQL-only)');
}

