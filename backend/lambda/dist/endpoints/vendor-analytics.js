"use strict";
/**
 * ============================================================================
 * VENDOR ANALYTICS ENDPOINTS
 * ============================================================================
 *
 * Handles vendor analytics and reporting:
 * - Dashboard analytics
 * - Revenue analytics
 * - Booking analytics
 *
 * Date: 2026-01-07
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorAnalyticsEndpoints = registerVendorAnalyticsEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// GET /vendor/analytics/dashboard - Dashboard analytics overview
// ============================================================================
class GetDashboardAnalyticsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        try {
            const vendorId = context.event.pathParameters?.vendorId ||
                context.event.queryStringParameters?.vendorId ||
                context.userId;
            if (!vendorId) {
                return this.error('Vendor ID is required', 401);
            }
            const startDate = context.event.queryStringParameters?.startDate ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = context.event.queryStringParameters?.endDate ||
                new Date().toISOString().split('T')[0];
            // Get booking statistics
            const bookingStats = await (0, rds_connection_1.query)(`
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_bookings,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
          SUM(total_amount) FILTER (WHERE status != 'cancelled') as total_revenue,
          AVG(total_amount) FILTER (WHERE status != 'cancelled') as avg_booking_value
        FROM bookings
        WHERE vendor_id = $1 
          AND booking_date >= $2 
          AND booking_date <= $3
      `, [vendorId, startDate, endDate]);
            // Get revenue by day
            const revenueByDay = await (0, rds_connection_1.query)(`
        SELECT 
          DATE(booking_date) as date,
          COUNT(*) as bookings_count,
          SUM(total_amount) as revenue
        FROM bookings
        WHERE vendor_id = $1 
          AND status != 'cancelled'
          AND booking_date >= $2 
          AND booking_date <= $3
        GROUP BY DATE(booking_date)
        ORDER BY date ASC
      `, [vendorId, startDate, endDate]);
            // Get top services
            const topServices = await (0, rds_connection_1.query)(`
        SELECT 
          s.id,
          s.name,
          COUNT(b.id) as booking_count,
          SUM(b.total_amount) as revenue
        FROM bookings b
        INNER JOIN services s ON b.service_id = s.id
        WHERE b.vendor_id = $1 
          AND b.status != 'cancelled'
          AND b.booking_date >= $2 
          AND b.booking_date <= $3
        GROUP BY s.id, s.name
        ORDER BY booking_count DESC
        LIMIT 10
      `, [vendorId, startDate, endDate]);
            // Get customer statistics
            const customerStats = await (0, rds_connection_1.query)(`
        SELECT 
          COUNT(DISTINCT customer_id) as unique_customers,
          COUNT(*) FILTER (WHERE is_repeat_customer = true) as repeat_customers
        FROM bookings
        WHERE vendor_id = $1 
          AND booking_date >= $2 
          AND booking_date <= $3
      `, [vendorId, startDate, endDate]);
            // Get staff performance
            const staffPerformance = await (0, rds_connection_1.query)(`
        SELECT 
          st.id,
          st.name,
          COUNT(b.id) as bookings_count,
          AVG(r.rating) as avg_rating,
          SUM(b.total_amount) as revenue
        FROM bookings b
        LEFT JOIN staff st ON b.staff_id = st.id
        LEFT JOIN reviews r ON b.id = r.booking_id
        WHERE b.vendor_id = $1 
          AND b.status != 'cancelled'
          AND b.booking_date >= $2 
          AND b.booking_date <= $3
        GROUP BY st.id, st.name
        ORDER BY bookings_count DESC
        LIMIT 10
      `, [vendorId, startDate, endDate]);
            return this.success({
                period: { startDate, endDate },
                bookingStats: bookingStats.rows[0],
                revenueByDay: revenueByDay.rows,
                topServices: topServices.rows,
                customerStats: customerStats.rows[0],
                staffPerformance: staffPerformance.rows
            });
        }
        catch (error) {
            console.error('Error fetching dashboard analytics:', error);
            return this.error(error.message || 'Failed to fetch dashboard analytics', 500);
        }
    }
}
// ============================================================================
// GET /vendor/analytics/revenue - Detailed revenue analytics
// ============================================================================
class GetRevenueAnalyticsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        try {
            const vendorId = context.event.pathParameters?.vendorId ||
                context.event.queryStringParameters?.vendorId ||
                context.userId;
            if (!vendorId) {
                return this.error('Vendor ID is required', 401);
            }
            const startDate = context.event.queryStringParameters?.startDate ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = context.event.queryStringParameters?.endDate ||
                new Date().toISOString().split('T')[0];
            const groupBy = context.event.queryStringParameters?.groupBy || 'day'; // day, week, month
            let dateFormat = "DATE(booking_date)";
            if (groupBy === 'week') {
                dateFormat = "DATE_TRUNC('week', booking_date)";
            }
            else if (groupBy === 'month') {
                dateFormat = "DATE_TRUNC('month', booking_date)";
            }
            // Revenue breakdown
            const revenueBreakdown = await (0, rds_connection_1.query)(`
        SELECT 
          ${dateFormat} as period,
          COUNT(*) as bookings_count,
          SUM(total_amount) as gross_revenue,
          SUM(discount_amount) as total_discounts,
          SUM(total_amount - discount_amount) as net_revenue,
          SUM(commission_amount) as total_commission,
          SUM(total_amount - discount_amount - commission_amount) as net_earnings
        FROM bookings
        WHERE vendor_id = $1 
          AND status != 'cancelled'
          AND booking_date >= $2 
          AND booking_date <= $3
        GROUP BY ${dateFormat}
        ORDER BY period ASC
      `, [vendorId, startDate, endDate]);
            // Revenue by service type
            const revenueByServiceType = await (0, rds_connection_1.query)(`
        SELECT 
          s.service_style,
          COUNT(b.id) as bookings_count,
          SUM(b.total_amount) as revenue
        FROM bookings b
        INNER JOIN services s ON b.service_id = s.id
        WHERE b.vendor_id = $1 
          AND b.status != 'cancelled'
          AND b.booking_date >= $2 
          AND b.booking_date <= $3
        GROUP BY s.service_style
        ORDER BY revenue DESC
      `, [vendorId, startDate, endDate]);
            // Payment method breakdown
            const paymentMethodBreakdown = await (0, rds_connection_1.query)(`
        SELECT 
          payment_method,
          COUNT(*) as transaction_count,
          SUM(total_amount) as revenue
        FROM bookings
        WHERE vendor_id = $1 
          AND status != 'cancelled'
          AND booking_date >= $2 
          AND booking_date <= $3
        GROUP BY payment_method
        ORDER BY revenue DESC
      `, [vendorId, startDate, endDate]);
            // Total summary
            const summary = await (0, rds_connection_1.query)(`
        SELECT 
          SUM(total_amount) as total_revenue,
          SUM(discount_amount) as total_discounts,
          SUM(commission_amount) as total_commission,
          SUM(total_amount - discount_amount - commission_amount) as net_earnings,
          COUNT(*) as total_bookings,
          AVG(total_amount) as avg_booking_value
        FROM bookings
        WHERE vendor_id = $1 
          AND status != 'cancelled'
          AND booking_date >= $2 
          AND booking_date <= $3
      `, [vendorId, startDate, endDate]);
            return this.success({
                period: { startDate, endDate, groupBy },
                summary: summary.rows[0],
                revenueBreakdown: revenueBreakdown.rows,
                revenueByServiceType: revenueByServiceType.rows,
                paymentMethodBreakdown: paymentMethodBreakdown.rows
            });
        }
        catch (error) {
            console.error('Error fetching revenue analytics:', error);
            return this.error(error.message || 'Failed to fetch revenue analytics', 500);
        }
    }
}
// ============================================================================
// GET /vendor/analytics/bookings - Detailed booking analytics
// ============================================================================
class GetBookingAnalyticsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        try {
            const vendorId = context.event.pathParameters?.vendorId ||
                context.event.queryStringParameters?.vendorId ||
                context.userId;
            if (!vendorId) {
                return this.error('Vendor ID is required', 401);
            }
            const startDate = context.event.queryStringParameters?.startDate ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = context.event.queryStringParameters?.endDate ||
                new Date().toISOString().split('T')[0];
            // Booking trends
            const bookingTrends = await (0, rds_connection_1.query)(`
        SELECT 
          DATE(booking_date) as date,
          COUNT(*) as bookings_count,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
        FROM bookings
        WHERE vendor_id = $1 
          AND booking_date >= $2 
          AND booking_date <= $3
        GROUP BY DATE(booking_date)
        ORDER BY date ASC
      `, [vendorId, startDate, endDate]);
            // Booking by time slot
            const bookingByTimeSlot = await (0, rds_connection_1.query)(`
        SELECT 
          CASE 
            WHEN EXTRACT(HOUR FROM booking_time) BETWEEN 6 AND 11 THEN 'Morning (6-11)'
            WHEN EXTRACT(HOUR FROM booking_time) BETWEEN 12 AND 17 THEN 'Afternoon (12-17)'
            WHEN EXTRACT(HOUR FROM booking_time) BETWEEN 18 AND 22 THEN 'Evening (18-22)'
            ELSE 'Night (22-6)'
          END as time_slot,
          COUNT(*) as bookings_count
        FROM bookings
        WHERE vendor_id = $1 
          AND status != 'cancelled'
          AND booking_date >= $2 
          AND booking_date <= $3
        GROUP BY time_slot
        ORDER BY bookings_count DESC
      `, [vendorId, startDate, endDate]);
            // Booking by day of week
            const bookingByDayOfWeek = await (0, rds_connection_1.query)(`
        SELECT 
          TO_CHAR(booking_date, 'Day') as day_name,
          EXTRACT(DOW FROM booking_date) as day_number,
          COUNT(*) as bookings_count
        FROM bookings
        WHERE vendor_id = $1 
          AND status != 'cancelled'
          AND booking_date >= $2 
          AND booking_date <= $3
        GROUP BY day_name, day_number
        ORDER BY day_number
      `, [vendorId, startDate, endDate]);
            // Cancellation analysis
            const cancellationAnalysis = await (0, rds_connection_1.query)(`
        SELECT 
          cancellation_reason,
          COUNT(*) as cancellation_count,
          AVG(EXTRACT(EPOCH FROM (cancelled_at - created_at))/3600) as avg_hours_before_cancellation
        FROM bookings
        WHERE vendor_id = $1 
          AND status = 'cancelled'
          AND booking_date >= $2 
          AND booking_date <= $3
        GROUP BY cancellation_reason
        ORDER BY cancellation_count DESC
      `, [vendorId, startDate, endDate]);
            // Service popularity
            const servicePopularity = await (0, rds_connection_1.query)(`
        SELECT 
          s.id,
          s.name,
          s.service_style,
          COUNT(b.id) as bookings_count,
          AVG(r.rating) as avg_rating,
          COUNT(r.id) as review_count
        FROM bookings b
        INNER JOIN services s ON b.service_id = s.id
        LEFT JOIN reviews r ON b.id = r.booking_id
        WHERE b.vendor_id = $1 
          AND b.status != 'cancelled'
          AND b.booking_date >= $2 
          AND b.booking_date <= $3
        GROUP BY s.id, s.name, s.service_style
        ORDER BY bookings_count DESC
        LIMIT 20
      `, [vendorId, startDate, endDate]);
            return this.success({
                period: { startDate, endDate },
                bookingTrends: bookingTrends.rows,
                bookingByTimeSlot: bookingByTimeSlot.rows,
                bookingByDayOfWeek: bookingByDayOfWeek.rows,
                cancellationAnalysis: cancellationAnalysis.rows,
                servicePopularity: servicePopularity.rows
            });
        }
        catch (error) {
            console.error('Error fetching booking analytics:', error);
            return this.error(error.message || 'Failed to fetch booking analytics', 500);
        }
    }
}
// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================
function registerVendorAnalyticsEndpoints(app) {
    const dashboardHandler = new GetDashboardAnalyticsHandler();
    const revenueHandler = new GetRevenueAnalyticsHandler();
    const bookingHandler = new GetBookingAnalyticsHandler();
    app.get('/vendor/analytics/dashboard', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await dashboardHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/analytics/revenue', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await revenueHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/analytics/bookings', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await bookingHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req) {
    return {
        pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
        queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
        body: req.body ? JSON.stringify(req.body) : null,
        headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
        requestContext: {
            authorizer: {
                claims: {
                    sub: req.header?.('x-user-id') || 'test-user'
                }
            }
        }
    };
}
function createLambdaContext() {
    return {};
}
//# sourceMappingURL=vendor-analytics.js.map