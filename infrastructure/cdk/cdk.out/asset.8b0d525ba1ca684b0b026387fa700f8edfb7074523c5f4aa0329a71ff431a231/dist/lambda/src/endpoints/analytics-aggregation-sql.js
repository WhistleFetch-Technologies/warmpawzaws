"use strict";
/**
 * ANALYTICS AGGREGATION ENDPOINTS - SQL VERSION
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL repositories
 *
 * Enterprise-grade analytics endpoints:
 * - Real-time KPI metrics
 * - Revenue analytics with multiple grouping
 * - Cohort analysis
 * - Conversion funnel metrics
 * - Vendor performance metrics
 * - Category insights
 * - Geographic distribution
 * - AI-powered predictions
 *
 * Date: 2025-01-27
 * Migration: KV to SQL (8 KV operations → 0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsAggregationEndpoints = analyticsAggregationEndpoints;
const bookings_1 = require("../lib/repositories/bookings");
const vendors_1 = require("../lib/repositories/vendors");
const customers_1 = require("../lib/repositories/customers");
const db_1 = require("../lib/db");
const response_utils_1 = require("./response-utils");
function analyticsAggregationEndpoints(app) {
    const bookingsRepo = (0, bookings_1.getBookingsRepository)();
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const customersRepo = (0, customers_1.getCustomersRepository)();
    /**
     * GET /admin/analytics/kpi
     * Get real-time KPI metrics with enterprise-grade insights
     */
    app.get("/make-server-3dd53475/admin/analytics/kpi", async (c) => {
        try {
            const range = c.req.query('range') || '7d';
            // Calculate date range
            const { startDate, endDate } = getDateRange(range);
            // Aggregate KPIs in parallel for maximum performance
            const [totalGMV, totalRevenue, activeCustomers, activeVendors, totalBookings, totalOrders, avgOrderValue, commissionEarned, conversionRate, churnRate, customerLTV, customerCAC, retentionRate, repeatPurchaseRate] = await Promise.all([
                calculateGMV(startDate, endDate),
                calculateRevenue(startDate, endDate),
                countActiveCustomers(startDate, endDate),
                countActiveVendors(startDate, endDate),
                countBookings(startDate, endDate),
                countOrders(startDate, endDate),
                calculateAOV(startDate, endDate),
                calculateCommission(startDate, endDate),
                calculateConversionRate(startDate, endDate),
                calculateChurnRate(startDate, endDate),
                calculateCustomerLTV(startDate, endDate),
                calculateCustomerCAC(startDate, endDate),
                calculateRetentionRate(startDate, endDate),
                calculateRepeatPurchaseRate(startDate, endDate)
            ]);
            const kpiData = {
                totalGMV,
                totalRevenue,
                activeCustomers,
                activeVendors,
                totalBookings,
                totalOrders,
                avgOrderValue,
                commissionEarned,
                conversionRate,
                churnRate,
                customerLTV,
                customerCAC,
                retentionRate,
                repeatPurchaseRate,
                profitMargin: totalRevenue > 0 ? ((commissionEarned / totalRevenue) * 100) : 0,
                timestamp: Date.now()
            };
            return (0, response_utils_1.sendSuccess)(c, { data: kpiData });
        }
        catch (error) {
            console.error('Analytics KPI Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/analytics/revenue
     * Get revenue analytics with multiple grouping options
     */
    app.get("/make-server-3dd53475/admin/analytics/revenue", async (c) => {
        try {
            const range = c.req.query('range') || '7d';
            const groupBy = c.req.query('groupBy') || 'day';
            const { startDate, endDate } = getDateRange(range);
            let revenueData;
            if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
                revenueData = await getRevenueByTimePeriod(startDate, endDate, groupBy);
            }
            else if (groupBy === 'category') {
                revenueData = await getRevenueByCategory(startDate, endDate);
            }
            else if (groupBy === 'vendor') {
                revenueData = await getRevenueByVendor(startDate, endDate);
            }
            else if (groupBy === 'service') {
                revenueData = await getRevenueByService(startDate, endDate);
            }
            return (0, response_utils_1.sendSuccess)(c, { data: revenueData });
        }
        catch (error) {
            console.error('Revenue Analytics Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/analytics/cohort
     * Get cohort analysis for customer retention
     */
    app.get("/make-server-3dd53475/admin/analytics/cohort", async (c) => {
        try {
            const period = c.req.query('period') || 'month';
            const cohortData = await getCohortAnalysis(period);
            return (0, response_utils_1.sendSuccess)(c, { data: cohortData });
        }
        catch (error) {
            console.error('Cohort Analysis Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/analytics/funnel
     * Get conversion funnel metrics
     */
    app.get("/make-server-3dd53475/admin/analytics/funnel", async (c) => {
        try {
            const range = c.req.query('range') || '7d';
            const { startDate, endDate } = getDateRange(range);
            const funnelData = await getFunnelMetrics(startDate, endDate);
            return (0, response_utils_1.sendSuccess)(c, { data: funnelData });
        }
        catch (error) {
            console.error('Funnel Analytics Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/analytics/vendor-performance
     * Get detailed vendor performance metrics
     */
    app.get("/make-server-3dd53475/admin/analytics/vendor-performance", async (c) => {
        try {
            const range = c.req.query('range') || '30d';
            const { startDate, endDate } = getDateRange(range);
            const vendorMetrics = await getVendorPerformanceMetrics(startDate, endDate);
            return (0, response_utils_1.sendSuccess)(c, { data: vendorMetrics });
        }
        catch (error) {
            console.error('Vendor Performance Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/analytics/category-insights
     * Get category-wise performance insights
     */
    app.get("/make-server-3dd53475/admin/analytics/category-insights", async (c) => {
        try {
            const range = c.req.query('range') || '30d';
            const { startDate, endDate } = getDateRange(range);
            const categoryInsights = await getCategoryInsights(startDate, endDate);
            return (0, response_utils_1.sendSuccess)(c, { data: categoryInsights });
        }
        catch (error) {
            console.error('Category Insights Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/analytics/geographic
     * Get geographic distribution of business
     */
    app.get("/make-server-3dd53475/admin/analytics/geographic", async (c) => {
        try {
            const range = c.req.query('range') || '30d';
            const { startDate, endDate } = getDateRange(range);
            const geoData = await getGeographicDistribution(startDate, endDate);
            return (0, response_utils_1.sendSuccess)(c, { data: geoData });
        }
        catch (error) {
            console.error('Geographic Analytics Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/analytics/predictions
     * Get AI-powered predictions and forecasts
     */
    app.get("/make-server-3dd53475/admin/analytics/predictions", async (c) => {
        try {
            const type = c.req.query('type') || 'revenue'; // revenue, bookings, churn
            const predictions = await generatePredictions(type);
            return (0, response_utils_1.sendSuccess)(c, { data: predictions });
        }
        catch (error) {
            console.error('Predictions Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    async function calculateGMV(startDate, endDate) {
        const bookings = await getBookingsInRange(startDate, endDate);
        const orders = await getOrdersInRange(startDate, endDate);
        const bookingGMV = bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount || 0)), 0);
        const orderGMV = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount || 0)), 0);
        return Math.round(bookingGMV + orderGMV);
    }
    async function calculateRevenue(startDate, endDate) {
        const transactions = await getTransactionsInRange(startDate, endDate);
        return Math.round(transactions.reduce((sum, t) => sum + (parseFloat(t.platform_commission || 0)), 0));
    }
    async function countActiveCustomers(startDate, endDate) {
        try {
            // ✅ SQL: Get unique customers from bookings
            const bookings = await getBookingsInRange(startDate, endDate);
            const uniqueCustomers = new Set(bookings.map((b) => b.customer_id).filter(Boolean));
            return uniqueCustomers.size;
        }
        catch (error) {
            console.error('Error counting active customers:', error);
            return 0;
        }
    }
    async function countActiveVendors(startDate, endDate) {
        try {
            // ✅ SQL: Get unique vendors from bookings
            const bookings = await getBookingsInRange(startDate, endDate);
            const uniqueVendors = new Set(bookings.map((b) => b.vendor_id).filter(Boolean));
            return uniqueVendors.size;
        }
        catch (error) {
            console.error('Error counting active vendors:', error);
            return 0;
        }
    }
    async function countBookings(startDate, endDate) {
        const bookings = await getBookingsInRange(startDate, endDate);
        return bookings.length;
    }
    async function countOrders(startDate, endDate) {
        const orders = await getOrdersInRange(startDate, endDate);
        return orders.length;
    }
    async function calculateAOV(startDate, endDate) {
        const orders = await getOrdersInRange(startDate, endDate);
        if (orders.length === 0)
            return 0;
        const total = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount || 0)), 0);
        return Math.round(total / orders.length);
    }
    async function calculateCommission(startDate, endDate) {
        const transactions = await getTransactionsInRange(startDate, endDate);
        return Math.round(transactions.reduce((sum, t) => sum + (parseFloat(t.platform_commission || 0)), 0));
    }
    async function calculateConversionRate(startDate, endDate) {
        const visitors = await getVisitorsInRange(startDate, endDate);
        const conversions = await getConversionsInRange(startDate, endDate);
        if (visitors === 0)
            return 0;
        return Math.round((conversions / visitors) * 100 * 100) / 100;
    }
    async function calculateChurnRate(startDate, endDate) {
        const previousPeriod = getPreviousPeriod(startDate, endDate);
        const previousActive = await countActiveCustomers(previousPeriod.start, previousPeriod.end);
        const currentActive = await countActiveCustomers(startDate, endDate);
        const churned = previousActive - currentActive;
        if (previousActive === 0)
            return 0;
        return Math.round((churned / previousActive) * 100 * 100) / 100;
    }
    async function calculateCustomerLTV(startDate, endDate) {
        try {
            const bookings = await getBookingsInRange(startDate, endDate);
            const orders = await getOrdersInRange(startDate, endDate);
            if (bookings.length === 0 && orders.length === 0)
                return 0;
            const totalValue = bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount || 0)), 0) +
                orders.reduce((sum, o) => sum + (parseFloat(o.total_amount || 0)), 0);
            const uniqueCustomers = new Set([
                ...bookings.map(b => b.customer_id).filter(Boolean),
                ...orders.map(o => o.customer_id).filter(Boolean)
            ]);
            return uniqueCustomers.size > 0 ? Math.round(totalValue / uniqueCustomers.size) : 0;
        }
        catch (error) {
            console.error('Error calculating LTV:', error);
            return 0;
        }
    }
    async function calculateCustomerCAC(startDate, endDate) {
        // Simplified CAC - in production, pull from marketing spend
        const marketingSpend = 50000; // Mock value - should come from marketing budget
        const newCustomers = await countActiveCustomers(startDate, endDate);
        if (newCustomers === 0)
            return 0;
        return Math.round(marketingSpend / newCustomers);
    }
    async function calculateRetentionRate(startDate, endDate) {
        const previousPeriod = getPreviousPeriod(startDate, endDate);
        const previousActive = await countActiveCustomers(previousPeriod.start, previousPeriod.end);
        const currentActive = await countActiveCustomers(startDate, endDate);
        if (previousActive === 0)
            return 0;
        return Math.round((currentActive / previousActive) * 100 * 100) / 100;
    }
    async function calculateRepeatPurchaseRate(startDate, endDate) {
        const bookings = await getBookingsInRange(startDate, endDate);
        const orders = await getOrdersInRange(startDate, endDate);
        const customerPurchases = new Map();
        bookings.forEach(b => {
            const customerId = b.customer_id;
            if (customerId) {
                const count = customerPurchases.get(customerId) || 0;
                customerPurchases.set(customerId, count + 1);
            }
        });
        orders.forEach(o => {
            const customerId = o.customer_id;
            if (customerId) {
                const count = customerPurchases.get(customerId) || 0;
                customerPurchases.set(customerId, count + 1);
            }
        });
        const repeatCustomers = Array.from(customerPurchases.values()).filter(count => count > 1).length;
        const totalCustomers = customerPurchases.size;
        if (totalCustomers === 0)
            return 0;
        return Math.round((repeatCustomers / totalCustomers) * 100 * 100) / 100;
    }
    function getDateRange(range) {
        const endDate = new Date();
        let startDate = new Date();
        switch (range) {
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                break;
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
                startDate.setDate(startDate.getDate() - 7);
        }
        return {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        };
    }
    async function getBookingsInRange(start, end) {
        // ✅ SQL: Get bookings from bookings table
        try {
            const bookings = await (0, db_1.executeRaw)('SELECT * FROM bookings WHERE created_at >= $1 AND created_at <= $2', [start, end]);
            return bookings || [];
        }
        catch (error) {
            console.error('Error fetching bookings:', error);
            return [];
        }
    }
    async function getOrdersInRange(start, end) {
        // ✅ SQL: Get orders from orders table
        try {
            const orders = await (0, db_1.executeRaw)('SELECT * FROM orders WHERE created_at >= $1 AND created_at <= $2', [start, end]);
            return orders || [];
        }
        catch (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
    }
    async function getTransactionsInRange(start, end) {
        // ✅ SQL: Get transactions from payments/transactions table
        try {
            const transactions = await (0, db_1.executeRaw)('SELECT * FROM payments WHERE created_at >= $1 AND created_at <= $2 AND status = $3', [start, end, 'completed']);
            return transactions || [];
        }
        catch (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
    }
    async function getVisitorsInRange(start, end) {
        // Mock implementation - in production, integrate with analytics service
        return 10000;
    }
    async function getConversionsInRange(start, end) {
        const bookings = await getBookingsInRange(start, end);
        const orders = await getOrdersInRange(start, end);
        return bookings.length + orders.length;
    }
    async function getCustomerBookings(customerId) {
        // ✅ SQL: Get customer bookings
        try {
            return await bookingsRepo.findByCustomer(customerId);
        }
        catch (error) {
            console.error('Error fetching customer bookings:', error);
            return [];
        }
    }
    async function getCustomerOrders(customerId) {
        // ✅ SQL: Get customer orders
        try {
            const orders = await (0, db_1.selectQuery)('orders', { customer_id: customerId });
            return orders || [];
        }
        catch (error) {
            console.error('Error fetching customer orders:', error);
            return [];
        }
    }
    function getPreviousPeriod(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diff = endDate.getTime() - startDate.getTime();
        return {
            start: new Date(startDate.getTime() - diff).toISOString(),
            end: startDate.toISOString()
        };
    }
    async function getRevenueByTimePeriod(start, end, period) {
        const transactions = await getTransactionsInRange(start, end);
        const grouped = {};
        transactions.forEach((t) => {
            const date = new Date(t.created_at || t.paid_at);
            let key;
            if (period === 'day') {
                key = date.toISOString().split('T')[0];
            }
            else if (period === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            }
            else if (period === 'month') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }
            else {
                key = date.toISOString().split('T')[0];
            }
            if (!grouped[key]) {
                grouped[key] = { revenue: 0, commission: 0, count: 0 };
            }
            grouped[key].revenue += parseFloat(t.amount || 0);
            grouped[key].commission += parseFloat(t.platform_commission || 0);
            grouped[key].count += 1;
        });
        return Object.entries(grouped).map(([date, data]) => ({
            date,
            revenue: Math.round(data.revenue),
            commission: Math.round(data.commission),
            count: data.count
        })).sort((a, b) => a.date.localeCompare(b.date));
    }
    async function getRevenueByCategory(start, end) {
        const bookings = await getBookingsInRange(start, end);
        const orders = await getOrdersInRange(start, end);
        const categoryRevenue = {};
        bookings.forEach((b) => {
            const category = b.service_type || b.category || 'Other';
            if (!categoryRevenue[category]) {
                categoryRevenue[category] = { revenue: 0, bookings: 0, commission: 0 };
            }
            categoryRevenue[category].revenue += parseFloat(b.total_amount || 0);
            categoryRevenue[category].bookings += 1;
            categoryRevenue[category].commission += parseFloat(b.platform_fee || (b.total_amount * 0.1) || 0);
        });
        orders.forEach((o) => {
            const category = o.category || 'E-Commerce';
            if (!categoryRevenue[category]) {
                categoryRevenue[category] = { revenue: 0, bookings: 0, commission: 0 };
            }
            categoryRevenue[category].revenue += parseFloat(o.total_amount || 0);
            categoryRevenue[category].bookings += 1;
            categoryRevenue[category].commission += parseFloat(o.platform_fee || (o.total_amount * 0.1) || 0);
        });
        return Object.entries(categoryRevenue).map(([name, data]) => ({
            name,
            revenue: Math.round(data.revenue),
            bookings: data.bookings,
            commission: Math.round(data.commission)
        })).sort((a, b) => b.revenue - a.revenue);
    }
    async function getRevenueByVendor(start, end) {
        const bookings = await getBookingsInRange(start, end);
        const vendorRevenue = {};
        bookings.forEach((b) => {
            const vendorId = b.vendor_id;
            if (!vendorRevenue[vendorId]) {
                vendorRevenue[vendorId] = { revenue: 0, bookings: 0, avgRating: 0 };
            }
            vendorRevenue[vendorId].revenue += parseFloat(b.total_amount || 0);
            vendorRevenue[vendorId].bookings += 1;
        });
        // ✅ SQL: Get vendor details
        const result = await Promise.all(Object.entries(vendorRevenue).map(async ([vendorId, data]) => {
            const vendor = await vendorsRepo.findById(vendorId);
            return {
                vendorId,
                vendorName: vendor?.business_name || vendor?.full_name || 'Unknown',
                revenue: Math.round(data.revenue),
                bookings: data.bookings,
                avgRating: 0 // Will need to calculate from reviews
            };
        }));
        return result.sort((a, b) => b.revenue - a.revenue);
    }
    async function getRevenueByService(start, end) {
        const bookings = await getBookingsInRange(start, end);
        const serviceRevenue = {};
        bookings.forEach((b) => {
            const service = b.service_name || b.service_type || 'Other';
            if (!serviceRevenue[service]) {
                serviceRevenue[service] = { revenue: 0, bookings: 0 };
            }
            serviceRevenue[service].revenue += parseFloat(b.total_amount || 0);
            serviceRevenue[service].bookings += 1;
        });
        return Object.entries(serviceRevenue).map(([name, data]) => ({
            name,
            revenue: Math.round(data.revenue),
            bookings: data.bookings
        })).sort((a, b) => b.revenue - a.revenue);
    }
    async function getCohortAnalysis(period) {
        // ✅ SQL: Get customers from customers table
        try {
            const customers = await (0, db_1.executeRaw)('SELECT id, created_at, last_activity_at FROM customers');
            if (!customers || customers.length === 0)
                return [];
            const cohorts = {};
            customers.forEach((c) => {
                const joinDate = new Date(c.created_at);
                const cohortKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
                if (!cohorts[cohortKey]) {
                    cohorts[cohortKey] = { total: 0, retained: 0 };
                }
                cohorts[cohortKey].total += 1;
                // Check if customer is still active
                if (c.last_activity_at && new Date(c.last_activity_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
                    cohorts[cohortKey].retained += 1;
                }
            });
            return Object.entries(cohorts).map(([cohort, data]) => ({
                cohort,
                total: data.total,
                retained: data.retained,
                retentionRate: Math.round((data.retained / data.total) * 100)
            })).sort((a, b) => a.cohort.localeCompare(b.cohort));
        }
        catch (error) {
            console.error('Error in cohort analysis:', error);
            return [];
        }
    }
    async function getFunnelMetrics(start, end) {
        const visitors = await getVisitorsInRange(start, end);
        const bookings = await getBookingsInRange(start, end);
        const orders = await getOrdersInRange(start, end);
        const payments = await getTransactionsInRange(start, end);
        const total = bookings.length + orders.length;
        const completed = payments.length;
        return {
            visitors,
            browsing: Math.round(visitors * 0.7), // Mock
            addedToCart: Math.round(visitors * 0.3), // Mock
            initiated: total,
            completed,
            conversionRate: visitors > 0 ? Math.round((completed / visitors) * 100 * 100) / 100 : 0
        };
    }
    async function getVendorPerformanceMetrics(start, end) {
        // ✅ SQL: Get approved vendors
        try {
            const vendors = await vendorsRepo.findAll({ status: 'approved' });
            const metrics = await Promise.all(vendors.map(async (vendor) => {
                const vendorBookings = await getVendorBookings(vendor.id || vendor.vendor_id, start, end);
                const revenue = vendorBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount || 0)), 0);
                const avgResponseTime = calculateAvgResponseTime(vendorBookings);
                return {
                    vendorId: vendor.id || vendor.vendor_id,
                    vendorName: vendor.business_name || vendor.full_name,
                    category: vendor.role_id || 'Other',
                    bookings: vendorBookings.length,
                    revenue: Math.round(revenue),
                    avgRating: 0, // Will need to calculate from reviews
                    avgResponseTime,
                    completionRate: calculateCompletionRate(vendorBookings)
                };
            }));
            return metrics.sort((a, b) => b.revenue - a.revenue).slice(0, 50);
        }
        catch (error) {
            console.error('Error in vendor performance metrics:', error);
            return [];
        }
    }
    async function getCategoryInsights(start, end) {
        const categoryData = await getRevenueByCategory(start, end);
        // Enrich with growth and trend data
        const previousPeriod = getPreviousPeriod(start, end);
        const previousData = await getRevenueByCategory(previousPeriod.start, previousPeriod.end);
        return categoryData.map(current => {
            const previous = previousData.find(p => p.name === current.name);
            const growth = previous ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0;
            return {
                ...current,
                growth: Math.round(growth * 100) / 100,
                trend: growth > 0 ? 'up' : growth < 0 ? 'down' : 'stable'
            };
        });
    }
    async function getGeographicDistribution(start, end) {
        const bookings = await getBookingsInRange(start, end);
        const orders = await getOrdersInRange(start, end);
        const geoData = {};
        bookings.forEach((b) => {
            const location = b.city || b.location || 'Unknown';
            if (!geoData[location]) {
                geoData[location] = { bookings: 0, revenue: 0, customers: new Set() };
            }
            geoData[location].bookings += 1;
            geoData[location].revenue += parseFloat(b.total_amount || 0);
            if (b.customer_id)
                geoData[location].customers.add(b.customer_id);
        });
        return Object.entries(geoData).map(([location, data]) => ({
            location,
            bookings: data.bookings,
            revenue: Math.round(data.revenue),
            customers: data.customers.size
        })).sort((a, b) => b.revenue - a.revenue);
    }
    async function generatePredictions(type) {
        // Simple linear regression prediction
        const last30Days = getDateRange('30d');
        const revenue30d = await getRevenueByTimePeriod(last30Days.startDate, last30Days.endDate, 'day');
        if (revenue30d.length < 7) {
            return {
                prediction: 'Insufficient data',
                confidence: 0
            };
        }
        // Calculate trend
        const values = revenue30d.map(d => d.revenue);
        const avgGrowth = calculateAverageGrowth(values);
        const lastValue = values[values.length - 1];
        const predictions = [];
        for (let i = 1; i <= 7; i++) {
            predictions.push({
                day: i,
                predicted: Math.round(lastValue * Math.pow(1 + avgGrowth, i)),
                confidence: Math.max(50, 90 - i * 5)
            });
        }
        return {
            type,
            predictions,
            trend: avgGrowth > 0 ? 'growing' : avgGrowth < 0 ? 'declining' : 'stable',
            avgGrowthRate: Math.round(avgGrowth * 100 * 100) / 100
        };
    }
    async function getVendorBookings(vendorId, start, end) {
        const bookings = await getBookingsInRange(start, end);
        return bookings.filter(b => (b.vendor_id || b.vendorId) === vendorId);
    }
    function calculateAvgResponseTime(bookings) {
        if (bookings.length === 0)
            return 0;
        const responseTimes = bookings
            .filter(b => b.response_time)
            .map(b => b.response_time);
        if (responseTimes.length === 0)
            return 0;
        return Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length);
    }
    function calculateCompletionRate(bookings) {
        if (bookings.length === 0)
            return 0;
        const completed = bookings.filter(b => b.status === 'completed').length;
        return Math.round((completed / bookings.length) * 100);
    }
    function calculateAverageGrowth(values) {
        if (values.length < 2)
            return 0;
        let totalGrowth = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i - 1] > 0) {
                totalGrowth += (values[i] - values[i - 1]) / values[i - 1];
            }
        }
        return totalGrowth / (values.length - 1);
    }
    console.log('✅ Analytics Aggregation endpoints registered (SQL-only)');
}
//# sourceMappingURL=analytics-aggregation-sql.js.map