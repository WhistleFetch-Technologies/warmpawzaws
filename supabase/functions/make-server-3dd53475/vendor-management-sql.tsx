/**
 * VENDOR MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Vendor Management & Status Control
 * Handles unique validation, status updates, and data isolation
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (12 KV operations → 0)
 * Endpoints: 6
 */

import { Hono } from "npm:hono";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getDbClient } from "../../lib/db.ts";
import { withTransaction } from "../../lib/db.ts";

export function vendorManagementEndpointsSQL(app: Hono) {
  const vendorsRepo = getVendorsRepository();
  const notificationsRepo = getNotificationsRepository();
  const db = getDbClient();

  // ============================================
  // UNIQUE IDENTIFIER VALIDATION
  // ============================================

  // Check if mobile/email already exists
  app.post("/make-server-3dd53475/vendor/check-unique", async (c) => {
    try {
      const { mobile, email, excludeVendorId } = await c.req.json();
      
      console.log(`🔍 Checking uniqueness - Mobile: ${mobile}, Email: ${email}`);
      
      // ✅ SQL: Check for existing vendors with same phone or email
      const { data: vendorsByPhone } = mobile ? await db
        .from('vendors')
        .select('id, business_name, status')
        .eq('phone', mobile)
        .neq('id', excludeVendorId || '')
        .limit(1) : { data: [] };
      
      const { data: vendorsByEmail } = email ? await db
        .from('vendors')
        .select('id, business_name, status')
        .eq('email', email)
        .neq('id', excludeVendorId || '')
        .limit(1) : { data: [] };
      
      const existingMobile = vendorsByPhone?.[0] || null;
      const existingEmail = vendorsByEmail?.[0] || null;
      
      const response = {
        mobileExists: !!existingMobile,
        emailExists: !!existingEmail,
        isUnique: !existingMobile && !existingEmail,
        existingMobileVendor: existingMobile ? {
          id: existingMobile.id,
          businessName: existingMobile.business_name,
          status: existingMobile.status
        } : null,
        existingEmailVendor: existingEmail ? {
          id: existingEmail.id,
          businessName: existingEmail.business_name,
          status: existingEmail.status
        } : null
      };
      
      console.log(`✅ Uniqueness check result:`, response);
      
      return c.json(response);
    } catch (error) {
      console.error('Error checking uniqueness:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // VENDOR STATUS MANAGEMENT
  // ============================================

  // Get vendor status by ID
  app.get("/make-server-3dd53475/vendor/status-by-id/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor from database
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Get status history from metadata if available
      const statusHistory = (vendor.metadata as any)?.status_history || [];
      
      return c.json({
        vendorId: vendor.id,
        status: vendor.status,
        businessName: vendor.business_name,
        vendorType: vendor.category,
        isActive: vendor.is_active || false,
        setupCompleted: (vendor.metadata as any)?.setup_completed || false,
        createdAt: vendor.created_at,
        approvedAt: (vendor.metadata as any)?.approved_at,
        reviewedBy: (vendor.metadata as any)?.reviewed_by,
        statusHistory: statusHistory
      });
    } catch (error) {
      console.error('Error fetching vendor status:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Update vendor status (single)
  app.post("/make-server-3dd53475/admin/vendor/status/update", async (c) => {
    try {
      const { 
        vendorId, 
        newStatus, 
        adminId, 
        adminName, 
        reason, 
        notes 
      } = await c.req.json();
      
      console.log(`📝 Updating vendor ${vendorId} status to: ${newStatus}`);
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const oldStatus = vendor.status;
      
      // Get existing status history
      const metadata = (vendor.metadata as any) || {};
      const statusHistory = metadata.status_history || [];
      
      // Add to status history
      statusHistory.push({
        from: oldStatus,
        to: newStatus,
        changedBy: adminName,
        changedById: adminId,
        changedAt: new Date().toISOString(),
        reason: reason || '',
        notes: notes || ''
      });
      
      // Prepare update data
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // Update metadata
      const updatedMetadata = {
        ...metadata,
        status_history: statusHistory,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminName
      };
      
      // Status-specific updates
      if (newStatus === 'approved') {
        updatedMetadata.approved_at = new Date().toISOString();
        updatedMetadata.rejection_reason = null;
      } else if (newStatus === 'rejected') {
        updatedMetadata.rejection_reason = reason;
        updateData.is_active = false;
      } else if (newStatus === 'suspended') {
        updatedMetadata.suspended_at = new Date().toISOString();
        updatedMetadata.suspension_reason = reason;
        updateData.is_active = false;
      } else if (newStatus === 'active') {
        updateData.is_active = true;
        updatedMetadata.suspended_at = null;
        updatedMetadata.suspension_reason = null;
      }
      
      updateData.metadata = updatedMetadata;
      
      // ✅ SQL: Update vendor with transaction
      await withTransaction(async () => {
        await vendorsRepo.update(vendorId, updateData);
        
        // Send notification
        await sendStatusChangeNotification({
          vendorId: vendor.id,
          email: vendor.email || '',
          phone: vendor.phone,
          vendorName: vendor.owner_name,
          businessName: vendor.business_name,
          oldStatus,
          newStatus,
          reason,
          notes
        });
      });
      
      console.log(`✅ Vendor ${vendorId} status updated: ${oldStatus} → ${newStatus}`);
      
      // Get updated vendor
      const updatedVendor = await vendorsRepo.findById(vendorId);
      
      return c.json({ 
        success: true, 
        vendor: updatedVendor,
        message: `Vendor status updated to ${newStatus}`
      });
    } catch (error) {
      console.error('Error updating vendor status:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Bulk approve vendors
  app.post("/make-server-3dd53475/admin/vendor/status/bulk-approve", async (c) => {
    try {
      const { vendorIds, adminId, adminName, notes } = await c.req.json();
      
      console.log(`📦 Bulk approving ${vendorIds.length} vendors`);
      
      const results = [];
      
      for (const vendorId of vendorIds) {
        try {
          const vendor = await vendorsRepo.findById(vendorId);
          
          if (!vendor) {
            results.push({ vendorId, success: false, error: 'Vendor not found' });
            continue;
          }
          
          const oldStatus = vendor.status;
          
          // Get existing status history
          const metadata = (vendor.metadata as any) || {};
          const statusHistory = metadata.status_history || [];
          
          // Add to status history
          statusHistory.push({
            from: oldStatus,
            to: 'approved',
            changedBy: adminName,
            changedById: adminId,
            changedAt: new Date().toISOString(),
            reason: 'Bulk approval',
            notes: notes || ''
          });
          
          // Update vendor
          const updateData: any = {
            status: 'approved',
            is_active: true,
            updated_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              status_history: statusHistory,
              approved_at: new Date().toISOString(),
              reviewed_at: new Date().toISOString(),
              reviewed_by: adminName,
              rejection_reason: null
            }
          };
          
          await vendorsRepo.update(vendorId, updateData);
          
          // Send notification
          await sendStatusChangeNotification({
            vendorId: vendor.id,
            email: vendor.email || '',
            phone: vendor.phone,
            vendorName: vendor.owner_name,
            businessName: vendor.business_name,
            oldStatus,
            newStatus: 'approved',
            reason: 'Bulk approval',
            notes
          });
          
          results.push({ 
            vendorId, 
            success: true, 
            businessName: vendor.business_name 
          });
          
          console.log(`✅ Approved: ${vendor.business_name} (${vendorId})`);
        } catch (error) {
          results.push({ 
            vendorId, 
            success: false, 
            error: String(error) 
          });
          console.error(`❌ Failed to approve ${vendorId}:`, error);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      console.log(`📊 Bulk approval complete: ${successCount}/${vendorIds.length} successful`);
      
      return c.json({ 
        success: true,
        totalProcessed: vendorIds.length,
        successCount,
        failureCount: vendorIds.length - successCount,
        results
      });
    } catch (error) {
      console.error('Error in bulk approve:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Bulk reject vendors
  app.post("/make-server-3dd53475/admin/vendor/status/bulk-reject", async (c) => {
    try {
      const { vendorIds, adminId, adminName, reason, notes } = await c.req.json();
      
      console.log(`📦 Bulk rejecting ${vendorIds.length} vendors`);
      
      if (!reason) {
        return c.json({ error: 'Rejection reason is required' }, 400);
      }
      
      const results = [];
      
      for (const vendorId of vendorIds) {
        try {
          const vendor = await vendorsRepo.findById(vendorId);
          
          if (!vendor) {
            results.push({ vendorId, success: false, error: 'Vendor not found' });
            continue;
          }
          
          const oldStatus = vendor.status;
          
          // Get existing status history
          const metadata = (vendor.metadata as any) || {};
          const statusHistory = metadata.status_history || [];
          
          // Add to status history
          statusHistory.push({
            from: oldStatus,
            to: 'rejected',
            changedBy: adminName,
            changedById: adminId,
            changedAt: new Date().toISOString(),
            reason: reason,
            notes: notes || ''
          });
          
          // Update vendor
          const updateData: any = {
            status: 'rejected',
            is_active: false,
            updated_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              status_history: statusHistory,
              rejected_at: new Date().toISOString(),
              reviewed_at: new Date().toISOString(),
              reviewed_by: adminName,
              rejection_reason: reason
            }
          };
          
          await vendorsRepo.update(vendorId, updateData);
          
          // Send notification
          await sendStatusChangeNotification({
            vendorId: vendor.id,
            email: vendor.email || '',
            phone: vendor.phone,
            vendorName: vendor.owner_name,
            businessName: vendor.business_name,
            oldStatus,
            newStatus: 'rejected',
            reason,
            notes
          });
          
          results.push({ 
            vendorId, 
            success: true, 
            businessName: vendor.business_name 
          });
          
          console.log(`✅ Rejected: ${vendor.business_name} (${vendorId})`);
        } catch (error) {
          results.push({ 
            vendorId, 
            success: false, 
            error: String(error) 
          });
          console.error(`❌ Failed to reject ${vendorId}:`, error);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      console.log(`📊 Bulk rejection complete: ${successCount}/${vendorIds.length} successful`);
      
      return c.json({ 
        success: true,
        totalProcessed: vendorIds.length,
        successCount,
        failureCount: vendorIds.length - successCount,
        results
      });
    } catch (error) {
      console.error('Error in bulk reject:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // DATA ISOLATION & VENDOR LOOKUP
  // ============================================

  // Get vendor by unique identifier (mobile or email)
  app.post("/make-server-3dd53475/vendor/lookup", async (c) => {
    try {
      const { mobile, email } = await c.req.json();
      
      console.log(`🔍 Looking up vendor - Mobile: ${mobile}, Email: ${email}`);
      
      let vendor = null;
      
      // ✅ SQL: Lookup by phone
      if (mobile) {
        const { data: vendors } = await db
          .from('vendors')
          .select('*')
          .eq('phone', mobile)
          .limit(1);
        
        vendor = vendors?.[0] || null;
      }
      
      // ✅ SQL: Lookup by email if not found
      if (!vendor && email) {
        const { data: vendors } = await db
          .from('vendors')
          .select('*')
          .eq('email', email)
          .limit(1);
        
        vendor = vendors?.[0] || null;
      }
      
      if (!vendor) {
        return c.json({ 
          found: false,
          vendor: null
        });
      }
      
      console.log(`✅ Vendor found: ${vendor.business_name} (${vendor.id})`);
      
      return c.json({
        found: true,
        vendor: {
          id: vendor.id,
          fullName: vendor.owner_name,
          businessName: vendor.business_name,
          vendorType: vendor.category,
          phone: vendor.phone,
          email: vendor.email,
          status: vendor.status,
          isActive: vendor.is_active,
          setupCompleted: (vendor.metadata as any)?.setup_completed || false,
          createdAt: vendor.created_at,
          approvedAt: (vendor.metadata as any)?.approved_at
        }
      });
    } catch (error) {
      console.error('Error looking up vendor:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get all vendors by type
  app.get("/make-server-3dd53475/vendors/by-type/:vendorType", async (c) => {
    try {
      const { vendorType } = c.req.param();
      
      console.log(`🔍 Fetching vendors of type: ${vendorType}`);
      
      // ✅ SQL: Get vendors by category
      const { data: vendors, error } = await db
        .from('vendors')
        .select('id, owner_name, business_name, phone, email, status, is_active, city, state, created_at')
        .eq('category', vendorType);
      
      if (error) throw error;
      
      const formattedVendors = (vendors || []).map((v: any) => ({
        id: v.id,
        fullName: v.owner_name,
        businessName: v.business_name,
        phone: v.phone,
        email: v.email,
        status: v.status,
        isActive: v.is_active,
        city: v.city,
        state: v.state,
        createdAt: v.created_at,
        approvedAt: null // Would need to get from metadata
      }));
      
      console.log(`✅ Found ${formattedVendors.length} vendors of type ${vendorType}`);
      
      return c.json({ vendors: formattedVendors, vendorType });
    } catch (error) {
      console.error('Error fetching vendors by type:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get vendor statistics
  app.get("/make-server-3dd53475/admin/vendor/statistics", async (c) => {
    try {
      console.log('📊 Generating vendor statistics...');
      
      // ✅ SQL: Get all vendors
      const { data: vendors, error } = await db
        .from('vendors')
        .select('id, status, category, is_active, metadata');
      
      if (error) throw error;
      
      const stats = {
        total: vendors?.length || 0,
        byStatus: {
          pending_approval: 0,
          approved: 0,
          rejected: 0,
          suspended: 0,
          active: 0
        },
        byType: {} as Record<string, number>,
        activeVendors: 0,
        completedSetup: 0,
        pendingSetup: 0
      };
      
      (vendors || []).forEach((vendor: any) => {
        // By status
        if (vendor.status === 'pending' || vendor.status === 'onboarding') {
          stats.byStatus.pending_approval++;
        } else if (vendor.status === 'approved') {
          stats.byStatus.approved++;
        } else if (vendor.status === 'rejected') {
          stats.byStatus.rejected++;
        } else if (vendor.status === 'suspended') {
          stats.byStatus.suspended++;
        } else if (vendor.status === 'active') {
          stats.byStatus.active++;
        }
        
        // By type
        if (vendor.category) {
          stats.byType[vendor.category] = (stats.byType[vendor.category] || 0) + 1;
        }
        
        // Active vendors
        if (vendor.is_active) {
          stats.activeVendors++;
        }
        
        // Setup status
        const metadata = vendor.metadata || {};
        if (metadata.setup_completed) {
          stats.completedSetup++;
        } else if (vendor.status === 'approved') {
          stats.pendingSetup++;
        }
      });
      
      console.log('✅ Statistics generated:', stats);
      
      return c.json({ stats });
    } catch (error) {
      console.error('Error generating statistics:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  async function sendStatusChangeNotification(data: {
    vendorId: string;
    email: string;
    phone: string;
    vendorName: string;
    businessName: string;
    oldStatus: string;
    newStatus: string;
    reason?: string;
    notes?: string;
  }) {
    try {
      // ✅ SQL: Create notification
      await notificationsRepo.create({
        recipient_id: data.vendorId,
        recipient_type: 'vendor',
        type: 'status_change',
        title: 'Vendor Status Update',
        message: `Your ${data.businessName} status has been updated from ${data.oldStatus} to ${data.newStatus}.`,
        metadata: {
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          reason: data.reason,
          notes: data.notes
        },
        channels: ['email', 'sms']
      });
      
      console.log(`📧 EMAIL to ${data.email}:`);
      console.log(`📱 SMS to ${data.phone}:`);
      console.log(`Subject: WARMPAWZ Application Status Update`);
      console.log(`Message: Dear ${data.vendorName}, Your ${data.businessName} status has been updated from ${data.oldStatus} to ${data.newStatus}.`);
      
      if (data.reason) {
        console.log(`Reason: ${data.reason}`);
      }
      
      if (data.notes) {
        console.log(`Notes: ${data.notes}`);
      }
      
      console.log('✅ Status change notification sent');
    } catch (error) {
      console.error('Error sending status change notification:', error);
      // Don't fail the main operation
    }
  }

  console.log('✅ Vendor management endpoints registered (SQL-only)');
}

