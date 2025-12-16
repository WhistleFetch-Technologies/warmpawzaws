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
      
      // Import problem grid catalog
      const { 
        vetHealthProblems, 
        groomingNeeds, 
        trainingNeeds, 
        walkingNeeds,
        behavioralIssues,
        boardingNeeds 
      } = await import('./problem-grid-catalog.tsx');
      
      // Normalize role ID
      const normalizedRoleId = roleId.replace(/^role_/, '').toLowerCase();
      
      let problemGrid: any[] = [];
      let roleType = '';
      
      // Map role to problem grid
      if (['veterinarian', 'vet_clinic', 'pet_clinic', 'clinic', 'hospital'].includes(normalizedRoleId)) {
        problemGrid = vetHealthProblems;
        roleType = 'Healthcare';
      } else if (['groomer', 'pet_groomer', 'grooming_center', 'grooming_salon', 'pet_salon'].includes(normalizedRoleId)) {
        problemGrid = groomingNeeds;
        roleType = 'Grooming';
      } else if (['trainer', 'pet_trainer', 'training_center', 'dog_trainer'].includes(normalizedRoleId)) {
        problemGrid = trainingNeeds;
        roleType = 'Training';
      } else if (['walker', 'dog_walker', 'pet_walker'].includes(normalizedRoleId)) {
        problemGrid = walkingNeeds;
        roleType = 'Walking';
      } else if (['behaviourist', 'behaviorist', 'pet_behaviorist'].includes(normalizedRoleId)) {
        problemGrid = behavioralIssues;
        roleType = 'Behavioral';
      } else if (['boarding', 'pet_boarding', 'boarding_center', 'pet_sitter', 'pet_resort', 'kennel'].includes(normalizedRoleId)) {
        problemGrid = boardingNeeds;
        roleType = 'Boarding/Sitting';
      } else {
        // ✅ FALLBACK: Return generic capabilities instead of error
        // This ensures custom roles or new roles can still create staff
        console.warn(`[PROBLEM GRID] Unknown roleId: ${roleId}, falling back to General Services`);
        
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
        roleType = 'General Service';
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
      const updatedVendor = {
        ...vendor,
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
      
      // Get problem grid to validate and get display names
      const { 
        vetHealthProblems, 
        groomingNeeds, 
        trainingNeeds, 
        walkingNeeds,
        behavioralIssues,
        boardingNeeds 
      } = await import('./problem-grid-catalog.tsx');
      
      const normalizedRoleId = vendor.roleId.replace(/^role_/, '').toLowerCase();
      let problemGrid: any[] = [];
      
      if (['veterinarian', 'vet_clinic', 'pet_clinic'].includes(normalizedRoleId)) {
        problemGrid = vetHealthProblems;
      } else if (['groomer', 'pet_groomer', 'grooming_center'].includes(normalizedRoleId)) {
        problemGrid = groomingNeeds;
      } else if (['trainer', 'pet_trainer', 'training_center'].includes(normalizedRoleId)) {
        problemGrid = trainingNeeds;
      } else if (['walker', 'dog_walker', 'pet_walker'].includes(normalizedRoleId)) {
        problemGrid = walkingNeeds;
      } else if (['behaviourist', 'behaviorist', 'pet_behaviorist'].includes(normalizedRoleId)) {
        problemGrid = behavioralIssues;
      } else if (['boarding', 'pet_boarding', 'boarding_center'].includes(normalizedRoleId)) {
        problemGrid = boardingNeeds;
      }
      
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
      const updatedStaff = {
        ...staff,
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
      // ✅ BUSINESS RULE: Maximum radius for home services discovery is 20KM
      let radius = parseInt(c.req.query('radius') || '20');
      if (radius > 20) {
        radius = 20; // Cap at 20KM maximum
      }
      
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
      
      for (const vendor of matchingVendors) {
        // Get vendor's staff
        const staffMembers = await kv.getByPrefix(`vendor:${vendor.id}:staff:`);
        
        // Filter staff by specialization
        const matchingStaff = staffMembers.filter((staff: any) => {
          return staff.specializations && staff.specializations.includes(problemId);
        });
        
        // If vendor has specialization OR has staff with specialization
        if (vendor.specializations?.includes(problemId) || matchingStaff.length > 0) {
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