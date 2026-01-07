"use strict";
/**
 * ============================================================================
 * VENDOR DASHBOARD ENHANCED ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Comprehensive vendor dashboard with:
 * - Real-time appointment data
 * - Revenue tracking
 * - Payout management
 * - Dashboard statistics and analytics
 *
 * Migrated from: supabase/functions/make-server-3dd53475/vendor-dashboard-endpoints-refactored.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorDashboardEnhancedEndpoints = registerVendorDashboardEnhancedEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerVendorDashboardEnhancedEndpoints(app) {
    /**
     * GET /vendor/dashboard/:vendorId
     * Get comprehensive vendor dashboard data
     */
    app.get("/vendor/dashboard/:vendorId", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const timeframe = c.req.query('timeframe') || 'today'; // today, week, month
            console.log(`📊 [DASHBOARD] Fetching dashboard for vendor: ${vendorId}, timeframe: ${timeframe}`);
            // Get vendor
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({
                    success: true,
                    vendor: {
                        vendorId,
                        fullName: 'Vendor',
                        businessName: null,
                        vendorType: 'service_provider',
                        serviceStyle: 'both',
                        address: 'Location not set',
                        isActive: false,
                    },
                    stats: {
                        appointments: 0,
                        consultations: 0,
                        earnings: 0,
                        pendingEarnings: 0,
                        completedServices: 0,
                        rating: 4.8,
                        totalReviews: 0,
                    },
                    timeframe,
                });
            }
            const vendor = vendors[0];
            // Calculate date range
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            let startDate = new Date();
            if (timeframe === 'today') {
                startDate = new Date(today);
            }
            else if (timeframe === 'week') {
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }
            else if (timeframe === 'month') {
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
            // Get bookings for vendor
            const bookings = await (0, rds_connection_1.query)(`SELECT * FROM bookings 
         WHERE vendor_id = $1 
           AND booking_date >= $2
         ORDER BY booking_date DESC, booking_time DESC`, [vendorId, startDate.toISOString().split('T')[0]]).catch(() => ({ rows: [] }));
            // Calculate stats
            const stats = {
                appointments: 0,
                consultations: 0,
                earnings: 0,
                pendingEarnings: 0,
                completedServices: 0,
                rating: 0,
                totalReviews: 0,
            };
            for (const booking of bookings.rows) {
                if (['confirmed', 'pending'].includes(booking.status)) {
                    stats.appointments++;
                }
                if (booking.status === 'completed') {
                    stats.completedServices++;
                    stats.consultations++;
                    stats.earnings += parseFloat(booking.total_amount || '0');
                }
                if (['in_progress', 'confirmed'].includes(booking.status)) {
                    stats.pendingEarnings += parseFloat(booking.total_amount || '0');
                }
            }
            // Get reviews
            const reviews = await (0, rds_connection_1.query)('SELECT * FROM reviews WHERE vendor_id = $1', [vendorId]).catch(() => ({ rows: [] }));
            if (reviews.rows.length > 0) {
                const totalRating = reviews.rows.reduce((sum, review) => sum + (parseFloat(review.rating || '0')), 0);
                stats.rating = parseFloat((totalRating / reviews.rows.length).toFixed(1));
                stats.totalReviews = reviews.rows.length;
            }
            else {
                stats.rating = 4.8; // Default rating for new vendors
                stats.totalReviews = 0;
            }
            return c.json({
                success: true,
                vendor: {
                    vendorId: vendor.id,
                    fullName: vendor.owner_name,
                    businessName: vendor.business_name,
                    vendorType: vendor.category,
                    serviceStyle: vendor.metadata?.serviceStyle || 'both',
                    address: vendor.address,
                    phone: vendor.phone,
                    email: vendor.email,
                    isActive: vendor.is_active,
                },
                stats,
                timeframe,
            });
        }
        catch (error) {
            console.error('Error fetching vendor dashboard:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /vendor/:vendorId/analytics
     * Get comprehensive analytics for vendor
     */
    app.get("/vendor/:vendorId/analytics", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const period = c.req.query('period') || 'month'; // day, week, month, year, all
            console.log(`📊 [ANALYTICS] Fetching analytics for vendor: ${vendorId}, period: ${period}`);
            // Get vendor
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Calculate period start
            const now = new Date();
            let periodStart = new Date();
            switch (period) {
                case 'day':
                    periodStart.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    periodStart.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    periodStart.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    periodStart.setFullYear(now.getFullYear() - 1);
                    break;
                case 'all':
                    periodStart = new Date(0);
                    break;
            }
            // Get bookings
            const bookings = await (0, rds_connection_1.query)(`SELECT * FROM bookings 
         WHERE vendor_id = $1 
           AND created_at >= $2
         ORDER BY created_at DESC`, [vendorId, periodStart.toISOString()]).catch(() => ({ rows: [] }));
            // Calculate analytics
            const analytics = {
                totalBookings: bookings.rows.length,
                completed: bookings.rows.filter((b) => b.status === 'completed').length,
                cancelled: bookings.rows.filter((b) => b.status === 'cancelled').length,
                pending: bookings.rows.filter((b) => b.status === 'pending').length,
                confirmed: bookings.rows.filter((b) => b.status === 'confirmed').length,
                totalRevenue: bookings.rows
                    .filter((b) => b.status === 'completed')
                    .reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0),
                averageBookingValue: 0,
                completionRate: 0,
                cancellationRate: 0,
            };
            if (analytics.totalBookings > 0) {
                analytics.averageBookingValue = analytics.totalRevenue / analytics.completed || 0;
                analytics.completionRate = (analytics.completed / analytics.totalBookings) * 100;
                analytics.cancellationRate = (analytics.cancelled / analytics.totalBookings) * 100;
            }
            // Get reviews
            const reviews = await (0, rds_connection_1.query)('SELECT * FROM reviews WHERE vendor_id = $1', [vendorId]).catch(() => ({ rows: [] }));
            const rating = reviews.rows.length > 0
                ? reviews.rows.reduce((sum, r) => sum + parseFloat(r.rating || '0'), 0) / reviews.rows.length
                : 0;
            return c.json({
                success: true,
                analytics: {
                    ...analytics,
                    rating: parseFloat(rating.toFixed(1)),
                    totalReviews: reviews.rows.length,
                },
                period,
            });
        }
        catch (error) {
            console.error('Error fetching vendor analytics:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=vendor-dashboard-enhanced.js.map