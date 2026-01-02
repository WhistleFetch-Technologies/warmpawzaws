/**
 * ENHANCED PROBLEM DISCOVERY SYSTEM
 * ✅ MIGRATED TO SQL: Now uses SQL-based discovery service (NO KV STORE)
 * Universal vendor discovery by problem across all vendor types
 */

import { Hono } from "hono";
import { getDiscoveryService } from '../../../supabase/lib/services/discovery-service';
import { findProblemById } from './problem-grid-catalog';

const app = new Hono();

/**
 * Role-based entity type configuration
 */
const ROLE_ENTITY_CONFIG: Record<string, {
  showIndividualStaff: boolean;
  showCenters: boolean;
  staffLabel: string;
  centerLabel: string;
  description: string;
}> = {
  'veterinarian': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'role_veterinarian': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'vet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'role_vet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'pet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'role_pet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  'role_groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  'pet_groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  'role_pet_groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  'trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  'role_trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  'pet_trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  'role_pet_trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  'dog_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  'role_dog_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  'pet_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  'role_pet_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  'behaviourist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  'role_behaviourist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  'behaviorist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  'role_behaviorist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  'boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
  'role_boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
  'pet_boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
  'role_pet_boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
};

/**
 * 🔍 ENHANCED VENDOR DISCOVERY BY PROBLEM
 * GET /customer/discover-by-problem-v2/:roleId/:problemId
 * ✅ MIGRATED TO SQL - NO KV STORE
 */
app.get('/make-server-3dd53475/customer/discover-by-problem-v2/:roleId/:problemId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const problemId = c.req.param('problemId');
    const lat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : undefined;
    const lng = c.req.query('lng') ? parseFloat(c.req.query('lng')!) : undefined;
    const radius = c.req.query('radius') ? parseInt(c.req.query('radius')!) : undefined;
    
    console.log(`\n🔍 [ENHANCED DISCOVERY] Starting discovery...`);
    console.log(`   Role: ${roleId}`);
    console.log(`   Problem: ${problemId}`);
    console.log(`   Location: ${lat},${lng} (radius: ${radius}km)`);
    
    if (!problemId || problemId === 'undefined' || problemId === 'null') {
      return c.json({ error: 'Invalid problem ID' }, 400);
    }
    
    if (!roleId || roleId === 'undefined' || roleId === 'null') {
      return c.json({ error: 'Invalid role ID' }, 400);
    }
    
    const roleConfig = ROLE_ENTITY_CONFIG[roleId];
    if (!roleConfig) {
      console.warn(`⚠️ No entity config for role: ${roleId}, using defaults (centers only)`);
    }
    
    const showIndividualStaff = roleConfig?.showIndividualStaff ?? false;
    const showCenters = roleConfig?.showCenters ?? true;
    
    console.log(`   Entity Config: Staff=${showIndividualStaff}, Centers=${showCenters}`);
    
    const problem = findProblemById(problemId);
    
    if (!problem) {
      return c.json({ error: 'Problem not found' }, 404);
    }
    
    console.log(`   Problem: "${problem.name}"`);
    console.log(`   Mapped Subcategories:`, problem.mappedSubCategories);
    
    if (!problem.mappedSubCategories || problem.mappedSubCategories.length === 0) {
      return c.json({ error: 'Problem has no mapped subcategories' }, 400);
    }
    
    // ✅ USE SQL-BASED DISCOVERY SERVICE (NO KV STORE)
    const discoveryService = getDiscoveryService();
    const result = await discoveryService.discoverByProblemGrid({
      problemGridId: problemId,
      roleId,
      customerLat: lat,
      customerLon: lng,
      maxDistance: radius,
      sortBy: 'distance'
    });
    
    // Format response based on entity config
    const centers = showCenters ? result.vendors.map(v => ({
      ...v,
      entityType: 'center',
      type: 'center'
    })) : [];
    
    const individuals = showIndividualStaff ? result.staff.map(s => ({
      ...s,
      entityType: 'staff',
      type: 'staff'
    })) : [];
    
    return c.json({
      success: true,
      centers,
      individuals,
      totalCount: centers.length + individuals.length,
      problemGrid: result.problemGrid,
      roleConfig: {
        showIndividualStaff,
        showCenters,
        staffLabel: roleConfig?.staffLabel || 'Staff',
        centerLabel: roleConfig?.centerLabel || 'Centers'
      }
    });
    
  } catch (error) {
    console.error('❌ [ENHANCED DISCOVERY] Error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

export default app;
