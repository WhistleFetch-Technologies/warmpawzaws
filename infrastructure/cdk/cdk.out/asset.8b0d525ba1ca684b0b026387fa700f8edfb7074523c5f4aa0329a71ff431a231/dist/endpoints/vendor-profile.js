"use strict";
/**
 * ============================================================================
 * VENDOR PROFILE MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor profile updates with intelligent re-approval logic:
 * - Update vendor profile
 * - Check edit permissions
 * - Re-approval workflow
 *
 * Migrated from: supabase/functions/server/vendor-profile-update.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorProfileEndpoints = registerVendorProfileEndpoints;
const rds_connection_1 = require("../database/rds-connection");
const sns_client_1 = require("../utils/sns-client");
const client_sns_1 = require("@aws-sdk/client-sns");
// Fields that require re-approval if changed
const CRITICAL_FIELDS = [
    'business_name',
    'owner_name',
    'gst_number',
    'pan_number',
    'registration_number',
    'address',
    'city',
    'state',
    'pincode',
    'latitude',
    'longitude',
];
function registerVendorProfileEndpoints(app) {
    /**
     * PUT /vendor/:vendorId/profile
     * Update vendor profile - requires re-approval only if critical fields changed
     */
    app.put("/vendor/:vendorId/profile", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const updates = await c.req.json();
            console.log(`📝 [PROFILE-UPDATE] Vendor ${vendorId} updating profile`);
            // Get existing vendor
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = vendors[0];
            const wasApproved = vendor.status === 'approved';
            const previousStatus = vendor.status;
            // Check if any critical fields are being changed
            let criticalFieldsChanged = false;
            const changedFields = [];
            for (const field of CRITICAL_FIELDS) {
                if (updates[field] !== undefined && updates[field] !== vendor[field]) {
                    criticalFieldsChanged = true;
                    changedFields.push(field);
                }
            }
            console.log(`🔍 [PROFILE-UPDATE] Critical fields changed: ${criticalFieldsChanged}`);
            console.log(`📋 [PROFILE-UPDATE] Changed fields: ${changedFields.join(', ')}`);
            // Prepare update data
            const updateData = {
                ...updates,
            };
            // If critical fields changed and vendor was approved, require re-approval
            if (criticalFieldsChanged && wasApproved) {
                console.log(`⚠️ [PROFILE-UPDATE] Critical fields changed - requiring re-approval`);
                updateData.status = 'pending';
                updateData.metadata = {
                    ...(vendor.metadata || {}),
                    previousStatus: previousStatus,
                    wasApprovedBefore: true,
                    reapprovalReason: `Critical profile fields updated: ${changedFields.join(', ')}`,
                    reapprovalRequestedAt: new Date().toISOString(),
                };
                // Create notification for admin (use recipient_id/recipient_type)
                await (0, rds_connection_1.insert)('notifications', {
                    recipient_id: null, // Admin notifications can have null recipient_id
                    recipient_type: 'admin',
                    title: 'Profile Update Review Required',
                    message: `Approved vendor "${vendor.business_name}" updated their profile. Re-approval required.`,
                    notification_type: 'admin_alert',
                    channels: { email: true, sms: false, inApp: true, push: false },
                    is_read: false,
                    // Note: notifications table doesn't have metadata column
                }).catch(() => { });
                // Send SNS notification
                const snsClient = (0, sns_client_1.getSnsClient)();
                await snsClient.send(new client_sns_1.PublishCommand({
                    TopicArn: process.env.ADMIN_ALERT_TOPIC_ARN,
                    Message: JSON.stringify({
                        eventType: 'VendorProfileUpdate',
                        vendorId: vendorId,
                        vendorName: vendor.business_name,
                        changedFields: changedFields,
                        requiresReapproval: true,
                    }),
                })).catch(err => console.error('SNS notification failed:', err));
                const updated = await (0, rds_connection_1.update)('vendors', { id: vendorId }, updateData);
                return c.json({
                    success: true,
                    message: 'Profile updated. Re-approval required for critical changes.',
                    requiresReapproval: true,
                    changedFields: changedFields,
                    status: 'pending',
                    vendor: updated[0],
                });
            }
            else {
                // Non-critical fields only - no re-approval needed
                console.log(`✅ [PROFILE-UPDATE] Non-critical fields updated - no re-approval needed`);
                const updated = await (0, rds_connection_1.update)('vendors', { id: vendorId }, updateData);
                return c.json({
                    success: true,
                    message: 'Profile updated successfully',
                    requiresReapproval: false,
                    status: vendor.status,
                    vendor: updated[0],
                });
            }
        }
        catch (error) {
            console.error('❌ [PROFILE-UPDATE] Error updating profile:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /vendor/:vendorId/profile/edit-check
     * Check if vendor can edit profile and what will happen
     */
    app.get("/vendor/:vendorId/profile/edit-check", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = vendors[0];
            const isApproved = vendor.status === 'approved';
            return c.json({
                canEdit: true, // Vendors can always edit
                currentStatus: vendor.status,
                warning: isApproved
                    ? 'Editing critical profile fields will require admin re-approval'
                    : null,
                criticalFields: CRITICAL_FIELDS,
            });
        }
        catch (error) {
            console.error('❌ [PROFILE-UPDATE] Error checking edit status:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /vendor/:vendorId/profile
     * Get vendor profile
     */
    app.get("/vendor/:vendorId/profile", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            return c.json({
                success: true,
                vendor: vendors[0],
            });
        }
        catch (error) {
            console.error('Error fetching vendor profile:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=vendor-profile.js.map