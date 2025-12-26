/**
 * ============================================================================
 * VENDOR PROFILE UPDATE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Uses `vendors` table for vendor data
 * - Uses `notifications` table for admin notifications
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 5
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { getDbClient } from '../../lib/db.ts';

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
      
      // ✅ SQL: Get existing vendor profile
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Track original approval status
      const wasApproved = vendor.status === 'approved';
      const previousStatus = vendor.status;
      
      // Check if any critical fields are being changed
      let criticalFieldsChanged = false;
      const changedFields: string[] = [];
      
      // Map critical fields to SQL column names
      const fieldMapping: Record<string, string> = {
        'businessName': 'business_name',
        'fullName': 'owner_name',
        'gstNumber': 'gst_number',
        'panNumber': 'pan_number',
        'licenseNumber': 'license_number',
        'aadhaarNumber': 'aadhaar_number',
        'bankDetails': 'bank_details',
        'address': 'address',
        'location': 'location'
      };
      
      for (const field of CRITICAL_FIELDS) {
        const sqlField = fieldMapping[field] || field;
        const currentValue = (vendor as any)[sqlField];
        const newValue = updates[field] !== undefined ? updates[field] : updates[sqlField];
        
        if (newValue !== undefined && 
            JSON.stringify(newValue) !== JSON.stringify(currentValue)) {
          criticalFieldsChanged = true;
          changedFields.push(field);
        }
      }
      
      console.log(`🔍 [PROFILE-UPDATE] Critical fields changed: ${criticalFieldsChanged}`);
      console.log(`📋 [PROFILE-UPDATE] Changed fields: ${changedFields.join(', ')}`);
      
      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Map updates to SQL column names
      for (const [key, value] of Object.entries(updates)) {
        const sqlKey = fieldMapping[key] || key;
        updateData[sqlKey] = value;
      }
      
      // If critical fields changed and vendor was approved, require re-approval
      if (criticalFieldsChanged && wasApproved) {
        console.log(`⚠️ [PROFILE-UPDATE] Critical fields changed - requiring re-approval`);
        
        updateData.status = 'pending';
        updateData.previous_status = previousStatus;
        updateData.was_approved_before = true;
        updateData.reapproval_reason = `Critical profile fields updated: ${changedFields.join(', ')}`;
        updateData.reapproval_requested_at = new Date().toISOString();
        
        // ✅ SQL: Update vendor
        await vendorsRepo.update(vendorId, updateData);
        
        // ✅ SQL: Create notification for admin
        const notificationsRepo = getNotificationsRepository();
        await notificationsRepo.create({
          user_id: 'admin', // Admin user ID
          notification_type: 'profile_update_review',
          title: 'Vendor Profile Update Requires Review',
          message: `Approved vendor "${vendor.business_name || vendor.owner_name}" updated their profile. Re-approval required.`,
          data: {
            vendorId: vendorId,
            vendorName: vendor.business_name || vendor.owner_name,
            changedFields: changedFields,
            type: 'profile_update_review'
          }
        });
        
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
        
        // ✅ SQL: Update vendor
        await vendorsRepo.update(vendorId, updateData);
        
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
      
      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
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

