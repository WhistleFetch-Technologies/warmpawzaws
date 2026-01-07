"use strict";
/**
 * ============================================================================
 * VENDOR DASHBOARD ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-vendor/vendor-dashboard-endpoints.tsx
 *
 * Endpoints:
 * - GET /vendor/dashboard/:vendorId - Get comprehensive dashboard data
 * - GET /vendor/stats/:vendorId - Get statistics
 * - GET /vendor/bookings/:vendorId - Get vendor bookings
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorDashboardEndpoints = registerVendorDashboardEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// VENDOR DASHBOARD HANDLERS
// ============================================================================
class VendorDashboardHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const timeframe = context.event.queryStringParameters?.timeframe || 'today';
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        // ✅ SQL: Get vendor profile
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        // ✅ SQL: Get bookings for vendor
        const bookings = await (0, rds_connection_1.select)('bookings', { vendor_id: vendorId });
        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        const todayBookings = bookings.filter(b => b.booking_date === today && b.status !== 'cancelled');
        const completedBookings = bookings.filter(b => b.status === 'completed');
        const pendingBookings = bookings.filter(b => ['pending', 'confirmed'].includes(b.status));
        // Calculate earnings
        const totalEarnings = completedBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
        const pendingEarnings = pendingBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
        // ✅ SQL: Get reviews
        const reviews = await (0, rds_connection_1.select)('reviews', { vendor_id: vendorId });
        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
            : 0;
        return this.success({
            vendor: {
                id: vendor.id,
                businessName: vendor.business_name,
                ownerName: vendor.owner_name,
                status: vendor.status,
                tier: vendor.tier,
            },
            stats: {
                appointments: todayBookings.length,
                consultations: bookings.filter(b => b.service_type === 'tele').length,
                earnings: totalEarnings,
                pendingEarnings: pendingEarnings,
                completedServices: completedBookings.length,
                rating: avgRating,
                totalReviews: reviews.length,
            },
            bookings: bookings.slice(0, 10), // Latest 10 bookings
            timeframe,
        });
    }
}
class VendorStatsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const startDate = context.event.queryStringParameters?.startDate;
        const endDate = context.event.queryStringParameters?.endDate;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        // ✅ SQL: Get bookings in date range
        let bookingsQuery = `SELECT * FROM bookings WHERE vendor_id = $1`;
        const params = [vendorId];
        if (startDate && endDate) {
            bookingsQuery += ` AND booking_date BETWEEN $2 AND $3`;
            params.push(startDate, endDate);
        }
        const { rows: bookings } = await (0, rds_connection_1.query)(bookingsQuery, params);
        // Calculate statistics
        const stats = {
            totalBookings: bookings.length,
            completed: bookings.filter(b => b.status === 'completed').length,
            cancelled: bookings.filter(b => b.status === 'cancelled').length,
            totalRevenue: bookings
                .filter(b => b.status === 'completed')
                .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0),
            averageBookingValue: bookings.length > 0
                ? bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0) / bookings.length
                : 0,
        };
        return this.success(stats);
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerVendorDashboardEndpoints(app) {
    const dashboardHandler = new VendorDashboardHandler();
    const statsHandler = new VendorStatsHandler();
    app.get('/vendor/dashboard/:vendorId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await dashboardHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/stats/:vendorId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await statsHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
function createApiGatewayEvent(req) {
    return {
        httpMethod: req.method,
        path: req.url,
        headers: req.headers,
        body: JSON.stringify(req.body || {}),
        pathParameters: req.param() || {},
        queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
        requestContext: {
            requestId: crypto.randomUUID(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'vendor-dashboard-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=vendor-dashboard.js.map