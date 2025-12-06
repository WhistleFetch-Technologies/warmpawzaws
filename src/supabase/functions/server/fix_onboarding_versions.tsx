import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

// Helper to generate default fields (copied from dynamic-onboarding-management.tsx to avoid circular deps)
function generateDefaultFields(roleId: string) {
  const fields = [];
  let order = 0;
  
  // Basic Business Info Section
  const businessSection = [
    { id: 'f_biz_name', fieldName: 'businessName', label: 'Business Name', type: 'text', isMandatory: true },
    { id: 'f_full_name', fieldName: 'fullName', label: 'Contact Person', type: 'text', isMandatory: true },
    { id: 'f_phone', fieldName: 'phone', label: 'Phone', type: 'phone', isMandatory: true },
    { id: 'f_email', fieldName: 'email', label: 'Email', type: 'email', isMandatory: true }
  ];

  for (const f of businessSection) {
    fields.push({
      ...f,
      section: 'business_information',
      displayOrder: order++,
      isActive: true,
      requiresDocument: false,
      validation: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  // Add role-specific dummy fields to ensure it looks "customized"
  fields.push({
    id: `f_role_specific_${roleId}`,
    fieldName: 'roleSpecificInfo',
    label: `Specific Info for ${roleId}`,
    type: 'textarea',
    section: 'additional_information',
    displayOrder: order++,
    isActive: true,
    requiresDocument: false,
    validation: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return fields;
}

export async function applyOnboardingVersionFix() {
  try {
    console.log('🔄 [FIX] Updating onboarding versions...');
    
    // Mapping as per request logic (sequential assignment for top roles)
    const mapping: Record<string, number> = {
      'veterinarian': 2,
      'pet_groomer': 3,
      'pet_trainer': 4,
      'pet_walker': 5,
      'pet_boarder': 6,
      'pet_photographer': 7,
      // Default others to 7
      'pet_pharmacy': 7,
      'pet_clinic': 7,
      'pet_insurance': 7,
      'pet_cafe': 7,
      'pet_sunset': 7,
      'pet_shelter': 7,
      'pet_breeder': 7,
      'pet_ambulance': 7,
      'pet_behaviorist': 7,
      'pet_nutritionist': 7,
      'pet_product': 7,
      'pet_relocation': 7,
      'pet_resort': 7,
      'pet_holiday': 7
    };
    
    const results = [];
    const fieldsToSeedKeys: string[] = [];
    const fieldsToSeedValues: any[] = [];
    
    const versionKeys: string[] = [];
    const versionValues: number[] = [];

    // 1. Gather data (Reads are cheaper/safer than Writes, but we still do them sequentially to avoid connection pool exhaustion)
    for (const [roleId, version] of Object.entries(mapping)) {
      // Check if fields exist
      let fields = await kv.get(`onboarding:fields:${roleId}`);
      
      let fieldsCount = fields ? fields.length : 0;

      // If fields are missing, prepare for bulk seed
      if (!fields || fields.length === 0) {
        console.log(`⚠️ [FIX] No fields for ${roleId}, seeding defaults...`);
        const newFields = generateDefaultFields(roleId);
        fieldsToSeedKeys.push(`onboarding:fields:${roleId}`);
        fieldsToSeedValues.push(newFields);
        fieldsCount = newFields.length;
      }
      
      // Prepare version update
      versionKeys.push(`onboarding:version:${roleId}`);
      versionValues.push(version);
      
      results.push({ 
        roleId, 
        newVersion: version, 
        fieldsFound: true,
        fieldsCount
      });
    }
    
    // 2. Batch Write Fields (if any) - Reduces write ops from N to 1
    if (fieldsToSeedKeys.length > 0) {
       console.log(`🌱 [FIX] Batch seeding ${fieldsToSeedKeys.length} field sets...`);
       await kv.mset(fieldsToSeedKeys, fieldsToSeedValues);
    }

    // 3. Batch Write Versions - Reduces write ops from N to 1
    if (versionKeys.length > 0) {
       console.log(`📈 [FIX] Batch updating ${versionKeys.length} versions...`);
       await kv.mset(versionKeys, versionValues);
    }
    
    console.log('✅ [FIX] Onboarding versions updated successfully');
    return { success: true, results };
    
  } catch (error) {
    console.error('Error fixing versions:', error);
    return { success: false, error: String(error) };
  }
}

export function registerOnboardingFix(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/fix/onboarding-versions
   * Force updates the onboarding form versions for specific roles
   * as requested: v2, v3, v4, v5, v6, v7 for respective roles.
   */
  app.post("/make-server-3dd53475/fix/onboarding-versions", async (c) => {
    const result = await applyOnboardingVersionFix();
    
    if (result.success) {
      return c.json({
        success: true,
        message: 'Onboarding versions updated',
        results: result.results
      });
    } else {
      return c.json({ error: result.error }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/fix/catalog/health
   * Diagnoses why services might be missing
   */
  app.get("/make-server-3dd53475/fix/catalog/health", async (c) => {
     try {
       // Check V2 keys
       const services = await kv.get('platform:service_catalog') || [];
       const categories = await kv.get('catalog:categories') || [];
       
       // Check Legacy keys (for comparison)
       const legacyCategories = await kv.get('admin:catalog:categories') || [];
       
       return c.json({
         success: true,
         diagnosis: {
           v2_flat_catalog_count: services.length,
           v2_categories_count: categories.length,
           legacy_categories_count: legacyCategories.length,
           status: services.length > 0 ? 'HEALTHY' : 'EMPTY_CATALOG'
         },
         sampleService: services.length > 0 ? services[0] : null
       });
     } catch (error) {
       return c.json({ error: String(error) }, 500);
     }
  });
}
