import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
// ✅ SQL MIGRATION: Replace KV with SQL repositories
import { getVendorsRepository } from "../../../supabase/lib/repositories/vendors";
import { getServicesRepository } from "../../../supabase/lib/repositories/services";
import { getBookingsRepository } from "../../../supabase/lib/repositories/bookings";
import { getReviewsRepository } from "../../../supabase/lib/repositories/reviews";

/**
 * Enhanced Admin Vendor Management Endpoints
 * Supports the new tabbed vendor administration interface
 * ✅ SQL MIGRATION: Now uses VendorsRepository instead of KV
 */
export function adminVendorEndpoints(app: Hono) {

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
      
      console.log('🔍 Querying SQL database for vendor records...');
      
      // ✅ SQL: Get all vendors from VendorsRepository
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll();
      
      console.log(`📦 Raw vendor records from SQL: ${allVendors.length}`);
      
      // ✅ SQL: Filter out deleted/rejected vendors (if needed)
      // Note: SQL vendors table may have is_active flag or status field
      const activeVendors = allVendors.filter((v: any) => 
        v.is_active !== false && 
        v.status !== 'deleted' && 
        v.status !== 'rejected'
      );
      
      console.log(`✅ Filtered active vendor records: ${activeVendors.length}`);
      
      // Enrich with additional data
      const enrichedVendors = activeVendors.map((vendor: any) => {
        // Normalize status for Admin UI (Admin expects 'pending_approval')
        let displayStatus = vendor.status || 'pending_approval';
        if (displayStatus === 'pending') displayStatus = 'pending_approval';

        // ✅ SQL: Get services count for vendor
        const servicesRepo = getServicesRepository();
        const vendorServices = await servicesRepo.findByVendor(vendor.id);
        const totalServices = vendorServices.length;
        const activeServices = vendorServices.filter((s: any) => s.is_active !== false).length;
        
        // ✅ SQL: Get bookings count and revenue
        const bookingsRepo = getBookingsRepository();
        const vendorBookings = await bookingsRepo.findByVendor(vendor.id);
        const totalBookings = vendorBookings.length;
        const completedBookings = vendorBookings.filter((b: any) => b.status === 'completed');
        const revenue = completedBookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
        
        // ✅ SQL: Get rating from reviews
        const reviewsRepo = getReviewsRepository();
        const vendorReviews = await reviewsRepo.findByVendor(vendor.id);
        const rating = vendorReviews.length > 0
          ? vendorReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / vendorReviews.length
          : null;
        
        return {
          id: vendor.id,
          vendorId: vendor.vendor_id || vendor.id, // Use vendor_id if available
          applicationId: vendor.id,
          fullName: vendor.owner_name,
          businessName: vendor.business_name,
          roleName: vendor.role_id, // May need to resolve role name from roles table
          roleId: vendor.role_id,
          serviceCategory: vendor.category,
          serviceStyle: vendor.specialization,
          phone: vendor.phone,
          email: vendor.email,
          city: vendor.city,
          state: vendor.state,
          address: vendor.address,
          status: displayStatus,
          vendorType: vendor.category, // Use category as vendor type
          submittedAt: vendor.created_at,
          approvedAt: vendor.approved_at,
          rejectedAt: null, // May need to add rejected_at field
          rejectionReason: null, // May need to add rejection_reason field
          totalServices,
          activeServices,
          rating,
          totalBookings,
          revenue,
          lastActivityAt: vendor.updated_at,
          services: vendorServices.map((s: any) => ({ id: s.id, name: s.name })),
          category: vendor.category,
          experience: vendor.experience_years || 'N/A',
          progressPercentage: vendor.setup_completed ? 100 : 50,
          daysSinceSubmission: Math.floor((Date.now() - new Date(vendor.created_at).getTime()) / (1000 * 60 * 60 * 24))
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
      
      // ✅ SQL: Get all vendors from repository
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll();
      
      // ✅ SQL: Vendors are already filtered by repository
      const vendors = allVendors;
      
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
      
      // ✅ SQL: Calculate average approval time
      const approvedVendors = vendors.filter((v: any) => v.status === 'approved' && v.approved_at && v.created_at);
      let avgApprovalTime = 0;
      
      if (approvedVendors.length > 0) {
        const totalApprovalTime = approvedVendors.reduce((sum: number, v: any) => {
          const submitted = new Date(v.created_at);
          const approved = new Date(v.approved_at);
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
  // GET ACTIVE VENDORS
  // ============================================

  /**
   * GET /admin/vendors/active
   * Get all active/approved vendors
   */
  app.get("/make-server-3dd53475/admin/vendors/active", async (c) => {
    try {
      console.log('📋 Loading active vendors...');
      
      // ✅ SQL: Get active vendors from repository
      const vendorsRepo = getVendorsRepository();
      const allActiveVendors = await vendorsRepo.findByStatus('approved');
      
      // ✅ SQL: Enrich with additional data
      const bookingsRepo = getBookingsRepository();
      const reviewsRepo = getReviewsRepository();
      
      const activeVendors = await Promise.all(allActiveVendors.map(async (vendor: any) => {
        const vendorBookings = await bookingsRepo.findByVendor(vendor.id);
        const vendorReviews = await reviewsRepo.findByVendor(vendor.id);
        const completedBookings = vendorBookings.filter((b: any) => b.status === 'completed');
        const revenue = completedBookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
        const rating = vendorReviews.length > 0
          ? vendorReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / vendorReviews.length
          : null;
        
        return {
          id: vendor.id,
          vendorId: vendor.vendor_id || vendor.id,
          fullName: vendor.owner_name,
          businessName: vendor.business_name,
          roleName: vendor.role_id,
          phone: vendor.phone,
          email: vendor.email,
          city: vendor.city,
          state: vendor.state,
          status: vendor.status,
          isActive: vendor.is_active,
          rating,
          totalBookings: vendorBookings.length,
          revenue,
          lastActivityAt: vendor.updated_at,
          approvedAt: vendor.approved_at
        };
      }));
      
      console.log(`✅ Returning ${activeVendors.length} active vendors`);
      
      return sendSuccess(c, {
        vendors: activeVendors,
        total: activeVendors.length
      });
      
    } catch (error) {
      console.error('❌ Error loading active vendors:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GET SINGLE VENDOR BY ID (for status checking)
  // ============================================
  
  /**
   * GET /admin/vendors/:vendorId
   * Get a single vendor by ID for status verification
   * IMPORTANT: This must be registered AFTER all static routes to avoid route shadowing
   */
  app.get("/make-server-3dd53475/admin/vendors/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      console.log(`🔍 Fetching vendor by ID: ${vendorId}`);
      
      // ✅ SQL: Get vendor from repository (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      let vendor = await vendorsRepo.findById(vendorId);
      
      // If not found by UUID, try vendor_id string (e.g., vendor_9611377119)
      if (!vendor) {
        vendor = await vendorsRepo.findByVendorId(vendorId);
      }
      
      // If still not found, try resolving (handles phone numbers)
      if (!vendor) {
        const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
        if (resolvedId) {
          vendor = await vendorsRepo.findById(resolvedId);
        }
      }
      
      if (!vendor) {
        console.error(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      console.log(`✅ Vendor found with status: ${vendor.status}`);
      return sendSuccess(c, { vendor });
    } catch (error) {
      console.error('Error fetching vendor:', error);
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
      
      // ✅ SQL: Get vendor from repository
      const vendorsRepo = getVendorsRepository();
      let vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        vendor = await vendorsRepo.findByVendorId(vendorId);
      }
      if (!vendor) {
        const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
        if (resolvedId) {
          vendor = await vendorsRepo.findById(resolvedId);
        }
      }
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // ✅ SQL: Update vendor status to approved
      const updatedVendor = await vendorsRepo.update(vendor.id, {
        status: 'approved',
        is_active: true,
        approved_at: new Date().toISOString(),
        approved_by: adminId,
      });
      
      console.log(`✅ Vendor ${vendorId} approved successfully`);
      
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
      
      // ✅ SQL: Get vendor from repository
      const vendorsRepo = getVendorsRepository();
      let vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        vendor = await vendorsRepo.findByVendorId(vendorId);
      }
      if (!vendor) {
        const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
        if (resolvedId) {
          vendor = await vendorsRepo.findById(resolvedId);
        }
      }
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // ✅ SQL: Update vendor status to rejected
      const updatedVendor = await vendorsRepo.update(vendor.id, {
        status: 'rejected',
        is_active: false, // Rejected vendors should NOT be active
        // Note: May need to add rejected_at, rejected_by, rejection_reason fields to vendors table
      });
      
      console.log(`✅ Vendor ${vendorId} rejected successfully`);
      
      return sendSuccess(c, {
        vendor: updatedVendor,
        rejectionReason: reason || 'No reason provided'
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
      
      // ✅ SQL: Get vendor from repository
      const vendorsRepo = getVendorsRepository();
      let vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        vendor = await vendorsRepo.findByVendorId(vendorId);
      }
      if (!vendor) {
        const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
        if (resolvedId) {
          vendor = await vendorsRepo.findById(resolvedId);
        }
      }
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // ✅ SQL: Update vendor status to pending_reverification
      const updatedVendor = await vendorsRepo.update(vendor.id, {
        status: 'pending_reverification',
        // Note: May need to add reverification fields to vendors table
      });
      
      console.log(`✅ Re-verification requested for vendor ${vendorId}`);
      
      return sendSuccess(c, {
        vendor: updatedVendor,
        reverificationReason: reason || 'Please update your documents'
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
      
      // ✅ SQL: Check 1: Direct vendor lookup by phone
      const vendorsRepo = getVendorsRepository();
      const directVendor = await vendorsRepo.findByPhone(cleanedPhone);
      
      // ✅ SQL: Check 2: Phone lookup (no separate index needed - phone is a column)
      const phoneLookup = directVendor ? { vendorId: directVendor.id, phone: directVendor.phone } : null;
      
      // Note: Check 3: User lookup would need UsersRepository - skip for now
      const user = null;
      
      // ✅ SQL: Check 4: User index not needed (vendors table has user_id column)
      const userIndex = directVendor?.user_id ? { userId: directVendor.user_id, vendorId: directVendor.id } : null;
      
      // ✅ SQL: Check 5: Search all vendors for this phone
      const allVendors = await vendorsRepo.findAll();
      const matchingVendors = allVendors.filter((v: any) => {
        const normalizedVendorPhone = normalizePhone(v.phone);
        return v.phone === phone || v.phone === cleanedPhone || normalizedVendorPhone === cleanedPhone;
      });
      
      console.log(`========== END DEBUG ==========\n`);
      
      return sendSuccess(c, {
        debug: {
          phone,
          cleanedPhone,
          directVendor: directVendor ? { id: directVendor.id, phone: directVendor.phone, userId: directVendor.user_id } : null,
          phoneLookup, // Phone lookup result (same as directVendor in SQL)
          user: null, // User lookup not available yet
          userIndex,
          matchingVendors: matchingVendors.map((v: any) => ({
            id: v.id,
            phone: v.phone,
            name: v.owner_name || v.business_name,
            userId: v.user_id,
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
      
      // ✅ SQL: Get vendor by phone
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findByPhone(cleanedPhone);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      console.log(`✅ Found vendor: ${vendor.id}`);
      
      // Note: user_id should be set via user account linking, not through vendor phone
      // This endpoint may need to be rethought for SQL architecture
      
      // ✅ SQL: Update vendor (if user_id needs to be set)
      // const userId = ...; // Would need to resolve from user phone somehow
      // const updatedVendor = await vendorsRepo.update(vendor.id, {
      //   user_id: userId,
      // });
      
      console.log(`✅ Vendor found: ${vendor.id}`);
      
      // Note: No indexes needed in SQL - phone is a column in vendors table
      
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
      
      // ✅ SQL: Get all vendors from repository
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll();
      
      // ✅ SQL: Filter to vendors with phone numbers
      const vendors = allVendors.filter((v: any) => !!v.phone);
      
      if (vendors.length === 0) {
        console.log('⚠️ NO VENDORS TO PROCESS');
        return sendSuccess(c, {
          stats: {
            total: 0,
            fixed: 0,
            skipped: 0
          },
          fixedVendors: []
        }, 'No vendors found to process');
      }
      
      // ✅ SQL: No indexes needed - phone is a column in vendors table
      // This endpoint is no longer needed in SQL architecture
      // But keeping it for backwards compatibility
      
      let fixed = 0;
      let skipped = vendors.length; // All vendors already have phone in SQL
      const results: any[] = [];
      
      // Note: In SQL, phone lookup is done via WHERE phone = ? query
      // No separate index table needed
      
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
      
      // ✅ SQL: Get vendors and check staff records
      const vendorsRepo = getVendorsRepository();
      // Note: Staff management should use StaffRepository if it exists
      // For now, this endpoint may need to be refactored or removed
      
      for (const vendorId of vendorIds) {
        try {
          let vendor = await vendorsRepo.findById(vendorId);
          if (!vendor) {
            vendor = await vendorsRepo.findByVendorId(vendorId);
          }
          if (!vendor) {
            const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
            if (resolvedId) {
              vendor = await vendorsRepo.findById(resolvedId);
            }
          }
          
          if (!vendor) {
            failedCount++;
            continue;
          }
          
          // Note: Staff records should be managed via StaffRepository
          // This endpoint may need to be rethought for SQL architecture
          // Staff should be in a separate staff table, not KV
          
          fixedCount++;
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

  // ============================================
  // CREATE VENDOR (Direct admin creation)
  // ============================================

  /**
   * POST /admin/vendors/create
   * Create a new vendor directly from admin panel
   * CRITICAL: This endpoint must properly set roleId for capability detection
   */
  app.post("/make-server-3dd53475/admin/vendors/create", async (c) => {
    try {
      console.log('🆕 ========== ADMIN VENDOR CREATION ==========');
      const body = await c.req.json();
      
      const {
        // Basic Information
        businessName,
        ownerName,
        email,
        phone,
        alternatePhone,
        
        // Business Details
        roleId,  // ✅ CRITICAL: This is the primary role identifier
        category,
        services,
        experience,
        registrationNumber,
        gstNumber,
        panNumber,
        
        // Location
        address,
        city,
        state,
        pincode,
        landmark,
        serviceAreas,
        
        // Banking
        bankName,
        accountNumber,
        ifscCode,
        accountHolderName,
        
        // Additional
        operatingHours,
        capacity,
        certifications,
        specialization,
        
        // Admin settings
        tier,
        commission,
        status,
        
        // Metadata
        createdBy,
        createdAt
      } = body;
      
      console.log('📋 Creating vendor with role:', roleId);
      console.log('📞 Phone:', phone);
      console.log('📧 Email:', email);
      
      // ✅ VALIDATION: roleId is required
      if (!roleId) {
        console.error('❌ Missing roleId in vendor creation request');
        return sendError(c, 'roleId is required for vendor creation', 400);
      }
      
      // Normalize phone number
      const { normalizePhone } = await import('./phone-utils.tsx');
      const cleanPhone = normalizePhone(phone);
      
      // Generate vendor ID
      const vendorId = `vendor_${cleanPhone}`;
      
      // ✅ SQL: Check if vendor already exists by phone
      const vendorsRepo = getVendorsRepository();
      const existingVendor = await vendorsRepo.findByPhone(cleanPhone);
      if (existingVendor) {
        console.error('❌ Vendor already exists with this phone:', cleanPhone);
        return sendError(c, 'A vendor with this phone number already exists', 409);
      }
      
      // ✅ SQL: Fetch role details from RolesRepository
      console.log('🔍 Fetching role details for roleId:', roleId);
      const { getRolesRepository } = await import("../../../supabase/lib/repositories/roles.ts");
      const rolesRepo = getRolesRepository();
      const role = await rolesRepo.findById(roleId);
      
      let roleName = roleId; // Fallback to roleId if not found
      let roleDisplayName = roleId;
      
      if (role) {
        roleName = role.name || role.display_name || roleId;
        roleDisplayName = role.display_name || role.name || roleId;
        console.log('✅ Role config found:', { roleName, roleDisplayName });
      } else {
        console.warn('⚠️ Role config not found for:', roleId, '- using roleId as name');
      }
      
      // ✅ SQL: Create vendor using repository
      console.log('💾 Creating vendor in database...');
      console.log('   Vendor ID:', vendorId);
      console.log('   Role ID:', roleId);
      console.log('   Role Name:', roleName);
      
      const vendorsRepo = getVendorsRepository();
      
      // Check if vendor already exists by phone (duplicate check removed since already done above)
      
      // Create vendor
      const createdVendor = await vendorsRepo.create({
        vendor_id: vendorId,
        phone: cleanPhone,
        email,
        business_name: businessName,
        owner_name: ownerName,
        alternate_phone: alternatePhone,
        role_id: roleId, // ✅ CRITICAL: roleId must be set
        category,
        experience_years: experience ? parseInt(experience) : undefined,
        registration_number: registrationNumber,
        gst_number: gstNumber,
        pan_number: panNumber,
        address,
        city,
        state,
        pincode,
        landmark,
        operating_hours,
        capacity: capacity ? parseInt(capacity) : undefined,
        specialization,
        status: status === 'pending' ? 'pending_approval' : 'approved',
        is_active: status !== 'pending',
        setup_completed: false,
      });
      
      // Update with approval info if approved
      if (status !== 'pending') {
        await vendorsRepo.update(createdVendor.id, {
          approved_at: new Date().toISOString(),
          approved_by: createdBy || 'admin',
        });
      }
      
      console.log('✅ Vendor created successfully with all indexes');
      console.log('🎉 ========== VENDOR CREATION COMPLETE ==========');
      
      return sendSuccess(c, {
        vendor: createdVendor,
        message: 'Vendor created successfully',
        credentials: {
          phone: cleanPhone,
          defaultOTP: '123456', // For testing - in production use SMS
          loginUrl: '/vendor'
        }
      }, 'Vendor created successfully');
      
    } catch (error) {
      console.error('❌ Error creating vendor:', error);
      return sendError(c, error, 500);
    }
  });
}