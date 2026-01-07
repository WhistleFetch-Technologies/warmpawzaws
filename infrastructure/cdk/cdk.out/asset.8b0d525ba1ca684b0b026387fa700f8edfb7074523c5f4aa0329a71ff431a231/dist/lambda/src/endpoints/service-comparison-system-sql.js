"use strict";
/**
 * ============================================================================
 * SERVICE COMPARISON SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Compare multiple services side-by-side
 * - Compare multiple vendors
 * - Compare multiple staff members
 * - Comparison criteria customization
 * - Save comparison results
 * - Share comparison with others
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Uses `ServicesRepository`, `VendorsRepository`, `BookingsRepository`
 * - Uses `customer_comparisons` table or `platform_settings` for saved comparisons
 *
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 8)
 * KV Operations Removed: 9
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceComparisonSystemSQL = serviceComparisonSystemSQL;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const services_1 = require("../lib/repositories/services");
const vendors_1 = require("../lib/repositories/vendors");
const bookings_1 = require("../lib/repositories/bookings");
const reviews_1 = require("../lib/repositories/reviews");
const db_1 = require("../lib/db");
const app = new hono_1.Hono();
app.use('*', (0, cors_1.cors)());
// ==========================================================================
// SERVICE COMPARISON
// ==========================================================================
/**
 * POST /make-server-3dd53475/customer/compare/services
 * Compare multiple services
 */
app.post('/make-server-3dd53475/customer/compare/services', async (c) => {
    try {
        const { serviceIds, criteria } = await c.req.json();
        if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length < 2) {
            return c.json({
                error: 'At least 2 services required for comparison',
                field: 'serviceIds'
            }, 400);
        }
        if (serviceIds.length > 5) {
            return c.json({
                error: 'Maximum 5 services can be compared at once',
                field: 'serviceIds'
            }, 400);
        }
        // ✅ SQL: Fetch all services
        const servicesRepo = (0, services_1.getServicesRepository)();
        const services = [];
        for (const serviceId of serviceIds) {
            const service = await servicesRepo.findById(serviceId);
            if (service) {
                // Get vendor info
                const vendorsRepo = (0, vendors_1.getVendorsRepository)();
                const vendor = service.vendor_id ? await vendorsRepo.findById(service.vendor_id) : null;
                services.push({
                    ...service,
                    vendorName: vendor?.business_name || '',
                    serviceStyle: vendor?.service_style || ''
                });
            }
        }
        if (services.length < 2) {
            return c.json({
                error: 'Not enough valid services found'
            }, 404);
        }
        // Default comparison criteria
        const defaultCriteria = [
            'price',
            'rating',
            'duration',
            'availability',
            'experience',
            'certifications',
            'specializations'
        ];
        const activeCriteria = criteria || defaultCriteria;
        // Build comparison matrix
        const comparison = {
            services: services.map(s => ({
                id: s.id,
                name: s.name,
                vendorName: s.vendorName,
                serviceStyle: s.serviceStyle
            })),
            criteria: {}
        };
        // Compare each criterion
        for (const criterion of activeCriteria) {
            comparison.criteria[criterion] = {
                values: services.map(s => extractCriterionValue(s, criterion)),
                winner: null,
                analysis: ''
            };
            // Determine winner for this criterion
            comparison.criteria[criterion].winner = determineWinner(services, criterion, comparison.criteria[criterion].values);
            comparison.criteria[criterion].analysis = generateAnalysis(criterion, comparison.criteria[criterion].values, comparison.criteria[criterion].winner);
        }
        // Overall recommendation
        const recommendation = generateRecommendation(services, comparison);
        console.log(`🔍 Compared ${services.length} services`);
        return c.json({
            success: true,
            comparison,
            recommendation,
            comparedAt: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error comparing services:', error);
        return c.json({ error: String(error) }, 500);
    }
});
// Helper: Extract value for a criterion
function extractCriterionValue(service, criterion) {
    switch (criterion) {
        case 'price':
            return service.price || 0;
        case 'rating':
            return service.rating || 0;
        case 'duration':
            return service.duration_minutes || 0;
        case 'availability':
            return service.is_active ? 'Available' : 'Not Available';
        case 'experience':
            return service.experience_years || 0;
        case 'certifications':
            return service.certifications || [];
        case 'specializations':
            return service.specializations || [];
        case 'reviewCount':
            return service.review_count || 0;
        case 'distance':
            return service.distance || null;
        default:
            return service[criterion] || 'N/A';
    }
}
// Helper: Determine winner for a criterion
function determineWinner(services, criterion, values) {
    switch (criterion) {
        case 'price':
            // Lower is better
            const minPriceIndex = values.indexOf(Math.min(...values.filter(v => v > 0)));
            return {
                serviceIndex: minPriceIndex,
                value: values[minPriceIndex],
                reason: 'Lowest price'
            };
        case 'rating':
        case 'experience':
        case 'reviewCount':
            // Higher is better
            const maxIndex = values.indexOf(Math.max(...values));
            return {
                serviceIndex: maxIndex,
                value: values[maxIndex],
                reason: `Highest ${criterion}`
            };
        case 'duration':
            // Shorter is better (for most services)
            const minDurationIndex = values.indexOf(Math.min(...values.filter(v => v > 0)));
            return {
                serviceIndex: minDurationIndex,
                value: values[minDurationIndex],
                reason: 'Shortest duration'
            };
        case 'certifications':
        case 'specializations':
            // More is better
            const lengths = values.map(v => Array.isArray(v) ? v.length : 0);
            const maxLengthIndex = lengths.indexOf(Math.max(...lengths));
            return {
                serviceIndex: maxLengthIndex,
                value: values[maxLengthIndex],
                reason: `Most ${criterion}`
            };
        case 'distance':
            // Closer is better
            const validDistances = values.filter(v => v !== null && v !== undefined);
            if (validDistances.length === 0)
                return null;
            const minDistanceIndex = values.indexOf(Math.min(...validDistances));
            return {
                serviceIndex: minDistanceIndex,
                value: values[minDistanceIndex],
                reason: 'Closest location'
            };
        default:
            return null;
    }
}
// Helper: Generate analysis text
function generateAnalysis(criterion, values, winner) {
    if (!winner)
        return 'No clear winner';
    const winnerValue = values[winner.serviceIndex];
    switch (criterion) {
        case 'price':
            const avgPrice = values.reduce((a, b) => a + b, 0) / values.length;
            const priceDiff = ((avgPrice - winnerValue) / avgPrice * 100).toFixed(0);
            return `${priceDiff}% cheaper than average (₹${avgPrice.toFixed(0)})`;
        case 'rating':
            return `${winnerValue}/5 rating - ${winner.reason}`;
        case 'experience':
            return `${winnerValue} years of experience - Most experienced`;
        case 'certifications':
            return `${winnerValue.length} certifications - Most certified`;
        case 'distance':
            return `${winnerValue.toFixed(1)} km away - Closest to you`;
        default:
            return winner.reason;
    }
}
// Helper: Generate overall recommendation
function generateRecommendation(services, comparison) {
    // Score each service based on wins
    const scores = services.map((_, index) => {
        let score = 0;
        let wins = 0;
        for (const criterion in comparison.criteria) {
            const winner = comparison.criteria[criterion].winner;
            if (winner && winner.serviceIndex === index) {
                // Weight different criteria
                const weight = criterion === 'rating' ? 3 :
                    criterion === 'price' ? 2 :
                        criterion === 'experience' ? 2 : 1;
                score += weight;
                wins++;
            }
        }
        return { index, score, wins };
    });
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    const topService = services[scores[0].index];
    return {
        recommendedServiceIndex: scores[0].index,
        recommendedService: {
            id: topService.id,
            name: topService.name,
            vendorName: topService.vendorName
        },
        score: scores[0].score,
        wins: scores[0].wins,
        reason: `Best overall value - won ${scores[0].wins} categories`,
        allScores: scores
    };
}
// ==========================================================================
// VENDOR COMPARISON
// ==========================================================================
/**
 * POST /make-server-3dd53475/customer/compare/vendors
 * Compare multiple vendors
 */
app.post('/make-server-3dd53475/customer/compare/vendors', async (c) => {
    try {
        const { vendorIds } = await c.req.json();
        if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length < 2) {
            return c.json({
                error: 'At least 2 vendors required for comparison'
            }, 400);
        }
        // ✅ SQL: Fetch vendors
        const vendorsRepo = (0, vendors_1.getVendorsRepository)();
        const vendors = [];
        for (const vendorId of vendorIds) {
            const vendor = await vendorsRepo.findById(vendorId);
            if (vendor) {
                // Get vendor stats
                const stats = await getVendorStats(vendorId);
                vendors.push({ ...vendor, stats });
            }
        }
        if (vendors.length < 2) {
            return c.json({ error: 'Not enough valid vendors found' }, 404);
        }
        // Compare vendors
        const comparison = {
            vendors: vendors.map(v => ({
                id: v.id,
                name: v.business_name || v.owner_name,
                roleId: v.role_id
            })),
            criteria: {
                rating: {
                    values: vendors.map(v => v.stats.averageRating || 0),
                    winner: null
                },
                totalBookings: {
                    values: vendors.map(v => v.stats.totalBookings || 0),
                    winner: null
                },
                totalReviews: {
                    values: vendors.map(v => v.stats.totalReviews || 0),
                    winner: null
                },
                responseTime: {
                    values: vendors.map(v => v.stats.avgResponseTime || 0),
                    winner: null
                },
                completionRate: {
                    values: vendors.map(v => v.stats.completionRate || 0),
                    winner: null
                }
            }
        };
        // Determine winners
        for (const criterion in comparison.criteria) {
            const values = comparison.criteria[criterion].values;
            if (criterion === 'responseTime') {
                // Lower is better
                const minIndex = values.indexOf(Math.min(...values.filter(v => v > 0)));
                comparison.criteria[criterion].winner = {
                    vendorIndex: minIndex,
                    value: values[minIndex]
                };
            }
            else {
                // Higher is better
                const maxIndex = values.indexOf(Math.max(...values));
                comparison.criteria[criterion].winner = {
                    vendorIndex: maxIndex,
                    value: values[maxIndex]
                };
            }
        }
        return c.json({
            success: true,
            comparison,
            comparedAt: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error comparing vendors:', error);
        return c.json({ error: String(error) }, 500);
    }
});
// Helper: Get vendor statistics
async function getVendorStats(vendorId) {
    // ✅ SQL: Get all bookings for vendor
    const bookingsRepo = (0, bookings_1.getBookingsRepository)();
    const bookings = await bookingsRepo.findByVendor(vendorId);
    let totalBookings = bookings.length;
    let completedBookings = 0;
    let totalRating = 0;
    let ratedBookings = 0;
    for (const booking of bookings) {
        if (booking.status === 'completed') {
            completedBookings++;
        }
    }
    // ✅ SQL: Get reviews for vendor
    const reviewsRepo = (0, reviews_1.getReviewsRepository)();
    const reviews = await reviewsRepo.findByVendor(vendorId);
    for (const review of reviews) {
        if (review.rating) {
            totalRating += review.rating;
            ratedBookings++;
        }
    }
    return {
        totalBookings,
        completedBookings,
        completionRate: totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : 0,
        averageRating: ratedBookings > 0 ? (totalRating / ratedBookings).toFixed(1) : 0,
        totalReviews: ratedBookings,
        avgResponseTime: 15 // Placeholder - would calculate from actual data
    };
}
// ==========================================================================
// SAVE COMPARISON
// ==========================================================================
/**
 * POST /make-server-3dd53475/customer/:customerId/comparisons/save
 * Save comparison results
 */
app.post('/make-server-3dd53475/customer/:customerId/comparisons/save', async (c) => {
    try {
        const customerId = c.req.param('customerId');
        const { comparisonType, comparisonData, name } = await c.req.json();
        const pool = await (0, db_1.getDbClient)();
        // ✅ SQL: Get saved comparisons
        const existingSettingResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', [`customer:${customerId}:saved-comparisons`]);
        const existingSetting = existingSettingResult.rows[0] || null;
        const savedComparisons = existingSetting?.setting_value || [];
        const comparisonId = `comparison_${Date.now()}`;
        savedComparisons.push({
            id: comparisonId,
            name: name || `Comparison ${savedComparisons.length + 1}`,
            type: comparisonType, // 'services', 'vendors', 'staff'
            data: comparisonData,
            createdAt: new Date().toISOString()
        });
        // Keep only last 20 comparisons
        if (savedComparisons.length > 20) {
            savedComparisons.splice(0, savedComparisons.length - 20);
        }
        // ✅ SQL: Save comparisons
        await (0, db_1.upsertQuery)('platform_settings', {
            setting_key: `customer:${customerId}:saved-comparisons`,
            setting_value: savedComparisons,
            is_public: false,
            updated_at: new Date().toISOString()
        }, 'setting_key');
        return c.json({
            success: true,
            comparisonId,
            message: 'Comparison saved successfully'
        });
    }
    catch (error) {
        console.error('Error saving comparison:', error);
        return c.json({ error: String(error) }, 500);
    }
});
/**
 * GET /make-server-3dd53475/customer/:customerId/comparisons
 * Get saved comparisons
 */
app.get('/make-server-3dd53475/customer/:customerId/comparisons', async (c) => {
    try {
        const customerId = c.req.param('customerId');
        const pool = await (0, db_1.getDbClient)();
        // ✅ SQL: Get saved comparisons
        const settingResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', [`customer:${customerId}:saved-comparisons`]);
        const setting = settingResult.rows[0] || null;
        const savedComparisons = setting?.setting_value || [];
        return c.json({
            success: true,
            comparisons: savedComparisons,
            count: savedComparisons.length
        });
    }
    catch (error) {
        console.error('Error fetching saved comparisons:', error);
        return c.json({ error: String(error) }, 500);
    }
});
/**
 * DELETE /make-server-3dd53475/customer/:customerId/comparisons/:comparisonId
 * Delete saved comparison
 */
app.delete('/make-server-3dd53475/customer/:customerId/comparisons/:comparisonId', async (c) => {
    try {
        const customerId = c.req.param('customerId');
        const comparisonId = c.req.param('comparisonId');
        const pool = await (0, db_1.getDbClient)();
        // ✅ SQL: Get saved comparisons
        const existingSettingResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', [`customer:${customerId}:saved-comparisons`]);
        const existingSetting = existingSettingResult.rows[0] || null;
        let savedComparisons = existingSetting?.setting_value || [];
        savedComparisons = savedComparisons.filter((comp) => comp.id !== comparisonId);
        // ✅ SQL: Save updated comparisons
        await (0, db_1.upsertQuery)('platform_settings', {
            setting_key: `customer:${customerId}:saved-comparisons`,
            setting_value: savedComparisons,
            is_public: false,
            updated_at: new Date().toISOString()
        }, 'setting_key');
        return c.json({
            success: true,
            message: 'Comparison deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting comparison:', error);
        return c.json({ error: String(error) }, 500);
    }
});
function serviceComparisonSystemSQL(mainApp) {
    mainApp.route('/', app);
}
exports.default = serviceComparisonSystemSQL;
//# sourceMappingURL=service-comparison-system-sql.js.map