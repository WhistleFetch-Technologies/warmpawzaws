import { Hono } from "hono";
import * as kv from "./kv_store";

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
      
      // ✅ SQL: Get existing vendor profile using repository
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
      
      // Map SQL field names to expected field names
      const fieldMapping: Record<string, string> = {
        'businessName': 'business_name',
        'fullName': 'owner_name',
        'gstNumber': 'gst_number',
        'panNumber': 'pan_number',
        'address': 'address'
      };
      
      for (const field of CRITICAL_FIELDS) {
        const sqlField = fieldMapping[field] || field;
        const currentValue = vendor[sqlField as keyof typeof vendor];
        const newValue = updates[field];
        
        if (newValue !== undefined && 
            JSON.stringify(newValue) !== JSON.stringify(currentValue)) {
          criticalFieldsChanged = true;
          changedFields.push(field);
        }
      }
      
      console.log(`🔍 [PROFILE-UPDATE] Critical fields changed: ${criticalFieldsChanged}`);
      console.log(`📋 [PROFILE-UPDATE] Changed fields: ${changedFields.join(', ')}`);
      
      // ✅ SQL: Map updates to SQL field names
      const sqlUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        const sqlField = fieldMapping[key] || key;
        sqlUpdates[sqlField] = value;
      }
      sqlUpdates.updated_at = new Date().toISOString();
      
      // If critical fields changed and vendor was approved, require re-approval
      if (criticalFieldsChanged && wasApproved) {
        console.log(`⚠️ [PROFILE-UPDATE] Critical fields changed - requiring re-approval`);
        
        sqlUpdates.status = 'pending';
        sqlUpdates.metadata = {
          ...(vendor.metadata || {}),
          previousStatus: previousStatus,
          wasApprovedBefore: true,
          reapprovalReason: `Critical profile fields updated: ${changedFields.join(', ')}`,
          reapprovalRequestedAt: new Date().toISOString()
        };
        
        // ✅ SQL: Create a notification for admin
        const notificationsRepo = getNotificationsRepository();
        await notificationsRepo.create({
          recipient_id: 'admin', // Admin notification
          recipient_type: 'admin',
          type: 'profile_update_review',
          title: 'Vendor Profile Update - Re-approval Required',
          message: `Approved vendor "${vendor.owner_name || vendor.business_name}" updated their profile. Re-approval required.`,
          metadata: {
            vendorId: vendorId,
            vendorName: vendor.owner_name || vendor.business_name,
            changedFields: changedFields
          },
          priority: 'medium'
        });
        
        // ✅ SQL: Update vendor
        await vendorsRepo.update(vendorId, sqlUpdates);
        
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
        
        // ✅ SQL: Update vendor (non-critical fields only)
        await vendorsRepo.update(vendorId, sqlUpdates);
        
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
      
      // ✅ SQL: Get vendor using repository
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
