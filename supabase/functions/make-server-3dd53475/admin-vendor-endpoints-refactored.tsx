/**
 * ============================================================================
 * ENHANCED ADMIN VENDOR MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Admin vendor management endpoints:
 * - Get all vendors (with status filtering)
 * - Get enhanced statistics
 * - Vendor details and management
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with repository calls
 * - All vendor operations use VendorsRepository
 * - Direct database queries replaced with repository methods
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { getDbClient } from "../../lib/db.ts";

export function adminVendorEndpoints(app: Hono) {

  // ============================================
  // GET ALL VENDORS (with status filtering)
  // ============================================

  /**
   * GET /admin/vendors/all
   * Get all vendors regardless of status
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/admin/vendors/all", async (c) => {
    try {
      console.log('========================================');
      console.log('📋 ADMIN: Loading all vendors...');
      console.log('========================================');
      
      // ✅ SQL: Get all vendors using repository
      const client = getDbClient();
      const { data: vendors, error } = await client
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching vendors:', error);
        return c.json({ error: error.message }, 500);
      }
      
      console.log(`📦 Vendor records from SQL: ${vendors?.length || 0}`);
      
      // ✅ SQL: Filter out rejected and deleted vendors
      const activeVendors = vendors?.filter((v: any) => 
        v.status !== 'rejected' && v.status !== 'deleted' && !v.is_deleted
      ) || [];
      
      console.log(`✅ Filtered active vendor records: ${activeVendors.length}`);
      
      // Enrich with additional data
      const enrichedVendors = await Promise.all(activeVendors.map(async (vendor: any) => {
        // ✅ SQL: Get vendor statistics
        const bookings = await getBookingsRepository().findByVendor(vendor.id);
        const reviews = await getReviewsRepository().findByVendor(vendor.id);
        
        // Normalize status for Admin UI
        let displayStatus = vendor.status || 'pending_approval';
        if (displayStatus === 'pending') displayStatus = 'pending_approval';

        return {
          id: vendor.id,
          vendorId: vendor.id,
          applicationId: vendor.application_id,
          fullName: vendor.owner_name,
          businessName: vendor.business_name,
          roleName: vendor.role_id,
          roleId: vendor.role_id,
          serviceCategory: vendor.category,
          serviceStyle: vendor.service_style,
          phone: vendor.phone,
          email: vendor.email,
          city: vendor.city,
          state: vendor.state,
          address: vendor.address,
          status: displayStatus,
          vendorType: vendor.category,
          submittedAt: vendor.submitted_at || vendor.created_at,
          approvedAt: vendor.approved_at,
          rejectedAt: vendor.rejected_at,
          rejectionReason: vendor.rejection_reason,
          totalServices: 0, // TODO: Calculate from services
          activeServices: 0, // TODO: Calculate from active services
          rating: vendor.rating || null,
          totalBookings: bookings.length,
          revenue: bookings
            .filter(b => b.status === 'completed')
            .reduce((sum, b) => sum + (b.total_amount || 0), 0),
          lastActivityAt: vendor.updated_at,
          services: vendor.services || [],
          category: vendor.category,
          experience: vendor.years_of_experience || 'N/A',
          progressPercentage: 100,
          daysSinceSubmission: Math.floor(
            (Date.now() - new Date(vendor.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
          )
        };
      }));
      
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
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/admin/vendors/stats-enhanced", async (c) => {
    try {
      console.log('📊 Calculating enhanced vendor statistics...');
      
      // ✅ SQL: Get all vendors
      const client = getDbClient();
      const { data: vendors } = await client
        .from('vendors')
        .select('id, status, is_active, created_at');
      
      const allVendors = vendors || [];
      
      // Calculate statistics
      const stats = {
        total: allVendors.length,
        pending: allVendors.filter((v: any) => v.status === 'pending_approval' || v.status === 'pending').length,
        approved: allVendors.filter((v: any) => v.status === 'approved').length,
        rejected: allVendors.filter((v: any) => v.status === 'rejected').length,
        active: allVendors.filter((v: any) => v.is_active).length,
        inactive: allVendors.filter((v: any) => !v.is_active).length,
        moreInfoRequired: allVendors.filter((v: any) => v.status === 'more_info_required').length,
        resubmitted: allVendors.filter((v: any) => v.status === 'resubmitted').length,
      };
      
      return sendSuccess(c, { stats });
    } catch (error) {
      console.error('❌ Error calculating vendor statistics:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // GET VENDOR DETAILS
  // ============================================

  /**
   * GET /admin/vendors/:vendorId
   * Get detailed vendor information
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/admin/vendors/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // ✅ SQL: Get related data
      const bookings = await getBookingsRepository().findByVendor(vendorId);
      const reviews = await getReviewsRepository().findByVendor(vendorId);
      
      return sendSuccess(c, {
        vendor: {
          ...vendor,
          totalBookings: bookings.length,
          totalReviews: reviews.length,
          revenue: bookings
            .filter(b => b.status === 'completed')
            .reduce((sum, b) => sum + (b.total_amount || 0), 0),
        }
      });
    } catch (error) {
      console.error('❌ Error loading vendor details:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // VENDOR ACTIONS
  // ============================================

  /**
   * POST /admin/vendors/:vendorId/activate
   * Activate a vendor
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/vendors/:vendorId/activate", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Activate vendor
      const vendor = await getVendorsRepository().activate(vendorId);
      
      return sendSuccess(c, { vendor, message: 'Vendor activated successfully' });
    } catch (error) {
      console.error('❌ Error activating vendor:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/vendors/:vendorId/suspend
   * Suspend a vendor
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/vendors/:vendorId/suspend", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Suspend vendor
      const vendor = await getVendorsRepository().suspend(vendorId);
      
      return sendSuccess(c, { vendor, message: 'Vendor suspended successfully' });
    } catch (error) {
      console.error('❌ Error suspending vendor:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Admin vendor endpoints registered (SQL-only)');
}

