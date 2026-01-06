"use strict";
/**
 * ============================================================================
 * ADMIN DASHBOARD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Complete API endpoints for admin dashboard with:
 * - Platform-wide statistics
 * - Vendor management overview
 * - Revenue analytics
 * - User metrics
 * - System health
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDashboardEndpoints = adminDashboardEndpoints;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const repositories_1 = require("../lib/repositories");
const BASE_PATH = '/make-server-3dd53475';
/**
 * Register admin dashboard endpoints
 */
function adminDashboardEndpoints(app) {
    /**
     * Get comprehensive admin dashboard data
     * GET /make-server-3dd53475/admin/dashboard
     */
    app.get(`${BASE_PATH}/admin/dashboard`, async (c) => {
        try {
            const timeframe = c.req.query('timeframe') || 'today'; // today, week, month, all
            // Calculate date ranges
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            let dateFrom;
            if (timeframe === 'today') {
                dateFrom = today;
            }
            else if (timeframe === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                dateFrom = weekAgo.toISOString().split('T')[0];
            }
            else if (timeframe === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                dateFrom = monthAgo.toISOString().split('T')[0];
            }
            // Get repositories
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const pool = await (0, db_1.getDbClient)();
            // Get all data using direct SQL queries
            const allVendors = await vendorsRepo.findAll();
            const allCustomers = await customersRepo.findAll();
            const bookingsResult = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10000');
            const allBookings = bookingsResult.rows;
            const paymentsResult = await pool.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 10000');
            const allPayments = paymentsResult.rows;
            const ordersResult = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10000').catch(() => ({ rows: [] }));
            const allOrders = ordersResult.rows;
            // Filter by date if needed
            let filteredBookings = allBookings;
            let filteredPayments = allPayments;
            let filteredOrders = allOrders;
            if (dateFrom) {
                filteredBookings = allBookings.filter((b) => {
                    const bookingDate = b.booking_date || b.scheduled_date || b.created_at || '';
                    return bookingDate >= dateFrom;
                });
                filteredPayments = allPayments.filter((p) => {
                    const paymentDate = p.created_at || p.payment_date || '';
                    return paymentDate >= dateFrom;
                });
                filteredOrders = allOrders.filter((o) => {
                    const orderDate = o.created_at || '';
                    return orderDate >= dateFrom;
                });
            }
            // Calculate statistics
            const stats = {
                // Vendor stats
                totalVendors: allVendors.length,
                activeVendors: allVendors.filter((v) => v.is_active).length,
                pendingVendors: allVendors.filter((v) => v.status === 'pending' || v.status === 'under_review').length,
                approvedVendors: allVendors.filter((v) => v.status === 'approved').length,
                // Customer stats
                totalCustomers: allCustomers.length,
                activeCustomers: allCustomers.filter((c) => c.is_active).length,
                newCustomers: dateFrom
                    ? allCustomers.filter((c) => (c.created_at || '') >= dateFrom).length
                    : 0,
                // Booking stats
                totalBookings: filteredBookings.length,
                completedBookings: filteredBookings.filter((b) => b.status === 'completed').length,
                pendingBookings: filteredBookings.filter((b) => b.status === 'pending' || b.status === 'confirmed').length,
                cancelledBookings: filteredBookings.filter((b) => b.status === 'cancelled').length,
                // Revenue stats
                totalRevenue: filteredPayments
                    .filter((p) => p.status === 'completed' || p.status === 'success')
                    .reduce((sum, p) => sum + (p.amount || 0), 0),
                pendingRevenue: filteredPayments
                    .filter((p) => p.status === 'pending')
                    .reduce((sum, p) => sum + (p.amount || 0), 0),
                refundedAmount: filteredPayments
                    .filter((p) => p.status === 'refunded')
                    .reduce((sum, p) => sum + (p.amount || 0), 0),
                // Order stats
                totalOrders: filteredOrders.length,
                completedOrders: filteredOrders.filter((o) => o.order_status === 'completed').length,
                pendingOrders: filteredOrders.filter((o) => o.order_status === 'pending').length,
            };
            // Recent activity
            const recentBookings = filteredBookings
                .sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            })
                .slice(0, 10);
            const recentVendors = allVendors
                .sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            })
                .slice(0, 10);
            return (0, response_utils_1.sendSuccess)(c, {
                stats,
                recentBookings,
                recentVendors,
                timeframe,
                generatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Error fetching admin dashboard:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get platform health metrics
     * GET /make-server-3dd53475/admin/dashboard/health
     */
    app.get(`${BASE_PATH}/admin/dashboard/health`, async (c) => {
        try {
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const pool = await (0, db_1.getDbClient)();
            const vendors = await vendorsRepo.findAll();
            const customers = await customersRepo.findAll();
            const bookingsResult = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10000');
            const bookings = bookingsResult.rows;
            // Calculate health metrics
            const health = {
                vendors: {
                    total: vendors.length,
                    active: vendors.filter((v) => v.is_active).length,
                    inactive: vendors.filter((v) => v.is_active === false).length,
                },
                customers: {
                    total: customers.length,
                    active: customers.filter((c) => c.is_active).length,
                    inactive: customers.filter((c) => c.is_active === false).length,
                },
                bookings: {
                    total: bookings.length,
                    completed: bookings.filter((b) => b.status === 'completed').length,
                    active: bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress').length,
                    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
                },
                system: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                },
            };
            return (0, response_utils_1.sendSuccess)(c, health);
        }
        catch (error) {
            console.error('Error fetching platform health:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Admin dashboard endpoints registered');
}
//# sourceMappingURL=admin-dashboard-endpoints-sql.js.map