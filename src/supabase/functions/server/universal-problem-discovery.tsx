/**
 * UNIVERSAL PROBLEM DISCOVERY ENDPOINT
 * ✅ MIGRATED TO SQL: Now uses SQL-based discovery service (NO KV STORE)
 * ✅ UPDATED: Now works for ALL vendor types dynamically (not just vets)
 * Reuses the exact same logic across all roles
 */

import { Hono } from 'hono';
import { getDiscoveryService } from '../../../supabase/lib/services/discovery-service';
import { findProblemById, getProblemGridByRole } from './problem-grid-catalog';

export function registerUniversalDiscovery(app: Hono) {
  /**
   * GET /make-server-3dd53475/customer/problem-grid/:roleId
   * 
   * Returns the problem grid catalog for a specific vendor role
   * Used by the Problem Grid UI to show relevant tiles
   */
  app.get('/make-server-3dd53475/customer/problem-grid/:roleId', (c) => {
    try {
      const { roleId } = c.req.param();
      console.log(`🔍 [PROBLEM-GRID] Fetching grid for role: ${roleId}`);
      
      const problems = getProblemGridByRole(roleId);
      
      console.log(`✅ [PROBLEM-GRID] Found ${problems.length} problems for ${roleId}`);
      
      return c.json({
        success: true,
        roleId,
        problems
      });
    } catch (error) {
      console.error('❌ [PROBLEM-GRID] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/universal-problem-discovery
   * 
   * Discovers vendors/staff based on problem grid selection
   * ✅ NOW SUPPORTS ALL VENDOR TYPES via dynamic roleId parameter
   * ✅ MIGRATED TO SQL - NO KV STORE
   */
  app.get('/make-server-3dd53475/customer/universal-problem-discovery', async (c) => {
    return handleDiscovery(c);
  });

  /**
   * GET /make-server-3dd53475/customer/doctors/search
   * LEGACY ALIAS for Vet Search to prevent 404s
   */
  const legacyHandler = async (c: any) => {
    console.log(`⚠️ Legacy endpoint ${c.req.path} called, redirecting to Universal Discovery`);
    // Force roleId to 'veterinarian' for legacy compatibility if not present
    const url = new URL(c.req.url);
    if (!url.searchParams.has('roleId')) {
      url.searchParams.set('roleId', 'veterinarian');
    }
    return handleDiscovery(c); 
  };

  /**
   * GET /make-server-3dd53475/customer/discover-by-problem/:roleId/:problemId
   * Compatibility endpoint for ProblemCategoryMapper
   */
  app.get('/make-server-3dd53475/customer/discover-by-problem/:roleId/:problemId', async (c) => {
    const roleId = c.req.param('roleId');
    const problemId = c.req.param('problemId');
    return handleDiscovery(c, { roleId, problemGridId: problemId });
  });

  app.get('/make-server-3dd53475/customer/doctors/search', legacyHandler);
  app.post('/make-server-3dd53475/customer/doctors/search', legacyHandler);
  
  // Catch-all for potential variations
  app.get('/make-server-3dd53475/doctors/search', legacyHandler); 
  app.post('/make-server-3dd53475/doctors/search', legacyHandler);

  async function handleDiscovery(c: any, overrides: any = {}) {
    try {
      const problemGridId = overrides.problemGridId || c.req.query('problemGridId');
      const roleId = overrides.roleId || c.req.query('roleId');
      const feeMin = parseInt(c.req.query('feeMin') || '0');
      const feeMax = parseInt(c.req.query('feeMax') || '999999');
      const sortBy = (c.req.query('sortBy') || 'rating') as 'rating' | 'distance' | 'fee_low' | 'fee_high' | 'experience';
      
      // Customer location for distance
      const customerLat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined;
      const customerLon = c.req.query('lon') ? parseFloat(c.req.query('lon')!) : undefined;
      const maxDistance = c.req.query('maxDistance') ? parseInt(c.req.query('maxDistance')!) : undefined;
      
      console.log('\n🔍 ===== UNIVERSAL PROBLEM DISCOVERY (SQL) =====');
      console.log(`📋 Problem Grid: ${problemGridId}`);
      console.log(`🏷️  Role: ${roleId || 'NOT PROVIDED'}`);
      console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);
      
      if (!roleId) {
        return c.json({
          success: false,
          error: 'Missing required parameter: roleId'
        }, 400);
      }
      
      // ✅ USE SQL-BASED DISCOVERY SERVICE (NO KV STORE)
      const discoveryService = getDiscoveryService();
      const result = await discoveryService.discoverByProblemGrid({
        problemGridId,
        roleId,
        customerLat,
        customerLon,
        maxDistance,
        feeMin,
        feeMax,
        sortBy
      });
      
      // Format response for backward compatibility
      const specialists = [
        ...result.vendors.map(v => ({
          id: v.vendorId,
          vendorId: v.vendorId,
          staffId: v.vendorId, // For centers, use vendor ID
          fullName: v.businessName,
          name: v.businessName,
          clinicName: v.businessName,
          clinicId: v.vendorId,
          clinicAddress: v.address,
          location: v.address,
          clinicCity: v.city,
          clinicState: v.state,
          rating: v.rating,
          totalReviews: v.reviewCount,
          reviewCount: v.reviewCount,
          distance: v.distance,
          type: 'center',
          entityType: 'center',
          serviceCount: v.matchingServices,
          staffCount: v.staffCount,
          services: []
        })),
        ...result.staff.map(s => ({
          id: s.staffId,
          staffId: s.staffId,
          fullName: s.fullName,
          name: s.fullName,
          specialization: s.specialization,
          specializations: s.specializations || [],
          consultationFee: s.consultationFee,
          rating: s.rating,
          totalReviews: 0,
          reviewCount: 0,
          distance: s.distance,
          vendorId: s.vendorId,
          clinicId: s.vendorId,
          type: 'staff',
          entityType: 'staff',
          serviceCount: s.serviceCount,
          services: s.services || []
        }))
      ];
      
      return c.json({
        success: true,
        specialists,
        totalCount: result.totalCount,
        problemGrid: result.problemGrid
      });
      
    } catch (error) {
      console.error('❌ Error in universal problem discovery:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  }
}
