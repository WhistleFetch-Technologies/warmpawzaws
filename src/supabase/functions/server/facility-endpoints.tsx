// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import {
  getVendorsRepository,
  getVendorServicesRepository,
  getReviewsRepository
} from '../../../supabase/lib/repositories/index';

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

    // ✅ SQL: Get facility data from vendor_center_settings or vendors table
    const db = getDbClient();
    const { data: facilityData } = await db
      .from('vendor_center_settings')
      .select('*')
      .eq('vendor_id', vendorId)
      .single();

    return c.json({
      success: true,
      facility: facilityData ? {
        description: facilityData.description || '',
        address: facilityData.address || '',
        operatingHours: facilityData.operating_hours || '',
        amenities: facilityData.amenities || [],
        customAmenities: facilityData.custom_amenities || [],
        photos: facilityData.photos || []
      } : {
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

    // ✅ SQL: Save facility data to vendor_center_settings
    const db = getDbClient();
    const now = new Date().toISOString();
    
    await db
      .from('vendor_center_settings')
      .upsert({
        vendor_id: vendorId,
        description: description || '',
        address,
        operating_hours: operatingHours || '',
        amenities: amenities || [],
        custom_amenities: customAmenities || [],
        photos: photos || [],
        specializations: specializations || [],
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        updated_at: now
      }, {
        onConflict: 'vendor_id'
      });

    // ✅ SQL: Also update vendor record with facility location for search
    const vendorsRepo = getVendorsRepository();
    if (location) {
      await vendorsRepo.update(vendorId, {
        latitude: location.lat,
        longitude: location.lng,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        updated_at: now
      });
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

    // ✅ SQL: Get vendor data
    const vendorsRepo = getVendorsRepository();
    const vendorData = await vendorsRepo.findById(vendorId);

    if (!vendorData) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    // ✅ SQL: Get facility data
    const db = getDbClient();
    const { data: facilityData } = await db
      .from('vendor_center_settings')
      .select('*')
      .eq('vendor_id', vendorId)
      .single();

    // ✅ SQL: Get vendor services
    const servicesRepo = getVendorServicesRepository();
    const services = await servicesRepo.findByVendor(vendorId);

    // ✅ SQL: Calculate average rating from reviews
    const reviewsRepo = getReviewsRepository();
    const reviews = await reviewsRepo.findByVendor(vendorId);
    
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
        vendorId: vendorData.id || vendorData.vendorId,
        businessName: vendorData.business_name || vendorData.businessName,
        fullName: vendorData.owner_name || vendorData.fullName,
        roleId: vendorData.role_id || vendorData.roleId,
        phone: vendorData.phone,
        email: vendorData.email,
        status: vendorData.status || vendorData.application_status
      },
      facility: facilityData ? {
        description: facilityData.description || '',
        address: facilityData.address || vendorData.address || '',
        operatingHours: facilityData.operating_hours || '',
        amenities: facilityData.amenities || [],
        customAmenities: facilityData.custom_amenities || [],
        photos: facilityData.photos || []
      } : {
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

    // ✅ SQL: Create review
    const reviewsRepo = getReviewsRepository();
    const review = await reviewsRepo.create({
      vendor_id: vendorId,
      customer_id: customerId,
      booking_id: bookingId || null,
      rating,
      comment: comment || '',
      facility_rating: facilityRating || rating,
      service_rating: serviceRating || rating,
      staff_rating: staffRating || rating,
      created_at: new Date().toISOString()
    });

    return c.json({
      success: true,
      message: 'Review submitted successfully',
      reviewId: review.id
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

    // ✅ SQL: Get all reviews for this vendor
    const reviewsRepo = getReviewsRepository();
    const allReviews = await reviewsRepo.findByVendor(vendorId, {
      limit: limit + offset,
      orderBy: 'created_at',
      orderDirection: 'desc'
    });

    // Sort by date (newest first) - already sorted by SQL
    const sortedReviews = allReviews || [];

    // Paginate
    const paginatedReviews = sortedReviews.slice(offset, offset + limit);

    // Calculate statistics
    const totalReviews = sortedReviews.length;
    const avgRating = totalReviews > 0
      ? sortedReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
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
