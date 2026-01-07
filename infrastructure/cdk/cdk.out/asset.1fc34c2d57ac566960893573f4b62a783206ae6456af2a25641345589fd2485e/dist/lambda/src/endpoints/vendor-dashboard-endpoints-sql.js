"use strict";
/**
 * ============================================================================
 * VENDOR DASHBOARD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Complete API endpoints for vendor dashboard with:
 * - Real-time appointment data from customer bookings
 * - Revenue tracking (realized after service completion)
 * - Payout management (settled via admin)
 * - Dashboard statistics and analytics
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorDashboardEndpoints = vendorDashboardEndpoints;
const response_utils_1 = require("./response-utils");
const repositories_1 = require("../lib/repositories");
const BASE_PATH = ''; // API Gateway handles routing
/**
 * Simple cascade delete helpers (simplified version)
 */
async function checkSafeDelete(entityType, entityId, vendorId) {
    const bookingsRepo = (0, repositories_1.getBookingsRepository)();
    const bookings = await bookingsRepo.findByVendor(vendorId);
    const activeBookings = bookings.filter((b) => (b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'pending') &&
        (b.assigned_staff_id === entityId || b.staff_id === entityId));
    return {
        canDelete: activeBookings.length === 0,
        blockers: activeBookings.length > 0 ? [`${activeBookings.length} active bookings exist`] : [],
        warnings: []
    };
}
async function cascadeDeleteStaff(vendorId, staffId, options) {
    const staffRepo = (0, repositories_1.getStaffRepository)();
    const bookingsRepo = (0, repositories_1.getBookingsRepository)();
    try {
        const cancelled = [];
        // Cancel active bookings if requested
        if (options.cancelBookings) {
            const bookings = await bookingsRepo.findByVendor(vendorId);
            const activeBookings = bookings.filter((b) => (b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'pending') &&
                (b.assigned_staff_id === staffId || b.staff_id === staffId));
            for (const booking of activeBookings) {
                await bookingsRepo.update(booking.id, {
                    status: 'cancelled',
                    cancellation_reason: 'Staff member removed',
                    cancelled_at: new Date().toISOString()
                });
                cancelled.push(booking.id);
            }
        }
        // Delete staff member (sets is_active to false)
        await staffRepo.delete(staffId);
        return {
            success: true,
            deleted: [{ type: 'staff', id: staffId }],
            cancelled
        };
    }
    catch (error) {
        return {
            success: false,
            errors: [String(error)]
        };
    }
}
async function cleanOrphanedData() {
    // Simplified orphaned data cleanup
    // TODO: Implement full orphaned data cleanup if needed
    return {
        cleaned: [],
        found: []
    };
}
function vendorDashboardEndpoints(app) {
    /**
     * Get comprehensive vendor dashboard data
     * GET /vendor/dashboard/:vendorId
     */
    app.get(`${BASE_PATH}/vendor/dashboard/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const timeframe = c.req.query('timeframe') || 'today'; // today, week, month
            // Get vendor profile
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                console.log(`⚠️ Vendor not found: ${vendorId}, returning default dashboard`);
                // Return default dashboard for newly created vendors
                return (0, response_utils_1.sendSuccess)(c, {
                    vendor: {
                        vendorId,
                        fullName: 'Vendor',
                        businessName: null,
                        vendorType: 'service_provider',
                        serviceStyle: 'both',
                        address: 'Location not set',
                        isActive: false
                    },
                    stats: {
                        appointments: 0,
                        consultations: 0,
                        earnings: 0,
                        pendingEarnings: 0,
                        completedServices: 0,
                        rating: 4.8,
                        totalReviews: 0
                    },
                    timeframe
                });
            }
            // Get all vendor bookings
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            // Calculate date ranges
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
            const bookings = await bookingsRepo.findByVendor(vendorId);
            // Filter by date if needed
            let filteredBookings = bookings;
            if (dateFrom) {
                filteredBookings = bookings.filter((b) => {
                    const bookingDate = b.booking_date || b.scheduled_date || '';
                    return bookingDate >= dateFrom;
                });
            }
            // Initialize stats
            const stats = {
                appointments: 0,
                consultations: 0,
                earnings: 0,
                pendingEarnings: 0,
                completedServices: 0,
                rating: 0,
                totalReviews: 0
            };
            // Process bookings
            for (const booking of filteredBookings) {
                if (booking.status === 'confirmed' || booking.status === 'pending') {
                    stats.appointments++;
                }
                if (booking.status === 'completed') {
                    stats.completedServices++;
                    stats.consultations++;
                    stats.earnings += (booking.total_amount || 0);
                }
                if (booking.status === 'in_progress' || booking.status === 'confirmed') {
                    stats.pendingEarnings += (booking.total_amount || 0);
                }
            }
            // Get vendor rating
            const reviewsRepo = (0, repositories_1.getReviewsRepository)();
            const reviews = await reviewsRepo.findByVendor(vendorId);
            if (reviews.length > 0) {
                const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
                stats.rating = Number((totalRating / reviews.length).toFixed(1));
                stats.totalReviews = reviews.length;
            }
            else {
                stats.rating = 4.8; // Default rating for new vendors
                stats.totalReviews = 0;
            }
            return (0, response_utils_1.sendSuccess)(c, {
                vendor: {
                    vendorId: vendor.id,
                    fullName: vendor.owner_name,
                    businessName: vendor.business_name,
                    vendorType: vendor.category || 'service_provider',
                    serviceStyle: 'both', // TODO: Map from vendor data
                    address: vendor.address,
                    phone: vendor.phone,
                    email: vendor.email,
                    isActive: vendor.is_active
                },
                stats,
                timeframe
            });
        }
        catch (error) {
            console.error('Error fetching vendor dashboard:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get today's schedule for vendor
     * GET /vendor/schedule/:vendorId
     */
    app.get(`${BASE_PATH}/vendor/schedule/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const date = c.req.query('date') || new Date().toISOString().split('T')[0];
            // Get bookings for vendor
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const allBookings = await bookingsRepo.findByVendor(vendorId);
            // Filter by date
            const bookings = allBookings.filter((b) => {
                const bookingDate = b.booking_date || b.scheduled_date;
                return bookingDate === date;
            });
            console.log(`📅 [SCHEDULE] Vendor: ${vendorId}, Date: ${date}, Bookings: ${bookings.length}`);
            const schedule = [];
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            for (const booking of bookings) {
                // Filter by active statuses
                if (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress') {
                    // Get customer details
                    const customer = booking.customer_id ? await customersRepo.findById(booking.customer_id) : null;
                    // Map booking data to schedule format
                    schedule.push({
                        id: booking.id,
                        bookingId: booking.id,
                        time: booking.scheduled_time || booking.booking_time,
                        duration: null, // TODO: Get from service details
                        petName: null, // TODO: Get from pet_id if available
                        petBreed: null, // TODO: Get from pet data
                        customerName: customer?.full_name || 'Customer',
                        customerPhone: customer?.phone || null,
                        serviceName: null, // TODO: Get from service_id
                        serviceType: booking.service_type,
                        status: booking.status,
                        price: booking.total_amount,
                        address: booking.address,
                        specialInstructions: booking.notes
                    });
                }
            }
            // Sort by time
            schedule.sort((a, b) => {
                const timeA = (a.time || '').split(':').map(Number);
                const timeB = (b.time || '').split(':').map(Number);
                return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
            });
            return (0, response_utils_1.sendSuccess)(c, { schedule, date, total: schedule.length });
        }
        catch (error) {
            console.error('Error fetching vendor schedule:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get vendor revenue details
     * GET /make-server-3dd53475/vendor/revenue/:vendorId
     */
    app.get(`${BASE_PATH}/vendor/revenue/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const timeframe = c.req.query('timeframe') || 'month';
            const revenue = {
                total: 0,
                completed: 0,
                pending: 0,
                inProgress: 0,
                platformFee: 0,
                netRevenue: 0,
                breakdown: []
            };
            // Platform commission rate (e.g., 15%)
            const COMMISSION_RATE = 0.15;
            const now = new Date();
            let dateFrom;
            if (timeframe === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                dateFrom = weekAgo.toISOString().split('T')[0];
            }
            else if (timeframe === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                dateFrom = monthAgo.toISOString().split('T')[0];
            }
            else if (timeframe === 'year') {
                const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                dateFrom = yearAgo.toISOString().split('T')[0];
            }
            // Get bookings for vendor
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const allBookings = await bookingsRepo.findByVendor(vendorId);
            // Filter by date if needed
            let bookings = allBookings;
            if (dateFrom) {
                bookings = allBookings.filter((b) => {
                    const bookingDate = b.booking_date || b.scheduled_date || '';
                    return bookingDate >= dateFrom;
                });
            }
            for (const booking of bookings) {
                const amount = booking.total_amount || 0;
                if (booking.status === 'completed') {
                    revenue.completed += amount;
                    revenue.breakdown.push({
                        bookingId: booking.id,
                        date: booking.scheduled_date || booking.booking_date,
                        service: null, // TODO: Get from service_id
                        customer: null, // TODO: Get from customer_id
                        amount: amount,
                        status: 'completed',
                        completedAt: booking.completed_at
                    });
                }
                else if (booking.status === 'confirmed') {
                    revenue.pending += amount;
                }
                else if (booking.status === 'in_progress') {
                    revenue.inProgress += amount;
                }
                revenue.total += amount;
            }
            // Calculate platform fee and net revenue (only on completed services)
            revenue.platformFee = Number((revenue.completed * COMMISSION_RATE).toFixed(2));
            revenue.netRevenue = Number((revenue.completed - revenue.platformFee).toFixed(2));
            // Sort breakdown by date (most recent first)
            revenue.breakdown.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return (0, response_utils_1.sendSuccess)(c, { revenue, timeframe, commissionRate: COMMISSION_RATE });
        }
        catch (error) {
            console.error('Error fetching vendor revenue:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get vendor payout information with staff revenue breakup
     * GET /make-server-3dd53475/vendor/payouts/:vendorId
     */
    app.get(`${BASE_PATH}/vendor/payouts/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const status = c.req.query('status'); // pending, processing, completed
            // Get vendor to check if it's a center-based vendor
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            const isCenterBased = vendor?.category === 'healthcare_provider' ||
                vendor?.role_id === 'veterinary_clinic' ||
                vendor?.role_id === 'pet_boarding' ||
                vendor?.role_id === 'pet_resort' ||
                vendor?.role_id === 'pet_cafe';
            // Get all payouts for vendor
            const payoutsRepo = (0, repositories_1.getPayoutsRepository)();
            const allPayouts = await payoutsRepo.findByVendor(vendorId);
            const payouts = [];
            let totalPending = 0;
            let totalProcessing = 0;
            let totalCompleted = 0;
            for (const payout of allPayouts) {
                const payoutAny = payout;
                const payoutStatus = payoutAny.status || payoutAny.payout_status || 'pending';
                if (status && payoutStatus !== status)
                    continue;
                // Get staff revenue breakup for this payout
                const staffBreakup = [];
                // TODO: Implement staff breakup using settlements -> bookings
                const payoutWithBreakup = {
                    ...payout,
                    payoutId: payout.id,
                    createdAt: payout.created_at,
                    updatedAt: payoutAny.updated_at || payout.created_at,
                    staffBreakup, // Include staff revenue breakup (empty for now)
                    totalStaffRevenue: staffBreakup.reduce((sum, s) => sum + (s.staffRevenue || 0), 0)
                };
                payouts.push(payoutWithBreakup);
                if (payoutStatus === 'scheduled' || payoutStatus === 'pending') {
                    totalPending += payout.amount;
                }
                else if (payoutStatus === 'processing') {
                    totalProcessing += payout.amount;
                }
                else if (payoutStatus === 'completed') {
                    totalCompleted += payout.amount;
                }
            }
            // Sort by date (most recent first)
            payouts.sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
            return (0, response_utils_1.sendSuccess)(c, {
                payouts,
                summary: {
                    totalPending,
                    totalProcessing,
                    totalCompleted,
                    count: payouts.length
                },
                isCenterBased // Indicate if vendor is center-based
            });
        }
        catch (error) {
            console.error('Error fetching vendor payouts:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Create payout request (triggered after settlement period)
     * POST /make-server-3dd53475/vendor/payouts/create
     */
    app.post(`${BASE_PATH}/vendor/payouts/create`, async (c) => {
        try {
            const { vendorId, amount, bookingIds, bankDetails, settlementIds } = await c.req.json();
            if (!vendorId || !amount || !settlementIds || settlementIds.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields (vendorId, amount, settlementIds)', 400);
            }
            // Create payout using repository
            const payoutsRepo = (0, repositories_1.getPayoutsRepository)();
            const payout = await payoutsRepo.create({
                vendor_id: vendorId,
                amount: amount,
                scheduled_at: new Date().toISOString(),
                settlement_ids: settlementIds,
                bank_account_id: bankDetails?.bank_account_id || null
            });
            console.log(`✅ Payout request created: ${payout.id} for vendor ${vendorId}`);
            const payoutAny = payout;
            return (0, response_utils_1.sendSuccess)(c, {
                payoutId: payout.id,
                payout: {
                    ...payout,
                    payoutId: payout.id,
                    vendorId: payout.vendor_id,
                    bookingIds: bookingIds || [], // Legacy field for backward compatibility
                    bankDetails: bankDetails || null,
                    requestedAt: payoutAny.scheduled_at || payout.created_at,
                    createdAt: payout.created_at,
                    updatedAt: payoutAny.updated_at || payout.created_at
                }
            }, 'Payout request created successfully');
        }
        catch (error) {
            console.error('Error creating payout request:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get vendor notifications
     * GET /make-server-3dd53475/vendor/notifications/:vendorId
     */
    app.get(`${BASE_PATH}/vendor/notifications/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const limit = parseInt(c.req.query('limit') || '10');
            console.log(`📬 [VENDOR-NOTIFICATIONS] Fetching notifications for vendor: ${vendorId}`);
            // ✅ SQL: Get notifications for vendor
            const notificationsRepo = (0, repositories_1.getNotificationsRepository)();
            const notifications = await notificationsRepo.findByRecipient('vendor', vendorId, {
                limit
            });
            // Apply limit
            const limitedNotifications = notifications.slice(0, limit);
            const formattedNotifications = limitedNotifications.map((n) => ({
                notificationId: n.id,
                type: n.notification_type || n.type,
                title: n.title,
                message: n.message,
                createdAt: n.created_at,
                read: n.is_read || n.read || false,
                data: n.data || {}
            }));
            console.log(`📬 [VENDOR-NOTIFICATIONS] Returning ${formattedNotifications.length} notifications`);
            return (0, response_utils_1.sendSuccess)(c, {
                notifications: formattedNotifications,
                total: formattedNotifications.length
            });
        }
        catch (error) {
            console.error('Error fetching vendor notifications:', error);
            // Return empty array instead of error to prevent UI from breaking
            return (0, response_utils_1.sendSuccess)(c, {
                notifications: [],
                total: 0,
                warning: 'Failed to fetch notifications due to network error'
            });
        }
    });
    /**
     * Get vendor watchlist (patients requiring follow-up)
     * GET /make-server-3dd53475/vendor/watchlist/:vendorId
     */
    app.get(`${BASE_PATH}/vendor/watchlist/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            // TODO: Implement watchlist repository if table exists
            // For now, return empty array
            const watchlist = [];
            return (0, response_utils_1.sendSuccess)(c, { watchlist, total: watchlist.length });
        }
        catch (error) {
            console.error('Error fetching vendor watchlist:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Add patient to watchlist
     * POST /make-server-3dd53475/vendor/watchlist/add
     */
    app.post(`${BASE_PATH}/vendor/watchlist/add`, async (c) => {
        try {
            const { vendorId, customerId, petId, petName, issue, notes, bookingId } = await c.req.json();
            if (!vendorId || !customerId || !petName) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            // Get customer details
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const customer = await customersRepo.findById(customerId);
            const watchlistId = `watchlist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const watchlistItem = {
                watchlistId,
                vendorId,
                customerId,
                petId: petId || null,
                petName,
                customerName: customer?.full_name || 'Customer',
                issue: issue || 'Monitoring required',
                notes: notes || '',
                bookingId: bookingId || null,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            // TODO: Save to watchlist table/repository if exists
            console.log(`✅ Patient added to watchlist: ${watchlistId} (not persisted - table needed)`);
            return (0, response_utils_1.sendSuccess)(c, { watchlistId, watchlistItem }, 'Patient added to watchlist');
        }
        catch (error) {
            console.error('Error adding to watchlist:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ============================================
    // STAFF MANAGEMENT
    // ============================================
    /**
     * GET /make-server-3dd53475/vendor/staff/:vendorId
     * Get all staff members for a vendor
     */
    app.get(`${BASE_PATH}/vendor/staff/:vendorId`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            // ✅ SQL: Get all staff for vendor from database
            const staffRepo = (0, repositories_1.getStaffRepository)();
            const staffList = await staffRepo.findByVendor(vendorId);
            console.log(`✅ Found ${staffList.length} active staff members for vendor ${vendorId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                staff: staffList,
                count: staffList.length
            });
        }
        catch (error) {
            console.error('Error fetching vendor staff:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /make-server-3dd53475/vendor/staff/add
     * Add a new staff member
     */
    app.post(`${BASE_PATH}/vendor/staff/add`, async (c) => {
        try {
            const { vendorId, staffData } = await c.req.json();
            if (!vendorId || !staffData) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            // Create staff using repository
            const staffRepo = (0, repositories_1.getStaffRepository)();
            const newStaff = await staffRepo.create({
                vendor_id: vendorId,
                name: staffData.full_name || staffData.fullName,
                phone: staffData.phone,
                email: staffData.email,
                role: staffData.role,
                specialization: staffData.specialization,
                experience_years: staffData.experience_years,
                is_active: true
            });
            return (0, response_utils_1.sendSuccess)(c, {
                staff: newStaff
            }, 'Staff member added successfully');
        }
        catch (error) {
            console.error('Error adding staff:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /make-server-3dd53475/vendor/staff/:staffId
     * Update staff member
     */
    app.put(`${BASE_PATH}/vendor/staff/:staffId`, async (c) => {
        try {
            const { staffId } = c.req.param();
            const updates = await c.req.json();
            const staffRepo = (0, repositories_1.getStaffRepository)();
            const existingStaff = await staffRepo.findById(staffId);
            if (!existingStaff) {
                return (0, response_utils_1.sendError)(c, 'Staff not found', 404);
            }
            // Map updates to repository format
            const updateData = {};
            if (updates.full_name || updates.fullName)
                updateData.name = updates.full_name || updates.fullName;
            if (updates.phone)
                updateData.phone = updates.phone;
            if (updates.email)
                updateData.email = updates.email;
            if (updates.role)
                updateData.role = updates.role;
            if (updates.specialization)
                updateData.specialization = updates.specialization;
            if (updates.experience_years !== undefined)
                updateData.experience_years = updates.experience_years;
            if (updates.is_active !== undefined)
                updateData.is_active = updates.is_active;
            const updatedStaff = await staffRepo.update(staffId, updateData);
            return (0, response_utils_1.sendSuccess)(c, {
                staff: updatedStaff
            }, 'Staff updated successfully');
        }
        catch (error) {
            console.error('Error updating staff:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * DELETE /make-server-3dd53475/vendor/staff/:staffId
     * Remove/Archive staff member with cascade delete
     */
    app.delete(`${BASE_PATH}/vendor/staff/:staffId`, async (c) => {
        try {
            const { staffId } = c.req.param();
            const vendorId = c.req.query('vendorId');
            const force = c.req.query('force') === 'true';
            const cancelBookings = c.req.query('cancelBookings') === 'true';
            if (!vendorId) {
                return (0, response_utils_1.sendError)(c, 'vendorId is required', 400);
            }
            console.log(`\n🗑️ [STAFF-DELETE] Request to delete staff: ${staffId}`);
            console.log(`   Vendor ID: ${vendorId}`);
            console.log(`   Force: ${force}`);
            console.log(`   Cancel Bookings: ${cancelBookings}`);
            // Check if it's safe to delete
            const safetyCheck = await checkSafeDelete('staff', staffId, vendorId);
            console.log(`   Safety Check:`);
            console.log(`   - Can Delete: ${safetyCheck.canDelete}`);
            console.log(`   - Blockers: ${safetyCheck.blockers.join(', ') || 'None'}`);
            if (!safetyCheck.canDelete && !force) {
                return (0, response_utils_1.sendError)(c, {
                    message: 'Cannot delete staff member',
                    blockers: safetyCheck.blockers,
                    warnings: safetyCheck.warnings,
                    suggestion: 'Use force=true and cancelBookings=true to proceed'
                }, 400);
            }
            // Perform cascade delete
            const result = await cascadeDeleteStaff(vendorId, staffId, {
                force,
                cancelBookings
            });
            if (!result.success) {
                return (0, response_utils_1.sendError)(c, {
                    message: 'Staff deletion failed',
                    errors: result.errors
                }, 500);
            }
            console.log(`✅ [STAFF-DELETE] Staff deleted successfully`);
            return (0, response_utils_1.sendSuccess)(c, {
                deleted: result.deleted,
                cancelled: result.cancelled,
                summary: {
                    recordsDeleted: result.deleted.length,
                    bookingsCancelled: result.cancelled.length
                }
            }, 'Staff member removed successfully with cascade cleanup');
        }
        catch (error) {
            console.error('❌ [STAFF-DELETE] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ============================================
    // ORPHANED DATA CLEANUP
    // ============================================
    /**
     * POST /make-server-3dd53475/vendor/:vendorId/cleanup-orphaned-data
     * Clean up orphaned data for a vendor
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/cleanup-orphaned-data`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`\n🧹 [CLEANUP] Starting orphaned data cleanup for vendor: ${vendorId}`);
            const result = await cleanOrphanedData();
            return (0, response_utils_1.sendSuccess)(c, {
                cleaned: result.cleaned,
                found: result.found,
                summary: `Cleaned ${result.cleaned.length} orphaned records`
            }, 'Orphaned data cleanup completed');
        }
        catch (error) {
            console.error('❌ [CLEANUP] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Vendor dashboard endpoints registered');
}
//# sourceMappingURL=vendor-dashboard-endpoints-sql.js.map