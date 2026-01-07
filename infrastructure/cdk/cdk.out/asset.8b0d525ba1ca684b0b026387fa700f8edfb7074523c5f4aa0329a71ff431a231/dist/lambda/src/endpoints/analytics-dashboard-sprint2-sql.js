"use strict";
/**
 * 📊 ADVANCED ANALYTICS DASHBOARD - SPRINT 2 (SQL-ONLY VERSION)
 * Phase 7E - Sprint 2: Advanced Analytics & Reporting
 * Date: December 15, 2024
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * This file implements comprehensive analytics features:
 * - Real-time analytics dashboard
 * - User behavior tracking
 * - Conversion funnel analysis
 * - Revenue analytics
 * - Service performance metrics
 * - Automated reports
 * - Custom report builder
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - All data now comes from SQL tables (bookings, customers, vendors, reviews)
 * - Analytics events stored in `platform_settings` or dedicated analytics table
 *
 * Date: 2025-01-27
 * Migration: Batch 7 - Complete KV to SQL Migration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalyticsDashboardSprint2SQL = registerAnalyticsDashboardSprint2SQL;
const response_utils_1 = require("./response-utils");
const bookings_1 = require("../lib/repositories/bookings");
const customers_1 = require("../lib/repositories/customers");
const vendors_1 = require("../lib/repositories/vendors");
const reviews_1 = require("../lib/repositories/reviews");
const db_1 = require("../lib/db");
function registerAnalyticsDashboardSprint2SQL(app) {
    console.log('✅ Registering Analytics Dashboard Sprint 2 (SQL-only)...');
    const BASE_PATH = "/make-server-3dd53475";
    const bookingsRepo = (0, bookings_1.getBookingsRepository)();
    const customersRepo = (0, customers_1.getCustomersRepository)();
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const reviewsRepo = (0, reviews_1.getReviewsRepository)();
    // ==========================================
    // REAL-TIME ANALYTICS
    // ==========================================
    /**
     * GET /analytics/realtime - Get real-time platform metrics
     */
    app.get(`${BASE_PATH}/analytics/realtime`, async (c) => {
        try {
            const now = new Date();
            const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
            const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
            const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            // Get recent bookings from SQL
            const bookingsPool = await (0, db_1.getDbClient)();
            const bookingsResult = await bookingsPool.query('SELECT * FROM bookings WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 1000', [last24Hours.toISOString()]);
            const recentBookings = bookingsResult.rows || [];
            // Get recent customers (active in last 5 minutes)
            const customersResult = await bookingsPool.query(`SELECT id, last_login_at, created_at FROM customers 
         WHERE last_login_at >= $1 OR created_at >= $1 
         ORDER BY last_login_at DESC NULLS LAST LIMIT 1000`, [last5Minutes.toISOString()]);
            const recentCustomers = customersResult.rows || [];
            // Get all vendors
            const vendorsResult = await bookingsPool.query('SELECT id FROM vendors WHERE is_active = true', []);
            const recentVendors = vendorsResult.rows || [];
            // Calculate active users
            const activeUsers = recentCustomers?.length || 0;
            // Bookings in last hour
            const recentBookingsCount = recentBookings?.filter((booking) => {
                const bookingDate = new Date(booking.created_at);
                return bookingDate >= lastHour;
            }).length || 0;
            // Calculate revenue per hour
            const recentRevenue = recentBookings
                ?.filter((booking) => {
                const bookingDate = new Date(booking.created_at);
                return bookingDate >= lastHour && booking.status !== 'cancelled';
            })
                .reduce((sum, booking) => sum + (parseFloat(booking.total_amount) || 0), 0) || 0;
            // Service popularity (bookings per service in last 24 hours)
            const servicePopularity = {};
            recentBookings?.forEach((booking) => {
                const bookingDate = new Date(booking.created_at);
                if (bookingDate >= last24Hours) {
                    const service = booking.service_type || 'unknown';
                    servicePopularity[service] = (servicePopularity[service] || 0) + 1;
                }
            });
            const topServices = Object.entries(servicePopularity)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([service, count]) => ({ service, count }));
            // Store real-time metrics for historical tracking (in platform_settings)
            const metricsKey = `analytics_realtime_${now.toISOString().split('T')[0]}`;
            const metricsPool = await (0, db_1.getDbClient)();
            // Get existing metrics
            const metricsResult = await metricsPool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', [metricsKey]);
            const metricsData = metricsResult.rows[0];
            const dailyMetrics = metricsData?.setting_value || { snapshots: [] };
            dailyMetrics.snapshots.push({
                timestamp: now.toISOString(),
                activeUsers,
                bookingsLastHour: recentBookingsCount,
                revenueLastHour: recentRevenue
            });
            // Keep only last 288 snapshots (24 hours at 5-minute intervals)
            if (dailyMetrics.snapshots.length > 288) {
                dailyMetrics.snapshots = dailyMetrics.snapshots.slice(-288);
            }
            // Update platform_settings
            await metricsPool.query(`INSERT INTO platform_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = $2, updated_at = $3`, [metricsKey, JSON.stringify(dailyMetrics), new Date().toISOString()]);
            return (0, response_utils_1.sendSuccess)(c, {
                realtime: {
                    activeUsers,
                    bookingsPerHour: recentBookingsCount,
                    revenuePerHour: recentRevenue,
                    topServices,
                    totalVendors: recentVendors?.length || 0,
                    totalCustomers: recentCustomers?.length || 0,
                    timestamp: now.toISOString()
                }
            });
        }
        catch (error) {
            console.error('Failed to fetch real-time analytics:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch analytics', 500);
        }
    });
    /**
     * GET /analytics/realtime/chart - Get real-time chart data for last 24 hours
     */
    app.get(`${BASE_PATH}/analytics/realtime/chart`, async (c) => {
        try {
            const now = new Date();
            const metricsKey = `analytics_realtime_${now.toISOString().split('T')[0]}`;
            const pool = await (0, db_1.getDbClient)();
            const metricsResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [metricsKey]);
            const metricsData = metricsResult.rows[0];
            const dailyMetrics = metricsData?.setting_value || { snapshots: [] };
            return (0, response_utils_1.sendSuccess)(c, {
                chartData: dailyMetrics.snapshots || [],
                dataPoints: dailyMetrics.snapshots.length
            });
        }
        catch (error) {
            return (0, response_utils_1.sendError)(c, 'Failed to fetch chart data', 500);
        }
    });
    // ==========================================
    // USER BEHAVIOR TRACKING
    // ==========================================
    /**
     * POST /analytics/track-event - Track user behavior event
     */
    app.post(`${BASE_PATH}/analytics/track-event`, async (c) => {
        try {
            const { userId, eventType, eventData, sessionId, timestamp } = await c.req.json();
            if (!eventType) {
                return (0, response_utils_1.sendError)(c, 'eventType is required', 400);
            }
            const event = {
                id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                session_id: sessionId,
                event_type: eventType,
                event_data: eventData,
                timestamp: timestamp || new Date().toISOString(),
                user_agent: c.req.header('user-agent'),
                ip_address: c.req.header('x-forwarded-for') || 'unknown'
            };
            // Store event in platform_settings (analytics_events array)
            const today = new Date().toISOString().split('T')[0];
            const aggregateKey = `analytics_events_${today}`;
            const pool = await (0, db_1.getDbClient)();
            const aggregatesResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [aggregateKey]);
            const aggregatesData = aggregatesResult.rows[0];
            const aggregates = aggregatesData?.setting_value || {
                events: [],
                eventCounts: {},
                userCounts: {}
            };
            aggregates.events.push(event.id);
            aggregates.eventCounts[eventType] = (aggregates.eventCounts[eventType] || 0) + 1;
            if (userId) {
                aggregates.userCounts[userId] = (aggregates.userCounts[userId] || 0) + 1;
            }
            // Store event details in events array
            if (!aggregates.eventDetails)
                aggregates.eventDetails = [];
            aggregates.eventDetails.push(event);
            await pool.query(`INSERT INTO platform_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = $2, updated_at = $3`, [aggregateKey, JSON.stringify(aggregates), new Date().toISOString()]);
            return (0, response_utils_1.sendSuccess)(c, { eventId: event.id });
        }
        catch (error) {
            console.error('Failed to track event:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to track event', 500);
        }
    });
    /**
     * GET /analytics/behavior/summary - Get user behavior summary
     */
    app.get(`${BASE_PATH}/analytics/behavior/summary`, async (c) => {
        try {
            const { startDate, endDate } = c.req.query();
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const eventsByType = {};
            const eventsByDay = {};
            const topUsers = {};
            // Aggregate events for date range
            const currentDate = new Date(start);
            while (currentDate <= end) {
                const dateKey = currentDate.toISOString().split('T')[0];
                const aggregateKey = `analytics_events_${dateKey}`;
                const pool = await (0, db_1.getDbClient)();
                const dayResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [aggregateKey]);
                const dayData = dayResult.rows[0] ? { setting_value: dayResult.rows[0].setting_value } : null;
                if (dayData?.setting_value) {
                    const dayDataValue = dayData.setting_value;
                    // Aggregate by event type
                    Object.entries(dayDataValue.eventCounts || {}).forEach(([type, count]) => {
                        eventsByType[type] = (eventsByType[type] || 0) + count;
                    });
                    // Aggregate by day
                    eventsByDay[dateKey] = dayDataValue.events?.length || 0;
                    // Aggregate by user
                    Object.entries(dayDataValue.userCounts || {}).forEach(([userId, count]) => {
                        topUsers[userId] = (topUsers[userId] || 0) + count;
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            // Sort top users
            const sortedUsers = Object.entries(topUsers)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([userId, count]) => ({ userId, eventCount: count }));
            return (0, response_utils_1.sendSuccess)(c, {
                summary: {
                    totalEvents: Object.values(eventsByType).reduce((sum, count) => sum + count, 0),
                    eventsByType,
                    eventsByDay,
                    topUsers: sortedUsers,
                    dateRange: { start: start.toISOString(), end: end.toISOString() }
                }
            });
        }
        catch (error) {
            console.error('Failed to fetch behavior summary:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch summary', 500);
        }
    });
    // ==========================================
    // CONVERSION FUNNEL ANALYSIS
    // ==========================================
    /**
     * GET /analytics/funnel/booking - Get booking conversion funnel
     */
    app.get(`${BASE_PATH}/analytics/funnel/booking`, async (c) => {
        try {
            const { startDate, endDate } = c.req.query();
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            // Define funnel stages
            const funnelStages = {
                serviceView: 0,
                serviceClick: 0,
                bookingStarted: 0,
                formCompleted: 0,
                paymentInitiated: 0,
                bookingConfirmed: 0
            };
            // Aggregate events for date range
            const currentDate = new Date(start);
            while (currentDate <= end) {
                const dateKey = currentDate.toISOString().split('T')[0];
                const aggregateKey = `analytics_events_${dateKey}`;
                const pool = await (0, db_1.getDbClient)();
                const dayResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [aggregateKey]);
                const dayData = dayResult.rows[0] ? { setting_value: dayResult.rows[0].setting_value } : null;
                if (dayData?.setting_value?.eventCounts) {
                    const eventCounts = dayData.setting_value.eventCounts;
                    funnelStages.serviceView += eventCounts['service_view'] || 0;
                    funnelStages.serviceClick += eventCounts['service_click'] || 0;
                    funnelStages.bookingStarted += eventCounts['booking_started'] || 0;
                    funnelStages.formCompleted += eventCounts['form_completed'] || 0;
                    funnelStages.paymentInitiated += eventCounts['payment_initiated'] || 0;
                    funnelStages.bookingConfirmed += eventCounts['booking_confirmed'] || 0;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            // Calculate conversion rates
            const conversionRates = {
                viewToClick: funnelStages.serviceView > 0
                    ? (funnelStages.serviceClick / funnelStages.serviceView * 100).toFixed(2)
                    : 0,
                clickToStart: funnelStages.serviceClick > 0
                    ? (funnelStages.bookingStarted / funnelStages.serviceClick * 100).toFixed(2)
                    : 0,
                startToComplete: funnelStages.bookingStarted > 0
                    ? (funnelStages.formCompleted / funnelStages.bookingStarted * 100).toFixed(2)
                    : 0,
                completeToPayment: funnelStages.formCompleted > 0
                    ? (funnelStages.paymentInitiated / funnelStages.formCompleted * 100).toFixed(2)
                    : 0,
                paymentToConfirmed: funnelStages.paymentInitiated > 0
                    ? (funnelStages.bookingConfirmed / funnelStages.paymentInitiated * 100).toFixed(2)
                    : 0,
                overallConversion: funnelStages.serviceView > 0
                    ? (funnelStages.bookingConfirmed / funnelStages.serviceView * 100).toFixed(2)
                    : 0
            };
            return (0, response_utils_1.sendSuccess)(c, {
                funnel: {
                    stages: funnelStages,
                    conversionRates,
                    dateRange: { start: start.toISOString(), end: end.toISOString() }
                }
            });
        }
        catch (error) {
            console.error('Failed to fetch funnel data:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch funnel', 500);
        }
    });
    /**
     * GET /analytics/funnel/dropoff - Identify funnel drop-off points
     */
    app.get(`${BASE_PATH}/analytics/funnel/dropoff`, async (c) => {
        try {
            const { startDate, endDate } = c.req.query();
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            // Define funnel stages
            const funnelStages = {
                serviceView: 0,
                serviceClick: 0,
                bookingStarted: 0,
                formCompleted: 0,
                paymentInitiated: 0,
                bookingConfirmed: 0
            };
            // Aggregate events for date range
            const currentDate = new Date(start);
            while (currentDate <= end) {
                const dateKey = currentDate.toISOString().split('T')[0];
                const aggregateKey = `analytics_events_${dateKey}`;
                const pool = await (0, db_1.getDbClient)();
                const dayResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [aggregateKey]);
                const dayData = dayResult.rows[0] ? { setting_value: dayResult.rows[0].setting_value } : null;
                if (dayData?.setting_value?.eventCounts) {
                    const eventCounts = dayData.setting_value.eventCounts;
                    funnelStages.serviceView += eventCounts['service_view'] || 0;
                    funnelStages.serviceClick += eventCounts['service_click'] || 0;
                    funnelStages.bookingStarted += eventCounts['booking_started'] || 0;
                    funnelStages.formCompleted += eventCounts['form_completed'] || 0;
                    funnelStages.paymentInitiated += eventCounts['payment_initiated'] || 0;
                    funnelStages.bookingConfirmed += eventCounts['booking_confirmed'] || 0;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            const stages = funnelStages;
            const dropoffs = [
                {
                    stage: 'View to Click',
                    dropped: stages.serviceView - stages.serviceClick,
                    dropRate: stages.serviceView > 0 ? ((stages.serviceView - stages.serviceClick) / stages.serviceView * 100).toFixed(2) : '0'
                },
                {
                    stage: 'Click to Start',
                    dropped: stages.serviceClick - stages.bookingStarted,
                    dropRate: stages.serviceClick > 0 ? ((stages.serviceClick - stages.bookingStarted) / stages.serviceClick * 100).toFixed(2) : '0'
                },
                {
                    stage: 'Start to Complete',
                    dropped: stages.bookingStarted - stages.formCompleted,
                    dropRate: stages.bookingStarted > 0 ? ((stages.bookingStarted - stages.formCompleted) / stages.bookingStarted * 100).toFixed(2) : '0'
                },
                {
                    stage: 'Complete to Payment',
                    dropped: stages.formCompleted - stages.paymentInitiated,
                    dropRate: stages.formCompleted > 0 ? ((stages.formCompleted - stages.paymentInitiated) / stages.formCompleted * 100).toFixed(2) : '0'
                },
                {
                    stage: 'Payment to Confirmed',
                    dropped: stages.paymentInitiated - stages.bookingConfirmed,
                    dropRate: stages.paymentInitiated > 0 ? ((stages.paymentInitiated - stages.bookingConfirmed) / stages.paymentInitiated * 100).toFixed(2) : '0'
                }
            ].sort((a, b) => parseFloat(b.dropRate) - parseFloat(a.dropRate));
            return (0, response_utils_1.sendSuccess)(c, {
                dropoffs,
                criticalDropoff: dropoffs[0]
            });
        }
        catch (error) {
            console.error('Failed to fetch dropoff data:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch dropoff data', 500);
        }
    });
    // ==========================================
    // REVENUE ANALYTICS
    // ==========================================
    /**
     * GET /analytics/revenue/overview - Get revenue overview
     */
    app.get(`${BASE_PATH}/analytics/revenue/overview`, async (c) => {
        try {
            const { period = 'month' } = c.req.query();
            const now = new Date();
            let startDate;
            switch (period) {
                case 'day':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
            // Get bookings from SQL
            const pool = await (0, db_1.getDbClient)();
            const bookingsResult = await pool.query('SELECT * FROM bookings WHERE created_at >= $1 AND status != $2', [startDate.toISOString(), 'cancelled']);
            const bookings = bookingsResult.rows || [];
            // Filter bookings in period
            const periodBookings = bookings || [];
            // Calculate metrics
            const totalRevenue = periodBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
            const totalCommission = periodBookings.reduce((sum, b) => sum + ((parseFloat(b.total_amount) || 0) * 0.15), 0); // Assuming 15% commission
            // Revenue by service category
            const revenueByCategory = {};
            periodBookings.forEach((booking) => {
                const category = booking.service_type || 'unknown';
                revenueByCategory[category] = (revenueByCategory[category] || 0) + (parseFloat(booking.total_amount) || 0);
            });
            // Top revenue categories
            const topCategories = Object.entries(revenueByCategory)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([category, revenue]) => ({
                category,
                revenue,
                percentage: ((revenue / totalRevenue) * 100).toFixed(2)
            }));
            // Revenue by vendor
            const revenueByVendor = {};
            periodBookings.forEach((booking) => {
                const vendorId = booking.vendor_id || 'unknown';
                revenueByVendor[vendorId] = (revenueByVendor[vendorId] || 0) + (parseFloat(booking.total_amount) || 0);
            });
            // Top revenue vendors
            const topVendors = Object.entries(revenueByVendor)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([vendorId, revenue]) => ({ vendorId, revenue }));
            // Calculate average transaction value
            const avgTransactionValue = periodBookings.length > 0
                ? totalRevenue / periodBookings.length
                : 0;
            // Revenue trend (daily breakdown)
            const revenueTrend = {};
            periodBookings.forEach((booking) => {
                const date = new Date(booking.created_at).toISOString().split('T')[0];
                revenueTrend[date] = (revenueTrend[date] || 0) + (parseFloat(booking.total_amount) || 0);
            });
            return (0, response_utils_1.sendSuccess)(c, {
                revenue: {
                    totalRevenue,
                    totalCommission,
                    totalBookings: periodBookings.length,
                    avgTransactionValue,
                    topCategories,
                    topVendors,
                    revenueTrend,
                    period
                }
            });
        }
        catch (error) {
            console.error('Failed to fetch revenue overview:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch revenue data', 500);
        }
    });
    /**
     * GET /analytics/revenue/growth - Get revenue growth analysis
     */
    app.get(`${BASE_PATH}/analytics/revenue/growth`, async (c) => {
        try {
            const now = new Date();
            // Current month
            const pool = await (0, db_1.getDbClient)();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthResult = await pool.query('SELECT * FROM bookings WHERE created_at >= $1 AND status != $2', [currentMonth.toISOString(), 'cancelled']);
            const currentMonthBookings = currentMonthResult.rows || [];
            const currentMonthRevenue = currentMonthBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
            // Previous month
            const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            const previousMonthResult = await pool.query('SELECT * FROM bookings WHERE created_at >= $1 AND created_at <= $2 AND status != $3', [previousMonth.toISOString(), previousMonthEnd.toISOString(), 'cancelled']);
            const previousMonthBookings = previousMonthResult.rows || [];
            const previousMonthRevenue = (previousMonthBookings || []).reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
            // Calculate growth
            const revenueGrowth = previousMonthRevenue > 0
                ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue * 100).toFixed(2)
                : '100';
            const bookingGrowth = (previousMonthBookings?.length || 0) > 0
                ? (((currentMonthBookings?.length || 0) - (previousMonthBookings?.length || 0)) / (previousMonthBookings?.length || 0) * 100).toFixed(2)
                : '100';
            return (0, response_utils_1.sendSuccess)(c, {
                growth: {
                    currentMonth: {
                        revenue: currentMonthRevenue,
                        bookings: currentMonthBookings?.length || 0
                    },
                    previousMonth: {
                        revenue: previousMonthRevenue,
                        bookings: previousMonthBookings?.length || 0
                    },
                    revenueGrowthPercent: parseFloat(revenueGrowth),
                    bookingGrowthPercent: parseFloat(bookingGrowth)
                }
            });
        }
        catch (error) {
            console.error('Failed to fetch growth data:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch growth data', 500);
        }
    });
    // ==========================================
    // SERVICE PERFORMANCE METRICS
    // ==========================================
    /**
     * GET /analytics/services/performance - Get service performance metrics
     */
    app.get(`${BASE_PATH}/analytics/services/performance`, async (c) => {
        try {
            // Get bookings from SQL
            const pool = await (0, db_1.getDbClient)();
            const bookingsResult = await pool.query('SELECT * FROM bookings LIMIT 10000');
            const bookings = bookingsResult.rows || [];
            // Get reviews from SQL
            const reviewsResult = await pool.query('SELECT * FROM reviews LIMIT 10000');
            const reviews = reviewsResult.rows || [];
            const serviceMetrics = {};
            // Calculate metrics per service
            bookings?.forEach((booking) => {
                const serviceType = booking.service_type || 'unknown';
                if (!serviceMetrics[serviceType]) {
                    serviceMetrics[serviceType] = {
                        totalBookings: 0,
                        completedBookings: 0,
                        cancelledBookings: 0,
                        totalRevenue: 0,
                        ratings: [],
                        responseTime: []
                    };
                }
                serviceMetrics[serviceType].totalBookings++;
                if (booking.status === 'completed') {
                    serviceMetrics[serviceType].completedBookings++;
                    serviceMetrics[serviceType].totalRevenue += parseFloat(booking.total_amount) || 0;
                }
                if (booking.status === 'cancelled') {
                    serviceMetrics[serviceType].cancelledBookings++;
                }
            });
            // Add ratings from reviews
            reviews?.forEach((review) => {
                const serviceType = review.service_type;
                if (serviceMetrics[serviceType]) {
                    serviceMetrics[serviceType].ratings.push(review.rating || 0);
                }
            });
            // Calculate aggregates
            const performanceData = Object.entries(serviceMetrics).map(([serviceType, metrics]) => {
                const avgRating = metrics.ratings.length > 0
                    ? metrics.ratings.reduce((sum, r) => sum + r, 0) / metrics.ratings.length
                    : 0;
                const completionRate = metrics.totalBookings > 0
                    ? (metrics.completedBookings / metrics.totalBookings * 100).toFixed(2)
                    : '0';
                const cancellationRate = metrics.totalBookings > 0
                    ? (metrics.cancelledBookings / metrics.totalBookings * 100).toFixed(2)
                    : '0';
                return {
                    serviceType,
                    totalBookings: metrics.totalBookings,
                    completedBookings: metrics.completedBookings,
                    cancelledBookings: metrics.cancelledBookings,
                    totalRevenue: metrics.totalRevenue,
                    avgRating: avgRating.toFixed(2),
                    completionRate: parseFloat(completionRate),
                    cancellationRate: parseFloat(cancellationRate),
                    reviewCount: metrics.ratings.length
                };
            }).sort((a, b) => b.totalRevenue - a.totalRevenue);
            return (0, response_utils_1.sendSuccess)(c, {
                services: performanceData,
                totalServices: performanceData.length
            });
        }
        catch (error) {
            console.error('Failed to fetch service performance:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch performance data', 500);
        }
    });
    // ==========================================
    // AUTOMATED REPORTS
    // ==========================================
    /**
     * POST /analytics/reports/generate - Generate automated report
     */
    app.post(`${BASE_PATH}/analytics/reports/generate`, async (c) => {
        try {
            const { reportType, period = 'month', format = 'json' } = await c.req.json();
            if (!reportType) {
                return (0, response_utils_1.sendError)(c, 'reportType is required', 400);
            }
            let reportData = {};
            // Generate report data based on type
            if (reportType === 'revenue') {
                const now = new Date();
                let startDate;
                switch (period) {
                    case 'day':
                        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        break;
                    case 'week':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                }
                const pool = await (0, db_1.getDbClient)();
                const periodResult = await pool.query('SELECT * FROM bookings WHERE created_at >= $1 AND status != $2', [startDate.toISOString(), 'cancelled']);
                const periodBookings = periodResult.rows || [];
                const totalRevenue = (periodBookings || []).reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
                reportData = {
                    success: true,
                    revenue: {
                        totalRevenue,
                        totalBookings: periodBookings?.length || 0,
                        period
                    }
                };
            }
            else if (reportType === 'service_performance') {
                const pool = await (0, db_1.getDbClient)();
                const bookingsResult = await pool.query('SELECT * FROM bookings LIMIT 10000');
                const bookings = bookingsResult.rows || [];
                const reviewsResult = await pool.query('SELECT * FROM reviews LIMIT 10000');
                const reviews = reviewsResult.rows || [];
                const serviceMetrics = {};
                bookings?.forEach((booking) => {
                    const serviceType = booking.service_type || 'unknown';
                    if (!serviceMetrics[serviceType]) {
                        serviceMetrics[serviceType] = {
                            totalBookings: 0,
                            completedBookings: 0,
                            totalRevenue: 0,
                            ratings: []
                        };
                    }
                    serviceMetrics[serviceType].totalBookings++;
                    if (booking.status === 'completed') {
                        serviceMetrics[serviceType].completedBookings++;
                        serviceMetrics[serviceType].totalRevenue += parseFloat(booking.total_amount) || 0;
                    }
                });
                reviews?.forEach((review) => {
                    const serviceType = review.service_type;
                    if (serviceMetrics[serviceType]) {
                        serviceMetrics[serviceType].ratings.push(review.rating || 0);
                    }
                });
                const performanceData = Object.entries(serviceMetrics).map(([serviceType, metrics]) => ({
                    serviceType,
                    totalBookings: metrics.totalBookings,
                    completedBookings: metrics.completedBookings,
                    totalRevenue: metrics.totalRevenue,
                    avgRating: metrics.ratings.length > 0
                        ? (metrics.ratings.reduce((sum, r) => sum + r, 0) / metrics.ratings.length).toFixed(2)
                        : 0
                }));
                reportData = {
                    success: true,
                    services: performanceData
                };
            }
            else if (reportType === 'user_behavior') {
                const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endDate = new Date();
                const eventsByType = {};
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const dateKey = currentDate.toISOString().split('T')[0];
                    const aggregateKey = `analytics_events_${dateKey}`;
                    const pool = await (0, db_1.getDbClient)();
                    const dayResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [aggregateKey]);
                    const dayData = dayResult.rows[0] ? { setting_value: dayResult.rows[0].setting_value } : null;
                    if (dayData?.setting_value?.eventCounts) {
                        Object.entries(dayData.setting_value.eventCounts).forEach(([type, count]) => {
                            eventsByType[type] = (eventsByType[type] || 0) + count;
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                reportData = {
                    success: true,
                    summary: {
                        totalEvents: Object.values(eventsByType).reduce((sum, count) => sum + count, 0),
                        eventsByType
                    }
                };
            }
            else if (reportType === 'conversion') {
                const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endDate = new Date();
                const funnelStages = {
                    serviceView: 0,
                    serviceClick: 0,
                    bookingStarted: 0,
                    formCompleted: 0,
                    paymentInitiated: 0,
                    bookingConfirmed: 0
                };
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const dateKey = currentDate.toISOString().split('T')[0];
                    const aggregateKey = `analytics_events_${dateKey}`;
                    const pool = await (0, db_1.getDbClient)();
                    const dayResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [aggregateKey]);
                    const dayData = dayResult.rows[0] ? { setting_value: dayResult.rows[0].setting_value } : null;
                    if (dayData?.setting_value?.eventCounts) {
                        const eventCounts = dayData.setting_value.eventCounts;
                        funnelStages.serviceView += eventCounts['service_view'] || 0;
                        funnelStages.serviceClick += eventCounts['service_click'] || 0;
                        funnelStages.bookingStarted += eventCounts['booking_started'] || 0;
                        funnelStages.formCompleted += eventCounts['form_completed'] || 0;
                        funnelStages.paymentInitiated += eventCounts['payment_initiated'] || 0;
                        funnelStages.bookingConfirmed += eventCounts['booking_confirmed'] || 0;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                const overallConversion = funnelStages.serviceView > 0
                    ? (funnelStages.bookingConfirmed / funnelStages.serviceView * 100).toFixed(2)
                    : 0;
                reportData = {
                    success: true,
                    funnel: {
                        stages: funnelStages,
                        overallConversion
                    }
                };
            }
            else {
                return (0, response_utils_1.sendError)(c, 'Invalid report type', 400);
            }
            const report = {
                id: `report_${Date.now()}`,
                reportType,
                period,
                generatedAt: new Date().toISOString(),
                data: reportData,
                format
            };
            // Store report in platform_settings
            const pool = await (0, db_1.getDbClient)();
            const reportKey = `analytics_report_${report.id}`;
            await pool.query(`INSERT INTO platform_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = $2, updated_at = $3`, [reportKey, JSON.stringify(report), new Date().toISOString()]);
            return (0, response_utils_1.sendSuccess)(c, { report });
        }
        catch (error) {
            console.error('Failed to generate report:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to generate report', 500);
        }
    });
    /**
     * GET /analytics/reports/:reportId - Get specific report
     */
    app.get(`${BASE_PATH}/analytics/reports/:reportId`, async (c) => {
        try {
            const reportId = c.req.param('reportId');
            const reportKey = `analytics_report_${reportId}`;
            const pool = await (0, db_1.getDbClient)();
            const reportResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1', [reportKey]);
            const reportData = reportResult.rows[0] ? { setting_value: reportResult.rows[0].setting_value } : null;
            if (!reportData) {
                return (0, response_utils_1.sendError)(c, 'Report not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, { report: reportData.setting_value });
        }
        catch (error) {
            console.error('Failed to fetch report:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to fetch report', 500);
        }
    });
    /**
     * GET /analytics/reports - List all reports
     */
    app.get(`${BASE_PATH}/analytics/reports`, async (c) => {
        try {
            const pool = await (0, db_1.getDbClient)();
            const reportsResult = await pool.query("SELECT setting_key, setting_value FROM platform_settings WHERE setting_key LIKE 'analytics_report_%'", []);
            const reportsData = reportsResult.rows || [];
            const reportList = (reportsData || []).map((item) => {
                const report = item.setting_value;
                return {
                    id: report.id,
                    reportType: report.reportType,
                    period: report.period,
                    generatedAt: report.generatedAt,
                    format: report.format
                };
            });
            return (0, response_utils_1.sendSuccess)(c, {
                reports: reportList,
                count: reportList.length
            });
        }
        catch (error) {
            console.error('Failed to list reports:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to list reports', 500);
        }
    });
    // ==========================================
    // CUSTOM REPORT BUILDER
    // ==========================================
    /**
     * POST /analytics/custom-report - Build custom report with filters
     */
    app.post(`${BASE_PATH}/analytics/custom-report`, async (c) => {
        try {
            const { metrics, dimensions, filters, dateRange, groupBy } = await c.req.json();
            if (!metrics || metrics.length === 0) {
                return (0, response_utils_1.sendError)(c, 'At least one metric is required', 400);
            }
            // Get all bookings from SQL
            const pool = await (0, db_1.getDbClient)();
            let query = 'SELECT * FROM bookings WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            // Apply date range
            if (dateRange) {
                query += ` AND created_at >= $${paramIndex} AND created_at <= $${paramIndex + 1}`;
                params.push(new Date(dateRange.start).toISOString());
                params.push(new Date(dateRange.end).toISOString());
                paramIndex += 2;
            }
            query += ' LIMIT 10000';
            const bookingsResult = await pool.query(query, params);
            const bookings = bookingsResult.rows || [];
            let data = bookings || [];
            // Apply filters
            if (filters) {
                if (filters.serviceType) {
                    data = data.filter((d) => d.service_type === filters.serviceType);
                }
                if (filters.status) {
                    data = data.filter((d) => d.status === filters.status);
                }
                if (filters.vendorId) {
                    data = data.filter((d) => d.vendor_id === filters.vendorId);
                }
            }
            // Calculate metrics
            const results = {};
            if (metrics.includes('count')) {
                results.count = data.length;
            }
            if (metrics.includes('revenue')) {
                results.revenue = data.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
            }
            if (metrics.includes('avgValue')) {
                const total = data.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
                results.avgValue = data.length > 0 ? total / data.length : 0;
            }
            // Group by dimension
            if (groupBy) {
                const grouped = {};
                data.forEach((item) => {
                    const key = item[groupBy] || 'unknown';
                    if (!grouped[key]) {
                        grouped[key] = [];
                    }
                    grouped[key].push(item);
                });
                results.grouped = Object.entries(grouped).map(([key, items]) => ({
                    [groupBy]: key,
                    count: items.length,
                    revenue: items.reduce((sum, i) => sum + (parseFloat(i.total_amount) || 0), 0)
                }));
            }
            const customReport = {
                id: `custom_report_${Date.now()}`,
                metrics,
                dimensions,
                filters,
                dateRange,
                groupBy,
                results,
                generatedAt: new Date().toISOString()
            };
            // Store custom report in platform_settings
            const reportKey = `analytics_custom_report_${customReport.id}`;
            await pool.query(`INSERT INTO platform_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = $2, updated_at = $3`, [reportKey, JSON.stringify(customReport), new Date().toISOString()]);
            return (0, response_utils_1.sendSuccess)(c, { report: customReport });
        }
        catch (error) {
            console.error('Failed to build custom report:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to build report', 500);
        }
    });
}
//# sourceMappingURL=analytics-dashboard-sprint2-sql.js.map