/**
 * ============================================================================
 * STAFF SPECIALIZATION SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Maps staff expertise to problem grid subcategories
 * Enables intelligent staff-to-problem matching
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `StaffRepository`, `VendorsRepository`
 * - Uses `staff`, `vendors`, `staff_specializations` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 10 Phase 1 - KV to SQL (7 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const staffRepo = getStaffRepository();
const vendorsRepo = getVendorsRepository();

export function staffSpecializationEndpoints(app: Hono) {
  
  /**
   * GET /vendor/staff-specializations/:roleId
   * Get available specializations for a specific vendor role
   */
  app.get("/make-server-3dd53475/vendor/staff-specializations/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      const { getSubcategoriesForVendorType } = await import('./problem-subcategory-mapping.tsx');
      const { subcategoryIdToNames } = await import('./problem-subcategory-mapping.tsx');
      const { getProblemGridByRole } = await import('./problem-grid-catalog.tsx');
      
      // Get subcategories for this role
      const subcategoryIds = getSubcategoriesForVendorType(roleId);
      
      if (subcategoryIds.length === 0) {
        return c.json({
          success: false,
          error: `No specializations found for roleId: ${roleId}`,
          supportedRoles: ['veterinarian', 'groomer', 'pet_trainer', 'pet_walker', 'behaviourist', 'pet_boarder']
        }, 400);
      }
      
      // Build specializations list
      const specializations = subcategoryIds.map(subCatId => {
        const names = subcategoryIdToNames[subCatId] || [];
        return {
          id: subCatId,
          name: names[0],
          alternativeNames: names.slice(1),
          description: getSpecializationDescription(subCatId)
        };
      }).filter(s => s.name);
      
      // Get problem grid for context
      const problemGrid = getProblemGridByRole(roleId);
      
      // Map which problems each specialization helps with
      const specializationsWithProblems = specializations.map(spec => {
        const relatedProblems = problemGrid.filter((problem: any) => 
          problem.mappedSubCategories.includes(spec.id)
        ).map((problem: any) => ({
          id: problem.id,
          name: problem.displayName,
          icon: problem.icon
        }));
        
        return {
          ...spec,
          helpsWithProblems: relatedProblems
        };
      });
      
      return c.json({
        success: true,
        roleId,
        specializations: specializationsWithProblems,
        usage: 'Select one or more specializations when creating/editing staff members'
      });
      
    } catch (error) {
      console.error('❌ Error fetching specializations:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /vendor/:vendorId/staff/:staffId/specializations
   * Update staff member specializations
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/staff/:staffId/specializations", async (c) => {
    try {
      const { vendorId, staffId } = c.req.param();
      const { specializations } = await c.req.json();
      
      if (!Array.isArray(specializations)) {
        return c.json({ error: 'Specializations must be an array' }, 400);
      }
      
      console.log(`🎯 Updating specializations for staff ${staffId}:`, specializations);
      
      // ✅ SQL: Load staff member
      const staff = await staffRepo.findById(staffId);
      
      if (!staff || staff.vendor_id !== vendorId) {
        return c.json({ error: 'Staff member not found' }, 404);
      }
      
      // Get display names for specializations
      const { subcategoryIdToNames } = await import('./problem-subcategory-mapping.tsx');
      const specializationNames = specializations.map(id => {
        const names = subcategoryIdToNames[id] || [];
        return names[0];
      }).filter(Boolean);
      
      // ✅ SQL: Update staff specializations
      // First, delete existing specializations
      await db
        .from('staff_specializations')
        .delete()
        .eq('staff_id', staffId);
      
      // Then, insert new specializations
      if (specializations.length > 0) {
        await db
          .from('staff_specializations')
          .insert(specializations.map((specId: string) => ({
            staff_id: staffId,
            specialization_id: specId,
            created_at: new Date().toISOString()
          })));
      }
      
      // ✅ SQL: Update staff metadata with specialization names
      await db
        .from('staff')
        .update({
          metadata: {
            ...((staff as any).metadata || {}),
            specializations,
            specializationNames,
            updatedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', staffId);
      
      console.log(`✅ Updated staff specializations:`, {
        staffId,
        specializations,
        specializationNames
      });
      
      // Get updated staff
      const updatedStaff = await staffRepo.findById(staffId);
      
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
   * GET /customer/staff-by-problem/:roleId/:problemId
   * Find staff members by problem (uses specializations)
   */
  app.get("/make-server-3dd53475/customer/staff-by-problem/:roleId/:problemId", async (c) => {
    try {
      const { roleId, problemId } = c.req.param();
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseInt(c.req.query('radius') || '5');
      
      console.log(`🔍 Finding staff for problem: ${problemId}, role: ${roleId}`);
      
      const { findProblemById } = await import('./problem-grid-catalog.tsx');
      const problem = findProblemById(problemId);
      
      if (!problem) {
        return c.json({ error: 'Problem not found' }, 404);
      }
      
      console.log(`   Problem: "${problem.displayName}"`);
      console.log(`   Mapped subcategories:`, problem.mappedSubCategories);
      
      // ✅ SQL: Get all vendors of this role
      const normalizedRoleId = roleId.replace('role_', '');
      const { data: roleVendors } = await db
        .from('vendors')
        .select('*')
        .eq('role_id', normalizedRoleId)
        .eq('status', 'approved')
        .eq('is_active', true);
      
      console.log(`   Found ${roleVendors?.length || 0} approved vendors with role ${roleId}`);
      
      // Find staff with matching specializations
      const matchingStaff: any[] = [];
      
      for (const vendor of roleVendors || []) {
        // ✅ SQL: Get staff for this vendor
        const { data: staffMembers } = await db
          .from('staff')
          .select('*, staff_specializations(*)')
          .eq('vendor_id', vendor.id)
          .eq('is_active', true);
        
        for (const staff of staffMembers || []) {
          // Check if staff has specializations matching the problem
          const staffSpecializations = staff.staff_specializations?.map((s: any) => s.specialization_id) || [];
          const hasMatchingSpecialization = staffSpecializations.some((specId: string) =>
            problem.mappedSubCategories.includes(specId)
          );
          
          if (hasMatchingSpecialization) {
            matchingStaff.push({
              ...staff,
              vendorId: vendor.id,
              vendorName: vendor.business_name || vendor.owner_name,
              vendorAddress: vendor.address,
              vendorPhone: vendor.phone,
              matchedSpecializations: staffSpecializations.filter((specId: string) =>
                problem.mappedSubCategories.includes(specId)
              )
            });
          }
        }
      }
      
      console.log(`✅ Found ${matchingStaff.length} staff members with matching specializations`);
      
      return c.json({
        success: true,
        problem,
        staffCount: matchingStaff.length,
        staff: matchingStaff
      });
      
    } catch (error) {
      console.error('❌ Error finding staff by problem:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /vendor/:vendorId/migrate-staff-specializations
   * Helper endpoint to migrate existing staff to specialization system
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/migrate-staff-specializations", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const roleId = vendor.role_id;
      
      // ✅ SQL: Get staff members
      const { data: staffMembers } = await db
        .from('staff')
        .select('*')
        .eq('vendor_id', vendorId);
      
      console.log(`🔄 Migrating ${staffMembers?.length || 0} staff members for vendor ${vendorId}`);
      
      // Get default specializations for this role
      const { getSubcategoriesForVendorType } = await import('./problem-subcategory-mapping.tsx');
      const { subcategoryIdToNames } = await import('./problem-subcategory-mapping.tsx');
      const defaultSpecializations = getSubcategoriesForVendorType(roleId);
      
      let migratedCount = 0;
      
      for (const staff of staffMembers || []) {
        // Skip if already has specializations
        const { data: existingSpecs } = await db
          .from('staff_specializations')
          .select('*')
          .eq('staff_id', staff.id);
        
        if (existingSpecs && existingSpecs.length > 0) {
          continue;
        }
        
        // Assign default specializations
        const specializationNames = defaultSpecializations.map(id => {
          const names = subcategoryIdToNames[id] || [];
          return names[0];
        }).filter(Boolean);
        
        // ✅ SQL: Insert specializations
        if (defaultSpecializations.length > 0) {
          await db
            .from('staff_specializations')
            .insert(defaultSpecializations.map((specId: string) => ({
              staff_id: staff.id,
              specialization_id: specId,
              created_at: new Date().toISOString()
            })));
        }
        
        // ✅ SQL: Update staff metadata
        await db
          .from('staff')
          .update({
            metadata: {
              ...((staff as any).metadata || {}),
              specializations: defaultSpecializations,
              specializationNames,
              migratedAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', staff.id);
        
        migratedCount++;
      }
      
      console.log(`✅ Migrated ${migratedCount} staff members`);
      
      return c.json({
        success: true,
        totalStaff: staffMembers?.length || 0,
        migratedCount,
        message: `Assigned default specializations to ${migratedCount} staff members`
      });
      
    } catch (error) {
      console.error('❌ Error migrating staff:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

/**
 * Helper function to get specialization descriptions
 */
function getSpecializationDescription(subcategoryId: string): string {
  const descriptions: Record<string, string> = {
    'sub_preventive_wellness': 'Preventive care, checkups, vaccinations, wellness programs',
    'sub_diagnostics': 'Diagnostic tests, lab work, imaging, health assessments',
    'sub_medical_treatment': 'Medical treatment, medications, non-surgical care',
    'sub_surgical_services': 'Surgical procedures, operations, surgical aftercare',
    'sub_specialty_services': 'Specialized care including dermatology, dentistry, ophthalmology, etc.',
    'sub_emergency_critical': 'Emergency care, critical care, urgent medical attention',
    'sub_vet_home': 'Home visit services, mobile veterinary care',
    'sub_teleconsult': 'Tele-consultation, online consultations, remote advice',
    'sub_health_programs': 'Health programs, wellness packages, vaccination programs',
    'sub_documents_cert': 'Pet certification, health certificates, documentation',
    'sub_grooming_basic': 'Basic grooming services including bath, haircut, nail care',
    'sub_grooming_specialty': 'Specialty grooming including spa treatments, styling',
    'sub_grooming_mobile': 'Mobile grooming services at customer location',
    'sub_daycare': 'Daycare and boarding services',
    'sub_training_basic': 'Basic obedience training, fundamental commands',
    'sub_training_advanced': 'Advanced training, specialized skills, tricks',
    'sub_behavior': 'Behavioral modification, aggression management, anxiety treatment',
    'sub_training_private': 'Private one-on-one training sessions',
    'sub_walking': 'Dog walking services, exercise sessions',
    'sub_sitting': 'Pet sitting, home care services'
  };
  
  return descriptions[subcategoryId] || 'Specialized service';
}

console.log('✅ Staff Specialization System endpoints (SQL-only) registered');
