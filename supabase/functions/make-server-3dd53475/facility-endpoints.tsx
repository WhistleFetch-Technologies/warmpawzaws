import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * GET /vendor/facility/:vendorId
 * Get facility information for a vendor
 */
app.get('/vendor/facility/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    if (!vendorId) {
      return c.json({ success: false, error: 'Vendor ID is required' }, 400);
    }

    // Get facility data from KV store
    const facilityKey = `facility:${vendorId}`;
    const facilityData = await kv.get(facilityKey);

    return c.json({
      success: true,
      facility: facilityData || {
        description: '',
        address: '',
        operatingHours: '',
        amenities: [],
        customAmenities: [],
        photos: []
      }
    });
  } catch (error) {
    console.error('Error fetching facility data:', error);
    return c.json({ success: false, error: 'Failed to fetch facility data' }, 500);
  }
});

/**
 * PUT /vendor/facility/:vendorId
 * Update facility information for a vendor
 */
app.put('/vendor/facility/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();

    if (!vendorId) {
      return c.json({ success: false, error: 'Vendor ID is required' }, 400);
    }

    const { 
      description, 
      address, 
      operatingHours, 
      amenities, 
      customAmenities, 
      photos,
      specializations,
      location,    // ✅ NEW: { lat, lng }
      city,        // ✅ NEW
      state,       // ✅ NEW
      pincode      // ✅ NEW
    } = body;

    // Validate data
    if (!address) {
      return c.json({ success: false, error: 'Address is required' }, 400);
    }

    // ✅ NEW: Validate location for accurate discovery
    if (location && (!location.lat || !location.lng)) {
      return c.json({ 
        success: false, 
        error: 'Invalid location coordinates. Please set your facility location on the map.' 
      }, 400);
    }

    // Save facility data
    const facilityKey = `facility:${vendorId}`;
    const facilityData = {
      description: description || '',
      address,
      operatingHours: operatingHours || '',
      amenities: amenities || [],
      customAmenities: customAmenities || [],
      photos: photos || [],
      specializations: specializations || [],
      location: location || null,    // ✅ SAVE
      city: city || null,            // ✅ SAVE
      state: state || null,          // ✅ SAVE
      pincode: pincode || null,      // ✅ SAVE
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(facilityKey, facilityData);

    // ✅ CRITICAL: Also update vendor record with facility location for search
    const vendorKey = `vendor:${vendorId}`;
    const vendor = await kv.get(vendorKey);
    if (vendor && location) {
      vendor.location = location;
      vendor.city = city;
      vendor.state = state;
      vendor.pincode = pincode;
      // Keep vendor's original address but add facility address as facilityAddress
      if (address !== vendor.address) {
        vendor.facilityAddress = address;
      }
      vendor.updatedAt = new Date().toISOString();
      await kv.set(vendorKey, vendor);
      console.log(`✅ Updated vendor ${vendorId} with facility location`);
    }

    return c.json({
      success: true,
      message: 'Facility information updated successfully'
    });
  } catch (error) {
    console.error('Error updating facility data:', error);
    return c.json({ success: false, error: 'Failed to update facility data' }, 500);
  }
});

/**
 * GET /customer/facility/:vendorId
 * Get facility information for customers (public view)
 */
app.get('/customer/facility/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    if (!vendorId) {
      return c.json({ success: false, error: 'Vendor ID is required' }, 400);
    }

    // Get vendor data
    const vendorKey = `vendor:${vendorId}`;
    const vendorData = await kv.get(vendorKey);

    if (!vendorData) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    // Get facility data
    const facilityKey = `facility:${vendorId}`;
    const facilityData = await kv.get(facilityKey);

    // Get vendor services
    const servicesPrefix = `service:${vendorId}:`;
    const services = await kv.getByPrefix(servicesPrefix);

    // Calculate average rating from reviews
    const reviewsPrefix = `review:vendor:${vendorId}:`;
    const reviews = await kv.getByPrefix(reviewsPrefix);
    
    let avgRating = 0;
    let totalReviews = 0;
    
    if (reviews && reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
      avgRating = totalRating / reviews.length;
      totalReviews = reviews.length;
    }

    return c.json({
      success: true,
      vendor: {
        vendorId: vendorData.vendorId,
        businessName: vendorData.businessName,
        fullName: vendorData.fullName,
        roleId: vendorData.roleId,
        phone: vendorData.phone,
        email: vendorData.email,
        status: vendorData.status
      },
      facility: facilityData || {
        description: '',
        address: vendorData.address || '',
        operatingHours: '',
        amenities: [],
        customAmenities: [],
        photos: []
      },
      services: services || [],
      rating: {
        average: Number(avgRating.toFixed(1)),
        total: totalReviews
      },
      recentReviews: reviews?.slice(0, 5) || []
    });
  } catch (error) {
    console.error('Error fetching facility data for customer:', error);
    return c.json({ success: false, error: 'Failed to fetch facility data' }, 500);
  }
});

/**
 * POST /customer/facility/:vendorId/review
 * Submit a review for a facility
 */
app.post('/customer/facility/:vendorId/review', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();

    if (!vendorId) {
      return c.json({ success: false, error: 'Vendor ID is required' }, 400);
    }

    const { customerId, bookingId, rating, comment, facilityRating, serviceRating, staffRating } = body;

    // Validate required fields
    if (!customerId || !rating) {
      return c.json({ success: false, error: 'Customer ID and rating are required' }, 400);
    }

    if (rating < 1 || rating > 5) {
      return c.json({ success: false, error: 'Rating must be between 1 and 5' }, 400);
    }

    // Create review
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const reviewKey = `review:vendor:${vendorId}:${reviewId}`;

    await kv.set(reviewKey, {
      reviewId,
      vendorId,
      customerId,
      bookingId: bookingId || null,
      rating,
      comment: comment || '',
      facilityRating: facilityRating || rating,
      serviceRating: serviceRating || rating,
      staffRating: staffRating || rating,
      createdAt: new Date().toISOString()
    });

    // Also index by customer for easy lookup
    const customerReviewKey = `review:customer:${customerId}:${reviewId}`;
    await kv.set(customerReviewKey, reviewId);

    return c.json({
      success: true,
      message: 'Review submitted successfully',
      reviewId
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return c.json({ success: false, error: 'Failed to submit review' }, 500);
  }
});

/**
 * GET /customer/facility/:vendorId/reviews
 * Get all reviews for a facility
 */
app.get('/customer/facility/:vendorId/reviews', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!vendorId) {
      return c.json({ success: false, error: 'Vendor ID is required' }, 400);
    }

    // Get all reviews for this vendor
    const reviewsPrefix = `review:vendor:${vendorId}:`;
    const allReviews = await kv.getByPrefix(reviewsPrefix);

    // Sort by date (newest first)
    const sortedReviews = (allReviews || []).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Paginate
    const paginatedReviews = sortedReviews.slice(offset, offset + limit);

    // Calculate statistics
    const totalReviews = sortedReviews.length;
    const avgRating = totalReviews > 0
      ? sortedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    // Calculate rating distribution
    const ratingDistribution = {
      5: sortedReviews.filter(r => r.rating === 5).length,
      4: sortedReviews.filter(r => r.rating === 4).length,
      3: sortedReviews.filter(r => r.rating === 3).length,
      2: sortedReviews.filter(r => r.rating === 2).length,
      1: sortedReviews.filter(r => r.rating === 1).length
    };

    return c.json({
      success: true,
      reviews: paginatedReviews,
      statistics: {
        total: totalReviews,
        average: Number(avgRating.toFixed(1)),
        distribution: ratingDistribution
      },
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < totalReviews
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return c.json({ success: false, error: 'Failed to fetch reviews' }, 500);
  }
});

export default app;
