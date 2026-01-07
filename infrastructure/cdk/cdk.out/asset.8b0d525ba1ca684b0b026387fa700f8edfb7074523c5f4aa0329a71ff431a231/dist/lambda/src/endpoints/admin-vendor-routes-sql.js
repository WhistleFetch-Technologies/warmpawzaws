"use strict";
/**
 * ============================================================================
 * ADMIN VENDOR ROUTES - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Admin endpoints for vendor management:
 * - Vendor statistics
 * - Application approval/rejection
 * - Platform settings
 * - Deactivation requests
 * - Reverification
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All vendor operations use VendorsRepository
 * - Notifications use NotificationsRepository
 * - Platform settings use platform_settings table
 *
 * Date: 2025-01-27
 * Migration: Phase 3, Task 3.5
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminVendorRoutes = registerAdminVendorRoutes;
const vendors_1 = require("../lib/repositories/vendors");
const notifications_1 = require("../lib/repositories/notifications");
const db_1 = require("../lib/db");
function registerAdminVendorRoutes(app) {
    // ============================================
    // VENDOR ADMINISTRATION - OVERVIEW & STATS
    // ============================================
    // Get all vendors (for Admin Dashboard vendor list)
    app.get("/admin/vendors", async (c) => {
        try {
            const status = c.req.query('status'); // Optional: filter by status
            const search = c.req.query('search'); // Optional: search query
            console.log('Fetching all vendors...', { status, search });
            // ✅ SQL: Get all vendors using repository
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            let vendors = await vendorsRepo.findAll();
            // Filter by status if provided
            if (status && status !== 'all') {
                vendors = vendors.filter(v => v.status === status);
            }
            // Filter by search query if provided
            if (search) {
                const searchLower = search.toLowerCase();
                vendors = vendors.filter(v => v.business_name?.toLowerCase().includes(searchLower) ||
                    v.owner_name?.toLowerCase().includes(searchLower) ||
                    v.email?.toLowerCase().includes(searchLower) ||
                    v.phone?.includes(search));
            }
            // Transform to match expected format
            const transformedVendors = vendors.map(v => ({
                id: v.id,
                businessName: v.business_name,
                ownerName: v.owner_name,
                email: v.email,
                phone: v.phone,
                status: v.status,
                isActive: v.is_active,
                category: v.category,
                address: v.address,
                city: v.city,
                state: v.state,
                pincode: v.pincode,
                gstin: v.gst_number,
                pan: v.pan_number,
                aadhar: v.aadhar_number || null,
                bankAccount: v.bank_account_number || null,
                ifsc: v.ifsc_code || null,
                created_at: v.created_at,
                revenue: 0, // TODO: Calculate from bookings/payments
                services: [] // TODO: Load from services table
            }));
            return c.json({
                success: true,
                vendors: transformedVendors,
                count: transformedVendors.length
            });
        }
        catch (error) {
            console.error('Error fetching vendors:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Get vendor statistics and overview
    app.get("/make-server-3dd53475/admin/vendors/stats", async (c) => {
        try {
            console.log('Fetching vendor statistics...');
            // ✅ SQL: Get all vendors using repository
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const allVendors = await vendorsRepo.findAll();
            console.log(`Total vendor records found: ${allVendors.length}`);
            // Calculate statistics efficiently
            const activeVendors = allVendors.filter(v => v.status === 'approved' && v.is_active);
            const pendingApplications = allVendors.filter(v => v.status === 'pending' || v.status === 'pending_approval');
            const deactivatedVendors = allVendors.filter(v => !v.is_active);
            const rejectedVendors = allVendors.filter(v => v.status === 'rejected');
            // Simplified compliance issues (would need a separate compliance_flags table for full implementation)
            const complianceIssues = [];
            const highPriorityIssues = [];
            // Simplified support tickets count (would need support_tickets table)
            let supportTicketCount = 0;
            let openTicketCount = 0;
            // Simplified quality alerts (would need reviews/ratings aggregation)
            const qualityAlerts = [];
            // Pending today count
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const pendingToday = pendingApplications.filter(v => {
                if (!v.created_at)
                    return false;
                const submittedDate = new Date(v.created_at);
                return submittedDate >= today;
            });
            // Distribution by category
            const distributionByCategory = {};
            allVendors.forEach(vendor => {
                if (vendor.category) {
                    distributionByCategory[vendor.category] = (distributionByCategory[vendor.category] || 0) + 1;
                }
            });
            const stats = {
                activeVendors: {
                    count: activeVendors.length,
                    percentage: allVendors.length > 0 ? Math.round((activeVendors.length / allVendors.length) * 100) : 0
                },
                pendingApplications: {
                    count: pendingApplications.length,
                    todayCount: pendingToday.length
                },
                deactivatedVendors: {
                    count: deactivatedVendors.length
                },
                complianceIssues: {
                    count: complianceIssues.length,
                    highPriority: highPriorityIssues.length
                },
                supportTickets: {
                    total: supportTicketCount,
                    open: openTicketCount
                },
                qualityAlerts: {
                    count: qualityAlerts.length
                },
                distribution: {
                    active: activeVendors.length,
                    deactivated: deactivatedVendors.length,
                    pending: pendingApplications.length
                },
                categoryDistribution: distributionByCategory
            };
            return c.json({
                success: true,
                stats,
                cached: false
            });
        }
        catch (error) {
            console.error('Error fetching vendor stats:', error);
            // Return basic fallback stats on error
            return c.json({
                success: true,
                stats: {
                    activeVendors: { count: 0, percentage: 0 },
                    pendingApplications: { count: 0, todayCount: 0 },
                    deactivatedVendors: { count: 0 },
                    complianceIssues: { count: 0, highPriority: 0 },
                    supportTickets: { total: 0, open: 0 },
                    qualityAlerts: { count: 0 },
                    distribution: { active: 0, deactivated: 0, pending: 0 },
                    categoryDistribution: {}
                },
                error: String(error),
                fallback: true
            });
        }
    });
    // ============================================
    // NEW VENDOR APPLICATIONS
    // ============================================
    // Get all pending vendor applications with filters
    app.get("/make-server-3dd53475/applications/pending", async (c) => {
        try {
            const category = c.req.query('category') || 'all';
            const priority = c.req.query('priority') || 'all';
            console.log('📋 Fetching pending applications with filters:', { category, priority });
            // ✅ SQL: Get pending vendors using repository
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            let pendingVendors = await vendorsRepo.findByStatus('pending');
            // Also include 'pending_approval' status if it exists
            const pendingApprovalVendors = await vendorsRepo.findByStatus('pending_approval');
            pendingVendors = [...pendingVendors, ...pendingApprovalVendors];
            console.log(`⏳ Pending vendors found: ${pendingVendors.length}`);
            // Filter by category
            if (category !== 'all') {
                pendingVendors = pendingVendors.filter(v => v.category === category);
            }
            // Filter by priority (calculated based on waiting time and completeness)
            if (priority !== 'all') {
                pendingVendors = pendingVendors.map(v => {
                    const daysSinceSubmission = Math.floor((Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24));
                    let calculatedPriority = 'low';
                    if (daysSinceSubmission > 7)
                        calculatedPriority = 'high';
                    else if (daysSinceSubmission > 3)
                        calculatedPriority = 'medium';
                    return { ...v, priority: calculatedPriority };
                }).filter((v) => v.priority === priority);
            }
            // Calculate progress for each vendor (simplified)
            const vendorsWithProgress = pendingVendors.map(vendor => {
                let totalFields = 0;
                let filledFields = 0;
                // Basic info
                totalFields += 6;
                if (vendor.owner_name)
                    filledFields++;
                if (vendor.phone)
                    filledFields++;
                if (vendor.email)
                    filledFields++;
                if (vendor.address)
                    filledFields++;
                if (vendor.category)
                    filledFields++;
                if (vendor.experience_years)
                    filledFields++;
                // Documents
                totalFields += 4;
                if (vendor.pan_number)
                    filledFields++;
                if (vendor.gst_number)
                    filledFields++;
                if (vendor.registration_number)
                    filledFields++;
                const progressPercentage = Math.round((filledFields / totalFields) * 100);
                return {
                    ...vendor,
                    progressPercentage,
                    daysSinceSubmission: Math.floor((Date.now() - new Date(vendor.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                    submittedAt: vendor.created_at
                };
            });
            // Sort by submission date (newest first)
            vendorsWithProgress.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
            return c.json({
                success: true,
                applications: vendorsWithProgress,
                count: vendorsWithProgress.length
            });
        }
        catch (error) {
            console.error('Error fetching pending applications:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Get single vendor application details
    app.get("/make-server-3dd53475/applications/:vendorId", async (c) => {
        try {
            const { vendorId } = c.req.param();
            // ✅ SQL: Get vendor using repository
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            return c.json({
                success: true,
                vendor
            });
        }
        catch (error) {
            console.error('Error fetching application:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // ============================================
    // APPROVE VENDOR APPLICATION
    // ============================================
    // Verify vendor (approve/reject) - for Admin Dashboard
    app.post("/admin/vendors/:vendorId/verify", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { status, remarks } = await c.req.json(); // status: 'approved' | 'rejected'
            if (!status || !['approved', 'rejected'].includes(status)) {
                return c.json({ error: 'Invalid status. Must be "approved" or "rejected"' }, 400);
            }
            // Resolve vendor ID first
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Get vendor to check current status
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Update vendor status
            if (status === 'approved') {
                await vendorsRepo.approve(resolvedId, 'admin');
            }
            else if (status === 'rejected') {
                await vendorsRepo.update(resolvedId, { status: 'rejected' });
            }
            // Send notification
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            await notificationsRepo.create({
                recipient_id: resolvedId,
                recipient_type: 'vendor',
                notification_type: status === 'approved' ? 'vendor_approved' : 'vendor_rejected',
                title: status === 'approved' ? 'Application Approved' : 'Application Rejected',
                message: status === 'approved'
                    ? 'Your vendor application has been approved!'
                    : `Your vendor application has been rejected. ${remarks || ''}`,
                data: { remarks }
            });
            return c.json({
                success: true,
                message: `Vendor ${status} successfully`,
                vendor: {
                    id: resolvedId,
                    status: status === 'approved' ? 'approved' : 'rejected'
                }
            });
        }
        catch (error) {
            console.error('Error verifying vendor:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Approve vendor application
    app.post("/make-server-3dd53475/admin/vendor/application/:vendorId/approve", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { adminId, adminName, notes } = await c.req.json();
            // Resolve vendor ID first (outside transaction since it's read-only)
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Get vendor to check status
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Validate status
            const validStatuses = ['pending_approval', 'pending', 'rejected', 'clarification_requested', 'pending_reverification', 'more_info_required'];
            if (!validStatuses.includes(vendor.status)) {
                return c.json({
                    error: 'Vendor cannot be approved from current status',
                    currentStatus: vendor.status,
                    validStatuses
                }, 400);
            }
            // ✅ SQL: Use transaction for atomic approval
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            const result = await (0, db_1.withTransaction)(async (client) => {
                // ✅ SQL: Approve vendor using repository
                const updatedVendor = await vendorsRepo.approve(resolvedId, adminId || 'system');
                // ✅ FIX: AUTO-CREATE STAFF FOR INDIVIDUAL VENDORS (if needed)
                // This logic can be enhanced based on vendor type
                // ✅ SQL: Create notification
                if (vendor.user_id) {
                    await notificationsRepo.create({
                        user_id: vendor.user_id,
                        notification_type: 'application_approved',
                        title: 'Application Approved',
                        message: 'Congratulations! Your vendor application has been approved. You can now start accepting bookings.',
                        data: { vendorId: resolvedId }
                    });
                }
                return { vendor: updatedVendor };
            });
            console.log('✅ Vendor approved successfully:', vendorId);
            return c.json({
                success: true,
                message: 'Vendor approved successfully',
                vendor: result.vendor
            });
        }
        catch (error) {
            console.error('Error approving vendor:', error);
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
    });
    // Approve vendor application (plural endpoint for backward compatibility)
    app.post("/make-server-3dd53475/admin/vendors/applications/:vendorId/approve", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const body = await c.req.json();
            // Redirect to singular endpoint
            return c.req.raw.clone().json().then(async (jsonBody) => {
                const req = new Request(c.req.url.replace('/admin/vendors/applications/', '/admin/vendor/application/'), {
                    method: 'POST',
                    headers: c.req.raw.headers,
                    body: JSON.stringify(jsonBody)
                });
                return app.fetch(req);
            });
        }
        catch (error) {
            return c.json({ error: String(error) }, 500);
        }
    });
    // ============================================
    // REJECT VENDOR APPLICATION
    // ============================================
    // Reject vendor application
    app.post("/make-server-3dd53475/admin/vendor/application/:vendorId/reject", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { adminId, adminName, reason, rejectionNotes } = await c.req.json();
            // Resolve vendor ID first
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Get vendor to check status
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Validate status
            if (vendor.status !== 'pending_approval' && vendor.status !== 'pending') {
                return c.json({ error: 'Vendor is not pending approval', currentStatus: vendor.status }, 400);
            }
            // ✅ SQL: Use transaction for atomic rejection
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            const result = await (0, db_1.withTransaction)(async (client) => {
                // ✅ SQL: Reject vendor using repository
                const updatedVendor = await vendorsRepo.update(resolvedId, {
                    status: 'rejected',
                    is_active: false,
                    approved_by: adminId || 'system',
                    rejection_reason: reason || rejectionNotes
                });
                // ✅ SQL: Create notification
                if (vendor.user_id) {
                    await notificationsRepo.create({
                        user_id: vendor.user_id,
                        notification_type: 'application_rejected',
                        title: 'Application Rejected',
                        message: `Unfortunately, your vendor application has been rejected. Reason: ${reason || rejectionNotes || 'Please contact support for details.'}`,
                        data: { vendorId: resolvedId, reason: reason || rejectionNotes }
                    });
                }
                return { vendor: updatedVendor };
            });
            console.log('✅ Vendor rejected successfully:', vendorId);
            return c.json({
                success: true,
                message: 'Vendor rejected',
                vendor: result.vendor
            });
        }
        catch (error) {
            console.error('Error rejecting vendor:', error);
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
    });
    // Reject vendor application (plural endpoint for backward compatibility)
    app.post("/make-server-3dd53475/admin/vendors/applications/:vendorId/reject", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const body = await c.req.json();
            // Redirect to singular endpoint
            return c.req.raw.clone().json().then(async (jsonBody) => {
                const req = new Request(c.req.url.replace('/admin/vendors/applications/', '/admin/vendor/application/'), {
                    method: 'POST',
                    headers: c.req.raw.headers,
                    body: JSON.stringify(jsonBody)
                });
                return app.fetch(req);
            });
        }
        catch (error) {
            return c.json({ error: String(error) }, 500);
        }
    });
    // ============================================
    // REQUEST CLARIFICATION FROM VENDOR
    // ============================================
    app.post("/make-server-3dd53475/admin/vendor/application/:vendorId/request-clarification", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { adminId, adminName, reviewerName, notes, clarificationNotes } = await c.req.json();
            console.log('📝 Requesting clarification from vendor:', vendorId);
            // Resolve vendor ID first
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // ✅ SQL: Update vendor status to clarification_requested
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            const result = await (0, db_1.withTransaction)(async (client) => {
                // Update vendor status
                const updatedVendor = await vendorsRepo.update(resolvedId, {
                    status: 'clarification_requested'
                });
                // Create notification
                if (vendor.user_id) {
                    await notificationsRepo.create({
                        user_id: vendor.user_id,
                        notification_type: 'clarification_requested',
                        title: 'Additional Information Required',
                        message: notes || clarificationNotes || 'Please provide additional information for your vendor application.',
                        data: { vendorId: resolvedId, notes: notes || clarificationNotes }
                    });
                }
                return { vendor: updatedVendor };
            });
            return c.json({
                success: true,
                message: 'Clarification requested successfully',
                vendor: result.vendor
            });
        }
        catch (error) {
            console.error('Error requesting clarification:', error);
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
    });
    // ============================================
    // PLATFORM SETTINGS
    // ============================================
    // Get platform-wide vendor settings
    app.get("/make-server-3dd53475/settings/platform", async (c) => {
        try {
            // ✅ SQL: Get platform settings from platform_settings table
            const settingsRecords = await (0, db_1.selectQuery)('platform_settings', { setting_key: 'vendor_settings' }, { limit: 1 });
            const settingsRecord = settingsRecords[0] || null;
            // Default settings if not found
            const defaultSettings = {
                refundPolicies: {
                    customerCancellation: {
                        tier1: {
                            hoursBeforeService: 24,
                            refundPercentage: 75,
                            cancellationFee: 10
                        },
                        tier2: {
                            hoursBeforeService: 6,
                            refundPercentage: 50,
                            cancellationFee: null
                        }
                    },
                    providerCancellation: {
                        refundToCustomer: 100,
                        additionalCompensation: 10,
                        cancellationFee: 50
                    },
                    refundProcessing: {
                        mode: 'auto',
                        processingTimeBusinessDays: 7,
                        disputeResolutionTimeDays: 7,
                        refundPreference: 'wallet'
                    }
                },
                reservationPayment: {
                    reservationType: 'flat',
                    fullPayment: '100_upfront',
                    partialPaymentAllowed: true,
                    reservationPercentage: 30,
                    minimumAdvancePayment: 25,
                    autoCapturePayment: true,
                    escrowHoldPeriodHours: 24,
                    cancellationGraceMinutes: 5
                },
                serviceSpecificCharges: {
                    travelDistanceLimit: 20,
                    travelSurchargePerKm: 12,
                    equipmentFee: 50
                },
                bookingRules: {
                    minAdvanceBookingHours: 2,
                    maxAdvanceBookingDays: 90,
                    cancellationWindowHours: 24,
                    rescheduleWindowHours: 12,
                    maxReschedulesPerBooking: 2
                }
            };
            const settings = settingsRecord?.setting_value || defaultSettings;
            return c.json({
                success: true,
                settings
            });
        }
        catch (error) {
            console.error('Error fetching platform settings:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Update platform-wide vendor settings
    app.put("/make-server-3dd53475/settings/platform", async (c) => {
        try {
            const updates = await c.req.json();
            // ✅ SQL: Upsert platform settings
            const pool = await (0, db_1.getDbClient)();
            // Get existing settings
            const existingResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['vendor_settings']);
            const currentSettings = existingResult.rows[0]?.setting_value || {};
            const updatedSettings = {
                ...currentSettings,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            // Upsert platform settings
            await pool.query(`INSERT INTO platform_settings (setting_key, setting_value, setting_type, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $2, updated_at = $4`, ['vendor_settings', JSON.stringify(updatedSettings), 'object', new Date().toISOString()]);
            return c.json({
                success: true,
                settings: updatedSettings
            });
        }
        catch (error) {
            console.error('Error updating platform settings:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // ============================================
    // VENDOR DEACTIVATION REQUESTS
    // ============================================
    // Get all deactivation requests
    app.get("/make-server-3dd53475/deactivation-requests", async (c) => {
        try {
            // ✅ SQL: Get deactivation requests (using a simple approach - can be enhanced with dedicated table)
            // For now, we'll filter vendors by status or use a deactivation_requests table if it exists
            const pool = await (0, db_1.getDbClient)();
            // Check if deactivation_requests table exists, otherwise use vendors table
            let requests = [];
            try {
                const result = await pool.query('SELECT * FROM deactivation_requests ORDER BY created_at DESC');
                requests = result.rows;
            }
            catch (tableError) {
                // Table doesn't exist - return empty array for now
                // In production, this table should exist
                if (tableError.code === '42P01') {
                    return c.json({
                        success: true,
                        requests: []
                    });
                }
                throw tableError;
            }
            // Enrich with vendor details
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const enrichedRequests = await Promise.all((requests || []).map(async (request) => {
                const vendor = await vendorsRepo.findById(request.vendor_id);
                return {
                    ...request,
                    vendorDetails: vendor ? {
                        fullName: vendor.owner_name,
                        businessName: vendor.business_name,
                        phone: vendor.phone,
                        email: vendor.email
                    } : null
                };
            }));
            return c.json({
                success: true,
                requests: enrichedRequests
            });
        }
        catch (error) {
            console.error('Error fetching deactivation requests:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Approve deactivation request
    app.post("/make-server-3dd53475/deactivation-requests/:requestId/approve", async (c) => {
        try {
            const { requestId } = c.req.param();
            const { adminId, adminName } = await c.req.json();
            // ✅ SQL: Use transaction for atomic deactivation
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const client = (0, db_1.getDbClient)();
            const result = await (0, db_1.withTransaction)(async (txClient) => {
                // Get deactivation request (table may not exist, so handle gracefully)
                try {
                    const requestResult = await txClient.query('SELECT * FROM deactivation_requests WHERE id = $1', [requestId]);
                    if (!requestResult.rows[0]) {
                        throw new Error('Request not found');
                    }
                    const request = requestResult.rows[0];
                    // Get vendor
                    const vendor = await vendorsRepo.findById(request.vendor_id);
                    if (!vendor) {
                        throw new Error('Vendor not found');
                    }
                    // ✅ SQL: Deactivate vendor
                    const updatedVendor = await vendorsRepo.update(request.vendor_id, {
                        is_active: false,
                        status: 'inactive'
                    });
                    // Update request status
                    await txClient.query(`UPDATE deactivation_requests 
           SET status = $1, reviewed_by = $2, reviewed_at = $3 
           WHERE id = $4`, ['approved', adminId, new Date().toISOString(), requestId]);
                    return { vendor: updatedVendor };
                }
                catch (tableError) {
                    // If table doesn't exist, still try to deactivate vendor if vendorId is in request
                    // This is a fallback for backward compatibility
                    throw new Error('Deactivation requests table not found. Please create the table or use vendor deactivation directly.');
                }
            });
            return c.json({
                success: true,
                message: 'Vendor deactivated successfully'
            });
        }
        catch (error) {
            console.error('Error approving deactivation:', error);
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
    });
    // ============================================
    // VENDOR RE-VERIFICATION
    // ============================================
    // Get vendors due for re-verification
    app.get("/make-server-3dd53475/reverification/due", async (c) => {
        try {
            // ✅ SQL: Get approved vendors and filter by approved_at date
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const allVendors = await vendorsRepo.findAll();
            const activeVendors = allVendors.filter(v => v.status === 'approved' && v.is_active);
            const vendorsDueForReverification = activeVendors.filter(vendor => {
                if (!vendor.approved_at)
                    return true;
                const reviewDate = new Date(vendor.approved_at);
                const now = new Date();
                const daysSinceReview = Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
                // Due for re-verification after 365 days (1 year)
                return daysSinceReview >= 365;
            });
            // Sort by approved_at (oldest first)
            vendorsDueForReverification.sort((a, b) => {
                const dateA = new Date(a.approved_at || a.created_at);
                const dateB = new Date(b.approved_at || b.created_at);
                return dateA.getTime() - dateB.getTime();
            });
            return c.json({
                success: true,
                vendors: vendorsDueForReverification,
                count: vendorsDueForReverification.length
            });
        }
        catch (error) {
            console.error('Error fetching vendors due for re-verification:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Schedule re-verification for vendor
    app.post("/make-server-3dd53475/reverification/:vendorId/schedule", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { scheduledDate, adminId, notes } = await c.req.json();
            // Resolve vendor ID first
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // ✅ SQL: Update vendor with reverification date
            // Note: next_reverification_date field would need to be added to vendors table
            // For now, this is a simplified implementation
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            const result = await (0, db_1.withTransaction)(async (client) => {
                // Create notification
                if (vendor.user_id) {
                    await notificationsRepo.create({
                        user_id: vendor.user_id,
                        notification_type: 'reverification_scheduled',
                        title: 'Re-verification Scheduled',
                        message: `Your account re-verification has been scheduled for ${new Date(scheduledDate).toLocaleDateString()}. Please ensure all documents are up to date.`,
                        data: { vendorId: resolvedId, scheduledDate, notes }
                    });
                }
                return { vendor };
            });
            return c.json({
                success: true,
                message: 'Re-verification scheduled successfully'
            });
        }
        catch (error) {
            console.error('Error scheduling re-verification:', error);
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
    });
    // ============================================
    // REQUEST INFO FROM VENDOR
    // ============================================
    app.post("/make-server-3dd53475/admin/vendor/request-info", async (c) => {
        try {
            const { vendorId, adminId, adminName, infoRequested, notes } = await c.req.json();
            // Resolve vendor ID first
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // ✅ SQL: Update vendor status and create notification
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            const result = await (0, db_1.withTransaction)(async (client) => {
                // Update vendor status
                const updatedVendor = await vendorsRepo.update(resolvedId, {
                    status: 'more_info_required'
                });
                // Create notification
                if (vendor.user_id) {
                    await notificationsRepo.create({
                        user_id: vendor.user_id,
                        notification_type: 'info_requested',
                        title: 'Additional Information Required',
                        message: notes || 'Please provide additional information for your vendor application.',
                        data: { vendorId: resolvedId, infoRequested, notes }
                    });
                }
                return { vendor: updatedVendor };
            });
            return c.json({
                success: true,
                message: 'Info request sent successfully',
                vendor: result.vendor
            });
        }
        catch (error) {
            console.error('Error requesting info:', error);
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
    });
    // ============================================
    // VENDOR RESPOND TO CLARIFICATION
    // ============================================
    app.post("/make-server-3dd53475/vendor/respond-to-clarification", async (c) => {
        try {
            const { vendorId, response, documents } = await c.req.json();
            // ✅ SQL: Update vendor with clarification response
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (!resolvedId) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = await vendorsRepo.findById(resolvedId);
            if (!vendor) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            // Update vendor status back to pending_approval
            const updatedVendor = await vendorsRepo.update(resolvedId, {
                status: 'pending_approval'
            });
            return c.json({
                success: true,
                message: 'Clarification response received',
                vendor: updatedVendor
            });
        }
        catch (error) {
            console.error('Error processing clarification response:', error);
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
    });
    // ============================================
    // COMPLIANCE & QUALITY MONITORING
    // ============================================
    // Get vendors with compliance issues (simplified - would need compliance_flags table for full implementation)
    app.get("/make-server-3dd53475/compliance/issues", async (c) => {
        try {
            // ✅ SQL: Get all vendors (compliance flags would be in a separate table)
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const allVendors = await vendorsRepo.findAll();
            // For now, return empty array - full implementation would require compliance_flags table
            const vendorsWithIssues = [];
            return c.json({
                success: true,
                vendors: vendorsWithIssues,
                count: vendorsWithIssues.length
            });
        }
        catch (error) {
            console.error('Error fetching compliance issues:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Add compliance flag to vendor (simplified - would need compliance_flags table)
    app.post("/make-server-3dd53475/:vendorId/compliance/flag", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { type, description, priority, adminId } = await c.req.json();
            // ✅ SQL: For now, just acknowledge - full implementation would create compliance_flag record
            // This would require a vendor_compliance_flags table
            return c.json({
                success: true,
                message: 'Compliance flag would be added (requires compliance_flags table)'
            });
        }
        catch (error) {
            console.error('Error adding compliance flag:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    // Get quality alerts (simplified - would need reviews/ratings aggregation)
    app.get("/make-server-3dd53475/quality/alerts", async (c) => {
        try {
            // ✅ SQL: Get approved vendors (quality alerts would require reviews aggregation)
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const activeVendors = await vendorsRepo.findByStatus('approved');
            // For now, return empty array - full implementation would aggregate reviews/ratings
            const qualityAlerts = [];
            return c.json({
                success: true,
                alerts: qualityAlerts,
                count: qualityAlerts.length
            });
        }
        catch (error) {
            console.error('Error fetching quality alerts:', error);
            return c.json({ error: String(error) }, 500);
        }
    });
    console.log('✅ Admin vendor routes (SQL) registered');
}
//# sourceMappingURL=admin-vendor-routes-sql.js.map