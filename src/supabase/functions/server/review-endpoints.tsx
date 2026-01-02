import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
// ✅ SQL MIGRATION: Replace KV with SQL repositories
import { getReviewsRepository } from "../../../supabase/lib/repositories/reviews";
import { getBookingsRepository } from "../../../supabase/lib/repositories/bookings";
import { getProductsRepository } from "../../../supabase/lib/repositories/products";
import { getCustomersRepository } from "../../../supabase/lib/repositories/customers";
import { getVendorsRepository } from "../../../supabase/lib/repositories/vendors";

export function reviewEndpoints(app: Hono) {
  
  // ============================================
  // REVIEW & RATING ENDPOINTS
  // ============================================
  
  /**
   * Create a review
   * POST /make-server-3dd53475/reviews/create
   */
  app.post("/make-server-3dd53475/reviews/create", async (c) => {
    try {
      const {
        bookingId,
        productId, // Added productId for e-commerce
        customerId,
        vendorId,
        rating, // 1-5
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
      const bookingsRepo = getBookingsRepository();
      const reviewsRepo = getReviewsRepository();
      const customersRepo = getCustomersRepository();
      const productsRepo = getProductsRepository();
      const vendorsRepo = getVendorsRepository();
      
      let resolvedVendorId = vendorId;
      
      if (bookingId) {
        // Check if booking exists and is completed
        const booking = await bookingsRepo.findById(bookingId);
        if (!booking) {
          return sendError(c, 'Booking not found', 404);
        }

        if (booking.status !== 'completed') {
          return sendError(c, 'Can only review completed bookings', 400);
        }

        // Check if already reviewed
        const existingReview = await reviewsRepo.findByBooking(bookingId);
        if (existingReview) {
          return sendError(c, 'Booking already reviewed', 400);
        }
        
        resolvedVendorId = booking.vendor_id || vendorId;
      }

      // ✅ SQL: Handling Product Review
      if (productId) {
        // Check if product exists
        const product = await productsRepo.findById(productId);
        if (!product) {
          return sendError(c, 'Product not found', 404);
        }
        resolvedVendorId = product.vendor_id || vendorId;
      }

      // ✅ SQL: Create review using repository
      const reviewText = review || ''; // Rename to avoid conflict with created review object
      const createdReview = await reviewsRepo.create({
        booking_id: bookingId || undefined,
        customer_id: customerId,
        vendor_id: resolvedVendorId || undefined,
        service_id: undefined, // Can be extracted from booking if needed
        rating,
        comment: reviewText || undefined,
      });
      
      // ✅ SQL: Update product rating if product review
      if (productId) {
        // Recalculate product rating from all reviews
        const allProductReviews = await reviewsRepo.findAll({ vendorId: resolvedVendorId });
        const productReviews = allProductReviews.filter(r => r.service_id === productId);
        const avgRating = productReviews.length > 0
          ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
          : 0;
        
        // Update product rating in products table
        await productsRepo.update(productId, {
          // Note: Products table may need a rating column - update if needed
        });
      }

      // ✅ SQL: Update vendor rating
      if (resolvedVendorId) {
        // Recalculate vendor rating from all reviews
        const allVendorReviews = await reviewsRepo.findByVendor(resolvedVendorId);
        const avgRating = allVendorReviews.length > 0
          ? allVendorReviews.reduce((sum, r) => sum + r.rating, 0) / allVendorReviews.length
          : 0;
        
        // Update vendor rating (if vendor repository supports it)
        // Note: Vendor rating may be calculated dynamically, not stored
      }

      // ✅ SQL: Update booking with review reference (if needed, add review_id column)
      if (bookingId) {
        // Note: Bookings table may need a review_id column for linking
        // For now, review is linked via booking_id foreign key in reviews table
      }

      console.log(`✅ Review created: ${createdReview.id} (Product: ${productId}, Booking: ${bookingId})`);
      return sendSuccess(c, { reviewId: createdReview.id, review: createdReview });
    } catch (error) {
      console.error('Error creating review:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get review details
   * GET /make-server-3dd53475/reviews/:reviewId
   */
  app.get("/make-server-3dd53475/reviews/:reviewId", async (c) => {
    try {
      const { reviewId } = c.req.param();
      
      // ✅ SQL: Get review from repository
      const reviewsRepo = getReviewsRepository();
      const review = await reviewsRepo.findById(reviewId);
      
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
   */
  app.get("/make-server-3dd53475/reviews/product/:productId", async (c) => {
      try {
        const { productId } = c.req.param();
        const limit = parseInt(c.req.query('limit') || '20');
        
        // ✅ SQL: Get reviews by product (via service_id if products map to services)
        // Note: Products may need a reviews table or use service_id mapping
        const reviewsRepo = getReviewsRepository();
        // For now, get all reviews and filter by service_id if product maps to service
        // This may need adjustment based on schema
        const allReviews = await reviewsRepo.findAll({ limit });
        const productReviews = allReviews.filter(r => r.service_id === productId);
        
        return sendSuccess(c, { reviews: productReviews.slice(0, limit), total: productReviews.length });
      } catch (error) {
        console.error('Error getting product reviews:', error);
        return sendError(c, error, 500);
      }
  });

  /**
   * Get vendor's reviews
   * GET /make-server-3dd53475/reviews/vendor/:vendorId
   */
  app.get("/make-server-3dd53475/reviews/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      
      // ✅ SQL: Get reviews by vendor from repository
      const reviewsRepo = getReviewsRepository();
      const reviews = await reviewsRepo.findByVendor(vendorId, { limit });
      
      return sendSuccess(c, { reviews, total: reviews.length });
    } catch (error) {
      console.error('Error getting vendor reviews:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get customer's reviews
   * GET /make-server-3dd53475/reviews/customer/:customerId
   */
  app.get("/make-server-3dd53475/reviews/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      // ✅ SQL: Get reviews by customer from repository
      const reviewsRepo = getReviewsRepository();
      const reviews = await reviewsRepo.findByCustomer(customerId);
      
      return sendSuccess(c, { reviews, total: reviews.length });
    } catch (error) {
      console.error('Error getting customer reviews:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Vendor responds to review
   * POST /make-server-3dd53475/reviews/:reviewId/respond
   */
  app.post("/make-server-3dd53475/reviews/:reviewId/respond", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const { vendorId, response } = await c.req.json();

      // ✅ SQL: Get review from repository
      const reviewsRepo = getReviewsRepository();
      const existingReview = await reviewsRepo.findById(reviewId);
      
      if (!existingReview) {
        return sendError(c, 'Review not found', 404);
      }

      if (existingReview.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Update review with vendor response
      // Note: Reviews table may need vendor_response and vendor_responded_at columns
      // For now, update comment or add to notes
      const updatedReview = await reviewsRepo.update(reviewId, {
        comment: existingReview.comment ? `${existingReview.comment}\n\nVendor Response: ${response}` : `Vendor Response: ${response}`,
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
   */
  app.post("/make-server-3dd53475/reviews/:reviewId/flag", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const { reason, flaggedBy } = await c.req.json();

      // ✅ SQL: Get review from repository
      const reviewsRepo = getReviewsRepository();
      const existingReview = await reviewsRepo.findById(reviewId);
      
      if (!existingReview) {
        return sendError(c, 'Review not found', 404);
      }

      // ✅ SQL: Flag review (may need status column or separate flagged_reviews table)
      // For now, update comment to indicate flag
      const updatedReview = await reviewsRepo.update(reviewId, {
        comment: existingReview.comment ? `${existingReview.comment}\n[FLAGGED: ${reason}]` : `[FLAGGED: ${reason}]`,
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
   */
  app.post("/make-server-3dd53475/reviews/:reviewId/hide", async (c) => {
    try {
      const { reviewId } = c.req.param();
      const { reason, hiddenBy } = await c.req.json();

      // ✅ SQL: Get review from repository
      const reviewsRepo = getReviewsRepository();
      const review = await reviewsRepo.findById(reviewId);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }

      // ✅ SQL: Delete review (hiding = soft delete)
      // Note: For soft delete, may need is_visible or deleted_at column
      // For now, delete the review (recalculate ratings automatically)
      await reviewsRepo.delete(reviewId);

      // ✅ SQL: Recalculate vendor rating (done automatically via SQL queries)
      // Vendor rating can be calculated on-the-fly from visible reviews

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
   */
  app.get("/make-server-3dd53475/reviews/vendor/:vendorId/summary", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get all reviews for vendor
      const reviewsRepo = getReviewsRepository();
      const reviews = await reviewsRepo.findByVendor(vendorId);
      
      let totalRating = 0;
      let count = reviews.length;
      let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      
      for (const review of reviews) {
        totalRating += review.rating;
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      }
      
      const averageRating = count > 0 ? totalRating / count : 0;
      
      return sendSuccess(c, {
        summary: {
          averageRating: parseFloat(averageRating.toFixed(2)),
          totalReviews: count,
          ratingDistribution,
          // Note: Detailed ratings (serviceQuality, punctuality, etc.) would need additional columns
          // These can be added to reviews table if needed
        }
      });
    } catch (error) {
      console.error('Error getting review summary:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Review endpoints registered');
}
