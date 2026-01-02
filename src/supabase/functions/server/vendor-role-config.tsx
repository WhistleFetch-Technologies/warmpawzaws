import { Hono } from "hono";
import * as kv from "./kv_store";

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
  
  const allConfigs = await kv.getByPrefix('role:config:') || [];
  const stats = { merged: 0, deleted: 0, renamed: 0 };

  // 1. Group by Canonical ID (or Best Guess ID)
  const buckets = new Map<string, any[]>();

  for (const config of allConfigs) {
    let id = config.roleId || config.id;
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

      // Save Winner to Correct Key
      await kv.set(`role:config:${bucketKey}`, optimizedConfig);
      stats.merged++;

      // Delete Old Key if ID changed
      if (winner._originalId && winner._originalId !== bucketKey) {
        await kv.del(`role:config:${winner._originalId}`);
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
          await kv.set(`role:config:${bucketKey}`, activeConfig);
          stats.merged++; // Count as an update
       }
    }

    // 4. Delete Losers
    for (const loser of losers) {
      if (loser._originalId && loser._originalId !== bucketKey) { // Don't delete if it's the same key we just wrote
         console.log(`🗑️ [DELETE] Removing duplicate/inferior config: ${loser._originalId}`);
         await kv.del(`role:config:${loser._originalId}`);
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
      
      // Fetch roles WITHOUT triggering cleanup (cleanup was causing timeouts)
      const allConfigs = await kv.getByPrefix('role:config:').catch(err => {
        console.error('❌ [ROLES] KV timeout fetching roles:', err.message);
        return [];
      });
      
      console.log(`📋 [ROLES] Raw KV response count: ${allConfigs?.length || 0}`);
      if (allConfigs && allConfigs.length > 0) {
        console.log(`📋 [ROLES] First item structure:`, JSON.stringify(allConfigs[0], null, 2).substring(0, 300));
      }
      
      // Filter & Transform
      const rawRoles = (allConfigs || [])
        .map((item: any) => {
          // KV store returns { key: string, value: string }
          // The value is a JSON STRING that needs to be parsed!
          let config;
          try {
            config = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          } catch (e) {
            console.error('⚠️ [ROLES] Failed to parse role JSON:', e);
            return null;
          }
          
          const id = config.roleId || config.id;
          if (!id) {
            console.warn('⚠️ [ROLES] Skipping role with no ID');
            return null;
          }
          
          console.log(`✅ [ROLES] Found role: ${id}`);
          
          // Ensure Name is NEVER empty
          let name = config.roleName || config.displayName || config.name;
          
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
            description: config.description || 'Vendor Role',
            icon: icon,
            version: config.version || 1,
            status: 'active', // Force active for all roles
            isActive: true,   // Force active for all roles
            
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
      
      // Check if role exists
      const existingRole = await kv.get(`role:config:${roleId}`);
      if (!existingRole) {
        console.error(`❌ [DELETE ROLE] Role not found: ${roleId}`);
        return c.json({ error: 'Role not found', roleId }, 404);
      }
      
      console.log(`✅ [DELETE ROLE] Found role: ${existingRole.name || roleId}`);
      
      // Delete the role from KV store
      await kv.del(`role:config:${roleId}`);
      
      console.log(`✅ [DELETE ROLE] Successfully deleted role: ${roleId}`);
      
      return c.json({ 
        success: true, 
        message: `Role "${existingRole.name || roleId}" deleted successfully`,
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

      // Check if exists
      const existing = await kv.get(`role:config:${id}`);
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
      
      await kv.set(`role:config:${id}`, newRole);
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
      
      const existing = await kv.get(`role:config:${id}`);
      if (!existing) {
        return c.json({ error: `Role '${id}' not found` }, 404);
      }

      const updatedRole = {
        ...existing,
        ...body,
        id, // Ensure ID matches URL param
        roleId: id,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`role:config:${id}`, updatedRole);
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
      let config = await kv.get(`role:config:${roleId}`);
      
      // Fallback: If head missing
      if (!config) {
        // Check legacy
        const legacyFields = await kv.get(`onboarding:fields:${roleId}`);
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
           await kv.set(`role:config:${roleId}`, baseConfig);
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
      const existing = await kv.get(`role:config:${roleId}`);
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
      
      await kv.set(`role:config:${roleId}`, config);
      // History
      await kv.set(`role:config:${roleId}:v${newVersion}`, config);
      
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
       
       // 1. Delete ALL existing role configs
       const allConfigs = await kv.getByPrefix('role:config:') || [];
       let deleted = 0;
       for (const config of allConfigs) {
          const key = config.roleId || config.id;
          if (key) {
             await kv.del(`role:config:${key}`);
             deleted++;
          }
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
          
          await kv.set(`role:config:${roleId}`, config);
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
      
      const allConfigs = await kv.getByPrefix('role:config:') || [];
      let updated = 0;
      let skipped = 0;
      
      for (const item of allConfigs) {
        // Parse the config
        let config;
        try {
          config = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
        } catch (e) {
          console.error('⚠️ [UPDATE-CAPS] Failed to parse role JSON:', e);
          skipped++;
          continue;
        }
        
        const roleId = config.roleId || config.id;
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
          
          await kv.set(`role:config:${roleId}`, updatedConfig);
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
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      
      const roleId = vendor.roleId || 'veterinarian';
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
      let config = await kv.get(`role:config:${roleId}`);
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
    await kv.set(`role:config:${config.id}`, { ...config, updatedAt: new Date().toISOString() });
    return c.json({ success: true });
  });
  
    // Get all
  app.get("/make-server-3dd53475/admin/role-config/all", async (c) => {
    const configs = await kv.getByPrefix('role:config:');
    return c.json({ success: true, configs });
  });
}