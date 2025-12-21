import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

/**
 * VENDOR PROFILE UPDATE ENDPOINTS
 * Handles vendor profile updates with intelligent re-approval logic
 */

// Fields that require re-approval if changed
const CRITICAL_FIELDS = [
  'businessName',
  'fullName',
  'gstNumber',
  'panNumber',
  'licenseNumber',
  'aadhaarNumber',
  'bankDetails',
  'address',
  'location'
];

export function registerVendorProfileUpdateEndpoints(app: Hono) {
  
  /**
   * POST /vendor/:vendorId/profile/update
   * Update vendor profile - requires re-approval only if critical fields changed
   */
  app.post('/make-server-3dd53475/vendor/:vendorId/profile/update', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const updates = await c.req.json();
      
      console.log(`📝 [PROFILE-UPDATE] Vendor ${vendorId} updating profile`);
      
      // Get existing vendor profile
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Track original approval status
      const wasApproved = vendor.status === 'approved';
      const previousStatus = vendor.status;
      
      // Check if any critical fields are being changed
      let criticalFieldsChanged = false;
      const changedFields: string[] = [];
      
      for (const field of CRITICAL_FIELDS) {
        if (updates[field] !== undefined && 
            JSON.stringify(updates[field]) !== JSON.stringify(vendor[field])) {
          criticalFieldsChanged = true;
          changedFields.push(field);
        }
      }
      
      console.log(`🔍 [PROFILE-UPDATE] Critical fields changed: ${criticalFieldsChanged}`);
      console.log(`📋 [PROFILE-UPDATE] Changed fields: ${changedFields.join(', ')}`);
      
      // Update the vendor profile
      const updatedVendor = {
        ...vendor,
        ...updates,
        updatedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      // If critical fields changed and vendor was approved, require re-approval
      if (criticalFieldsChanged && wasApproved) {
        console.log(`⚠️ [PROFILE-UPDATE] Critical fields changed - requiring re-approval`);
        
        updatedVendor.status = 'pending';
        updatedVendor.previousStatus = previousStatus;
        updatedVendor.wasApprovedBefore = true;
        updatedVendor.reapprovalReason = `Critical profile fields updated: ${changedFields.join(', ')}`;
        updatedVendor.reapprovalRequestedAt = new Date().toISOString();
        
        // Create a notification for admin
        const notificationId = `admin_notification:profile_update:${vendorId}:${Date.now()}`;
        await kv.set(notificationId, {
          type: 'profile_update_review',
          vendorId: vendorId,
          vendorName: updatedVendor.fullName || updatedVendor.businessName,
          changedFields: changedFields,
          message: `Approved vendor "${updatedVendor.fullName || updatedVendor.businessName}" updated their profile. Re-approval required.`,
          createdAt: new Date().toISOString(),
          isRead: false,
          priority: 'medium'
        });
        
        await kv.set(vendorKey, updatedVendor);
        
        return c.json({
          success: true,
          message: 'Profile updated. Re-approval required for critical changes.',
          requiresReapproval: true,
          changedFields: changedFields,
          status: 'pending'
        });
      } else {
        // Non-critical fields only - no re-approval needed
        console.log(`✅ [PROFILE-UPDATE] Non-critical fields updated - no re-approval needed`);
        
        await kv.set(vendorKey, updatedVendor);
        
        return c.json({
          success: true,
          message: 'Profile updated successfully',
          requiresReapproval: false,
          status: vendor.status
        });
      }
      
    } catch (error) {
      console.error('❌ [PROFILE-UPDATE] Error updating profile:', error);
      return c.json({ error: 'Failed to update profile' }, 500);
    }
  });
  
  /**
   * GET /vendor/:vendorId/profile/edit-check
   * Check if vendor can edit profile and what will happen
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/profile/edit-check', async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const isApproved = vendor.status === 'approved';
      const canEdit = true; // Vendors can always edit
      
      return c.json({
        canEdit: canEdit,
        currentStatus: vendor.status,
        warning: isApproved 
          ? 'Editing critical profile fields will require admin re-approval' 
          : null,
        criticalFields: CRITICAL_FIELDS
      });
      
    } catch (error) {
      console.error('❌ [PROFILE-UPDATE] Error checking edit status:', error);
      return c.json({ error: 'Failed to check edit status' }, 500);
    }
  });
}
