/**
 * ============================================================================
 * PROBLEM GRID SPECIALIZATION SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Get problem grid specializations by role
 * - Update vendor specializations
 * - Update staff specializations
 * - Find vendors/staff by specialization
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Vendors from `vendors` table
 * - Vendor specializations from `vendor_specializations` table
 * - Staff from `staff` table
 * - Staff specializations from `staff_specializations` table
 * 
 * Date: 2025-01-27
 * Migration: Batch 7 Phase 4 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getProblemGridByRole } from './problem-grid-catalog.tsx';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getDbClient } from '../../lib/db.ts';

/**
 * PROBLEM GRID SPECIALIZATION SYSTEM - SQL-ONLY
 */
export function registerProblemGridSpecializationSystem(app: Hono) {
  const db = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const staffRepo = getStaffRepository();
  
  /**
   * GET /vendor/problem-grid-specializations/:roleId
   * 
   * Returns specializations using EXACT problem grid labels
   * This is what customers see, and what staff/centers should select
   */
  app.get("/make-server-3dd53475/vendor/problem-grid-specializations/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      // Normalize role ID
      const normalizedRoleId = roleId.replace(/^role_/, '').toLowerCase();
      
      let problemGrid: any[] = [];
      let roleType = '';
      
      // Use centralized getProblemGridByRole function
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
          name: problem.displayName,
          shortName: problem.name,
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
      
      // ✅ SQL: Get vendor from vendors table
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ SQL: Delete existing specializations
      await db
        .from('vendor_specializations')
        .delete()
        .eq('vendor_id', vendorId);
      
      // ✅ SQL: Insert new specializations
      if (specializations.length > 0) {
        const specializationsToInsert = specializations.map((spec: string) => ({
          vendor_id: vendorId,
          specialization: spec
        }));
        
        const { error: insertError } = await db
          .from('vendor_specializations')
          .insert(specializationsToInsert);
        
        if (insertError) {
          console.error('Error inserting specializations:', insertError);
          return c.json({ error: 'Failed to update specializations' }, 500);
        }
      }
      
      // ✅ SQL: Update vendor updated_at
      await vendorsRepo.update(vendorId, {
        updated_at: new Date().toISOString()
      });
      
      console.log(`✅ Updated vendor ${vendorId} specializations:`, specializations);
      
      // Get updated vendor with specializations
      const updatedVendor = await vendorsRepo.findById(vendorId);
      const { data: vendorSpecs } = await db
        .from('vendor_specializations')
        .select('specialization')
        .eq('vendor_id', vendorId);
      
      return c.json({
        success: true,
        vendor: {
          ...updatedVendor,
          specializations: (vendorSpecs || []).map((s: any) => s.specialization)
        }
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
      
      // ✅ SQL: Get staff member from staff table
      const staff = await staffRepo.findById(staffId);
      if (!staff || staff.vendorId !== vendorId) {
        return c.json({ error: 'Staff member not found' }, 404);
      }
      
      // ✅ SQL: Get vendor to get roleId for validation
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Get problem grid for validation
      const normalizedRoleId = (vendor.role_id || '').toString().replace(/^role_/, '').toLowerCase();
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
      
      // ✅ SQL: Delete existing staff specializations
      await db
        .from('staff_specializations')
        .delete()
        .eq('staff_id', staffId);
      
      // ✅ SQL: Insert new specializations
      if (specializations.length > 0) {
        const specializationsToInsert = specializations.map((spec: string) => ({
          staff_id: staffId,
          specialization: spec
        }));
        
        const { error: insertError } = await db
          .from('staff_specializations')
          .insert(specializationsToInsert);
        
        if (insertError) {
          console.error('Error inserting staff specializations:', insertError);
          return c.json({ error: 'Failed to update specializations' }, 500);
        }
      }
      
      console.log(`✅ Updated staff ${staffId} specializations:`, {
        specializations,
        details: specializationDetails
      });
      
      // Get updated staff with specializations
      const { data: staffSpecs } = await db
        .from('staff_specializations')
        .select('specialization')
        .eq('staff_id', staffId);
      
      return c.json({
        success: true,
        staff: {
          ...staff,
          specializations: (staffSpecs || []).map((s: any) => s.specialization),
          specializationDetails
        }
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
      
      // ✅ SQL: Get all vendors for this role
      const allVendors = await vendorsRepo.findByRole(roleId, { status: 'active' });
      
      // ✅ SQL: Get vendor specializations
      const { data: allVendorSpecs } = await db
        .from('vendor_specializations')
        .select('vendor_id, specialization');
      
      const vendorSpecsMap: Record<string, string[]> = {};
      (allVendorSpecs || []).forEach((vs: any) => {
        if (!vendorSpecsMap[vs.vendor_id]) {
          vendorSpecsMap[vs.vendor_id] = [];
        }
        vendorSpecsMap[vs.vendor_id].push(vs.specialization);
      });
      
      // Filter vendors by role and specialization
      const matchingVendors = allVendors.filter((vendor: any) => {
        // Check if vendor has this specialization
        const vendorSpecs = vendorSpecsMap[vendor.id] || [];
        return vendorSpecs.includes(problemId);
      });
      
      // ✅ SQL: Get staff for matching vendors
      const results: any[] = [];
      
      for (const vendor of matchingVendors) {
        // ✅ SQL: Get vendor's staff
        const { data: staffMembers } = await db
          .from('staff')
          .select('*')
          .eq('vendor_id', vendor.id)
          .eq('is_active', true);
        
        // ✅ SQL: Get staff specializations
        const staffIds = (staffMembers || []).map((s: any) => s.id);
        const { data: staffSpecs } = staffIds.length > 0 ? await db
          .from('staff_specializations')
          .select('staff_id, specialization')
          .in('staff_id', staffIds) : { data: [] };
        
        const staffSpecsMap: Record<string, string[]> = {};
        (staffSpecs || []).forEach((ss: any) => {
          if (!staffSpecsMap[ss.staff_id]) {
            staffSpecsMap[ss.staff_id] = [];
          }
          staffSpecsMap[ss.staff_id].push(ss.specialization);
        });
        
        // Filter staff by specialization
        const matchingStaff = (staffMembers || []).filter((staff: any) => {
          const staffSpecs = staffSpecsMap[staff.id] || [];
          return staffSpecs.includes(problemId);
        });
        
        // If vendor has specialization OR has staff with specialization
        const vendorSpecs = vendorSpecsMap[vendor.id] || [];
        if (vendorSpecs.includes(problemId) || matchingStaff.length > 0) {
          results.push({
            vendor: {
              ...vendor,
              specializations: vendorSpecs
            },
            staff: matchingStaff.map((s: any) => ({
              ...s,
              specializations: staffSpecsMap[s.id] || []
            }))
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

