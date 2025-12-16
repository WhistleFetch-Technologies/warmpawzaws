import { Hono } from "npm:hono";

/**
 * Vendor Management & Status Control
 * Handles unique validation, status updates, and data isolation
 */
export function vendorManagementEndpoints(app: Hono, kv: any) {

  // ============================================
  // UNIQUE IDENTIFIER VALIDATION
  // ============================================

  // Check if mobile/email already exists
  app.post("/make-server-3dd53475/vendor/check-unique", async (c) => {
    try {
      const { mobile, email, excludeVendorId } = await c.req.json();
      
      console.log(`🔍 Checking uniqueness - Mobile: ${mobile}, Email: ${email}`);
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      const existingMobile = allVendors.find((v: any) => 
        v && v.phone === mobile && v.id !== excludeVendorId
      );
      
      const existingEmail = allVendors.find((v: any) => 
        v && v.email === email && v.id !== excludeVendorId
      );
      
      const response = {
        mobileExists: !!existingMobile,
        emailExists: !!existingEmail,
        isUnique: !existingMobile && !existingEmail,
        existingMobileVendor: existingMobile ? {
          id: existingMobile.id,
          businessName: existingMobile.businessName,
          status: existingMobile.status
        } : null,
        existingEmailVendor: existingEmail ? {
          id: existingEmail.id,
          businessName: existingEmail.businessName,
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
  // NOTE: This route checks status by vendor ID, not phone number
  // For phone-based status check, use /vendor/status/:phone in vendor-approval-workflow
  app.get("/make-server-3dd53475/vendor/status-by-id/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      return c.json({
        vendorId: vendor.id,
        status: vendor.status,
        businessName: vendor.businessName,
        vendorType: vendor.vendorType,
        isActive: vendor.isActive || false,
        setupCompleted: vendor.setupCompleted || false,
        createdAt: vendor.createdAt,
        approvedAt: vendor.approvedAt,
        reviewedBy: vendor.reviewedBy,
        statusHistory: vendor.statusHistory || []
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
      
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const oldStatus = vendor.status;
      
      // Add to status history
      if (!vendor.statusHistory) {
        vendor.statusHistory = [];
      }
      
      vendor.statusHistory.push({
        from: oldStatus,
        to: newStatus,
        changedBy: adminName,
        changedById: adminId,
        changedAt: new Date().toISOString(),
        reason: reason || '',
        notes: notes || ''
      });
      
      // Update status
      vendor.status = newStatus;
      vendor.reviewedAt = new Date().toISOString();
      vendor.reviewedBy = adminName;
      
      // Status-specific updates
      if (newStatus === 'approved') {
        vendor.approvedAt = new Date().toISOString();
        vendor.rejectionReason = null;
      } else if (newStatus === 'rejected') {
        vendor.rejectionReason = reason;
        vendor.isActive = false;
      } else if (newStatus === 'suspended') {
        vendor.suspendedAt = new Date().toISOString();
        vendor.suspensionReason = reason;
        vendor.isActive = false;
      } else if (newStatus === 'active') {
        vendor.isActive = true;
        vendor.suspendedAt = null;
        vendor.suspensionReason = null;
      }
      
      await kv.set(`vendor:${vendorId}`, vendor);
      
      console.log(`✅ Vendor ${vendorId} status updated: ${oldStatus} → ${newStatus}`);
      
      // Send notification
      await sendStatusChangeNotification({
        vendorId: vendor.id,
        email: vendor.email,
        phone: vendor.phone,
        vendorName: vendor.fullName,
        businessName: vendor.businessName,
        oldStatus,
        newStatus,
        reason,
        notes
      });
      
      return c.json({ 
        success: true, 
        vendor,
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
          const vendor = await kv.get(`vendor:${vendorId}`);
          
          if (!vendor) {
            results.push({ vendorId, success: false, error: 'Vendor not found' });
            continue;
          }
          
          const oldStatus = vendor.status;
          
          // Add to status history
          if (!vendor.statusHistory) {
            vendor.statusHistory = [];
          }
          
          vendor.statusHistory.push({
            from: oldStatus,
            to: 'approved',
            changedBy: adminName,
            changedById: adminId,
            changedAt: new Date().toISOString(),
            reason: 'Bulk approval',
            notes: notes || ''
          });
          
          vendor.status = 'approved';
          vendor.approvedAt = new Date().toISOString();
          vendor.reviewedAt = new Date().toISOString();
          vendor.reviewedBy = adminName;
          vendor.rejectionReason = null;
          
          await kv.set(`vendor:${vendorId}`, vendor);
          
          // Send notification
          await sendStatusChangeNotification({
            vendorId: vendor.id,
            email: vendor.email,
            phone: vendor.phone,
            vendorName: vendor.fullName,
            businessName: vendor.businessName,
            oldStatus,
            newStatus: 'approved',
            reason: 'Bulk approval',
            notes
          });
          
          results.push({ 
            vendorId, 
            success: true, 
            businessName: vendor.businessName 
          });
          
          console.log(`✅ Approved: ${vendor.businessName} (${vendorId})`);
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
          const vendor = await kv.get(`vendor:${vendorId}`);
          
          if (!vendor) {
            results.push({ vendorId, success: false, error: 'Vendor not found' });
            continue;
          }
          
          const oldStatus = vendor.status;
          
          // Add to status history
          if (!vendor.statusHistory) {
            vendor.statusHistory = [];
          }
          
          vendor.statusHistory.push({
            from: oldStatus,
            to: 'rejected',
            changedBy: adminName,
            changedById: adminId,
            changedAt: new Date().toISOString(),
            reason: reason,
            notes: notes || ''
          });
          
          vendor.status = 'rejected';
          vendor.rejectedAt = new Date().toISOString();
          vendor.reviewedAt = new Date().toISOString();
          vendor.reviewedBy = adminName;
          vendor.rejectionReason = reason;
          vendor.isActive = false;
          
          await kv.set(`vendor:${vendorId}`, vendor);
          
          // Send notification
          await sendStatusChangeNotification({
            vendorId: vendor.id,
            email: vendor.email,
            phone: vendor.phone,
            vendorName: vendor.fullName,
            businessName: vendor.businessName,
            oldStatus,
            newStatus: 'rejected',
            reason,
            notes
          });
          
          results.push({ 
            vendorId, 
            success: true, 
            businessName: vendor.businessName 
          });
          
          console.log(`✅ Rejected: ${vendor.businessName} (${vendorId})`);
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
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      let vendor = null;
      
      if (mobile) {
        vendor = allVendors.find((v: any) => v && v.phone === mobile);
      }
      
      if (!vendor && email) {
        vendor = allVendors.find((v: any) => v && v.email === email);
      }
      
      if (!vendor) {
        return c.json({ 
          found: false,
          vendor: null
        });
      }
      
      console.log(`✅ Vendor found: ${vendor.businessName} (${vendor.id})`);
      
      return c.json({
        found: true,
        vendor: {
          id: vendor.id,
          fullName: vendor.fullName,
          businessName: vendor.businessName,
          vendorType: vendor.vendorType,
          phone: vendor.phone,
          email: vendor.email,
          status: vendor.status,
          isActive: vendor.isActive,
          setupCompleted: vendor.setupCompleted,
          createdAt: vendor.createdAt,
          approvedAt: vendor.approvedAt
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
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      const vendors = allVendors
        .filter((v: any) => v && v.vendorType === vendorType)
        .map((v: any) => ({
          id: v.id,
          fullName: v.fullName,
          businessName: v.businessName,
          phone: v.phone,
          email: v.email,
          status: v.status,
          isActive: v.isActive,
          city: v.city,
          state: v.state,
          createdAt: v.createdAt,
          approvedAt: v.approvedAt
        }));
      
      console.log(`✅ Found ${vendors.length} vendors of type ${vendorType}`);
      
      return c.json({ vendors, vendorType });
    } catch (error) {
      console.error('Error fetching vendors by type:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get vendor statistics
  app.get("/make-server-3dd53475/admin/vendor/statistics", async (c) => {
    try {
      console.log('📊 Generating vendor statistics...');
      
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      const stats = {
        total: allVendors.length,
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
      
      allVendors.forEach((vendor: any) => {
        if (!vendor || !vendor.id) return;
        
        // By status
        if (vendor.status && stats.byStatus[vendor.status as keyof typeof stats.byStatus] !== undefined) {
          stats.byStatus[vendor.status as keyof typeof stats.byStatus]++;
        }
        
        // By type
        if (vendor.vendorType) {
          stats.byType[vendor.vendorType] = (stats.byType[vendor.vendorType] || 0) + 1;
        }
        
        // Active vendors
        if (vendor.isActive) {
          stats.activeVendors++;
        }
        
        // Setup status
        if (vendor.setupCompleted) {
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
      const notificationId = `NOTIF${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const notification = {
        id: notificationId,
        vendorId: data.vendorId,
        type: 'status_change',
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        sentAt: new Date().toISOString(),
        channels: ['email', 'sms']
      };
      
      await kv.set(`notification:${notificationId}`, notification);
      
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
}