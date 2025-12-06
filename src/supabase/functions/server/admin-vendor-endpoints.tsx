import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * Enhanced Admin Vendor Management Endpoints
 * Supports the new tabbed vendor administration interface
 */
export function adminVendorEndpoints(app: Hono, kv: any) {

  // ============================================
  // GET ALL VENDORS (with status filtering)
  // ============================================

  /**
   * GET /admin/vendors/all
   * Get all vendors regardless of status
   */
  app.get("/make-server-3dd53475/admin/vendors/all", async (c) => {
    try {
      console.log('========================================');
      console.log('📋 ADMIN: Loading all vendors...');
      console.log('========================================');
      
      // Get all vendors
      const allVendors = await kv.getByPrefix('vendor:');
      console.log(`📦 Raw vendor records from KV: ${allVendors.length}`);
      
      // Filter to only main vendor records (not indexes, applications, or other metadata)
      const vendors = allVendors.filter((v: any) => {
        // 1. Check if it's an object
        if (!v || typeof v !== 'object') return false;
        
        // 2. Exclude based on content (since we don't have keys)
        // Exclude Application records
        if (v.applicationId === v.id || (v.id && String(v.id).startsWith('APP'))) {
           return false;
        }
        
        // Exclude specific metadata types if identifiable
        if (v.type === 'index' || v.type === 'metadata') return false;

        // 3. Check for ID pattern
        const id = v.id || v.vendorId;
        
        // Strict check: Must have 'vendor_' prefix
        if (id && String(id).startsWith('vendor_')) {
          return true;
        }
        
        // 4. Fallback: Check for structural validity
        // A valid vendor usually has businessName OR fullName AND phone AND role
        const hasName = !!(v.businessName || v.fullName);
        const hasPhone = !!v.phone;
        const hasRole = !!v.role || !!v.roleId || !!v.roleName;
        
        // Safest bet: If it doesn't have vendor_ prefix, rely on it NOT being an APP
        if (hasName && hasPhone && hasRole) {
            // Double check it's not an application
            if (v.documents && v.documents.length > 0 && v.formData) {
                // High chance this is an application object if it has formData
                return false;
            }
            return true;
        }
        
        return false;
      });
      
      console.log(`✅ Filtered main vendor records: ${vendors.length}`);
      
      // Enrich with additional data
      const enrichedVendors = vendors.map((vendor: any) => {
        // Normalize status for Admin UI (Admin expects 'pending_approval')
        let displayStatus = vendor.status || 'pending_approval';
        if (displayStatus === 'pending') displayStatus = 'pending_approval';

        return {
          id: vendor.id,
          vendorId: vendor.id, // Add vendorId for approval
          applicationId: vendor.applicationId || vendor.id,
          fullName: vendor.fullName,
          businessName: vendor.businessName,
          roleName: vendor.roleName,
          roleId: vendor.roleId,
          serviceCategory: vendor.serviceCategory,
          serviceStyle: vendor.serviceStyle,
          phone: vendor.phone,
          email: vendor.email,
          city: vendor.city,
          state: vendor.state,
          address: vendor.address,
          status: displayStatus,
          vendorType: vendor.vendorType,
          submittedAt: vendor.createdAt || vendor.submittedAt,
          approvedAt: vendor.approvedAt,
          rejectedAt: vendor.rejectedAt,
          rejectionReason: vendor.rejectionReason,
          totalServices: 0, // TODO: Calculate from services
          activeServices: 0, // TODO: Calculate from active services
          rating: vendor.rating || null,
          totalBookings: vendor.totalBookings || 0,
          revenue: vendor.revenue || 0,
          lastActivityAt: vendor.lastActivityAt,
          // Add fields for applications table
          services: vendor.services || [],
          category: vendor.serviceCategory || vendor.category,
          experience: vendor.experience || 'N/A',
          progressPercentage: 100, // Assume complete if they're in the system
          daysSinceSubmission: Math.floor((Date.now() - new Date(vendor.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
        };
      });
      
      console.log(`✅ Returning ${enrichedVendors.length} enriched vendors`);
      console.log('========================================');
      
      return sendSuccess(c, {
        vendors: enrichedVendors,
        total: enrichedVendors.length
      });
      
    } catch (error) {
      console.error('❌ Error loading all vendors:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GET ENHANCED STATISTICS
  // ============================================

  /**
   * GET /admin/vendors/stats-enhanced
   * Get comprehensive vendor statistics
   */
  app.get("/make-server-3dd53475/admin/vendors/stats-enhanced", async (c) => {
    try {
      console.log('📊 Calculating enhanced vendor statistics...');
      
      // Get all vendors
      const allVendors = await kv.getByPrefix('vendor:');
      
      // Filter to main vendor records
      const vendors = allVendors.filter((v: any) => {
        const key = v.key || '';
        return !key.includes(':phone:') && 
               !key.includes(':email:') && 
               !key.includes(':services:') &&
               v.id && v.id.startsWith('vendor_');
      });
      
      // Calculate statistics
      const total = vendors.length;
      const pending = vendors.filter((v: any) => v.status === 'pending_approval' || v.status === 'pending').length;
      const approved = vendors.filter((v: any) => v.status === 'approved').length;
      const rejected = vendors.filter((v: any) => v.status === 'rejected').length;
      const reverification = vendors.filter((v: any) => v.status === 'pending_reverification').length;
      
      // Calculate today's activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeToday = vendors.filter((v: any) => {
        if (!v.lastActivityAt) return false;
        const activityDate = new Date(v.lastActivityAt);
        return activityDate >= today;
      }).length;
      
      // Calculate this week's new vendors
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const newThisWeek = vendors.filter((v: any) => {
        const createdDate = new Date(v.createdAt || v.submittedAt);
        return createdDate >= weekAgo;
      }).length;
      
      // Calculate conversion rate (approved / total applied)
      const totalApplied = pending + approved + rejected;
      const conversionRate = totalApplied > 0 ? (approved / totalApplied) * 100 : 0;
      
      // Calculate average approval time
      const approvedVendors = vendors.filter((v: any) => v.status === 'approved' && v.approvedAt && v.submittedAt);
      let avgApprovalTime = 0;
      
      if (approvedVendors.length > 0) {
        const totalApprovalTime = approvedVendors.reduce((sum: number, v: any) => {
          const submitted = new Date(v.submittedAt);
          const approved = new Date(v.approvedAt);
          const hours = (approved.getTime() - submitted.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        
        avgApprovalTime = totalApprovalTime / approvedVendors.length;
      }
      
      const stats = {
        total,
        pending,
        approved,
        rejected,
        reverification,
        activeToday,
        newThisWeek,
        conversionRate,
        avgApprovalTime
      };
      
      return sendSuccess(c, { stats });
      
    } catch (error) {
      console.error('❌ Error calculating statistics:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // APPROVE VENDOR
  // ============================================

  /**
   * POST /admin/vendors/:vendorId/approve
   * Approve a vendor application
   */
  app.post("/make-server-3dd53475/admin/vendors/:vendorId/approve", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { adminId, adminName } = body;
      
      console.log(`✅ Approving vendor: ${vendorId} by ${adminName}`);
      
      // Get vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // Update vendor status
      const updatedVendor = {
        ...vendor,
        status: 'approved',
        applicationStatus: 'approved', // ✅ Keep backwards compatibility
        isActive: true,
        isVerified: true,
        approvedAt: new Date().toISOString(),
        approvedBy: adminId,
        approvedByName: adminName,
        updatedAt: new Date().toISOString()
      };
      
      // ✅ PERMANENT FIX: Use saveVendor utility that ALWAYS creates indexes
      const { saveVendor } = await import('./vendor-utils.tsx');
      
      console.log(`💾 Approving vendor with automatic index creation: ${vendorId}...`);
      await saveVendor(updatedVendor);
      
      console.log(`✅ Vendor ${vendorId} approved successfully with all indexes`);
      
      return sendSuccess(c, {
        vendor: updatedVendor
      }, 'Vendor approved successfully');
      
    } catch (error) {
      console.error('❌ Error approving vendor:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // REJECT VENDOR
  // ============================================

  /**
   * POST /admin/vendors/:vendorId/reject
   * Reject a vendor application
   */
  app.post("/make-server-3dd53475/admin/vendors/:vendorId/reject", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { adminId, adminName, reason } = body;
      
      console.log(`❌ Rejecting vendor: ${vendorId} by ${adminName}`);
      
      // Get vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // Update vendor status
      const updatedVendor = {
        ...vendor,
        status: 'rejected',
        isActive: false, // ✅ PERMANENT FIX: Rejected vendors should NOT be active
        rejectedAt: new Date().toISOString(),
        rejectedBy: adminId,
        rejectedByName: adminName,
        rejectionReason: reason || 'No reason provided',
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`vendor:${vendorId}`, updatedVendor);
      
      console.log(`✅ Vendor ${vendorId} rejected successfully`);
      
      return sendSuccess(c, {
        vendor: updatedVendor
      }, 'Vendor rejected');
      
    } catch (error) {
      console.error('❌ Error rejecting vendor:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // REQUEST RE-VERIFICATION
  // ============================================

  /**
   * POST /admin/vendors/:vendorId/request-reverification
   * Request vendor to re-verify their documents
   */
  app.post("/make-server-3dd53475/admin/vendors/:vendorId/request-reverification", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { adminId, adminName, reason } = body;
      
      console.log(`🔄 Requesting re-verification for vendor: ${vendorId}`);
      
      // Get vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // Update vendor status
      const updatedVendor = {
        ...vendor,
        status: 'pending_reverification',
        reverificationRequestedAt: new Date().toISOString(),
        reverificationRequestedBy: adminId,
        reverificationRequestedByName: adminName,
        reverificationReason: reason || 'Please update your documents'
      };
      
      await kv.set(`vendor:${vendorId}`, updatedVendor);
      
      console.log(`✅ Re-verification requested for vendor ${vendorId}`);
      
      return sendSuccess(c, {
        vendor: updatedVendor
      }, 'Re-verification requested');
      
    } catch (error) {
      console.error('❌ Error requesting re-verification:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MIGRATION: FIX MISSING INDEXES
  // ============================================
  
  /**
   * GET /admin/vendors/debug/:phone
   * Debug endpoint to check vendor state
   */
  app.get("/make-server-3dd53475/admin/vendors/debug/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const { normalizePhone } = await import('./phone-utils.tsx');
      
      const cleanedPhone = normalizePhone(phone);
      console.log(`\n🔍 ========== DEBUG VENDOR ${phone} ==========`);
      console.log(`Cleaned phone: ${cleanedPhone}`);
      
      // Check 1: Direct vendor lookup
      const directVendor = await kv.get(`vendor:vendor_${cleanedPhone}`);
      
      // Check 2: Phone index
      const phoneIndex = await kv.get(`vendor:phone:${cleanedPhone}`);
      
      // Check 3: User lookup
      const user = await kv.get(`user:phone:${cleanedPhone}`);
      
      // Check 4: User index
      let userIndex = null;
      if (user) {
        userIndex = await kv.get(`vendor:user:${user.userId}`);
      }
      
      // Check 5: Search all vendors for this phone
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      const matchingVendors = allVendors.filter((v: any) => {
        return v.phone === phone || v.phone === cleanedPhone || normalizePhone(v.phone) === cleanedPhone;
      });
      
      console.log(`========== END DEBUG ==========\n`);
      
      return sendSuccess(c, {
        debug: {
          phone,
          cleanedPhone,
          directVendor: directVendor ? { id: directVendor.id, phone: directVendor.phone, userId: directVendor.userId } : null,
          phoneIndex,
          user: user ? { userId: user.userId, role: user.role } : null,
          userIndex,
          matchingVendors: matchingVendors.map((v: any) => ({
            id: v.id,
            phone: v.phone,
            name: v.fullName,
            userId: v.userId,
            status: v.status
          }))
        }
      });
      
    } catch (error) {
      console.error('❌ Debug error:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /admin/vendors/fix-vendor-user-link/:phone
   * Fix a specific vendor's userId and index
   */
  app.post("/make-server-3dd53475/admin/vendors/fix-vendor-user-link/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const { normalizePhone } = await import('./phone-utils.tsx');
      
      const cleanedPhone = normalizePhone(phone);
      console.log(`\n🔧 ========== FIXING VENDOR-USER LINK FOR ${phone} ==========`);
      
      // Get user
      const user = await kv.get(`user:phone:${cleanedPhone}`);
      if (!user) {
        return sendError(c, 'User not found', 404);
      }
      
      console.log(`✅ Found user: ${user.userId}`);
      
      // Get vendor
      const vendorId = `vendor_${cleanedPhone}`;
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      console.log(`✅ Found vendor: ${vendorId}`);
      
      // Update vendor with userId
      const updatedVendor = {
        ...vendor,
        userId: user.userId,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`vendor:${vendorId}`, updatedVendor);
      console.log(`✅ Updated vendor record with userId: ${user.userId}`);
      
      // Fix user index
      await kv.set(`vendor:user:${user.userId}`, vendorId);
      console.log(`✅ Fixed user index: vendor:user:${user.userId} → ${vendorId}`);
      
      // Ensure phone index exists
      await kv.set(`vendor:phone:${cleanedPhone}`, vendorId);
      console.log(`✅ Ensured phone index: vendor:phone:${cleanedPhone} → ${vendorId}`);
      
      console.log(`🎉 ========== FIX COMPLETE ==========\n`);
      
      return sendSuccess(c, {
        vendor: {
          id: vendorId,
          userId: user.userId,
          phone: cleanedPhone
        }
      }, 'Vendor-user link fixed successfully');
      
    } catch (error) {
      console.error('❌ Fix error:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /admin/vendors/fix-indexes
   * Create missing phone indexes for all existing vendors
   * This is a one-time migration to fix vendors created before index logic was added
   */
  app.post("/make-server-3dd53475/admin/vendors/fix-indexes", async (c) => {
    try {
      console.log('🔧 ========== FIXING VENDOR INDEXES ==========');
      
      const { normalizePhone } = await import('./phone-utils.tsx');
      
      // Get all vendors - the KV store returns values without keys
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      // Filter to only valid vendor records (must have phone number)
      const vendors = allVendors.filter((v: any) => {
        // Must have an id field that starts with vendor_
        const hasValidId = v.id && (v.id.startsWith('vendor_') || v.vendorId?.startsWith('vendor_'));
        // Must have a phone number
        const hasPhone = !!v.phone;
        
        return hasValidId && hasPhone;
      });
      
      if (vendors.length === 0) {
        console.log('⚠️ NO VENDORS TO PROCESS - Check database query and filtering logic');
        return sendSuccess(c, {
          stats: {
            total: 0,
            fixed: 0,
            skipped: 0
          },
          fixedVendors: []
        }, 'No vendors found to process');
      }
      
      let fixed = 0;
      let skipped = 0;
      const results: any[] = [];
      
      for (const vendor of vendors) {
        const vendorId = vendor.id || vendor.vendorId;
        const phone = vendor.phone;
        
        if (!phone) {
          skipped++;
          continue;
        }
        
        // Clean phone
        const cleanedPhone = normalizePhone(phone);
        
        // Check if phone index already exists
        const existingPhoneIndex = await kv.get(`vendor:phone:${cleanedPhone}`);
        
        let indexCreated = false;
        
        if (!existingPhoneIndex) {
          // Create phone index
          await kv.set(`vendor:phone:${cleanedPhone}`, vendorId);
          indexCreated = true;
        }
        
        // Also check/create user index if vendor has userId
        if (vendor.userId) {
          const existingUserIndex = await kv.get(`vendor:user:${vendor.userId}`);
          
          if (!existingUserIndex) {
            await kv.set(`vendor:user:${vendor.userId}`, vendorId);
            indexCreated = true;
          }
        }
        
        if (indexCreated) {
          fixed++;
          results.push({
            vendorId,
            phone: cleanedPhone,
            name: vendor.fullName || vendor.businessName,
            status: vendor.status,
            userId: vendor.userId
          });
        } else {
          skipped++;
        }
      }
      
      console.log('\n🎉 ========== INDEX FIX COMPLETE ==========');
      
      return sendSuccess(c, {
        stats: {
          total: vendors.length,
          fixed,
          skipped
        },
        fixedVendors: results
      }, 'Vendor indexes fixed successfully');
      
    } catch (error) {
      console.error('❌ Error fixing vendor indexes:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/vendors/fix-staff-records
   * Fix missing staff records for vendors
   */
  app.post("/make-server-3dd53475/admin/vendors/fix-staff-records", async (c) => {
    try {
      const { vendorIds } = await c.req.json();
      console.log(`🔧 Fixing staff records for ${vendorIds.length} vendors...`);
      
      let fixedCount = 0;
      let failedCount = 0;
      
      for (const vendorId of vendorIds) {
        try {
          const vendor = await kv.get(`vendor:${vendorId}`);
          if (!vendor) continue;
          
          // Check if staff record exists
          const staffId = `staff_${vendor.phone}`; // Or however we generate staff IDs
          const existingStaff = await kv.get(`staff:${staffId}`);
          
          if (!existingStaff) {
            // Create staff record
            const staffRecord = {
              id: staffId,
              vendorId: vendorId,
              fullName: vendor.fullName,
              phone: vendor.phone,
              email: vendor.email,
              role: vendor.roleName || 'staff',
              isActive: true,
              isOnline: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            await kv.set(`staff:${staffId}`, staffRecord);
            await kv.set(`staff:phone:${vendor.phone}`, staffId); // Index
            
            fixedCount++;
          } else {
            // Already exists
          }
        } catch (e) {
          console.error(`Failed to fix vendor ${vendorId}:`, e);
          failedCount++;
        }
      }
      
      return sendSuccess(c, {
        fixed: fixedCount,
        failed: failedCount
      });
      
    } catch (error) {
      console.error('❌ Error fixing staff records:', error);
      return sendError(c, error, 500);
    }
  });
}
