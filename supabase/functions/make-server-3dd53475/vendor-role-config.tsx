import { Hono } from "npm:hono";
import { getRolesRepository } from '../../lib/repositories/roles.ts';

// ----------------------------------------------------------------------------
// CONFIGURATION & CONSTANTS
// ----------------------------------------------------------------------------

const KNOWN_ROLE_NAMES: Record<string, string> = {
  'veterinarian': 'Veterinarian',
  'pet_walker': 'Pet Walker',
  'pet_groomer': 'Pet Grooming Salon',
  'pet_clinic': 'Pet Clinic / Hospital',
  'pet_pharmacy': 'Pet Pharmacy',
  'pet_boarding': 'Pet Boarding / Kennel',
  'pet_sitter': 'Pet Sitter',
  'pet_trainer': 'Pet Trainer',
  'pet_taxi': 'Pet Taxi',
  'pet_transport': 'Pet Taxi', // Alias
  'product_seller': 'Pet Store / Retailer',
  'pet_product': 'Pet Store / Retailer',
  'pet_products_store': 'Pet Store / Retailer',
  'pet_insurance': 'Insurance Agent',
  'pet_behaviorist': 'Pet Behaviorist',
  'pet_nutritionist': 'Pet Nutritionist',
  'pet_photographer': 'Pet Photographer',
  'pet_shelter': 'Pet Shelter / NGO',
  'pet_ambulance': 'Pet Ambulance',
  'pet_relocation': 'Pet Relocation',
  'pet_cafe': 'Pet Cafe',
  'pet_resort': 'Pet Resort',
  'pet_holiday': 'Pet Holiday Planner',
  'pet_holiday_planner': 'Pet Holiday Planner',
  'pet_sunset': 'Pet Sunset Services',
  'pet_sunset_services': 'Pet Sunset Services',
  'service_provider': 'Service Provider',
  'pet_breeder': 'Pet Breeder'
};

// Content-based heuristics to identify roles from form fields
const ROLE_FINGERPRINTS: Record<string, string[]> = {
  'pet_pharmacy': ['drug', '20b', '21b', 'pharmacist'],
  'pet_cafe': ['fssai', 'food safety'],
  'pet_breeder': ['awbi', 'kennel club', 'breeding'],
  'pet_clinic': ['clinical establishment', 'bio-medical', 'hospital reg'],
  'pet_sunset_services': ['pollution', 'cremation', 'burial', 'funeral'],
  'pet_resort': ['tourism', 'pool', 'resort'],
  'pet_taxi': ['driving license', 'vehicle rc', 'transport'],
  'pet_shelter': ['80g', 'ngo', 'trust deed'],
  'pet_walker': ['police verification', 'walking experience'],
  'pet_groomer': ['styling', 'grooming', 'spa']
};

// ----------------------------------------------------------------------------
// STANDARD ROLE DEFINITIONS (Master Config)
// ----------------------------------------------------------------------------

const STANDARD_ROLE_DEFINITIONS: Record<string, any> = {
  'veterinarian': {
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['at_clinic', 'video_consultation', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'prescription', 
      'medical_records', 
      'booking', 
      'chat', 
      'staff_management', 
      'tele', 
      'emergency',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      // ✅ NEW VET-SPECIFIC CAPABILITIES
      'vet_summary',
      'patient_monitoring'
    ],
    icon: '🩺'
  },
  'veterinary_clinic': {
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['at_clinic', 'video_consultation', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'prescription', 
      'medical_records', 
      'booking', 
      'chat', 
      'staff_management', 
      'tele', 
      'emergency',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      // ✅ NEW CLINIC-SPECIFIC CAPABILITIES
      'vet_summary',
      'patient_monitoring',
      'multi_doctor_management',
      'ambulance_services',
      'diagnostic_lab',
      'emergency_protocols'
    ],
    icon: '🏥'
  },
  'pet_groomer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking', 
      'portfolio', 
      'gallery', 
      'chat', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management'
    ],
    icon: '✂️'
  },
  'pet_boarding': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking', 
      'cctv_access', 
      'photo_updates', 
      'chat', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      // ✅ NEW BOARDING-SPECIFIC CAPABILITIES
      'room_management',
      'nightly_pricing',
      'occupancy_tracking'
    ],
    icon: '🏨'
  },
  'pet_resort': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking', 
      'cctv_access', 
      'photo_updates', 
      'chat', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      // ✅ NEW RESORT-SPECIFIC CAPABILITIES
      'room_management',
      'nightly_pricing',
      'occupancy_tracking'
    ],
    icon: '🏝️'
  },
  'pet_walker': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'gps_tracking', 
      'photo_updates', 
      'booking',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'chat' // ✅ ADDED: Missing chat capability
    ],
    icon: '🦮'
  },
  'pet_trainer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center', 'online'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking', 
      'progress_tracking', 
      'chat', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management'
    ],
    icon: '🎾'
  },
  'pet_behaviorist': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center', 'video_consultation'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking', 
      'progress_tracking', 
      'chat', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'tele'
    ],
    icon: '🧠'
  },
  'pet_sitter': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking', 
      'photo_updates', 
      'chat',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'staff_management' // ✅ ADDED: Agencies need staff management
    ],
    icon: '🏠'
  },
  'pet_taxi': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking', 
      'gps_tracking', 
      'emergency',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'distance_pricing', // ✅ NEW: basePrice + pricePerKm model
      'chat' // ✅ ADDED: Missing chat capability
    ],
    icon: '🚕'
  },
  'pet_products_store': {
    vendorTypes: ['seller'],
    serviceStyles: ['delivery', 'pickup'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'catalog', 
      'inventory', 
      'orders', 
      'delivery', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management'
      // Note: No custom_services/package_management for product sellers
    ],
    icon: '🛍️'
  },
  'pet_pharmacy': {
    vendorTypes: ['seller', 'healthcare_provider'],
    serviceStyles: ['delivery', 'pickup'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'catalog', 
      'inventory', 
      'prescription', 
      'delivery', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      // ✅ NEW PHARMACY-SPECIFIC CAPABILITIES
      'prescription_verification',
      'controlled_substances',
      'expiry_management'
    ],
    icon: '💊'
  },
  'pet_cafe': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking', 
      'menu', 
      'events', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      // ✅ NEW CAFE-SPECIFIC CAPABILITIES
      'table_management',
      'pax_management',
      'chat'
    ],
    icon: '☕'
  },
  'pet_photographer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'at_home', 'outdoor'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking', 
      'portfolio', 
      'gallery', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'chat'
    ],
    icon: '📸'
  },
  'pet_shelter': {
    vendorTypes: ['service_provider', 'ngo'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: false, canControlDuration: false },
    capabilities: [
      'adoption', 
      'donation', 
      'events', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'chat'
      // Note: No custom_services/package_management for shelters
    ],
    icon: '🏠'
  },
  'pet_sunset_services': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking', 
      'memorial', 
      'counseling', 
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'chat'
    ],
    icon: '🌅'
  },
  'nutritionist': {
    vendorTypes: ['healthcare_provider', 'service_provider'],
    serviceStyles: ['at_center', 'video_consultation', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking',
      'chat',
      'staff_management',
      'tele',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      // ✅ NEW NUTRITIONIST-SPECIFIC CAPABILITIES
      'meal_plans',
      'diet_charts',
      'progress_tracking'
    ],
    icon: '🥗'
  },
  'insurance': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['online', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'chat',
      'staff_management',
      // ✅ NEW UNIVERSAL CAPABILITIES
      'facility_management',
      'schedule_management',
      // ✅ NEW INSURANCE-SPECIFIC CAPABILITIES
      'policy_management',
      'claims_management'
    ],
    icon: '🛡️'
  }
};

// ----------------------------------------------------------------------------
// CLEANUP & MERGE LOGIC
// ----------------------------------------------------------------------------

async function cleanupAndMergeRoles() {
  console.log('🧹 [CLEANUP] Starting Deep Role Cleanup & Merge...');
  
  // ✅ SQL: Get all roles with configs
  const rolesRepo = getRolesRepository();
  const allRoles = await rolesRepo.findAllWithConfigs();
  const stats = { merged: 0, deleted: 0, renamed: 0 };

  // 1. Group by Canonical ID (or Best Guess ID)
  const buckets = new Map<string, any[]>();

  for (const role of allRoles) {
    // Extract config from role.config JSONB or use role data
    const config = role.config || {
      roleId: role.name,
      id: role.name,
      roleName: role.display_name,
      ...role
    };
    
    let id = config.roleId || config.id || role.name;
    if (!id) continue;
    id = id.toLowerCase().trim();

    // HEURISTIC MATCHING: If generic/UUID ID, try to guess role from content
    let canonicalId = Object.keys(KNOWN_ROLE_NAMES).find(k => k === id);

    if (!canonicalId) {
      // Try to detect from fields
      const fieldString = JSON.stringify(config.sections || []).toLowerCase();
      for (const [roleKey, keywords] of Object.entries(ROLE_FINGERPRINTS)) {
        if (keywords.some(k => fieldString.includes(k))) {
          console.log(`🕵️ [DETECT] Matched orphaned form ${id} to ${roleKey} via keywords`);
          canonicalId = roleKey;
          break;
        }
      }
    }

    // If matched to a canonical ID, use that. Otherwise use the ID itself (orphan).
    const bucketKey = canonicalId || id;
    
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey).push({ ...config, _originalId: config.roleId || config.id });
  }

  // 2. Process Buckets
  for (const [bucketKey, candidates] of buckets.entries()) {
    if (candidates.length === 0) continue;

    // Determine the Winner
    // Score = (Field Count * 100) + (Version * 10) + (Has Name ? 5 : 0)
    const scored = candidates.map(c => {
      const fieldCount = (c.sections || []).reduce((acc: number, s: any) => acc + (s.fields?.length || 0), 0);
      const hasName = !!(c.roleName || c.name);
      const score = (fieldCount * 100) + ((c.version || 0) * 10) + (hasName ? 5 : 0);
      return { config: c, score, fieldCount };
    });

    // Sort Descending by Score
    scored.sort((a, b) => b.score - a.score);
    
    const winner = scored[0].config;
    const losers = scored.slice(1).map(s => s.config);

    // 3. Upgrade Winner & Merge Defaults
    const canonicalName = KNOWN_ROLE_NAMES[bucketKey];
    const standardDef = STANDARD_ROLE_DEFINITIONS[bucketKey] || {};

    // Check if we need to inject standard config
    const needsConfigInjection = 
      (standardDef.vendorTypes && (!winner.vendorTypes || winner.vendorTypes.length === 0)) ||
      (standardDef.serviceStyles && (!winner.serviceStyles || winner.serviceStyles.length === 0)) ||
      (standardDef.capabilities && (!winner.capabilities || winner.capabilities.length === 0));

    const needsUpdate = 
      winner.roleId !== bucketKey || 
      (canonicalName && winner.roleName !== canonicalName) ||
      needsConfigInjection ||
      !winner.isActive || 
      winner.status !== 'active' ||
      losers.length > 0;

    if (needsUpdate) {
      console.log(`🏆 [WINNER] Role: ${bucketKey} (Fields: ${scored[0].fieldCount}) - Updating & Healing...`);
      
      // Construct Optimized Config with Standard Defaults Merged In
      const optimizedConfig = {
        ...winner,
        ...standardDef, // Merge in standard capabilities/styles if missing in winner
        roleId: bucketKey,
        id: bucketKey,
        roleName: canonicalName || winner.roleName || winner.displayName || bucketKey.replace(/_/g, ' '),
        status: 'active', // Force active
        isActive: true,   // Explicit boolean for Frontend
        version: (winner.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        _healed: true
      };
      
      // Intelligent Merge: Prefer Winner's data if present, else Standard
      if (winner.vendorTypes?.length > 0) optimizedConfig.vendorTypes = winner.vendorTypes;
      else optimizedConfig.vendorTypes = standardDef.vendorTypes || [];

      if (winner.serviceStyles?.length > 0) optimizedConfig.serviceStyles = winner.serviceStyles;
      else optimizedConfig.serviceStyles = standardDef.serviceStyles || [];

      if (winner.capabilities?.length > 0) optimizedConfig.capabilities = winner.capabilities;
      else optimizedConfig.capabilities = standardDef.capabilities || [];

      if (winner.pricingControl && Object.keys(winner.pricingControl).length > 0) optimizedConfig.pricingControl = winner.pricingControl;
      else optimizedConfig.pricingControl = standardDef.pricingControl || {};

      // ✅ SQL: Save Winner to roles table
      const existingRole = await rolesRepo.findById(bucketKey);
      if (existingRole) {
        await rolesRepo.setConfig(bucketKey, optimizedConfig);
      } else {
        await rolesRepo.create({
          name: bucketKey,
          display_name: optimizedConfig.roleName || bucketKey,
          description: optimizedConfig.description,
          config: optimizedConfig,
          is_active: true
        });
      }
      stats.merged++;

      // ✅ SQL: Delete Old Key if ID changed (soft delete)
      if (winner._originalId && winner._originalId !== bucketKey) {
        await rolesRepo.delete(winner._originalId);
        stats.renamed++;
      }
    } else {
       // Even if it doesn't need a "merge" or "structure" update, 
       // we MUST ensure it is explicitly marked ACTIVE in the DB if it isn't already.
       if (!winner.isActive || winner.status !== 'active') {
          console.log(`🔋 [ACTIVATE] Force activating role: ${bucketKey}`);
          const activeConfig = {
             ...winner,
             isActive: true,
             status: 'active',
             updatedAt: new Date().toISOString()
          };
          // ✅ SQL: Update role config
          await rolesRepo.setConfig(bucketKey, activeConfig);
          await rolesRepo.update(bucketKey, { is_active: true });
          stats.merged++; // Count as an update
       }
    }

    // 4. Delete Losers
    for (const loser of losers) {
      if (loser._originalId && loser._originalId !== bucketKey) { // Don't delete if it's the same key we just wrote
         console.log(`🗑️ [DELETE] Removing duplicate/inferior config: ${loser._originalId}`);
         // ✅ SQL: Soft delete duplicate role
         await rolesRepo.delete(loser._originalId);
         stats.deleted++;
      }
    }
  }
  
  console.log('✨ [CLEANUP] Complete:', stats);
  return stats;
}

// ----------------------------------------------------------------------------
// ENDPOINTS
// ----------------------------------------------------------------------------

export function vendorRoleConfigEndpoints(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/config/roles
   * Fetches roles WITHOUT auto-cleanup to avoid timeouts
   */
  app.get("/make-server-3dd53475/config/roles", async (c) => {
    try {
      console.log('📋 [ROLES] Fetching roles...');
      
      // ✅ SQL: Fetch all active roles with configs
      const rolesRepo = getRolesRepository();
      const allRoles = await rolesRepo.findActive();
      
      console.log(`📋 [ROLES] Raw SQL response count: ${allRoles?.length || 0}`);
      
      // Filter & Transform
      const rawRoles = (allRoles || [])
        .map((role: any) => {
          // Extract config from role.config JSONB or use role data
          const config = role.config || {
            roleId: role.name,
            id: role.name,
            roleName: role.display_name,
            ...role
          };
          
          const id = config.roleId || config.id || role.name;
          if (!id) {
            console.warn('⚠️ [ROLES] Skipping role with no ID');
            return null;
          }
          
          console.log(`✅ [ROLES] Found role: ${id}`);
          
          // Ensure Name is NEVER empty
          let name = config.roleName || config.displayName || config.name || role.display_name;
          
          // Fallback to Known Name
          if (!name && KNOWN_ROLE_NAMES[id]) {
            name = KNOWN_ROLE_NAMES[id];
          }

          // Fallback to Formatted ID
          if (!name || name.trim() === '') {
             name = id ? id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unnamed Role';
          }
          
          // Merge Standard Defs for Display if DB config is partial
          const standardDef = STANDARD_ROLE_DEFINITIONS[id] || {};

          // Intelligent Merge for API Response
          const vendorTypes = (config.vendorTypes && config.vendorTypes.length > 0) ? config.vendorTypes : (standardDef.vendorTypes || []);
          const serviceStyles = (config.serviceStyles && config.serviceStyles.length > 0) ? config.serviceStyles : (standardDef.serviceStyles || []);
          const capabilities = (config.capabilities && config.capabilities.length > 0) ? config.capabilities : (standardDef.capabilities || []);
          const pricingControl = (config.pricingControl && Object.keys(config.pricingControl).length > 0) ? config.pricingControl : (standardDef.pricingControl || {});
          const icon = config.icon || standardDef.icon || '🔧'; // ✅ FIX: Use emoji instead of "briefcase" text

          return {
            ...config,
            id: id,
            name: name, 
            displayName: name,
            description: config.description || role.description || 'Vendor Role',
            icon: icon,
            version: config.version || 1,
            status: 'active', // Force active for all roles
            isActive: role.is_active !== false,   // Use SQL is_active
            
            vendorTypes,
            serviceStyles,
            pricingControl,
            capabilities
          };
        })
        .filter(Boolean); // Remove nulls

      console.log(`📋 [ROLES] Processed ${rawRoles.length} roles after mapping`);

      // EXPLICIT DEDUPLICATION (To prevent React Key Errors)
      const uniqueRoles = new Map();
      for (const role of rawRoles) {
         if (!role.id) continue;
         if (!uniqueRoles.has(role.id)) {
             uniqueRoles.set(role.id, role);
         } else {
             // Conflict: Prefer the one with a better name if existing is generic
             const existing = uniqueRoles.get(role.id);
             if (existing.name === 'Unnamed Role' && role.name !== 'Unnamed Role') {
                 uniqueRoles.set(role.id, role);
             }
         }
      }
      
      const roles = Array.from(uniqueRoles.values());

      // Sort
      roles.sort((a, b) => a.displayName.localeCompare(b.displayName));

      console.log(`✅ [ROLES] Returning ${roles.length} roles to frontend`);
      console.log(`✅ [ROLES] Role IDs:`, roles.map(r => r.id).join(', '));
      
      return c.json({ success: true, roles });

    } catch (error) {
      console.error('❌ [ROLES] Error fetching roles:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/config/roles/:roleId
   * Delete a role configuration
   */
  app.delete("/make-server-3dd53475/config/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log(`🗑️ [DELETE ROLE] Attempting to delete role: ${roleId}`);
      
      // ✅ SQL: Check if role exists
      const rolesRepo = getRolesRepository();
      const existingRole = await rolesRepo.findById(roleId);
      if (!existingRole) {
        console.error(`❌ [DELETE ROLE] Role not found: ${roleId}`);
        return c.json({ error: 'Role not found', roleId }, 404);
      }
      
      console.log(`✅ [DELETE ROLE] Found role: ${existingRole.display_name || roleId}`);
      
      // ✅ SQL: Soft delete the role
      await rolesRepo.delete(roleId);
      
      console.log(`✅ [DELETE ROLE] Successfully deleted role: ${roleId}`);
      
      return c.json({ 
        success: true, 
        message: `Role "${existingRole.display_name || roleId}" deleted successfully`,
        deletedRoleId: roleId
      });
    } catch (error) {
      console.error('❌ [DELETE ROLE] Error deleting role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/config/roles
   * Create a new role configuration
   */
  app.post("/make-server-3dd53475/config/roles", async (c) => {
    try {
      const body = await c.req.json();
      
      // Generate ID from name if not provided
      let id = body.id;
      if (!id && body.name) {
        id = body.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      }
      
      if (!id) {
        return c.json({ error: "Role Name or ID is required" }, 400);
      }

      // ✅ SQL: Check if exists
      const rolesRepo = getRolesRepository();
      const existing = await rolesRepo.findById(id);
      if (existing) {
        return c.json({ error: `Role with ID '${id}' already exists` }, 409);
      }

      const newRole = {
        ...body,
        id,
        roleId: id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        isActive: true,
        version: 1
      };
      
      // ✅ SQL: Create role with config
      await rolesRepo.create({
        name: id,
        display_name: body.roleName || body.name || id,
        description: body.description,
        config: newRole,
        is_active: true
      });
      return c.json({ success: true, role: newRole });
    } catch (error) {
      console.error('Error creating role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/config/roles/:id
   * Update an existing role configuration
   */
  app.put("/make-server-3dd53475/config/roles/:id", async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      
      // ✅ SQL: Get existing role
      const rolesRepo = getRolesRepository();
      const existing = await rolesRepo.findById(id);
      if (!existing) {
        return c.json({ error: `Role '${id}' not found` }, 404);
      }

      const existingConfig = existing.config || {};
      const updatedRole = {
        ...existingConfig,
        ...body,
        id, // Ensure ID matches URL param
        roleId: id,
        updatedAt: new Date().toISOString()
      };
      
      // ✅ SQL: Update role config
      await rolesRepo.setConfig(id, updatedRole);
      await rolesRepo.update(id, {
        display_name: body.roleName || body.name || existing.display_name,
        description: body.description || existing.description
      });
      return c.json({ success: true, role: updatedRole });
    } catch (error) {
      console.error('Error updating role:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ... Rest of the endpoints (Get Config, Save, etc.) remain largely the same but use the cleanup implicitly
  
  app.get("/make-server-3dd53475/admin/onboarding-forms/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      // ✅ SQL: Get role config
      const rolesRepo = getRolesRepository();
      const role = await rolesRepo.findById(roleId);
      let config = role?.config || null;
      
      // Fallback: If config missing
      if (!config) {
        // Check legacy (TODO: Migrate onboarding:fields to SQL if needed)
        // For now, return empty config
        const legacyFields = null; // await kv.get(`onboarding:fields:${roleId}`);
        if (legacyFields) {
           const baseConfig = {
             id: roleId,
             roleId: roleId,
             roleName: KNOWN_ROLE_NAMES[roleId] || roleId,
             status: 'active',
             version: 1,
             sections: [{
                id: 'restored_section',
                name: 'general',
                title: 'General Info',
                order: 1,
                isActive: true,
                fields: legacyFields.map((f: any) => ({...f, section: 'general'}))
             }]
           };
           // ✅ SQL: Save restored config
           await rolesRepo.setConfig(roleId, baseConfig);
           config = baseConfig;
        } else {
           // Generate Default
           config = {
             id: roleId,
             roleId: roleId,
             roleName: KNOWN_ROLE_NAMES[roleId] || roleId,
             status: 'draft',
             version: 1,
             sections: [],
             documentSections: [],
             metadata: { createdAt: new Date().toISOString(), createdBy: 'system' }
           };
        }
      }
      
      // Inject standard defs if missing in form config (just in case)
      const standardDef = STANDARD_ROLE_DEFINITIONS[roleId];
      if (standardDef) {
         config = { ...standardDef, ...config };
      }

      return c.json({ success: true, form: config, isNew: false });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  app.post("/make-server-3dd53475/admin/onboarding-forms/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const formData = await c.req.json();
      // ✅ SQL: Get existing role
      const rolesRepo = getRolesRepository();
      const existingRole = await rolesRepo.findById(roleId);
      const existing = existingRole?.config || {};
      const newVersion = (existing?.version || 0) + 1;

      const config = {
        ...existing,
        ...formData,
        id: roleId,
        roleId: roleId,
        roleName: formData.roleName || KNOWN_ROLE_NAMES[roleId] || existing?.roleName,
        version: newVersion,
        updatedAt: new Date().toISOString(),
        status: formData.status || existing?.status || 'draft' 
      };
      
      // ✅ SQL: Save config
      await rolesRepo.setConfig(roleId, config);
      // TODO: History can be stored in a separate role_config_history table if needed
      
      return c.json({ success: true, message: 'Saved', form: config });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // Manual trigger if needed
  app.post("/make-server-3dd53475/admin/roles/cleanup", async (c) => {
    const stats = await cleanupAndMergeRoles();
    return c.json({ success: true, stats });
  });

  /**
   * POST /make-server-3dd53475/admin/roles/resurrect
   * NUCLEAR OPTION: Wipes all role configs and restores from Standard Definitions
   * Use this when roles are corrupted or stuck in inactive state.
   */
  app.post("/make-server-3dd53475/admin/roles/resurrect", async (c) => {
    try {
       console.log('☢️ [RESURRECT] Starting Nuclear Role Restoration...');
       
       // ✅ SQL: Soft delete ALL existing role configs
       const rolesRepo = getRolesRepository();
       const allRoles = await rolesRepo.findAll();
       let deleted = 0;
       for (const role of allRoles) {
          await rolesRepo.delete(role.name);
          deleted++;
       }
       console.log(`🗑️ [RESURRECT] Deleted ${deleted} potentially corrupted role configs.`);

       // 2. Re-seed from Standard Definitions
       let restored = 0;
       for (const [roleId, def] of Object.entries(STANDARD_ROLE_DEFINITIONS)) {
          const config = {
            ...def,
            id: roleId,
            roleId: roleId,
            roleName: KNOWN_ROLE_NAMES[roleId] || roleId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            status: 'active',
            isActive: true,
            version: 1,
            sections: [], // Fresh start for sections to avoid legacy schema conflicts
            documentSections: [],
            updatedAt: new Date().toISOString(),
            _restored: true
          };
          
          // ✅ SQL: Create/update role with config
          const existing = await rolesRepo.findById(roleId);
          if (existing) {
            await rolesRepo.setConfig(roleId, config);
            await rolesRepo.update(roleId, { is_active: true });
          } else {
            await rolesRepo.create({
              name: roleId,
              display_name: config.roleName,
              description: config.description,
              config: config,
              is_active: true
            });
          }
          restored++;
       }

       return c.json({ 
         success: true, 
         message: `Resurrection Complete. Wiped ${deleted} roles, Restored ${restored} clean active roles.`,
         stats: { deleted, restored }
       });
    } catch (error) {
       console.error('Resurrection failed:', error);
       return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/roles/update-capabilities
   * Updates ALL existing roles to include the latest capabilities from STANDARD_ROLE_DEFINITIONS
   * This is a NON-DESTRUCTIVE update - it only adds missing capabilities
   */
  app.post("/make-server-3dd53475/admin/roles/update-capabilities", async (c) => {
    try {
      console.log('🔄 [UPDATE-CAPS] Starting capability update for all roles...');
      
      // ✅ SQL: Get all roles with configs
      const rolesRepo = getRolesRepository();
      const allRoles = await rolesRepo.findAllWithConfigs();
      let updated = 0;
      let skipped = 0;
      
      for (const role of allRoles) {
        const config = role.config || {};
        const roleId = config.roleId || config.id || role.name;
        if (!roleId) {
          skipped++;
          continue;
        }
        
        // Get standard definition for this role
        const standardDef = STANDARD_ROLE_DEFINITIONS[roleId];
        if (!standardDef) {
          console.log(`⏩ [UPDATE-CAPS] No standard definition for ${roleId}, skipping`);
          skipped++;
          continue;
        }
        
        // Check if capabilities need updating
        const currentCaps = config.capabilities || [];
        const standardCaps = standardDef.capabilities || [];
        
        // Only update if different
        const needsUpdate = JSON.stringify(currentCaps) !== JSON.stringify(standardCaps);
        
        if (needsUpdate) {
          console.log(`🔄 [UPDATE-CAPS] Updating ${roleId}:`);
          console.log(`   Old: ${JSON.stringify(currentCaps)}`);
          console.log(`   New: ${JSON.stringify(standardCaps)}`);
          
          const updatedConfig = {
            ...config,
            capabilities: standardCaps,
            version: (config.version || 0) + 1,
            updatedAt: new Date().toISOString(),
            _capabilitiesUpdated: true
          };
          
          // ✅ SQL: Update role config
          await rolesRepo.setConfig(roleId, updatedConfig);
          updated++;
        } else {
          console.log(`✅ [UPDATE-CAPS] ${roleId} already has latest capabilities`);
          skipped++;
        }
      }

      return c.json({ 
        success: true, 
        message: `Capability update complete. Updated: ${updated}, Skipped: ${skipped}`,
        stats: { updated, skipped }
      });
    } catch (error) {
      console.error('Capability update failed:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // Vendor Allowed Styles Endpoint
  app.get("/make-server-3dd53475/vendor/:vendorId/allowed-service-styles", async (c) => {
    try {
      const { vendorId } = c.req.param();
      // ✅ SQL: Get vendor
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      
      // ✅ FIX: Resolve vendor ID (handles both UUID and vendor_id string like "vendor_9611377119")
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [ALLOWED-STYLES] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [ALLOWED-STYLES] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      const vendor = await vendorsRepo.findById(resolvedVendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      
      // ✅ FIX: Use role_id (database field) - check both snake_case and camelCase
      const roleId = (vendor as any).role_id || (vendor as any).roleId || 'veterinarian';
      console.log(`📋 [ALLOWED-STYLES] Vendor roleId: ${roleId}`);
      const stylesList: string[] = [];
      
      // Use standard defs if available
      const standardDef = STANDARD_ROLE_DEFINITIONS[roleId];
      if (standardDef && standardDef.serviceStyles) {
         return c.json({ success: true, allowedStyles: standardDef.serviceStyles, roleId });
      }

      // Fallback Logic
      if (['pet_boarding', 'pet_kennel', 'pet_resort', 'pet_clinic'].includes(roleId)) {
        stylesList.push('at_center');
      } else if (['pet_walking', 'pet_sitter'].includes(roleId)) {
        stylesList.push('at_home');
      } else {
        stylesList.push('at_center');
        stylesList.push('at_home');
      }
      
      return c.json({ success: true, allowedStyles: stylesList, roleId });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  app.get("/make-server-3dd53475/vendor/onboarding-form/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      // ✅ SQL: Get role config
      const rolesRepo = getRolesRepository();
      const role = await rolesRepo.findById(roleId);
      let config = role?.config || null;
      // If clean-up worked, config should be good.
      // If still missing, fallback to basic generator
      if (!config) {
         config = {
            id: roleId,
            roleId: roleId,
            roleName: KNOWN_ROLE_NAMES[roleId] || roleId,
            status: 'active',
            version: 1,
            sections: [],
            documentSections: []
         };
      }
      
      // Ensure standard properties are present for the frontend
      const standardDef = STANDARD_ROLE_DEFINITIONS[roleId];
      if (standardDef) {
         config = { ...standardDef, ...config };
      }

      return c.json({ success: true, form: config, roleId });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // Save
  app.post("/make-server-3dd53475/admin/role-config/save", async (c) => {
    const config = await c.req.json();
    if (!config.id) return c.json({ error: 'Role ID required' }, 400);
    // ✅ SQL: Save role config
    const rolesRepo = getRolesRepository();
    await rolesRepo.setConfig(config.id, { ...config, updatedAt: new Date().toISOString() });
    return c.json({ success: true });
  });
  
    // Get all
  app.get("/make-server-3dd53475/admin/role-config/all", async (c) => {
    // ✅ SQL: Get all roles with configs
    const rolesRepo = getRolesRepository();
    const configs = await rolesRepo.findAllWithConfigs();
    return c.json({ success: true, configs: configs.map(r => r.config || {}) });
  });
}