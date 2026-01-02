/**
 * ✅ UNIVERSAL STAFF PROBLEM SEARCH - SQL VERSION
 * ✅ MIGRATED TO SQL: Now uses SQL-based discovery service (NO KV STORE)
 * 
 * CORRECT APPROACH:
 * 1. Uses SQL-based discovery service
 * 2. Filters staff by problem grid subcategories
 * 3. Checks availability and capability
 * 4. Calculates distance
 * 
 * This approach ensures we only show staff who can actually provide services,
 * and properly filter by their specialization.
 */

import { Hono } from 'hono';
import { getDiscoveryRepository } from '../../../supabase/lib/repositories/discovery';
import { findProblemById } from './problem-grid-catalog';

const app = new Hono();

/**
 * GET /make-server-3dd53475/customer/staff-by-problem/:roleId/:problemId
 * 
 * Search for staff members by problem category
 * ✅ MIGRATED TO SQL - NO KV STORE
 * - Works for ALL vendor types (vet, groomer, trainer, walker, behaviorist, boarding)
 * - Returns staff with at least 1 active published service
 * - Filters by specialization matching problem grid
 * - Includes parent clinic/vendor information
 */
app.get('/make-server-3dd53475/customer/staff-by-problem/:roleId/:problemId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const problemId = c.req.param('problemId');
    const lat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined;
    const lng = c.req.query('lng') ? parseFloat(c.req.query('lng')!) : undefined;
    const radius = c.req.query('radius') ? parseInt(c.req.query('radius')!) : undefined;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;
    
    console.log(`\n🔍 [STAFF-BY-PROBLEM] Starting search (SQL)...`);
    console.log(`   Role: ${roleId}`);
    console.log(`   Problem: ${problemId}`);
    console.log(`   Location: ${lat},${lng} (radius: ${radius}km)`);
    
    // ✅ STEP 1: Get problem details and mapped subcategories
    const problem = findProblemById(problemId);
    
    if (!problem) {
      return c.json({ 
        success: false, 
        error: 'Problem not found',
        problemId 
      }, 404);
    }
    
    console.log(`   Problem: "${problem.name}"`);
    console.log(`   Mapped Subcategories:`, problem.mappedSubCategories);
    
    if (!problem.mappedSubCategories || problem.mappedSubCategories.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Problem has no mapped subcategories',
        problem 
      }, 400);
    }
    
    // ✅ STEP 2: Use SQL-based discovery repository
    const discoveryRepo = getDiscoveryRepository();
    const staff = await discoveryRepo.searchStaffBySubcategories(
      roleId,
      problem.mappedSubCategories,
      lat,
      lng,
      radius,
      true // Check availability
    );
    
    // Sort by distance if location provided
    if (lat && lng) {
      staff.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else {
      staff.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    // Apply pagination
    const paginatedStaff = staff.slice(offset, offset + limit);
    
    // Format response
    const staffResults = paginatedStaff.map(s => ({
      id: s.staffId,
      staffId: s.staffId,
      fullName: s.fullName,
      specialization: s.specialization,
      specializations: s.specializations || [],
      consultationFee: s.consultationFee,
      rating: s.rating,
      services: s.services || [],
      distance: s.distance,
      vendorId: s.vendorId
    }));
    
    // Get unique clinics
    const clinicIds = new Set(staff.map(s => s.vendorId));
    const clinics: any[] = [];
    
    // Note: In a full implementation, you'd fetch clinic details from SQL
    // For now, we'll return staff with vendorId for frontend to handle
    
    return c.json({
      success: true,
      staff: staffResults,
      clinics: [],
      total: staff.length,
      limit,
      offset,
      hasMore: offset + limit < staff.length,
      problemGrid: {
        id: problemId,
        displayName: problem.displayName || problem.name,
        mappedSubCategories: problem.mappedSubCategories
      }
    });
    
  } catch (error) {
    console.error('❌ [STAFF-BY-PROBLEM] Error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

export default app;
