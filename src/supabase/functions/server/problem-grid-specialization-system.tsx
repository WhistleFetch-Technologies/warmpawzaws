/**
 * PROBLEM GRID SPECIALIZATION SYSTEM
 * 
 * Staff and centers select specializations using the SAME labels customers see
 * in the problem grid. This ensures perfect matching and consistency.
 * 
 * Customer sees: "Heart Care" → Staff/Center selects: "Heart Care"
 */

import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { getProblemGridByRole } from './problem-grid-catalog.tsx';

export function registerProblemGridSpecializationSystem(app: Hono) {
  
  /**
   * GET /vendor/problem-grid-specializations/:roleId
   * 
   * Returns specializations using EXACT problem grid labels
   * This is what customers see, and what staff/centers should select
   */
  app.get("/make-server-3dd53475/vendor/problem-grid-specializations/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      // ✅ FIX: Use centralized getProblemGridByRole (already imported at top)
      
      // Normalize role ID
      const normalizedRoleId = roleId.replace(/^role_/, '').toLowerCase();
      
      let problemGrid: any[] = [];
      let roleType = '';
      
      // ✅ FIX: Use centralized getProblemGridByRole function (no duplicate logic)
      problemGrid = getProblemGridByRole(normalizedRoleId);
      
      // Determine role type for display
      if (['veterinarian', 'vet_clinic', 'pet_clinic', 'clinic', 'hospital'].includes(normalizedRoleId)) {
        roleType = 'Healthcare';
      } else if (['groomer', 'pet_groomer', 'grooming_center', 'grooming_salon', 'pet_salon'].includes(normalizedRoleId)) {
        roleType = 'Grooming';
      } else if (['trainer', 'pet_trainer', 'training_center', 'dog_trainer'].includes(normalizedRoleId)) {
        roleType = 'Training';
      } else if (['walker', 'dog_walker', 'pet_walker'].includes(normalizedRoleId)) {
        roleType = 'Walking';
      } else if (['behaviourist', 'behaviorist', 'pet_behaviorist'].includes(normalizedRoleId)) {
        roleType = 'Behavioral';
      } else if (['boarding', 'pet_boarding', 'boarding_center', 'pet_sitter', 'kennel'].includes(normalizedRoleId)) {
        roleType = 'Boarding/Sitting';
      } else if (['nutritionist', 'pet_nutritionist', 'nutrition_center'].includes(normalizedRoleId)) {
        roleType = 'Nutrition';
      } else if (['pharmacist', 'pet_pharmacist', 'pharmacy_center', 'pet_pharmacy'].includes(normalizedRoleId)) {
        roleType = 'Pharmacy';
      } else if (['adoption_center', 'pet_adoption_center', 'adoption_agency', 'pet_shelter'].includes(normalizedRoleId)) {
        roleType = 'Adoption';
      } else if (['insurance', 'pet_insurance', 'insurance_provider', 'insurance_agent'].includes(normalizedRoleId)) {
        roleType = 'Insurance';
      } else if (['ambulance', 'pet_ambulance', 'ambulance_service'].includes(normalizedRoleId)) {
        roleType = 'Ambulance';
      } else if (['diagnostics', 'diagnostic_lab', 'diagnostics_lab', 'lab'].includes(normalizedRoleId)) {
        roleType = 'Diagnostics';
      } else if (['cafe', 'pet_cafe', 'cafes'].includes(normalizedRoleId)) {
        roleType = 'Cafe';
      } else if (['resort', 'pet_resort', 'boarding_resort'].includes(normalizedRoleId)) {
        roleType = 'Resort';
      } else if (['holiday', 'pet_holiday', 'pet_holiday_planner', 'holiday_planner'].includes(normalizedRoleId)) {
        roleType = 'Holiday';
      } else if (['photography', 'pet_photographer'].includes(normalizedRoleId)) {
        roleType = 'Photography';
      } else if (['relocation', 'pet_relocation'].includes(normalizedRoleId)) {
        roleType = 'Relocation';
      } else if (['breeder', 'pet_breeder'].includes(normalizedRoleId)) {
        roleType = 'Breeder';
      } else if (['sunset', 'pet_sunset', 'pet_sunset_services'].includes(normalizedRoleId)) {
        roleType = 'Sunset Services';
      } else {
        // ✅ FALLBACK: Return generic capabilities if no problem grid found
        console.warn(`[PROBLEM GRID] Unknown roleId: ${roleId}, falling back to General Services`);
        
        if (problemGrid.length === 0) {
          problemGrid = [
            {
              id: 'general_service',
              name: 'General Service',
              displayName: 'General Service',
              icon: '🐾',
              color: '#10B981',
              gradient: 'from-green-500 to-green-600',
              description: 'General pet care services',
              keywords: ['general', 'service', 'care'],
              mappedSubCategories: ['sub_general'],
              order: 1
            },
            {
              id: 'consultation',
              name: 'Consultation',
              displayName: 'Consultation',
              icon: '💬',
              color: '#3B82F6',
              gradient: 'from-blue-500 to-blue-600',
              description: 'Professional consultation',
              keywords: ['consult', 'advice'],
              mappedSubCategories: ['sub_consultation'],
              order: 2
            },
            {
              id: 'emergency',
              name: 'Emergency',
              displayName: 'Emergency Support',
              icon: '🚨',
              color: '#EF4444',
              gradient: 'from-red-500 to-red-600',
              description: 'Urgent assistance',
              keywords: ['urgent', 'emergency'],
              mappedSubCategories: ['sub_emergency'],
              order: 3
            }
          ];
        }
        roleType = roleType || 'General Service';
      }
      
      // Format specializations using problem grid data
      const specializations = problemGrid
        .sort((a, b) => a.order - b.order)
        .map(problem => ({
          id: problem.id,
          name: problem.displayName,  // This is what customer sees (e.g., "Heart Care", "Skin Care")
          shortName: problem.name,    // Short version (e.g., "Cardiology")
          icon: problem.icon,
          color: problem.color,
          gradient: problem.gradient,
          description: problem.description,
          keywords: problem.keywords,
          mappedSubCategories: problem.mappedSubCategories,
          order: problem.order
        }));
      
      console.log(`✅ Loaded ${specializations.length} specializations for ${roleType}`);
      
      return c.json({
        success: true,
        roleId,
        roleType,
        specializations,
        totalCount: specializations.length,
        note: 'These are the same labels customers see in the problem grid'
      });
      
    } catch (error) {
      console.error('❌ Error loading problem grid specializations:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /vendor/:vendorId/update-specializations
   * 
   * Update vendor/center specializations
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/update-specializations", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { specializations } = await c.req.json();
      
      if (!Array.isArray(specializations)) {
        return c.json({ error: 'Specializations must be an array of problem IDs' }, 400);
      }
      
      // Load vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Update vendor with specializations
      const updatedVendor: any = {
        ...(vendor as any),
        specializations,  // Array of problem IDs (e.g., ['surgery', 'cardiology', 'dermatology'])
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`vendor:${vendorId}`, updatedVendor);
      
      console.log(`✅ Updated vendor ${vendorId} specializations:`, specializations);
      
      return c.json({
        success: true,
        vendor: updatedVendor
      });
      
    } catch (error) {
      console.error('❌ Error updating vendor specializations:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /vendor/:vendorId/staff/:staffId/update-specializations
   * 
   * Update staff member specializations
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/staff/:staffId/update-specializations", async (c) => {
    try {
      const { vendorId, staffId } = c.req.param();
      const { specializations } = await c.req.json();
      
      if (!Array.isArray(specializations)) {
        return c.json({ error: 'Specializations must be an array of problem IDs' }, 400);
      }
      
      // Load staff member
      const staff = await kv.get(`vendor:${vendorId}:staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff member not found' }, 404);
      }
      
      // Load vendor to get roleId for validation
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ FIX: Use centralized getProblemGridByRole function
      const vendorData = vendor as any;
      const normalizedRoleId = (vendorData.roleId || '').replace(/^role_/, '').toLowerCase();
      const problemGrid = getProblemGridByRole(normalizedRoleId);
      
      // Get display names for selected specializations
      const specializationDetails = specializations.map(specId => {
        const problem = problemGrid.find(p => p.id === specId);
        return problem ? {
          id: problem.id,
          displayName: problem.displayName,
          icon: problem.icon,
          mappedSubCategories: problem.mappedSubCategories
        } : null;
      }).filter(Boolean);
      
      // Update staff with specializations
      const updatedStaff: any = {
        ...(staff as any),
        specializations,  // Array of problem IDs
        specializationDetails,  // Full details for display
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`vendor:${vendorId}:staff:${staffId}`, updatedStaff);
      
      // Also store in staff: key for direct access
      await kv.set(`staff:${staffId}`, updatedStaff);
      
      console.log(`✅ Updated staff ${staffId} specializations:`, {
        specializations,
        details: specializationDetails
      });
      
      return c.json({
        success: true,
        staff: updatedStaff
      });
      
    } catch (error) {
      console.error('❌ Error updating staff specializations:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /customer/find-by-specialization/:roleId/:problemId
   * 
   * Find vendors/staff by problem grid specialization
   */
  app.get("/make-server-3dd53475/customer/find-by-specialization/:roleId/:problemId", async (c) => {
    try {
      const { roleId, problemId } = c.req.param();
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseInt(c.req.query('radius') || '50');
      
      console.log(`🔍 Finding providers for problem: ${problemId}, role: ${roleId}`);
      
      // Normalize role ID
      const normalizedRoleId = roleId.replace(/^role_/, '').toLowerCase();
      
      // Get all vendors for this role
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      
      // Filter vendors by role and specialization
      const matchingVendors = allVendors.filter((vendor: any) => {
        const vendorRoleId = vendor.roleId.replace(/^role_/, '').toLowerCase();
        
        // Check if vendor role matches
        const roleMatches = vendorRoleId === normalizedRoleId ||
          (normalizedRoleId === 'veterinarian' && ['veterinarian', 'vet_clinic', 'pet_clinic'].includes(vendorRoleId)) ||
          (normalizedRoleId === 'groomer' && ['groomer', 'pet_groomer', 'grooming_center'].includes(vendorRoleId)) ||
          (normalizedRoleId === 'trainer' && ['trainer', 'pet_trainer', 'training_center'].includes(vendorRoleId)) ||
          (normalizedRoleId === 'walker' && ['walker', 'dog_walker', 'pet_walker'].includes(vendorRoleId));
        
        if (!roleMatches) return false;
        
        // Check if vendor is active and approved
        if (vendor.status !== 'active' || !vendor.isActive) return false;
        
        // Check if vendor has this specialization
        if (vendor.specializations && vendor.specializations.includes(problemId)) {
          return true;
        }
        
        // Also check staff members
        // This will be populated when we query staff
        return true;
      });
      
      // Now get staff for matching vendors
      const results: any[] = [];
      
      for (const vendorItem of matchingVendors) {
        const vendor = vendorItem.value || vendorItem;
        const vendorId = (vendor as any).id || (vendorItem as any).key?.replace('vendor:vendor_', '') || '';
        
        if (!vendorId) continue;
        
        // Get vendor's staff
        const staffMembers = await kv.getByPrefix(`vendor:${vendorId}:staff:`);
        
        // Filter staff by specialization
        const matchingStaff = (staffMembers || []).filter((staffItem: any) => {
          const staff = staffItem.value || staffItem;
          return (staff as any).specializations && (staff as any).specializations.includes(problemId);
        });
        
        // If vendor has specialization OR has staff with specialization
        const vendorSpecializations = (vendor as any).specializations || [];
        if (vendorSpecializations.includes(problemId) || matchingStaff.length > 0) {
          results.push({
            vendor,
            staff: matchingStaff
          });
        }
      }
      
      console.log(`✅ Found ${results.length} providers with ${problemId} specialization`);
      
      return c.json({
        success: true,
        problemId,
        roleId,
        totalProviders: results.length,
        providers: results
      });
      
    } catch (error) {
      console.error('❌ Error finding by specialization:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

export default registerProblemGridSpecializationSystem;