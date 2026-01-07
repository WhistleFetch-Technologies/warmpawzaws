"use strict";
/**
 * ============================================================================
 * REPORTS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles report generation and management:
 * - Generate reports (revenue, bookings, vendors, customers)
 * - Save report configurations
 * - Export reports
 *
 * Migrated from: supabase/functions/make-server-3dd53475/report-builder-endpoints-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReportEndpoints = registerReportEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function getDateRange(dateRange) {
    const endDate = new Date();
    const startDate = new Date();
    switch (dateRange) {
        case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(startDate.getDate() - 90);
            break;
        case '1y':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        default:
            startDate.setDate(startDate.getDate() - 30);
    }
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
}
async function generateRevenueReport(startDate, endDate, groupBy, filters, metrics) {
    const revenueQuery = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_revenue,
      SUM(commission_amount) as total_commission,
      SUM(net_amount) as net_revenue
    FROM payments
    WHERE created_at >= $1 AND created_at <= $2
    AND payment_status = 'completed'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
    const result = await (0, rds_connection_1.query)(revenueQuery, [startDate, endDate]);
    return result.rows;
}
async function generateBookingsReport(startDate, endDate, groupBy, filters, metrics) {
    const bookingsQuery = `
    SELECT 
      DATE(booking_date) as date,
      COUNT(*) as total_bookings,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
      SUM(total_amount) as total_revenue
    FROM bookings
    WHERE booking_date >= $1 AND booking_date <= $2
    GROUP BY DATE(booking_date)
    ORDER BY date ASC
  `;
    const result = await (0, rds_connection_1.query)(bookingsQuery, [startDate, endDate]);
    return result.rows;
}
async function generateVendorsReport(startDate, endDate, groupBy, filters, metrics) {
    const vendorsQuery = `
    SELECT 
      v.id,
      v.business_name,
      v.city,
      v.status,
      COUNT(DISTINCT b.id) as total_bookings,
      SUM(b.total_amount) as total_revenue,
      AVG(r.rating) as avg_rating
    FROM vendors v
    LEFT JOIN bookings b ON v.id = b.vendor_id AND b.booking_date >= $1 AND b.booking_date <= $2
    LEFT JOIN reviews r ON v.id = r.vendor_id
    GROUP BY v.id, v.business_name, v.city, v.status
    ORDER BY total_revenue DESC NULLS LAST
  `;
    const result = await (0, rds_connection_1.query)(vendorsQuery, [startDate, endDate]);
    return result.rows;
}
async function generateCustomersReport(startDate, endDate, groupBy, filters, metrics) {
    const customersQuery = `
    SELECT 
      c.id,
      c.name,
      c.phone,
      c.city,
      COUNT(DISTINCT b.id) as total_bookings,
      SUM(b.total_amount) as total_spent,
      MAX(b.booking_date) as last_booking_date
    FROM customers c
    LEFT JOIN bookings b ON c.id = b.customer_id AND b.booking_date >= $1 AND b.booking_date <= $2
    GROUP BY c.id, c.name, c.phone, c.city
    HAVING COUNT(DISTINCT b.id) > 0
    ORDER BY total_spent DESC NULLS LAST
  `;
    const result = await (0, rds_connection_1.query)(customersQuery, [startDate, endDate]);
    return result.rows;
}
async function generateCustomReport(startDate, endDate, groupBy, filters, metrics) {
    // Custom report generation based on filters and metrics
    // This is a simplified version - can be extended
    return generateRevenueReport(startDate, endDate, groupBy, filters, metrics);
}
function registerReportEndpoints(app) {
    /**
     * GET /admin/reports
     * Get all saved reports
     */
    app.get("/admin/reports", async (c) => {
        try {
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'reports' });
            const reports = settings.length > 0 ? settings[0].setting_value : [];
            const validReports = Array.isArray(reports) ? reports.filter((r) => r.id && !r.id.includes(':template')) : [];
            return c.json({
                success: true,
                reports: validReports,
            });
        }
        catch (error) {
            console.error('Error fetching reports:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /admin/reports/generate
     * Generate report data
     */
    app.post("/admin/reports/generate", async (c) => {
        try {
            const reportConfig = await c.req.json();
            const { reportType, dateRange, groupBy, filters, metrics } = reportConfig;
            const { startDate, endDate } = getDateRange(dateRange || '30d');
            let data = [];
            switch (reportType) {
                case 'revenue':
                    data = await generateRevenueReport(startDate, endDate, groupBy, filters, metrics);
                    break;
                case 'bookings':
                    data = await generateBookingsReport(startDate, endDate, groupBy, filters, metrics);
                    break;
                case 'vendors':
                    data = await generateVendorsReport(startDate, endDate, groupBy, filters, metrics);
                    break;
                case 'customers':
                    data = await generateCustomersReport(startDate, endDate, groupBy, filters, metrics);
                    break;
                case 'custom':
                    data = await generateCustomReport(startDate, endDate, groupBy, filters, metrics);
                    break;
                default:
                    data = await generateRevenueReport(startDate, endDate, groupBy, filters, metrics);
            }
            return c.json({
                success: true,
                data,
                reportType,
                dateRange: { startDate, endDate },
                totalRows: data.length,
            });
        }
        catch (error) {
            console.error('Error generating report:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /admin/reports/templates
     * Get report templates
     */
    app.get("/admin/reports/templates", async (c) => {
        try {
            const templates = [
                {
                    id: 'revenue',
                    name: 'Revenue Report',
                    description: 'Revenue breakdown by date',
                    reportType: 'revenue',
                },
                {
                    id: 'bookings',
                    name: 'Bookings Report',
                    description: 'Booking statistics and trends',
                    reportType: 'bookings',
                },
                {
                    id: 'vendors',
                    name: 'Vendors Report',
                    description: 'Vendor performance metrics',
                    reportType: 'vendors',
                },
                {
                    id: 'customers',
                    name: 'Customers Report',
                    description: 'Customer activity and spending',
                    reportType: 'customers',
                },
            ];
            return c.json({
                success: true,
                templates,
            });
        }
        catch (error) {
            console.error('Error fetching templates:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=reports.js.map