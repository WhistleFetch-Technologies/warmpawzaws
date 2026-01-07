"use strict";
/**
 * ============================================================================
 * SERVICE DISCOVERY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Customer-facing service discovery and search:
 * - Multi-category search (Vet, Grooming, Training, Walker, etc.)
 * - Location-based filtering
 * - Rating filter
 * - Availability check
 * - Vendor profiles with services
 *
 * Migrated from: supabase/functions/make-server-3dd53475/universal-service-discovery.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerServiceDiscoveryEndpoints = registerServiceDiscoveryEndpoints;
const rds_connection_1 = require("../database/rds-connection");
/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}
function getCategoryFromRole(roleId) {
    const roleCategoryMap = {
        'vet_clinic': 'vet',
        'veterinarian': 'vet',
        'grooming_salon': 'grooming',
        'pet_groomer': 'grooming',
        'groomer': 'grooming',
        'trainer': 'training',
        'pet_trainer': 'training',
        'dog_walker': 'walker',
        'pet_walker': 'walker',
        'boarding_resort': 'boarding',
        'pet_boarding': 'boarding',
        'nutritionist': 'nutrition',
        'ngo': 'adoption',
        'shelter': 'adoption',
        'breeder': 'adoption',
        'pet_store': 'marketplace',
    };
    return roleCategoryMap[roleId] || 'other';
}
function registerServiceDiscoveryEndpoints(app) {
    /**
     * GET /customer/discover-services
     * Main customer entry point for service discovery
     */
    app.get("/customer/discover-services", async (c) => {
        try {
            const category = c.req.query('category');
            const location = c.req.query('location');
            const minRating = c.req.query('minRating');
            const availability = c.req.query('availability');
            const petType = c.req.query('petType');
            const sortBy = c.req.query('sortBy') || 'rating';
            const latitude = c.req.query('latitude');
            const longitude = c.req.query('longitude');
            // Build vendor query
            let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;
            const params = [];
            let paramIndex = 1;
            // Filter by category (role)
            if (category) {
                const categoryRoleMap = {
                    'vet': ['vet_clinic', 'veterinarian'],
                    'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
                    'training': ['trainer', 'pet_trainer'],
                    'walker': ['dog_walker', 'pet_walker'],
                    'boarding': ['boarding_resort', 'pet_boarding'],
                    'nutrition': ['nutritionist'],
                    'adoption': ['ngo', 'shelter', 'breeder'],
                    'marketplace': ['pet_store'],
                };
                const targetRoles = categoryRoleMap[category] || [];
                if (targetRoles.length > 0) {
                    vendorQuery += ` AND r.name = ANY($${paramIndex})`;
                    params.push(targetRoles);
                    paramIndex++;
                }
            }
            // Filter by location (text match)
            if (location) {
                vendorQuery += ` AND (
          v.city ILIKE $${paramIndex} OR 
          v.state ILIKE $${paramIndex} OR 
          v.address ILIKE $${paramIndex}
        )`;
                params.push(`%${location}%`);
                paramIndex++;
            }
            vendorQuery += ` ORDER BY v.created_at DESC`;
            const vendorResults = await (0, rds_connection_1.query)(vendorQuery, params);
            let vendors = vendorResults.rows;
            // Enrich vendors with services, reviews, and availability
            const enrichedVendors = await Promise.all(vendors.map(async (vendor) => {
                // Get services
                const services = await (0, rds_connection_1.query)(`SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled
             FROM services s
             LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
             WHERE (vs.vendor_id = $1 OR s.is_global = true)
             AND s.is_active = true
             AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
             LIMIT 10`, [vendor.id]);
                // Get reviews and calculate rating
                const reviews = await (0, rds_connection_1.query)(`SELECT rating FROM reviews 
             WHERE vendor_id = $1 
             AND is_approved = true`, [vendor.id]);
                const avgRating = reviews.rows.length > 0
                    ? reviews.rows.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.rows.length
                    : 0;
                // Check availability (simplified - check if vendor has slots today)
                const today = new Date();
                const dayOfWeek = today.getDay();
                const availabilityCheck = await (0, rds_connection_1.query)(`SELECT 1 FROM vendor_schedule_slots 
             WHERE vendor_id = $1 
             AND day_of_week = $2 
             AND is_enabled = true 
             LIMIT 1`, [vendor.id, dayOfWeek]);
                const isAvailableToday = availabilityCheck.rows.length > 0;
                // Calculate distance if coordinates provided
                let distance = null;
                if (latitude && longitude && vendor.latitude && vendor.longitude) {
                    distance = calculateDistance(parseFloat(latitude), parseFloat(longitude), parseFloat(vendor.latitude), parseFloat(vendor.longitude));
                }
                return {
                    id: vendor.id,
                    vendorId: vendor.id,
                    businessName: vendor.business_name,
                    roleId: vendor.role_id,
                    roleName: vendor.role_name,
                    category: getCategoryFromRole(vendor.role_name),
                    address: vendor.address,
                    city: vendor.city,
                    state: vendor.state,
                    location: vendor.latitude && vendor.longitude ? {
                        coordinates: { lat: parseFloat(vendor.latitude), lng: parseFloat(vendor.longitude) },
                        address: vendor.address,
                    } : null,
                    rating: avgRating,
                    totalReviews: reviews.rows.length,
                    totalOfferings: services.rows.length,
                    featuredOfferings: services.rows.slice(0, 3).map((s) => ({
                        id: s.id,
                        name: s.name,
                        price: s.custom_price || s.base_price || 0,
                        duration: s.custom_duration || s.duration_minutes || 0,
                        serviceStyle: s.service_style,
                        category: s.category,
                    })),
                    availabilityScore: isAvailableToday ? 100 : 0,
                    isAvailableToday,
                    distance,
                    phone: vendor.phone,
                    email: vendor.email,
                    operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
                };
            }));
            // Filter by rating
            if (minRating) {
                enrichedVendors.filter((v) => v.rating >= parseFloat(minRating));
            }
            // Sort
            if (sortBy === 'distance' && latitude && longitude) {
                enrichedVendors.sort((a, b) => {
                    if (a.distance === null)
                        return 1;
                    if (b.distance === null)
                        return -1;
                    return a.distance - b.distance;
                });
            }
            else if (sortBy === 'rating') {
                enrichedVendors.sort((a, b) => b.rating - a.rating);
            }
            else if (sortBy === 'price') {
                enrichedVendors.sort((a, b) => {
                    const aPrice = a.featuredOfferings[0]?.price || 0;
                    const bPrice = b.featuredOfferings[0]?.price || 0;
                    return aPrice - bPrice;
                });
            }
            return c.json({
                success: true,
                vendors: enrichedVendors,
                total: enrichedVendors.length,
                filters: {
                    category,
                    location,
                    minRating,
                    availability,
                    petType,
                    sortBy,
                },
            });
        }
        catch (error) {
            console.error('Error discovering services:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /customer/vendor/:vendorId
     * Get detailed vendor profile with all services
     */
    app.get("/customer/vendor/:vendorId", async (c) => {
        try {
            const { vendorId } = c.req.param();
            // Get vendor
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = vendors[0];
            // Get role
            const roles = await (0, rds_connection_1.select)('roles', { id: vendor.role_id });
            const role = roles[0];
            // Get all services
            const services = await (0, rds_connection_1.query)(`SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1 OR s.is_global = true)
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`, [vendorId]);
            // Get reviews
            const reviews = await (0, rds_connection_1.query)(`SELECT r.*, c.name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 
         AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 20`, [vendorId]);
            const avgRating = reviews.rows.length > 0
                ? reviews.rows.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.rows.length
                : 0;
            // Get staff (if applicable)
            const staff = await (0, rds_connection_1.query)(`SELECT s.* FROM staff s
         WHERE s.vendor_id = $1 
         AND s.is_active = true
         ORDER BY s.name`, [vendorId]);
            return c.json({
                success: true,
                vendor: {
                    id: vendor.id,
                    businessName: vendor.business_name,
                    ownerName: vendor.owner_name,
                    roleId: vendor.role_id,
                    roleName: role?.name,
                    category: getCategoryFromRole(role?.name || ''),
                    address: vendor.address,
                    city: vendor.city,
                    state: vendor.state,
                    pincode: vendor.pincode,
                    phone: vendor.phone,
                    email: vendor.email,
                    latitude: vendor.latitude,
                    longitude: vendor.longitude,
                    rating: avgRating,
                    totalReviews: reviews.rows.length,
                    operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
                    description: vendor.description || '',
                },
                services: services.rows,
                reviews: reviews.rows,
                staff: staff.rows,
            });
        }
        catch (error) {
            console.error('Error fetching vendor profile:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=service-discovery.js.map