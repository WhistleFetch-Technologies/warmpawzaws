/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║        UNIVERSAL PROBLEM DISCOVERY - ALL VENDOR TYPES                      ║
 * ║     ✅ MIGRATED TO SQL: Now uses SQL-based discovery service (NO KV STORE) ║
 * ║     Single endpoint that works for ALL vendors dynamically                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { Hono } from 'hono';
import { getDiscoveryService } from '../../../supabase/lib/services/discovery-service';
import { findProblemById, getProblemGridByRole } from './problem-grid-catalog';

const app = new Hono();

/**
 * GET /make-server-3dd53475/customer/problem-discovery
 * 
 * Universal problem discovery endpoint for ALL vendor types
 * ✅ MIGRATED TO SQL - NO KV STORE
 * Works with: veterinarian, groomer, trainer, walker, behaviourist, boarding_center
 */
app.get('/make-server-3dd53475/customer/problem-discovery', async (c) => {
  try {
    const problemGridId = c.req.query('problemGridId');
    const roleId = c.req.query('roleId');
    const feeMin = parseInt(c.req.query('feeMin') || '0');
    const feeMax = parseInt(c.req.query('feeMax') || '999999');
    const sortBy = (c.req.query('sortBy') || 'rating') as 'rating' | 'distance' | 'fee_low' | 'fee_high' | 'experience';
    
    const customerLat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined;
    const customerLon = c.req.query('lon') ? parseFloat(c.req.query('lon')!) : undefined;
    const maxDistance = c.req.query('maxDistance') ? parseInt(c.req.query('maxDistance')!) : undefined;
    
    console.log('\n🔍 ===== UNIVERSAL PROBLEM DISCOVERY (SQL) =====');
    console.log(`📋 Problem Grid: ${problemGridId}`);
    console.log(`🏷️  Role: ${roleId}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);
    
    if (!problemGridId) {
      return c.json({
        success: false,
        error: 'Missing required parameter: problemGridId'
      }, 400);
    }
    
    if (!roleId) {
      return c.json({
        success: false,
        error: 'Missing required parameter: roleId'
      }, 400);
    }
    
    const problemGrid = findProblemById(problemGridId);
    
    if (!problemGrid) {
      console.log('❌ Problem grid not found in catalog');
      return c.json({
        success: false,
        error: 'Problem grid not found'
      }, 404);
    }
    
    console.log(`✅ Problem Grid: "${problemGrid.displayName}"`);
    console.log(`   Mapped SubCategories: [${problemGrid.mappedSubCategories?.join(', ') || 'none'}]`);
    
    const requiredSubCategories = problemGrid.mappedSubCategories || [];
    
    if (requiredSubCategories.length === 0) {
      console.log('⚠️  No subcategories mapped for this problem grid');
      return c.json({
        success: true,
        specialists: [],
        totalCount: 0,
        message: 'No specialists available for this problem'
      });
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
    
    // Format response
    const specialists = [
      ...result.vendors.map(v => ({
        ...v,
        vendorId: v.vendorId,
        clinicName: v.businessName,
        clinicAddress: v.address,
        type: 'center',
        entityType: 'center'
      })),
      ...result.staff.map(s => ({
        ...s,
        staffId: s.staffId,
        clinicId: s.vendorId,
        type: 'staff',
        entityType: 'staff'
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
});

/**
 * GET /make-server-3dd53475/customer/problem-grids/:roleId
 * 
 * Get all problem grids for a specific vendor role
 */
app.get('/make-server-3dd53475/customer/problem-grids/:roleId', async (c) => {
  try {
    const { roleId } = c.req.param();
    
    console.log(`\n📋 Fetching problem grids for role: ${roleId}`);
    
    const problemGrids = getProblemGridByRole(roleId);
    
    if (!problemGrids || problemGrids.length === 0) {
      return c.json({
        success: false,
        error: `No problem grids found for role: ${roleId}`
      }, 404);
    }
    
    console.log(`✅ Found ${problemGrids.length} problem grids for ${roleId}`);
    
    return c.json({
      success: true,
      problemGrids,
      roleId,
      totalCount: problemGrids.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching problem grids:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

export default app;
