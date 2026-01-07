"use strict";
/**
 * ============================================================================
 * FACILITY ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Facility management endpoints for vendors and customers
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.facilityEndpoints = facilityEndpoints;
const response_utils_1 = require("./response-utils");
const repositories_1 = require("../lib/repositories");
const db_1 = require("../lib/db");
const BASE_PATH = '/make-server-3dd53475';
function facilityEndpoints(app) {
    /**
     * GET /vendor/facility/:vendorId
     * Get facility information for a vendor
     */
    app.get(`${BASE_PATH}/vendor/facility/:vendorId`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            if (!vendorId) {
                return (0, response_utils_1.sendError)(c, 'Vendor ID is required', 400);
            }
            // ✅ SQL: Get facility data from vendor_center_settings
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM vendor_center_settings WHERE vendor_id = $1 LIMIT 1`, [vendorId]);
            const facilityData = result.rows[0] || null;
            return (0, response_utils_1.sendSuccess)(c, {
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
        }
        catch (error) {
            console.error('Error fetching facility data:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /vendor/facility/:vendorId
     * Update facility information for a vendor
     */
    app.put(`${BASE_PATH}/vendor/facility/:vendorId`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const body = await c.req.json();
            if (!vendorId) {
                return (0, response_utils_1.sendError)(c, 'Vendor ID is required', 400);
            }
            const { description, address, operatingHours, amenities, customAmenities, photos, specializations, location, city, state, pincode } = body;
            // Validate data
            if (!address) {
                return (0, response_utils_1.sendError)(c, 'Address is required', 400);
            }
            // Validate location for accurate discovery
            if (location && (!location.lat || !location.lng)) {
                return (0, response_utils_1.sendError)(c, 'Invalid location coordinates. Please set your facility location on the map.', 400);
            }
            // ✅ SQL: Save facility data to vendor_center_settings
            const now = new Date().toISOString();
            // Use upsertQuery or manual upsert logic
            const pool = await (0, db_1.getDbClient)();
            const existing = await pool.query(`SELECT vendor_id FROM vendor_center_settings WHERE vendor_id = $1`, [vendorId]);
            if (existing.rows.length > 0) {
                // Update existing
                await pool.query(`UPDATE vendor_center_settings SET
            description = $2, address = $3, operating_hours = $4,
            amenities = $5, custom_amenities = $6, photos = $7,
            specializations = $8, latitude = $9, longitude = $10,
            city = $11, state = $12, pincode = $13, updated_at = $14
            WHERE vendor_id = $1`, [
                    vendorId, description || '', address, operatingHours || '',
                    JSON.stringify(amenities || []), JSON.stringify(customAmenities || []),
                    JSON.stringify(photos || []), JSON.stringify(specializations || []),
                    location?.lat || null, location?.lng || null,
                    city || null, state || null, pincode || null, now
                ]);
            }
            else {
                // Insert new
                await pool.query(`INSERT INTO vendor_center_settings 
            (vendor_id, description, address, operating_hours, amenities, 
             custom_amenities, photos, specializations, latitude, longitude,
             city, state, pincode, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, [
                    vendorId, description || '', address, operatingHours || '',
                    JSON.stringify(amenities || []), JSON.stringify(customAmenities || []),
                    JSON.stringify(photos || []), JSON.stringify(specializations || []),
                    location?.lat || null, location?.lng || null,
                    city || null, state || null, pincode || null, now, now
                ]);
            }
            // ✅ SQL: Also update vendor record with facility location for search
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
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
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Facility information updated successfully'
            });
        }
        catch (error) {
            console.error('Error updating facility data:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /customer/facility/:vendorId
     * Get facility information for customers (public view)
     */
    app.get(`${BASE_PATH}/customer/facility/:vendorId`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            if (!vendorId) {
                return (0, response_utils_1.sendError)(c, 'Vendor ID is required', 400);
            }
            // ✅ SQL: Get vendor data
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const vendorData = await vendorsRepo.findById(vendorId);
            if (!vendorData) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // ✅ SQL: Get facility data
            const pool = await (0, db_1.getDbClient)();
            const facilityResult = await pool.query(`SELECT * FROM vendor_center_settings WHERE vendor_id = $1 LIMIT 1`, [vendorId]);
            const facilityData = facilityResult.rows[0] || null;
            // ✅ SQL: Get vendor services
            const servicesRepo = (0, repositories_1.getServicesRepository)();
            const services = await servicesRepo.findByVendor(vendorId);
            // ✅ SQL: Calculate average rating from reviews
            const reviewsRepo = (0, repositories_1.getReviewsRepository)();
            const reviews = await reviewsRepo.findByVendor(vendorId);
            let avgRating = 0;
            let totalReviews = 0;
            if (reviews && reviews.length > 0) {
                const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
                avgRating = totalRating / reviews.length;
                totalReviews = reviews.length;
            }
            return (0, response_utils_1.sendSuccess)(c, {
                vendor: {
                    vendorId: vendorData.id,
                    businessName: vendorData.business_name,
                    fullName: vendorData.owner_name,
                    roleId: vendorData.role_id,
                    phone: vendorData.phone,
                    email: vendorData.email,
                    status: vendorData.status
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
        }
        catch (error) {
            console.error('Error fetching facility data for customer:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /customer/facility/:vendorId/review
     * Submit a review for a facility
     */
    app.post(`${BASE_PATH}/customer/facility/:vendorId/review`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const body = await c.req.json();
            if (!vendorId) {
                return (0, response_utils_1.sendError)(c, 'Vendor ID is required', 400);
            }
            const { customerId, bookingId, rating, comment, facilityRating, serviceRating, staffRating } = body;
            // Validate required fields
            if (!customerId || !rating) {
                return (0, response_utils_1.sendError)(c, 'Customer ID and rating are required', 400);
            }
            if (rating < 1 || rating > 5) {
                return (0, response_utils_1.sendError)(c, 'Rating must be between 1 and 5', 400);
            }
            // ✅ SQL: Create review
            const reviewsRepo = (0, repositories_1.getReviewsRepository)();
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
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Review submitted successfully',
                reviewId: review.id
            });
        }
        catch (error) {
            console.error('Error submitting review:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /customer/facility/:vendorId/reviews
     * Get all reviews for a facility
     */
    app.get(`${BASE_PATH}/customer/facility/:vendorId/reviews`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const limit = parseInt(c.req.query('limit') || '20');
            const offset = parseInt(c.req.query('offset') || '0');
            if (!vendorId) {
                return (0, response_utils_1.sendError)(c, 'Vendor ID is required', 400);
            }
            // ✅ SQL: Get all reviews for this vendor
            const reviewsRepo = (0, repositories_1.getReviewsRepository)();
            const allReviews = await reviewsRepo.findByVendor(vendorId);
            // Sort by date (newest first)
            const sortedReviews = (allReviews || []).sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            });
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
            return (0, response_utils_1.sendSuccess)(c, {
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
        }
        catch (error) {
            console.error('Error fetching reviews:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=facility-endpoints-sql.js.map