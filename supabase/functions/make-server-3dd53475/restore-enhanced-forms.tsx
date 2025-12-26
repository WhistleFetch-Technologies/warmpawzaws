import { Hono } from 'npm:hono@4';
import { getRolesRepository } from '../../lib/repositories/roles.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * RESTORE ENHANCED FORMS FROM KV TO SQL
 * 
 * This script restores the original enhanced onboarding forms from KV store
 * to SQL (roles.config), preserving:
 * - Document sections (licenses, police verification, etc.)
 * - Enhanced field configurations
 * - Original version numbers
 * - Sections structure
 */

const app = new Hono();

// Role name mapping: KV name -> SQL name
const ROLE_NAME_MAPPING: Record<string, string> = {
  'pet_groomer': 'groomer',
  'pet_clinic': 'vet_clinic',
  'pet_boarder': 'boarding',
  'pet_behaviorist': 'behaviourist',
  'pet_cafe': 'cafe',
  'pet_ambulance': 'ambulance',
  'pet_insurance': 'insurance',
  'pet_pharmacy': 'pharmacy',
  'pet_photographer': 'photography',
  'pet_trainer': 'trainer',
  'pet_walker': 'walker',
  'pet_shelter': 'adoption',
  'pet_sunset': 'sunset',
  'pet_product_seller': 'product_seller',
  'service-provider': 'service_provider',
  'sunset_services': 'sunset',
  'veterinarian': 'veterinarian'
};

// Get Supabase client for direct KV access
function getKvClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Restore enhanced forms from KV to SQL
 * POST /make-server-3dd53475/admin/onboarding-forms/restore-from-kv
 */
app.post("/make-server-3dd53475/admin/onboarding-forms/restore-from-kv", async (c) => {
  try {
    console.log('[RESTORE FORMS] Starting restoration from KV to SQL...');
    
    const kvClient = getKvClient();
    const rolesRepo = getRolesRepository();
    
    // Get all KV entries for onboarding forms
    const { data: kvEntries, error: kvListError } = await kvClient
      .from('kv_store_3dd53475')
      .select('key, value')
      .like('key', 'onboarding:form:%:active');
    
    if (kvListError) {
      throw new Error(`Failed to fetch KV entries: ${kvListError.message}`);
    }
    
    if (!kvEntries || kvEntries.length === 0) {
      return c.json({
        success: true,
        message: 'No KV forms found to restore',
        results: []
      });
    }
    
    const results: Array<{
      roleId: string;
      sqlRoleId: string;
      status: string;
      kvVersion?: number;
      sqlVersion?: number;
      sectionsCount?: number;
      documentSectionsCount?: number;
      error?: string;
    }> = [];
    
    // Process each KV entry
    for (const kvEntry of kvEntries) {
      // Extract role name from KV key (e.g., "onboarding:form:pet_groomer:active" -> "pet_groomer")
      const kvKey = kvEntry.key;
      const kvRoleName = kvKey.replace('onboarding:form:', '').replace(':active', '');
      const sqlRoleName = ROLE_NAME_MAPPING[kvRoleName] || kvRoleName;
      
      try {
        // Check if SQL role exists
        const sqlRole = await rolesRepo.findById(sqlRoleName);
        if (!sqlRole) {
          console.log(`[RESTORE] SQL role not found: ${sqlRoleName} (KV: ${kvRoleName}), skipping...`);
          results.push({
            roleId: kvRoleName,
            sqlRoleId: sqlRoleName,
            status: 'skipped',
            error: `SQL role not found: ${sqlRoleName}`
          });
          continue;
        }
        
        // Parse JSONB value if it's a string
        const enhancedForm = typeof kvEntry.value === 'string' 
          ? JSON.parse(kvEntry.value) 
          : kvEntry.value;
        const kvVersion = enhancedForm.version || 1;
        const sections = enhancedForm.sections || [];
        const documentSections = enhancedForm.documentSections || [];
        
        console.log(`[RESTORE] Found KV form for ${kvRoleName} -> ${sqlRoleName}: v${kvVersion}, ${sections.length} sections, ${documentSections.length} doc sections`);
        
        // 2. Get current SQL config
        const roleConfig = sqlRole.config || {};
        const currentVersion = roleConfig.onboardingFields?.version || 0;
        
        // 3. Convert enhanced form to SQL format
        // Extract all fields from sections and flatten them for onboardingFields.fields
        const allFields: any[] = [];
        sections.forEach((section: any) => {
          if (section.fields && Array.isArray(section.fields)) {
            section.fields.forEach((field: any) => {
              allFields.push({
                ...field,
                section: section.id || section.name || 'general'
              });
            });
          }
        });
        
        // 4. Update SQL config with enhanced form data
        const updatedConfig = {
          ...roleConfig,
          onboardingFields: {
            ...(roleConfig.onboardingFields || {}),
            // Preserve original version from KV (or use current if higher)
            version: Math.max(kvVersion, currentVersion),
            // Store flat fields list (for backward compatibility)
            fields: allFields,
            // Store sections structure (for enhanced forms)
            sections: sections,
            // Store document sections (for document uploads)
            documentSections: documentSections
          }
        };
        
        // 5. Save to SQL
        await rolesRepo.setConfig(sqlRoleName, updatedConfig);
        
        results.push({
          roleId: kvRoleName,
          sqlRoleId: sqlRoleName,
          status: 'restored',
          kvVersion: kvVersion,
          sqlVersion: updatedConfig.onboardingFields.version,
          sectionsCount: sections.length,
          documentSectionsCount: documentSections.length
        });
        
        console.log(`[RESTORE] ✅ Restored ${kvRoleName} -> ${sqlRoleName}: v${kvVersion} -> v${updatedConfig.onboardingFields.version}`);
        
      } catch (error) {
        console.error(`[RESTORE] ❌ Error restoring ${kvRoleName} -> ${sqlRoleName}:`, error);
        results.push({
          roleId: kvRoleName,
          sqlRoleId: sqlRoleName,
          status: 'error',
          error: String(error)
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'restored').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    return c.json({
      success: true,
      message: `Restored ${successCount} forms, skipped ${skippedCount}, errors: ${errorCount}`,
      results
    });
    
  } catch (error) {
    console.error('[RESTORE FORMS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;

