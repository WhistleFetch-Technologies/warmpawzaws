import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { safeGet, safeSet, safeGetByPrefix, tryGet, trySet } from "./kv-safe.tsx";

export function registerAdminVendorRoutes(app: Hono) {

// ============================================
// VENDOR ADMINISTRATION - OVERVIEW & STATS
// ============================================

// Get vendor statistics and overview
app.get("/make-server-3dd53475/admin/vendors/stats", async (c) => {
  try {
    console.log('Fetching vendor statistics...');
    
    // Optimized: Use cached stats if available and fresh (less than 5 minutes old)
    const cachedStats = await tryGet('admin:vendor_stats_cache', null, { timeout: 3000 });
    if (cachedStats && cachedStats.cachedAt) {
      const cacheAge = Date.now() - new Date(cachedStats.cachedAt).getTime();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (cacheAge < fiveMinutes) {
        console.log('✅ Returning cached stats (age: ' + Math.round(cacheAge / 1000) + 's)');
        return c.json({
          success: true,
          stats: cachedStats.stats,
          cached: true
        });
      }
    }
    
    console.log('📊 Computing fresh stats...');
    
    // ✅ FIX: Use safe getByPrefix with timeout and limit
    const allVendors = await safeGetByPrefix('vendor:', { 
      timeout: 10000, // 10 second timeout
      retries: 1,
      limit: 1000 // Limit to prevent huge queries
    });
    
    console.log(`Total vendor records found: ${allVendors.length}`);
    
    // Filter to actual vendor records (exclude metadata)
    const vendors = allVendors.filter((v: any) => {
      if (!v || typeof v !== 'object') return false;
      if (v.applicationId === v.id || (v.id && String(v.id).startsWith('APP'))) return false;
      if (v.type === 'index' || v.type === 'metadata') return false;
      const id = v.id || v.vendorId;
      if (id && String(id).startsWith('vendor_')) return true;
      const hasName = !!(v.businessName || v.fullName);
      const hasPhone = !!v.phone;
      const hasRole = !!v.role || !!v.roleId || !!v.roleName;
      if (hasName && hasPhone && hasRole) {
        if (v.documents && v.documents.length > 0 && v.formData) return false;
        return true;
      }
      return false;
    });
    
    console.log(`Filtered vendor count: ${vendors.length}`);
    
    // Calculate statistics efficiently
    const activeVendors = vendors.filter(v => v.status === 'approved' && !v.deactivated);
    const pendingApplications = vendors.filter(v => v.status === 'pending_approval');
    const deactivatedVendors = vendors.filter(v => v.deactivated === true);
    const rejectedVendors = vendors.filter(v => v.status === 'rejected');
    
    // Get compliance issues (simplified)
    const complianceIssues = vendors.filter(v => v.complianceFlags && v.complianceFlags.length > 0);
    const highPriorityIssues = complianceIssues.filter(v => 
      v.complianceFlags?.some((flag: any) => flag.priority === 'high')
    );
    
    // Simplified support tickets count (use cache or skip for now)
    let supportTicketCount = 0;
    let openTicketCount = 0;
    
    // Simplified quality alerts
    const qualityAlerts = vendors.filter(v => {
      if (!v.rating) return false;
      return v.rating < 3.5 || (v.complaints && v.complaints.length > 0);
    });
    
    // Pending today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingToday = pendingApplications.filter(v => {
      if (!v.submittedAt) return false;
      const submittedDate = new Date(v.submittedAt);
      return submittedDate >= today;
    });
    
    // Distribution by category (simplified)
    const distributionByCategory: any = {};
    vendors.forEach(vendor => {
      if (vendor.serviceCategory) {
        distributionByCategory[vendor.serviceCategory] = (distributionByCategory[vendor.serviceCategory] || 0) + 1;
      }
    });
    
    const stats = {
      activeVendors: {
        count: activeVendors.length,
        percentage: vendors.length > 0 ? Math.round((activeVendors.length / vendors.length) * 100) : 0
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
    
    // Cache the stats for 5 minutes
    try {
      await safeSet('admin:vendor_stats_cache', {
        stats,
        cachedAt: new Date().toISOString()
      }, { timeout: 3000 });
      console.log('✅ Stats computed and cached');
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache stats (non-critical):', cacheError);
      // Continue anyway - caching failure shouldn't break the request
    }
    
    return c.json({
      success: true,
      stats,
      cached: false
    });
  } catch (error) {
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
    
    // FIX: Get ALL vendors with prefix 'vendor:' not 'vendor:vendor_'
    const allVendors = await kv.getByPrefix('vendor:');
    console.log(`📊 Total vendors found: ${allVendors.length}`);
    
    let pendingVendors = allVendors.filter(v => v.status === 'pending_approval');
    console.log(`⏳ Pending vendors found: ${pendingVendors.length}`);
    
    // Filter by category
    if (category !== 'all') {
      pendingVendors = pendingVendors.filter(v => 
        v.services && v.services.includes(category)
      );
    }
    
    // Filter by priority (calculated based on waiting time and completeness)
    if (priority !== 'all') {
      pendingVendors = pendingVendors.map(v => {
        const daysSinceSubmission = Math.floor(
          (Date.now() - new Date(v.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        let calculatedPriority = 'low';
        if (daysSinceSubmission > 7) calculatedPriority = 'high';
        else if (daysSinceSubmission > 3) calculatedPriority = 'medium';
        
        return { ...v, priority: calculatedPriority };
      }).filter(v => v.priority === priority);
    }
    
    // Calculate progress for each vendor
    const vendorsWithProgress = pendingVendors.map(vendor => {
      let totalFields = 0;
      let filledFields = 0;
      
      // Basic info
      totalFields += 6;
      if (vendor.fullName) filledFields++;
      if (vendor.phone) filledFields++;
      if (vendor.email) filledFields++;
      if (vendor.address) filledFields++;
      if (vendor.services && vendor.services.length > 0) filledFields++;
      if (vendor.experience) filledFields++;
      
      // Documents
      totalFields += 4;
      if (vendor.aadhaarNumber) filledFields++;
      if (vendor.panNumber) filledFields++;
      if (vendor.gstNumber) filledFields++;
      if (vendor.bankDetails && vendor.bankDetails.accountNumber) filledFields++;
      
      const progressPercentage = Math.round((filledFields / totalFields) * 100);
      
      return {
        ...vendor,
        progressPercentage,
        daysSinceSubmission: Math.floor(
          (Date.now() - new Date(vendor.submittedAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      };
    });
    
    // Sort by submission date (newest first)
    vendorsWithProgress.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    
    return c.json({
      success: true,
      applications: vendorsWithProgress,
      count: vendorsWithProgress.length
    });
  } catch (error) {
    console.error('Error fetching pending applications:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get single vendor application details
app.get("/make-server-3dd53475/applications/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    return c.json({
      success: true,
      vendor
    });
  } catch (error) {
    console.error('Error fetching vendor application:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Approve vendor application
app.post("/make-server-3dd53475/admin/vendor/application/:vendorId/approve", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { adminId, adminName, notes } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Accept both 'pending' and 'pending_approval' statuses
    if (vendor.status !== 'pending_approval' && vendor.status !== 'pending') {
      return c.json({ error: 'Vendor is not pending approval', currentStatus: vendor.status }, 400);
    }
    
    // Update vendor status
    vendor.status = 'approved';
    vendor.reviewedBy = adminId;
    vendor.reviewedByName = adminName;
    vendor.reviewedAt = new Date().toISOString();
    vendor.approvalNotes = notes;
    vendor.isActive = true;
    
    await kv.set(`vendor:${vendorId}`, vendor);
    
    // Remove from pending list and add to approved list
    const pendingList = await kv.get('vendor:pending_approvals') || [];
    const updatedPending = pendingList.filter((id: string) => id !== vendorId);
    await kv.set('vendor:pending_approvals', updatedPending);
    
    const approvedList = await kv.get('vendor:approved_list') || [];
    approvedList.push(vendorId);
    await kv.set('vendor:approved_list', approvedList);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'application_approved',
      title: 'Application Approved',
      message: 'Congratulations! Your vendor application has been approved. You can now start accepting bookings.',
      read: false,
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Vendor approved successfully:', vendorId);
    
    return c.json({
      success: true,
      message: 'Vendor approved successfully',
      vendor
    });
  } catch (error) {
    console.error('Error approving vendor:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Approve vendor application (plural endpoint for backward compatibility)
app.post("/make-server-3dd53475/admin/vendors/applications/:vendorId/approve", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { adminId, adminName, notes } = await c.req.json();
    
    console.log('🔍 Attempting to approve vendor:', vendorId);
    console.log('📦 Looking for key:', `vendor:${vendorId}`);
    
    // First try direct lookup
    let vendor = await kv.get(`vendor:${vendorId}`);
    let actualKey = `vendor:${vendorId}`;
    
    if (!vendor) {
      console.log('⚠️ Direct lookup failed, searching database for matching vendor...');
      
      // Query database directly to find the vendor
      const { createClient } = await import('jsr:@supabase/supabase-js@2.49.8');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      );
      
      const { data: kvRecords, error } = await supabase
        .from('kv_store_3dd53475')
        .select('key, value')
        .like('key', 'vendor:%');
      
      if (error) {
        console.error('❌ Database query error:', error);
        return c.json({ error: 'Database error' }, 500);
      }
      
      // Find vendor by matching the vendorId in the value OR in the key
      const matchingRecord = kvRecords?.find((record: any) => {
        const v = record.value;
        const key = record.key;
        
        // Check if the key ends with the vendorId
        if (key === `vendor:${vendorId}`) return true;
        
        // Check if the value has matching id or vendorId
        if (v.id === vendorId || v.vendorId === vendorId) return true;
        
        // Check if the key contains the vendorId (in case of different formats)
        if (key.includes(vendorId)) return true;
        
        return false;
      });
      
      if (matchingRecord) {
        vendor = matchingRecord.value;
        actualKey = matchingRecord.key;
        console.log('✅ Found vendor with key:', actualKey);
        console.log('📋 Vendor ID in data:', vendor.id);
      } else {
        console.error('❌ Vendor not found with ID:', vendorId);
        console.log('📊 Total vendors in database:', kvRecords?.length || 0);
        
        // Log first few vendor keys for debugging
        console.log('📝 Sample vendor keys:', kvRecords?.slice(0, 5).map((r: any) => r.key));
        
        return c.json({ error: 'Vendor not found', vendorId, searchKey: `vendor:${vendorId}` }, 404);
      }
    }
    
    console.log('📋 Vendor found with status:', vendor.status);
    
    // Accept both 'pending' and 'pending_approval' statuses
    if (vendor.status !== 'pending_approval' && vendor.status !== 'pending') {
      console.error('❌ Vendor status is not pending:', vendor.status);
      return c.json({ error: 'Vendor is not pending approval', currentStatus: vendor.status }, 400);
    }
    
    // ✅ DUPLICATE CHECK: Before approving, check if phone/email are already used by an approved vendor
    console.log('🔍 Checking for duplicate phone/email in approved vendors...');
    
    const { createClient } = await import('jsr:@supabase/supabase-js@2.49.8');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    // Import phone utils for normalization
    const { normalizePhone } = await import('./phone-utils.tsx');
    const cleanPhone = normalizePhone(vendor.phone || '');
    const cleanEmail = vendor.email?.toLowerCase().trim();
    
    // Query all vendor records
    const { data: allVendorRecords, error: queryError } = await supabase
      .from('kv_store_3dd53475')
      .select('key, value')
      .like('key', 'vendor:vendor_%');
    
    if (!queryError && allVendorRecords) {
      // Check for duplicate phone in approved vendors
      const duplicatePhone = allVendorRecords.find((record: any) => {
        const v = record.value;
        
        // Skip if it's the same vendor
        if (v.id === vendorId || record.key === actualKey) return false;
        
        // Only check approved vendors
        if (v.status !== 'approved') return false;
        
        // Check phone match
        if (v.phone) {
          const vCleanPhone = normalizePhone(v.phone);
          if (vCleanPhone === cleanPhone && cleanPhone) {
            console.error(`❌ Duplicate phone found in approved vendor: ${v.id}`);
            return true;
          }
        }
        
        return false;
      });
      
      if (duplicatePhone) {
        const dupVendor = duplicatePhone.value;
        console.error('❌ DUPLICATE PHONE NUMBER DETECTED!');
        console.error(`   Current vendor: ${vendorId} - ${vendor.fullName || vendor.businessName}`);
        console.error(`   Existing approved vendor: ${dupVendor.id} - ${dupVendor.fullName || dupVendor.businessName}`);
        console.error(`   Phone: ${vendor.phone} (normalized: ${cleanPhone})`);
        
        return c.json({ 
          error: 'Cannot approve: A vendor with this phone number is already approved',
          duplicateField: 'phone',
          duplicateVendor: {
            id: dupVendor.id,
            name: dupVendor.fullName || dupVendor.businessName,
            phone: dupVendor.phone,
            status: dupVendor.status
          }
        }, 409); // 409 Conflict
      }
      
      // Check for duplicate email in approved vendors
      if (cleanEmail) {
        const duplicateEmail = allVendorRecords.find((record: any) => {
          const v = record.value;
          
          // Skip if it's the same vendor
          if (v.id === vendorId || record.key === actualKey) return false;
          
          // Only check approved vendors
          if (v.status !== 'approved') return false;
          
          // Check email match
          if (v.email) {
            const vCleanEmail = v.email?.toLowerCase().trim();
            if (vCleanEmail === cleanEmail) {
              console.error(`❌ Duplicate email found in approved vendor: ${v.id}`);
              return true;
            }
          }
          
          return false;
        });
        
        if (duplicateEmail) {
          const dupVendor = duplicateEmail.value;
          console.error('❌ DUPLICATE EMAIL DETECTED!');
          console.error(`   Current vendor: ${vendorId} - ${vendor.fullName || vendor.businessName}`);
          console.error(`   Existing approved vendor: ${dupVendor.id} - ${dupVendor.fullName || dupVendor.businessName}`);
          console.error(`   Email: ${vendor.email}`);
          
          return c.json({ 
            error: 'Cannot approve: A vendor with this email is already approved',
            duplicateField: 'email',
            duplicateVendor: {
              id: dupVendor.id,
              name: dupVendor.fullName || dupVendor.businessName,
              email: dupVendor.email,
              status: dupVendor.status
            }
          }, 409); // 409 Conflict
        }
      }
    }
    
    console.log('✅ No duplicates found, proceeding with approval...');
    
    // Update vendor status
    vendor.status = 'approved';
    vendor.reviewedBy = adminId;
    vendor.reviewedByName = adminName;
    vendor.reviewedAt = new Date().toISOString();
    vendor.approvalNotes = notes;
    vendor.isActive = true;
    
    // Save using the actual key we found
    await kv.set(actualKey, vendor);
    
    // Remove from pending list and add to approved list
    const pendingList = await kv.get('vendor:pending_approvals') || [];
    const updatedPending = pendingList.filter((id: string) => id !== vendorId);
    await kv.set('vendor:pending_approvals', updatedPending);
    
    const approvedList = await kv.get('vendor:approved_list') || [];
    approvedList.push(vendorId);
    await kv.set('vendor:approved_list', approvedList);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'application_approved',
      title: 'Application Approved',
      message: 'Congratulations! Your vendor application has been approved. You can now start accepting bookings.',
      read: false,
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Vendor approved successfully:', vendorId);
    
    return c.json({
      success: true,
      message: 'Vendor approved successfully',
      vendor
    });
  } catch (error) {
    console.error('Error approving vendor:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Reject vendor application
app.post("/make-server-3dd53475/admin/vendor/application/:vendorId/reject", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { adminId, adminName, reason, rejectionNotes } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Accept both 'pending' and 'pending_approval' statuses
    if (vendor.status !== 'pending_approval' && vendor.status !== 'pending') {
      return c.json({ error: 'Vendor is not pending approval', currentStatus: vendor.status }, 400);
    }
    
    // Update vendor status
    vendor.status = 'rejected';
    vendor.isActive = false;
    vendor.reviewedBy = adminId;
    vendor.reviewedByName = adminName;
    vendor.reviewedAt = new Date().toISOString();
    vendor.rejectionReason = reason;
    vendor.rejectionNotes = rejectionNotes;
    
    await kv.set(`vendor:${vendorId}`, vendor);
    
    // Remove from pending list
    const pendingList = await kv.get('vendor:pending_approvals') || [];
    const updatedPending = pendingList.filter((id: string) => id !== vendorId);
    await kv.set('vendor:pending_approvals', updatedPending);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'application_rejected',
      title: 'Application Rejected',
      message: `Unfortunately, your vendor application has been rejected. Reason: ${reason}`,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Vendor rejected successfully:', vendorId);
    
    return c.json({
      success: true,
      message: 'Vendor rejected',
      vendor
    });
  } catch (error) {
    console.error('Error rejecting vendor:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Reject vendor application (plural endpoint for backward compatibility)
app.post("/make-server-3dd53475/admin/vendors/applications/:vendorId/reject", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { adminId, adminName, reason, rejectionNotes } = await c.req.json();
    
    console.log('🔍 Attempting to reject vendor:', vendorId);
    console.log('📦 Looking for key:', `vendor:${vendorId}`);
    
    // First try direct lookup
    let vendor = await kv.get(`vendor:${vendorId}`);
    let actualKey = `vendor:${vendorId}`;
    
    if (!vendor) {
      console.log('⚠️ Direct lookup failed, searching database for matching vendor...');
      
      // Query database directly to find the vendor
      const { createClient } = await import('jsr:@supabase/supabase-js@2.49.8');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      );
      
      const { data: kvRecords, error } = await supabase
        .from('kv_store_3dd53475')
        .select('key, value')
        .like('key', 'vendor:%');
      
      if (error) {
        console.error('❌ Database query error:', error);
        return c.json({ error: 'Database error' }, 500);
      }
      
      // Find vendor by matching the vendorId in the value OR in the key
      const matchingRecord = kvRecords?.find((record: any) => {
        const v = record.value;
        const key = record.key;
        
        // Check if the key ends with the vendorId
        if (key === `vendor:${vendorId}`) return true;
        
        // Check if the value has matching id or vendorId
        if (v.id === vendorId || v.vendorId === vendorId) return true;
        
        // Check if the key contains the vendorId (in case of different formats)
        if (key.includes(vendorId)) return true;
        
        return false;
      });
      
      if (matchingRecord) {
        vendor = matchingRecord.value;
        actualKey = matchingRecord.key;
        console.log('✅ Found vendor with key:', actualKey);
        console.log('📋 Vendor ID in data:', vendor.id);
      } else {
        console.error('❌ Vendor not found with ID:', vendorId);
        console.log('📊 Total vendors in database:', kvRecords?.length || 0);
        
        return c.json({ error: 'Vendor not found', vendorId, searchKey: `vendor:${vendorId}` }, 404);
      }
    }
    
    console.log('📋 Vendor found with status:', vendor.status);
    
    // Accept both 'pending' and 'pending_approval' statuses
    if (vendor.status !== 'pending_approval' && vendor.status !== 'pending') {
      console.error('❌ Vendor status is not pending:', vendor.status);
      return c.json({ error: 'Vendor is not pending approval', currentStatus: vendor.status }, 400);
    }
    
    // Update vendor status
    vendor.status = 'rejected';
    vendor.isActive = false;
    vendor.reviewedBy = adminId;
    vendor.reviewedByName = adminName;
    vendor.reviewedAt = new Date().toISOString();
    vendor.rejectionReason = reason;
    vendor.rejectionNotes = rejectionNotes;
    
    // Save using the actual key we found
    await kv.set(actualKey, vendor);
    
    // Remove from pending list
    const pendingList = await kv.get('vendor:pending_approvals') || [];
    const updatedPending = pendingList.filter((id: string) => id !== vendorId);
    await kv.set('vendor:pending_approvals', updatedPending);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'application_rejected',
      title: 'Application Rejected',
      message: `Unfortunately, your vendor application has been rejected. Reason: ${reason}`,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Vendor rejected successfully:', vendorId);
    
    return c.json({
      success: true,
      message: 'Vendor rejected',
      vendor
    });
  } catch (error) {
    console.error('Error rejecting vendor:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// VENDOR SETTINGS & POLICIES
// ============================================

// Get platform-wide vendor settings
app.get("/make-server-3dd53475/settings/platform", async (c) => {
  try {
    const settings = await kv.get('admin:platform:vendor_settings') || {
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
          processingTimeBusinessDays: 1000,
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
    
    return c.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Update platform-wide vendor settings
app.put("/make-server-3dd53475/settings/platform", async (c) => {
  try {
    const updates = await c.req.json();
    
    const currentSettings = await kv.get('admin:platform:vendor_settings') || {};
    const updatedSettings = {
      ...currentSettings,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set('admin:platform:vendor_settings', updatedSettings);
    
    return c.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
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
    const requests = await kv.getByPrefix('vendor:deactivation_request:') || [];
    
    // Enrich with vendor details
    const enrichedRequests = await Promise.all(
      requests.map(async (request: any) => {
        const vendor = await kv.get(`vendor:${request.vendorId}`);
        return {
          ...request,
          vendorDetails: vendor ? {
            fullName: vendor.fullName,
            businessName: vendor.businessName,
            phone: vendor.phone,
            email: vendor.email,
            services: vendor.services
          } : null
        };
      })
    );
    
    // Sort by request date (newest first)
    enrichedRequests.sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    
    return c.json({
      success: true,
      requests: enrichedRequests
    });
  } catch (error) {
    console.error('Error fetching deactivation requests:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Approve deactivation request
app.post("/make-server-3dd53475/deactivation-requests/:requestId/approve", async (c) => {
  try {
    const { requestId } = c.req.param();
    const { adminId, adminName } = await c.req.json();
    
    const request = await kv.get(`vendor:deactivation_request:${requestId}`);
    
    if (!request) {
      return c.json({ error: 'Request not found' }, 404);
    }
    
    const vendor = await kv.get(`vendor:${request.vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Deactivate vendor
    vendor.deactivated = true;
    vendor.deactivatedAt = new Date().toISOString();
    vendor.deactivatedBy = adminId;
    vendor.deactivationReason = request.reason;
    
    await kv.set(`vendor:${request.vendorId}`, vendor);
    
    // Update request status
    request.status = 'approved';
    request.reviewedBy = adminId;
    request.reviewedByName = adminName;
    request.reviewedAt = new Date().toISOString();
    
    await kv.set(`vendor:deactivation_request:${requestId}`, request);
    
    return c.json({
      success: true,
      message: 'Vendor deactivated successfully'
    });
  } catch (error) {
    console.error('Error approving deactivation:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// VENDOR RE-VERIFICATION
// ============================================

// Get vendors due for re-verification
app.get("/make-server-3dd53475/reverification/due", async (c) => {
  try {
    const allVendors = await kv.getByPrefix('vendor:');
    const activeVendors = allVendors.filter(v => v.status === 'approved' && !v.deactivated);
    
    const vendorsDueForReverification = activeVendors.filter(vendor => {
      if (!vendor.reviewedAt) return true;
      
      const reviewDate = new Date(vendor.reviewedAt);
      const now = new Date();
      const daysSinceReview = Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Due for re-verification after 365 days (1 year)
      return daysSinceReview >= 365;
    });
    
    // Sort by days since last review (oldest first)
    vendorsDueForReverification.sort((a, b) => {
      const dateA = new Date(a.reviewedAt || a.submittedAt);
      const dateB = new Date(b.reviewedAt || b.submittedAt);
      return dateA.getTime() - dateB.getTime();
    });
    
    return c.json({
      success: true,
      vendors: vendorsDueForReverification,
      count: vendorsDueForReverification.length
    });
  } catch (error) {
    console.error('Error fetching vendors due for re-verification:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Schedule re-verification for vendor
app.post("/make-server-3dd53475/reverification/:vendorId/schedule", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { scheduledDate, adminId, notes } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Create re-verification record
    const reverificationId = `reverification_${Date.now()}`;
    await kv.set(`vendor:reverification:${reverificationId}`, {
      id: reverificationId,
      vendorId,
      scheduledDate,
      status: 'scheduled',
      scheduledBy: adminId,
      notes,
      createdAt: new Date().toISOString()
    });
    
    // Update vendor record
    vendor.nextReverificationDate = scheduledDate;
    vendor.reverificationStatus = 'scheduled';
    await kv.set(`vendor:${vendorId}`, vendor);
    
    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    await kv.set(`notification:vendor:${vendorId}:${notificationId}`, {
      id: notificationId,
      vendorId,
      type: 'reverification_scheduled',
      title: 'Re-verification Scheduled',
      message: `Your account re-verification has been scheduled for ${new Date(scheduledDate).toLocaleDateString()}. Please ensure all documents are up to date.`,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      message: 'Re-verification scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling re-verification:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// COMPLIANCE & QUALITY MONITORING
// ============================================

// Get vendors with compliance issues
app.get("/make-server-3dd53475/compliance/issues", async (c) => {
  try {
    const allVendors = await kv.getByPrefix('vendor:');
    
    const vendorsWithIssues = allVendors.filter(vendor => {
      if (!vendor.complianceFlags) return false;
      return vendor.complianceFlags.length > 0;
    }).map(vendor => {
      // Calculate priority based on flags
      const highPriorityFlags = vendor.complianceFlags.filter((flag: any) => flag.priority === 'high');
      const priority = highPriorityFlags.length > 0 ? 'high' : 
                      vendor.complianceFlags.length > 3 ? 'medium' : 'low';
      
      return {
        ...vendor,
        overallPriority: priority,
        issueCount: vendor.complianceFlags.length
      };
    });
    
    // Sort by priority and issue count
    vendorsWithIssues.sort((a, b) => {
      const priorityOrder: any = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.overallPriority] - priorityOrder[a.overallPriority] || 
             b.issueCount - a.issueCount;
    });
    
    return c.json({
      success: true,
      vendors: vendorsWithIssues,
      count: vendorsWithIssues.length
    });
  } catch (error) {
    console.error('Error fetching compliance issues:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Add compliance flag to vendor
app.post("/make-server-3dd53475/:vendorId/compliance/flag", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { type, description, priority, adminId } = await c.req.json();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    if (!vendor.complianceFlags) {
      vendor.complianceFlags = [];
    }
    
    vendor.complianceFlags.push({
      id: `flag_${Date.now()}`,
      type,
      description,
      priority,
      flaggedBy: adminId,
      flaggedAt: new Date().toISOString(),
      resolved: false
    });
    
    await kv.set(`vendor:${vendorId}`, vendor);
    
    return c.json({
      success: true,
      message: 'Compliance flag added',
      vendor
    });
  } catch (error) {
    console.error('Error adding compliance flag:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get quality alerts
app.get("/make-server-3dd53475/quality/alerts", async (c) => {
  try {
    // ✅ FIX: Use safeGetByPrefix with timeout and limit
    const allVendors = await safeGetByPrefix('vendor:', { 
      timeout: 10000,
      retries: 1,
      limit: 1000
    });
    
    const activeVendors = allVendors.filter((v: any) => v.status === 'approved' && !v.deactivated);
    
    const qualityAlerts = activeVendors.filter(vendor => {
      // Low rating alert
      if (vendor.rating && vendor.rating < 3.5) return true;
      
      // High complaint rate
      if (vendor.complaints && vendor.complaints.length > 0) {
        const recentComplaints = vendor.complaints.filter((c: any) => {
          const complaintDate = new Date(c.createdAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return complaintDate >= thirtyDaysAgo;
        });
        if (recentComplaints.length >= 3) return true;
      }
      
      // Rating dropped significantly
      if (vendor.ratingHistory && vendor.ratingHistory.length >= 2) {
        const latest = vendor.ratingHistory[vendor.ratingHistory.length - 1];
        const previous = vendor.ratingHistory[vendor.ratingHistory.length - 2];
        if (latest.rating - previous.rating < -0.5) return true;
      }
      
      return false;
    }).map(vendor => {
      let alertType = 'low_rating';
      let alertMessage = '';
      let priority = 'low';
      
      if (vendor.rating < 3.0) {
        alertType = 'critical_rating';
        alertMessage = `Critical: Rating dropped to ${vendor.rating}`;
        priority = 'high';
      } else if (vendor.rating < 3.5) {
        alertType = 'low_rating';
        alertMessage = `Low rating: ${vendor.rating}`;
        priority = 'medium';
      }
      
      if (vendor.complaints && vendor.complaints.length > 0) {
        const recentComplaints = vendor.complaints.filter((c: any) => {
          const complaintDate = new Date(c.createdAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return complaintDate >= thirtyDaysAgo;
        });
        
        if (recentComplaints.length >= 5) {
          alertType = 'high_complaint_rate';
          alertMessage = `${recentComplaints.length} complaints received | This Month`;
          priority = 'high';
        } else if (recentComplaints.length >= 3) {
          alertType = 'moderate_complaint_rate';
          alertMessage = `${recentComplaints.length} complaints received | This Month`;
          priority = 'medium';
        }
      }
      
      return {
        vendorId: vendor.id,
        vendorName: vendor.fullName || vendor.businessName,
        alertType,
        alertMessage,
        priority,
        rating: vendor.rating,
        complaintCount: vendor.complaints?.length || 0
      };
    });
    
    // Sort by priority
    qualityAlerts.sort((a, b) => {
      const priorityOrder: any = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    return c.json({
      success: true,
      alerts: qualityAlerts,
      count: qualityAlerts.length
    });
  } catch (error) {
    console.error('Error fetching quality alerts:', error);
    // Return empty alerts on timeout/error instead of 500
    return c.json({
      success: true,
      alerts: [],
      count: 0,
      error: 'Query timed out - please try again'
    });
  }
});

// ============================================
// VENDOR SEARCH & FILTERING
// ============================================

// Search vendors
app.get("/make-server-3dd53475/search", async (c) => {
  try {
    const query = c.req.query('q') || '';
    const status = c.req.query('status') || 'all';
    const service = c.req.query('service') || 'all';
    
    let vendors = await safeGetByPrefix('vendor:', { timeout: 10000, limit: 1000 });
    
    // Filter by status
    if (status !== 'all') {
      vendors = vendors.filter(v => {
        if (status === 'active') return v.status === 'approved' && !v.deactivated;
        if (status === 'pending') return v.status === 'pending_approval';
        if (status === 'deactivated') return v.deactivated === true;
        if (status === 'rejected') return v.status === 'rejected';
        return true;
      });
    }
    
    // Filter by service
    if (service !== 'all') {
      vendors = vendors.filter(v => v.services && v.services.includes(service));
    }
    
    // Search by name, phone, or email
    if (query) {
      const lowerQuery = query.toLowerCase();
      vendors = vendors.filter(v => 
        (v.fullName && v.fullName.toLowerCase().includes(lowerQuery)) ||
        (v.businessName && v.businessName.toLowerCase().includes(lowerQuery)) ||
        (v.phone && v.phone.includes(query)) ||
        (v.email && v.email.toLowerCase().includes(lowerQuery))
      );
    }
    
    return c.json({
      success: true,
      vendors,
      count: vendors.length
    });
  } catch (error) {
    console.error('Error searching vendors:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// DUPLICATE DETECTION & CLEANUP
// ============================================

/**
 * Find duplicate vendors by phone or email
 * GET /make-server-3dd53475/admin/vendors/duplicates
 */
app.get("/make-server-3dd53475/admin/vendors/duplicates", async (c) => {
  try {
    console.log('🔍 Scanning for duplicate vendors...');
    
    // Import phone utils
    const { normalizePhone } = await import('./phone-utils.tsx');
    
    // Get all vendor records
    const { createClient } = await import('jsr:@supabase/supabase-js@2.49.8');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    const { data: vendorRecords, error } = await supabase
      .from('kv_store_3dd53475')
      .select('key, value')
      .like('key', 'vendor:vendor_%');
    
    if (error) {
      console.error('❌ Database query error:', error);
      return c.json({ error: 'Database error' }, 500);
    }
    
    console.log(`📊 Found ${vendorRecords?.length || 0} vendor records`);
    
    // Track duplicates
    const phoneMap = new Map<string, any[]>();
    const emailMap = new Map<string, any[]>();
    
    // Group vendors by phone and email
    vendorRecords?.forEach((record: any) => {
      const vendor = record.value;
      const key = record.key;
      
      // Group by phone
      if (vendor.phone) {
        const cleanPhone = normalizePhone(vendor.phone);
        if (cleanPhone) {
          if (!phoneMap.has(cleanPhone)) {
            phoneMap.set(cleanPhone, []);
          }
          phoneMap.get(cleanPhone)!.push({ ...vendor, _key: key });
        }
      }
      
      // Group by email
      if (vendor.email) {
        const cleanEmail = vendor.email.toLowerCase().trim();
        if (!emailMap.has(cleanEmail)) {
          emailMap.set(cleanEmail, []);
        }
        emailMap.get(cleanEmail)!.push({ ...vendor, _key: key });
      }
    });
    
    // Find duplicates
    const duplicatesByPhone: any[] = [];
    phoneMap.forEach((vendors, phone) => {
      if (vendors.length > 1) {
        duplicatesByPhone.push({
          phone,
          count: vendors.length,
          vendors: vendors.map(v => ({
            id: v.id,
            key: v._key,
            name: v.fullName || v.businessName,
            status: v.status,
            email: v.email,
            createdAt: v.createdAt,
            submittedAt: v.submittedAt
          }))
        });
      }
    });
    
    const duplicatesByEmail: any[] = [];
    emailMap.forEach((vendors, email) => {
      if (vendors.length > 1) {
        duplicatesByEmail.push({
          email,
          count: vendors.length,
          vendors: vendors.map(v => ({
            id: v.id,
            key: v._key,
            name: v.fullName || v.businessName,
            status: v.status,
            phone: v.phone,
            createdAt: v.createdAt,
            submittedAt: v.submittedAt
          }))
        });
      }
    });
    
    console.log(`📋 Found ${duplicatesByPhone.length} phone duplicates`);
    console.log(`📋 Found ${duplicatesByEmail.length} email duplicates`);
    
    return c.json({
      success: true,
      duplicates: {
        byPhone: duplicatesByPhone,
        byEmail: duplicatesByEmail
      },
      summary: {
        totalPhoneDuplicates: duplicatesByPhone.length,
        totalEmailDuplicates: duplicatesByEmail.length,
        affectedVendorsByPhone: duplicatesByPhone.reduce((sum, dup) => sum + dup.count, 0),
        affectedVendorsByEmail: duplicatesByEmail.reduce((sum, dup) => sum + dup.count, 0)
      }
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Clean up duplicate vendors (keeping the most recent approved one)
 * POST /make-server-3dd53475/admin/vendors/duplicates/cleanup
 */
app.post("/make-server-3dd53475/admin/vendors/duplicates/cleanup", async (c) => {
  try {
    const { dryRun = true, keepStrategy = 'newest_approved' } = await c.req.json();
    
    console.log('🧹 Starting duplicate cleanup...');
    console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Strategy: ${keepStrategy}`);
    
    // Import phone utils
    const { normalizePhone } = await import('./phone-utils.tsx');
    
    // Get all vendor records
    const { createClient } = await import('jsr:@supabase/supabase-js@2.49.8');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    const { data: vendorRecords, error } = await supabase
      .from('kv_store_3dd53475')
      .select('key, value')
      .like('key', 'vendor:vendor_%');
    
    if (error) {
      return c.json({ error: 'Database error' }, 500);
    }
    
    // Group vendors by phone
    const phoneGroups = new Map<string, any[]>();
    vendorRecords?.forEach((record: any) => {
      const vendor = record.value;
      const key = record.key;
      
      if (vendor.phone) {
        const cleanPhone = normalizePhone(vendor.phone);
        if (cleanPhone) {
          if (!phoneGroups.has(cleanPhone)) {
            phoneGroups.set(cleanPhone, []);
          }
          phoneGroups.get(cleanPhone)!.push({ ...vendor, _key: key });
        }
      }
    });
    
    const cleanupActions: any[] = [];
    let vendorsToDelete = 0;
    let vendorsToKeep = 0;
    
    // Process each group
    phoneGroups.forEach((vendors, phone) => {
      if (vendors.length > 1) {
        console.log(`\n📞 Processing duplicate group for phone: ${phone}`);
        console.log(`   Found ${vendors.length} vendors`);
        
        // Sort vendors by priority:
        // 1. Approved vendors first
        // 2. Then by creation date (newest first)
        vendors.sort((a, b) => {
          // Approved status takes priority
          if (a.status === 'approved' && b.status !== 'approved') return -1;
          if (a.status !== 'approved' && b.status === 'approved') return 1;
          
          // Then by creation date (newest first)
          const dateA = new Date(a.createdAt || a.submittedAt || 0);
          const dateB = new Date(b.createdAt || b.submittedAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        // Keep the first one (highest priority)
        const toKeep = vendors[0];
        const toDelete = vendors.slice(1);
        
        console.log(`   ✅ Keeping: ${toKeep.id} (${toKeep.fullName || toKeep.businessName}) - Status: ${toKeep.status}`);
        vendorsToKeep++;
        
        toDelete.forEach(vendor => {
          console.log(`   ❌ Deleting: ${vendor.id} (${vendor.fullName || vendor.businessName}) - Status: ${vendor.status}`);
          vendorsToDelete++;
          
          cleanupActions.push({
            action: 'delete',
            vendorId: vendor.id,
            key: vendor._key,
            name: vendor.fullName || vendor.businessName,
            status: vendor.status,
            reason: `Duplicate of ${toKeep.id}`,
            phone: vendor.phone,
            email: vendor.email
          });
        });
      }
    });
    
    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   Vendors to keep: ${vendorsToKeep}`);
    console.log(`   Vendors to delete: ${vendorsToDelete}`);
    console.log(`   Total cleanup actions: ${cleanupActions.length}`);
    
    // Execute cleanup if not dry run
    if (!dryRun && cleanupActions.length > 0) {
      console.log('\n🔥 Executing cleanup (LIVE MODE)...');
      
      for (const action of cleanupActions) {
        try {
          // Delete from KV store
          await kv.del(action.key);
          console.log(`   ✅ Deleted: ${action.key}`);
        } catch (err) {
          console.error(`   ❌ Failed to delete ${action.key}:`, err);
          action.error = String(err);
        }
      }
      
      console.log('✅ Cleanup completed!');
    } else if (dryRun) {
      console.log('\n💡 DRY RUN - No changes made. Set dryRun=false to execute cleanup.');
    }
    
    return c.json({
      success: true,
      dryRun,
      summary: {
        vendorsToKeep,
        vendorsToDelete,
        totalActions: cleanupActions.length
      },
      actions: cleanupActions,
      message: dryRun 
        ? 'Dry run completed. Review actions and set dryRun=false to execute cleanup.'
        : `Cleanup completed. Deleted ${vendorsToDelete} duplicate vendors.`
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return c.json({ error: String(error) }, 500);
  }
});

}