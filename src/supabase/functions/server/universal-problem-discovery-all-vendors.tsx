/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║        UNIVERSAL PROBLEM DISCOVERY - ALL VENDOR TYPES                      ║
 * ║     Single endpoint that works for ALL vendors dynamically                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { calculateDistance, getStaffNextAvailableSlot } from './schedule-utils.tsx';
import { findProblemById, getProblemGridByRole } from './problem-grid-catalog.tsx';

const app = new Hono();

/**
 * GET /make-server-3dd53475/customer/problem-discovery
 * 
 * Universal problem discovery endpoint for ALL vendor types
 * Works with: veterinarian, groomer, trainer, walker, behaviourist, boarding_center
 */
app.get('/make-server-3dd53475/customer/problem-discovery', async (c) => {
  try {
    const problemGridId = c.req.query('problemGridId');
    const roleId = c.req.query('roleId'); // DYNAMIC - passed from client
    const feeMin = parseInt(c.req.query('feeMin') || '0');
    const feeMax = parseInt(c.req.query('feeMax') || '999999');
    const sortBy = c.req.query('sortBy') || 'rating';
    
    // Customer location for distance
    const customerLat = parseFloat(c.req.query('lat') || '0');
    const customerLon = parseFloat(c.req.query('lon') || '0');
    
    console.log('\n🔍 ===== UNIVERSAL PROBLEM DISCOVERY =====');
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
    
    // STEP 1: Get problem grid configuration from static catalog
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
    
    // STEP 2: Get all vendors (UNIVERSAL LOGIC)
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    console.log(`📊 Total vendors: ${allVendors.length}`);

    // Filter approved vendors for the specific role
    let vendors = allVendors.filter((v: any) => {
      const isApproved = v.status === 'approved';
      const isActive = v.isActive === true;
      
      // Dynamic role matching
      let roleMatches = false;
      const vendorRole = v.roleId || v.role || '';
      
      // Normalize role IDs for comparison
      const normalizedVendorRole = vendorRole.toLowerCase().replace('role_', '');
      const normalizedSearchRole = roleId.toLowerCase().replace('role_', '');
      
      if (normalizedVendorRole === normalizedSearchRole) {
        roleMatches = true;
      }
      
      // Alternative role names matching
      const roleAliases: Record<string, string[]> = {
        'veterinarian': ['vet_clinic', 'pet_clinic', 'veterinarian'],
        'groomer': ['grooming_center', 'groomer'],
        'trainer': ['training_center', 'trainer'],
        'walker': ['walker', 'dog_walker'],
        'behaviourist': ['behavioral_trainer', 'behaviourist', 'behaviorist'],
        'boarding_center': ['boarding_center', 'boarding', 'pet_boarding']
      };
      
      const aliasesForRole = roleAliases[normalizedSearchRole] || [];
      if (aliasesForRole.some(alias => normalizedVendorRole.includes(alias))) {
        roleMatches = true;
      }
      
      return isApproved && isActive && roleMatches;
    });

    console.log(`✅ Approved & Active vendors for ${roleId}: ${vendors.length}`);

    // STEP 3: Get all staff from these vendors
    const allStaff: any[] = [];
    
    for (const vendor of vendors) {
      const staffPrefix = `staff:${vendor.id}:`;
      const vendorStaff = await kv.getByPrefix(staffPrefix);
      
      for (const staff of vendorStaff) {
        // Only include active staff
        if (staff.isActive !== false) {
          allStaff.push({
            ...staff,
            vendorId: vendor.id,
            vendorName: vendor.businessName,
            vendorPhone: vendor.phone,
            vendorAddress: vendor.address,
            vendorCity: vendor.city,
            vendorLat: vendor.lat || 0,
            vendorLon: vendor.lon || 0,
            vendorRating: vendor.rating || 0
          });
        }
      }
    }

    console.log(`📊 Total staff from ${vendors.length} vendors: ${allStaff.length}`);

    // STEP 4: Filter staff by fee range and calculate distance
    const staffWithDistance = allStaff.map((staff: any) => {
      const fee = staff.consultationFee || staff.serviceFee || staff.fee || 0;
      
      let distance = null;
      if (customerLat && customerLon && staff.vendorLat && staff.vendorLon) {
        distance = calculateDistance(
          customerLat,
          customerLon,
          staff.vendorLat,
          staff.vendorLon
        );
      }
      
      return {
        ...staff,
        consultationFee: fee,
        distance
      };
    }).filter((staff: any) => {
      const fee = staff.consultationFee;
      return fee >= feeMin && fee <= feeMax;
    });

    console.log(`✅ After fee filter (₹${feeMin}-₹${feeMax}): ${staffWithDistance.length}`);

    // STEP 5: Filter by problem grid subcategories
    console.log('\n🔍 Filtering by problem grid subcategories...');
    console.log(`   Required subcategories: [${requiredSubCategories.join(', ')}]`);
    
    const matchingStaff = staffWithDistance.filter((staff: any) => {
      // Check if staff has any services that match the required subcategories
      const staffServices = staff.services || [];
      
      // Check both staff specializations AND service categories
      const staffSpecializations = staff.specializations || [];
      const serviceCategories = staffServices.map((s: any) => s.category).filter(Boolean);
      const allCategories = [...new Set([...staffSpecializations, ...serviceCategories])];
      
      // Check if staff has any of the required subcategories
      const hasMatch = requiredSubCategories.some((reqSubCat: string) => 
        allCategories.includes(reqSubCat)
      );
      
      if (hasMatch) {
        const matchedCategories = allCategories.filter((cat: string) => 
          requiredSubCategories.includes(cat)
        );
        console.log(`   ✅ ${staff.fullName} - Matched: [${matchedCategories.join(', ')}]`);
      }
      
      return hasMatch;
    });
    
    console.log(`\n📊 FILTERED RESULTS: ${matchingStaff.length} specialists`);
    
    // STEP 6: Get next available slot for each staff
    for (const staff of matchingStaff) {
      try {
        const nextSlot = await getStaffNextAvailableSlot(staff.id);
        staff.nextAvailableDate = nextSlot?.date || null;
        staff.nextAvailableTime = nextSlot?.time || null;
      } catch (error) {
        console.error(`Error getting next slot for staff ${staff.id}:`, error);
        staff.nextAvailableDate = null;
        staff.nextAvailableTime = null;
      }
    }
    
    // STEP 7: Sort specialists
    matchingStaff.sort((a, b) => {
      if (sortBy === 'fee_low') return a.consultationFee - b.consultationFee;
      if (sortBy === 'fee_high') return b.consultationFee - a.consultationFee;
      if (sortBy === 'experience') return (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0);
      if (sortBy === 'rating') return (b.rating || b.vendorRating || 0) - (a.rating || a.vendorRating || 0);
      if (sortBy === 'distance' && a.distance && b.distance) return a.distance - b.distance;
      return 0;
    });
    
    // STEP 8: Format response
    const specialists = matchingStaff.map((staff: any) => {
      const staffServices = staff.services || [];
      const staffSpecializations = staff.specializations || [];
      const serviceCategories = staffServices.map((s: any) => s.category).filter(Boolean);
      const allCategories = [...new Set([...staffSpecializations, ...serviceCategories])];
      
      return {
        ...staff,
        matchedSubCategories: allCategories.filter((cat: string) => 
          requiredSubCategories.includes(cat)
        ),
        problemGridId,
        problemGridName: problemGrid.displayName
      };
    });
    
    return c.json({
      success: true,
      specialists,
      totalCount: specialists.length,
      problemGrid: {
        id: problemGridId,
        displayName: problemGrid.displayName,
        description: problemGrid.description,
        icon: problemGrid.icon,
        requiredSubCategories
      }
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
