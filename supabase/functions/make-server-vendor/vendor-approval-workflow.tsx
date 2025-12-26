/**
 * ============================================================================
 * VENDOR APPROVAL WORKFLOW ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Vendor approval workflow endpoints:
 * - Approve vendor application
 * - Reject vendor application
 * - Request more information
 * - Check vendor status
 * - Resubmit application
 * - Get vendor history
 * - Bulk actions
 * - Get pending applications
 * 
 * CHANGES:
 * - Removed `kvStore` parameter from function signature
 * - Replaced all `kvStore.get()`, `kvStore.set()`, `kvStore.getByPrefix()` with repository calls
 * - All vendor operations use VendorsRepository
 * - All staff operations use StaffRepository
 * - All session operations use SessionsRepository
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { determineServiceCategory } from "./service-category-mapping.tsx";
import { normalizePhone, createVendorId, phonesMatch } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "../_shared/response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getSessionsRepository } from "../../lib/repositories/sessions.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getDbClient } from "../../lib/db.ts";

export function vendorApprovalWorkflowEndpoints(app: Hono) {
  
  /**
   * APPLICATION STATES:
   * - pending: Initial submission, awaiting admin review
   * - under_review: Admin is actively reviewing
   * - approved: Admin approved, vendor can access dashboard
   * - rejected: Admin rejected, vendor cannot proceed
   * - more_info_required: Admin needs clarification, vendor can resubmit
   * - resubmitted: Vendor resubmitted after more info request
   */

  // ============================================
  // ADMIN ACTIONS
  // ============================================

  /**
   * Approve vendor application
   * POST /make-server-3dd53475/admin/vendor/approve
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/vendor/approve", async (c) => {
    try {
      const { vendorId, approvedBy, notes } = await c.req.json();

      console.log('✅ APPROVE REQUEST RECEIVED:', {
        vendorId,
        approvedBy,
        notes
      });

      if (!vendorId) {
        console.error('❌ APPROVE FAILED: Missing vendorId');
        return c.json({ error: 'vendorId is required' }, 400);
      }

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      
      if (!vendor) {
        console.error(`❌ VENDOR NOT FOUND in database!`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      console.log('✅ VENDOR FOUND:', {
        id: vendor.id,
        name: vendor.owner_name || vendor.business_name,
        phone: vendor.phone,
        currentStatus: vendor.status,
        roleId: vendor.role_id
      });

      // ✅ SQL: Update vendor status to approved
      const updatedVendor = await getVendorsRepository().approve(vendorId, {
        approved_by: approvedBy || 'admin',
        approval_notes: notes || '',
      });

      // ✅ SQL: Create status history entry in platform_settings or dedicated table
      const client = getDbClient();
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `vendor:history:${vendorId}:${Date.now()}`,
          setting_value: {
            vendor_id: vendorId,
            application_id: vendor.application_id,
            action: 'approved',
            previous_status: vendor.status,
            new_status: 'approved',
            action_by: approvedBy || 'admin',
            notes: notes || '',
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        });

      // ✅ SQL: Create active vendor session token
      await getSessionsRepository().create({
        user_id: vendorId,
        user_type: 'vendor',
        token: `session_${vendorId}_${Date.now()}`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });

      // ✅ SQL: Auto-create staff record for individual vendors when approved
      console.log(`\n🔧 ===== AUTO-CREATING STAFF FOR APPROVED VENDOR =====`);
      console.log(`📝 Vendor ID: ${vendorId}`);
      console.log(`👤 Vendor Type: ${vendor.category}`);
      console.log(`🏥 Role ID: ${vendor.role_id}`);
      console.log(`📋 Service Category: ${vendor.category}`);
      
      // Check if this is an individual vendor
      const isIndividualVendor = vendor.category === 'service_provider' || 
                                 !vendor.business_name;
      
      console.log(`   Is Individual Vendor: ${isIndividualVendor}`);
      
      // For individual vendors, auto-create staff profile
      if (isIndividualVendor) {
        const staffId = `${vendorId}_staff_self`;
        
        // ✅ SQL: Check if staff already exists
        const existingStaff = await getStaffRepository().findById(staffId);
        
        if (!existingStaff) {
          console.log(`✅ Creating staff profile for individual vendor...`);
          
          // ✅ SQL: Create staff profile
          await getStaffRepository().create({
            vendor_id: vendorId,
            full_name: vendor.owner_name || vendor.business_name,
            phone: vendor.phone,
            email: vendor.email,
            role_type: vendor.role_id || 'staff',
            specialization: vendor.specializations?.[0] || '',
            experience_years: vendor.years_of_experience || 0,
            is_active: true,
          });
          
          console.log(`✅ Staff profile created: ${staffId}`);
        } else {
          console.log(`ℹ️ Staff profile already exists: ${staffId}`);
        }
      } else {
        console.log(`ℹ️ Business/Center vendor - staff profiles managed separately`);
      }

      // ✅ SQL: Send notification
      await getNotificationsRepository().create({
        recipient_type: 'vendor',
        recipient_id: vendorId,
        notification_type: 'vendor_application_approved',
        title: '✅ Application Approved - Welcome to Warmpawz!',
        message: `Congratulations! Your application has been approved. You can now start offering services on Warmpawz.`,
        channels: { email: true, sms: true, inApp: true, push: false },
        data: {
          vendorId,
          roleName: vendor.role_id,
        },
      });

      console.log(`✅ Vendor approved: ${vendorId}`);
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: `Vendor has been approved successfully`
      });
    } catch (error) {
      console.error('Error approving vendor:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Reject vendor application
   * POST /make-server-3dd53475/admin/vendor/reject
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/vendor/reject", async (c) => {
    try {
      const { vendorId, rejectedBy, reason } = await c.req.json();

      if (!vendorId || !reason) {
        return c.json({ error: 'vendorId and reason are required' }, 400);
      }

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Reject vendor
      const updatedVendor = await getVendorsRepository().reject(vendorId, {
        rejected_by: rejectedBy || 'admin',
        rejection_reason: reason,
      });

      // ✅ SQL: Create status history entry
      const client = getDbClient();
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `vendor:history:${vendorId}:${Date.now()}`,
          setting_value: {
            vendor_id: vendorId,
            application_id: vendor.application_id,
            action: 'rejected',
            previous_status: vendor.status,
            new_status: 'rejected',
            action_by: rejectedBy || 'admin',
            notes: reason,
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        });

      // ✅ SQL: Send notification
      await getNotificationsRepository().create({
        recipient_type: 'vendor',
        recipient_id: vendorId,
        notification_type: 'vendor_application_rejected',
        title: '❌ Application Status Update',
        message: `Your application has been reviewed. Reason: ${reason}. You may reapply after addressing the concerns.`,
        channels: { email: true, sms: true, inApp: true, push: false },
        data: {
          vendorId,
          rejectionReason: reason,
        },
      });

      console.log(`❌ Vendor rejected: ${vendorId}`);
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: `Vendor has been rejected`
      });
    } catch (error) {
      console.error('Error rejecting vendor:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Request more information from vendor
   * POST /make-server-3dd53475/admin/vendor/request-info
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/vendor/request-info", async (c) => {
    try {
      const { vendorId, requestedBy, message, requiredFields } = await c.req.json();

      if (!vendorId || !message) {
        return c.json({ error: 'vendorId and message are required' }, 400);
      }

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Update vendor status to more_info_required
      const client = getDbClient();
      await client
        .from('vendors')
        .update({
          status: 'more_info_required',
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorId);

      // ✅ SQL: Store info request in platform_settings
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `vendor:info_request:${vendorId}`,
          setting_value: {
            vendor_id: vendorId,
            requested_by: requestedBy || 'admin',
            requested_at: new Date().toISOString(),
            message,
            required_fields: requiredFields || [],
          },
          updated_at: new Date().toISOString(),
        });

      // ✅ SQL: Create status history entry
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `vendor:history:${vendorId}:${Date.now()}`,
          setting_value: {
            vendor_id: vendorId,
            application_id: vendor.application_id,
            action: 'info_requested',
            previous_status: vendor.status,
            new_status: 'more_info_required',
            action_by: requestedBy || 'admin',
            notes: message,
            required_fields: requiredFields || [],
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        });

      // ✅ SQL: Send notification
      await getNotificationsRepository().create({
        recipient_type: 'vendor',
        recipient_id: vendorId,
        notification_type: 'vendor_clarification_requested',
        title: '📋 Clarification Required for Your Application',
        message: `We need additional information for your application. ${message}`,
        channels: { email: true, sms: true, inApp: true, push: false },
        data: {
          vendorId,
          clarificationReason: message,
          requiredFields: requiredFields || [],
        },
      });

      console.log(`📋 Info requested from vendor: ${vendorId}`);
      
      return c.json({ 
        success: true, 
        message: `Information request sent to vendor`
      });
    } catch (error) {
      console.error('Error requesting info:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // VENDOR ACTIONS
  // ============================================

  /**
   * Check vendor application status
   * GET /make-server-3dd53475/vendor/status/:phone
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/status/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      console.log(`🔍 Checking status for phone: ${phone}`);

      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      // ✅ SQL: Clean phone and find vendor
      const cleanPhone = normalizePhone(phone);
      const vendor = await getVendorsRepository().findByPhone(cleanPhone);

      if (!vendor) {
        return c.json({ 
          status: 'not_found',
          hasApplication: false,
          message: 'No application found for this phone number'
        });
      }

      console.log(`✅ Found vendor: ${vendor.id}`);
      console.log(`   Status: ${vendor.status}`);

      // Return comprehensive status
      const response = {
        status: vendor.status,
        hasApplication: true,
        vendorId: vendor.id,
        applicationId: vendor.application_id,
        fullName: vendor.owner_name || vendor.business_name,
        roleName: vendor.role_id,
        roleId: vendor.role_id,
        isActive: vendor.is_active || false,
        setupCompleted: false, // TODO: Add setup tracking
        servicesConfigured: false, // TODO: Add service configuration tracking
        availabilityConfigured: false, // TODO: Add availability tracking
        serviceCategory: vendor.category,
        vendorType: vendor.category
      };

      return c.json(response);
    } catch (error) {
      console.error('❌ ERROR in status endpoint:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get vendor application for editing (when more info required)
   * GET /make-server-3dd53475/vendor/application/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/application/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Only allow editing if status is more_info_required
      if (vendor.status !== 'more_info_required') {
        return c.json({ 
          error: 'Application cannot be edited in current status',
          currentStatus: vendor.status
        }, 400);
      }

      // ✅ SQL: Get info request details
      const client = getDbClient();
      const { data: infoRequest } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `vendor:info_request:${vendorId}`)
        .maybeSingle();

      return c.json({ 
        vendor,
        canEdit: true,
        infoRequestMessage: infoRequest?.setting_value?.message || '',
        requiredFields: infoRequest?.setting_value?.required_fields || []
      });
    } catch (error) {
      console.error('Error fetching vendor application:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Resubmit vendor application after corrections
   * PUT /make-server-3dd53475/vendor/resubmit/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.put("/make-server-3dd53475/vendor/resubmit/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Only allow resubmission if status is more_info_required
      if (vendor.status !== 'more_info_required') {
        return c.json({ 
          error: 'Application cannot be resubmitted in current status',
          currentStatus: vendor.status
        }, 400);
      }

      // ✅ SQL: Update vendor with new data
      const updatedVendor = await getVendorsRepository().update(vendorId, {
        business_name: updates.formData?.businessName,
        owner_name: updates.formData?.fullName,
        email: updates.formData?.email,
        address: updates.formData?.address,
        city: updates.formData?.city,
        state: updates.formData?.state,
        pincode: updates.formData?.pincode,
        status: 'resubmitted',
      });

      // ✅ SQL: Create status history entry
      const client = getDbClient();
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `vendor:history:${vendorId}:${Date.now()}`,
          setting_value: {
            vendor_id: vendorId,
            application_id: vendor.application_id,
            action: 'resubmitted',
            previous_status: vendor.status,
            new_status: 'resubmitted',
            action_by: vendor.owner_name || vendor.business_name,
            notes: 'Application resubmitted with corrections',
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        });

      console.log(`🔄 Vendor resubmitted application: ${vendorId}`);
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: 'Application resubmitted successfully. Admin will review again.'
      });
    } catch (error) {
      console.error('Error resubmitting vendor application:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get vendor status history
   * GET /make-server-3dd53475/vendor/history/:vendorId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/history/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get history from platform_settings
      const client = getDbClient();
      const { data: historySettings } = await client
        .from('platform_settings')
        .select('*')
        .like('setting_key', `vendor:history:${vendorId}:%`);
      
      const history = historySettings?.map((hs: any) => hs.setting_value) || [];
      
      // Sort by timestamp descending
      history.sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return c.json({ history });
    } catch (error) {
      console.error('Error fetching vendor history:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Bulk status update (for admin panel)
   * POST /make-server-3dd53475/admin/vendor/bulk-action
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/vendor/bulk-action", async (c) => {
    try {
      const { vendorIds, action, actionBy, notes } = await c.req.json();

      if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
        return c.json({ error: 'vendorIds array is required' }, 400);
      }

      if (!['approve', 'reject'].includes(action)) {
        return c.json({ error: 'Invalid action. Must be approve or reject' }, 400);
      }

      const results = [];

      for (const vendorId of vendorIds) {
        try {
          // ✅ SQL: Get vendor
          const vendor = await getVendorsRepository().findById(vendorId);
          if (!vendor) {
            results.push({ vendorId, success: false, error: 'Not found' });
            continue;
          }

          const newStatus = action === 'approve' ? 'approved' : 'rejected';

          // ✅ SQL: Update vendor
          if (action === 'approve') {
            await getVendorsRepository().approve(vendorId, {
              approved_by: actionBy || 'admin',
              approval_notes: notes || '',
            });
          } else {
            await getVendorsRepository().reject(vendorId, {
              rejected_by: actionBy || 'admin',
              rejection_reason: notes || 'Bulk rejection',
            });
          }

          // ✅ SQL: Create history entry
          const client = getDbClient();
          await client
            .from('platform_settings')
            .upsert({
              setting_key: `vendor:history:${vendorId}:${Date.now()}`,
              setting_value: {
                vendor_id: vendorId,
                application_id: vendor.application_id,
                action: action === 'approve' ? 'approved' : 'rejected',
                previous_status: vendor.status,
                new_status: newStatus,
                action_by: actionBy || 'admin',
                notes: notes || '',
                timestamp: new Date().toISOString()
              },
              updated_at: new Date().toISOString(),
            });

          results.push({ vendorId, success: true, newStatus });
        } catch (error) {
          results.push({ vendorId, success: false, error: String(error) });
        }
      }

      const successCount = results.filter(r => r.success).length;

      return c.json({ 
        success: true,
        total: vendorIds.length,
        successful: successCount,
        failed: vendorIds.length - successCount,
        results
      });
    } catch (error) {
      console.error('Error performing bulk action:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get all pending applications (for admin dashboard)
   * GET /make-server-3dd53475/admin/vendor/pending
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/admin/vendor/pending", async (c) => {
    try {
      // ✅ SQL: Get all pending vendors
      const pendingVendors = await getVendorsRepository().findByStatus('pending');
      const resubmittedVendors = await getVendorsRepository().findByStatus('resubmitted');
      
      const allPending = [...pendingVendors, ...resubmittedVendors];

      // Sort by submission date
      allPending.sort((a, b) => 
        new Date(a.submitted_at || a.created_at).getTime() - 
        new Date(b.submitted_at || b.created_at).getTime()
      );

      return c.json({ 
        vendors: allPending,
        total: allPending.length
      });
    } catch (error) {
      console.error('Error fetching pending vendors:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Vendor approval workflow endpoints registered (SQL-only)');
}

