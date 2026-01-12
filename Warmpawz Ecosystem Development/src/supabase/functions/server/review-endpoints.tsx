import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

export function reviewEndpoints(app: Hono, kv: any) {
  
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

      // Handling Booking Review
      if (bookingId) {
        // Check if booking exists and is completed
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking) {
          return sendError(c, 'Booking not found', 404);
        }

        if (booking.status !== 'completed') {
          return sendError(c, 'Can only review completed bookings', 400);
        }

        // Check if already reviewed
        const existingReview = await kv.get(`review:booking:${bookingId}`);
        if (existingReview) {
          return sendError(c, 'Booking already reviewed', 400);
        }
      }

      // Handling Product Review
      if (productId) {
        // Check if product exists
        const product = await kv.get(`product:${productId}`);
        if (!product) {
          return sendError(c, 'Product not found', 404);
        }
        
        // Check if already reviewed by this customer (optional logic, but good for preventing spam)
        // For now, we'll allow multiple reviews or rely on frontend to limit it
      }

      // Generate review ID
      const reviewId = `review_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Get customer details
      const customer = await kv.get(`customer:${customerId}`);
      
      // Create review object
      const reviewData = {
        id: reviewId,
        bookingId: bookingId || null,
        productId: productId || null,
        customerId,
        customerName: customer?.name || 'Anonymous',
        vendorId: vendorId || (productId ? (await kv.get(`product:${productId}`))?.sellerId : null),
        rating,
        review: review || '',
        
        // Detailed ratings (only applicable for services really, but we keep them optional)
        serviceQuality: serviceQuality || rating,
        punctuality: punctuality || rating,
        cleanliness: cleanliness || rating,
        valueForMoney: valueForMoney || rating,
        wouldRecommend: wouldRecommend !== false,
        
        // Media
        photos: photos || [],
        
        // Status
        status: 'published', // published, hidden, flagged
        isVerified: true, // All booking/purchase-based reviews are verified
        
        // Response
        vendorResponse: null,
        vendorRespondedAt: null,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save review
      await kv.set(`review:${reviewId}`, reviewData);
      
      if (bookingId) {
        await kv.set(`review:booking:${bookingId}`, reviewId); // Link to booking
      }
      
      if (productId) {
        // Link to product
        const productReviewsKey = `product:${productId}:reviews`;
        const productReviews = await kv.get(productReviewsKey) || [];
        productReviews.unshift(reviewId);
        await kv.set(productReviewsKey, productReviews);
        
        // Update Product Rating
        const allProductReviews = productReviews;
        let totalProductRating = 0;
        let count = 0;
        
        for (const revId of allProductReviews) {
           const rev = await kv.get(`review:${revId}`);
           if (rev && rev.status === 'published') {
             totalProductRating += rev.rating;
             count++;
           }
        }
        
        const avgProductRating = count > 0 ? totalProductRating / count : 0;
        const product = await kv.get(`product:${productId}`);
        if (product) {
          product.rating = parseFloat(avgProductRating.toFixed(1)); // 4.5
          product.reviewCount = count;
          await kv.set(`product:${productId}`, product);
        }
      }

      // Add to vendor's reviews if vendorId exists
      if (reviewData.vendorId) {
        const vendorReviewsKey = `vendor:${reviewData.vendorId}:reviews`;
        const vendorReviews = await kv.get(vendorReviewsKey) || [];
        vendorReviews.unshift(reviewId);
        await kv.set(vendorReviewsKey, vendorReviews);

        // Update vendor rating logic...
        // Note: Vendor rating might be aggregation of all service reviews + product reviews? 
        // Or separate. For now, let's update global vendor rating including products.
        
        const allVendorReviewIds = vendorReviews; // Includes new review
        
        let totalRating = 0;
        let count = 0;
        
        for (const revId of allVendorReviewIds) {
          const rev = await kv.get(`review:${revId}`);
          if (rev && rev.status === 'published') {
            totalRating += rev.rating;
            count++;
          }
        }
        
        const averageRating = count > 0 ? totalRating / count : 0;

        // Update vendor
        const vendor = await kv.get(`vendor:${reviewData.vendorId}`);
        if (vendor) {
          vendor.rating = parseFloat(averageRating.toFixed(2));
          vendor.totalReviews = count;
          await kv.set(`vendor:${reviewData.vendorId}`, vendor);
        }
      }

      // Add to customer's reviews
      const customerReviewsKey = `customer:${customerId}:reviews`;
      const customerReviews = await kv.get(customerReviewsKey) || [];
      customerReviews.unshift(reviewId);
      await kv.set(customerReviewsKey, customerReviews);

      // Update booking if applicable
      if (bookingId) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
            booking.reviewId = reviewId;
            booking.reviewedAt = new Date().toISOString();
            await kv.set(`booking:${bookingId}`, booking);
        }
      }

      console.log(`✅ Review created: ${reviewId} (Product: ${productId}, Booking: ${bookingId})`);
      return sendSuccess(c, { reviewId, review: reviewData });
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
      
      const review = await kv.get(`review:${reviewId}`);
      
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
        
        const reviewIds = await kv.get(`product:${productId}:reviews`) || [];
        
        const reviews = [];
        for (const reviewId of reviewIds.slice(0, limit)) {
            const review = await kv.get(`review:${reviewId}`);
            if (review && review.status === 'published') {
                reviews.push(review);
            }
        }
        
        return sendSuccess(c, { reviews, total: reviews.length });
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
      const status = c.req.query('status') || 'published';
      const limit = parseInt(c.req.query('limit') || '50');
      
      const reviewIds = await kv.get(`vendor:${vendorId}:reviews`) || [];
      
      const reviews = [];
      for (const reviewId of reviewIds.slice(0, limit)) {
        const review = await kv.get(`review:${reviewId}`);
        if (review && (!status || review.status === status)) {
          reviews.push(review);
        }
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
   */
  app.get("/make-server-3dd53475/reviews/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      
      const reviewIds = await kv.get(`customer:${customerId}:reviews`) || [];
      
      const reviews = [];
      for (const reviewId of reviewIds) {
        const review = await kv.get(`review:${reviewId}`);
        if (review) {
          reviews.push(review);
        }
      }
      
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

      const review = await kv.get(`review:${reviewId}`);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }

      if (review.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      review.vendorResponse = response;
      review.vendorRespondedAt = new Date().toISOString();
      review.updatedAt = new Date().toISOString();

      await kv.set(`review:${reviewId}`, review);

      console.log(`✅ Vendor responded to review: ${reviewId}`);
      return sendSuccess(c, { review });
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

      const review = await kv.get(`review:${reviewId}`);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }

      review.status = 'flagged';
      review.flagReason = reason;
      review.flaggedBy = flaggedBy;
      review.flaggedAt = new Date().toISOString();
      review.updatedAt = new Date().toISOString();

      await kv.set(`review:${reviewId}`, review);

      console.log(`⚠️ Review flagged: ${reviewId}`);
      return sendSuccess(c, { review });
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

      const review = await kv.get(`review:${reviewId}`);
      
      if (!review) {
        return sendError(c, 'Review not found', 404);
      }

      review.status = 'hidden';
      review.hideReason = reason;
      review.hiddenBy = hiddenBy;
      review.hiddenAt = new Date().toISOString();
      review.updatedAt = new Date().toISOString();

      await kv.set(`review:${reviewId}`, review);

      // Recalculate vendor rating without this review
      if (review.vendorId) {
        const vendorReviews = await kv.get(`vendor:${review.vendorId}:reviews`) || [];
        
        let totalRating = 0;
        let count = 0;
        
        for (const revId of vendorReviews) {
            const rev = await kv.get(`review:${revId}`);
            if (rev && rev.status === 'published') {
            totalRating += rev.rating;
            count++;
            }
        }
        
        const averageRating = count > 0 ? totalRating / count : 0;

        const vendor = await kv.get(`vendor:${review.vendorId}`);
        if (vendor) {
            vendor.rating = parseFloat(averageRating.toFixed(2));
            vendor.totalReviews = count;
            await kv.set(`vendor:${review.vendorId}`, vendor);
        }
      }

      console.log(`🙈 Review hidden: ${reviewId}`);
      return sendSuccess(c, { review });
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
      
      const reviewIds = await kv.get(`vendor:${vendorId}:reviews`) || [];
      
      let totalRating = 0;
      let count = 0;
      let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalServiceQuality = 0;
      let totalPunctuality = 0;
      let totalCleanliness = 0;
      let totalValueForMoney = 0;
      let wouldRecommendCount = 0;
      
      for (const reviewId of reviewIds) {
        const review = await kv.get(`review:${reviewId}`);
        if (review && review.status === 'published') {
          totalRating += review.rating;
          count++;
          ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
          
          totalServiceQuality += review.serviceQuality || review.rating;
          totalPunctuality += review.punctuality || review.rating;
          totalCleanliness += review.cleanliness || review.rating;
          totalValueForMoney += review.valueForMoney || review.rating;
          
          if (review.wouldRecommend) wouldRecommendCount++;
        }
      }
      
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

  console.log('✅ Review endpoints registered');
}
