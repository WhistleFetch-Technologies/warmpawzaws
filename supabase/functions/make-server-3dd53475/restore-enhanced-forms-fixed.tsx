/**
 * ============================================================================
 * RESTORE ENHANCED FORMS - FIXED VERSION
 * ============================================================================
 * 
 * ✅ FIXED: Proper imports, SQL-only, reliable restoration
 * 
 * Restores enhanced onboarding forms from platform_settings to ensure
 * all forms are properly loaded and available
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getRolesRepository } from '../../lib/repositories/roles.ts';

const app = new Hono();
const db = getDbClient();
const rolesRepo = getRolesRepository();

/**
 * Load all onboarding forms from platform_settings
 * GET /make-server-3dd53475/admin/onboarding-forms/load-all
 */
app.get('/make-server-3dd53475/admin/onboarding-forms/load-all', async (c) => {
  try {
    console.log('[LOAD FORMS] Loading all onboarding forms from SQL...');
    
    // ✅ SQL: Get all active forms
    const { data: formsData, error } = await db
      .from('platform_settings')
      .select('*')
      .ilike('setting_key', 'onboarding:form:%:active');
    
    if (error) {
      console.error('[LOAD FORMS] Database error:', error);
      return sendError(c, 'Failed to load forms', 500);
    }
    
    const forms = (formsData || [])
      .map((s: any) => s.setting_value)
      .filter((f: any) => f && f.roleId && f.id);
    
    console.log(`[LOAD FORMS] ✅ Loaded ${forms.length} forms from SQL`);
    
    return sendSuccess(c, {
      forms,
      count: forms.length,
      message: `Successfully loaded ${forms.length} onboarding forms`
    });
  } catch (error) {
    console.error('[LOAD FORMS] Error:', error);
    return sendError(c, error, 500);
  }
});

/**
 * Ensure all roles have onboarding forms
 * POST /make-server-3dd53475/admin/onboarding-forms/ensure-all-roles
 */
app.post('/make-server-3dd53475/admin/onboarding-forms/ensure-all-roles', async (c) => {
  try {
    console.log('[ENSURE FORMS] Ensuring all roles have onboarding forms...');
    
    // ✅ SQL: Get all active roles
    const roles = await rolesRepo.findAll();
    
    const results: Array<{
      roleId: string;
      roleName: string;
      status: string;
      formId?: string;
      version?: number;
      error?: string;
    }> = [];
    
    for (const role of roles) {
      try {
        // Check if form exists
        const { data: formData } = await db
          .from('platform_settings')
          .select('*')
          .eq('setting_key', `onboarding:form:${role.id}:active`)
          .maybeSingle();
        
        if (!formData) {
          // Generate default form
          const defaultForm = {
            id: `form_${role.id}_${Date.now()}`,
            roleId: role.id,
            roleName: role.display_name || role.name,
            version: 1,
            status: 'draft',
            sections: [
              {
                id: 'business_info',
                name: 'business_info',
                title: 'Business Information',
                order: 1,
                isActive: true,
                fields: [
                  {
                    id: 'business_name',
                    name: 'businessName',
                    label: 'Business Name',
                    type: 'text',
                    section: 'business_info',
                    validation: { required: true },
                    order: 1,
                    isActive: true
                  }
                ]
              }
            ],
            documentSections: [],
            metadata: {
              createdBy: 'system',
              createdAt: new Date().toISOString(),
              lastModifiedBy: 'system',
              lastModifiedAt: new Date().toISOString()
            }
          };
          
          // Save form
          await db
            .from('platform_settings')
            .upsert({
              setting_key: `onboarding:form:${role.id}:active`,
              setting_value: defaultForm,
              description: `Default onboarding form for ${role.display_name || role.name}`,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });
          
          results.push({
            roleId: role.id,
            roleName: role.display_name || role.name,
            status: 'created',
            formId: defaultForm.id,
            version: defaultForm.version
          });
          
          console.log(`[ENSURE FORMS] ✅ Created form for ${role.id}`);
        } else {
          results.push({
            roleId: role.id,
            roleName: role.display_name || role.name,
            status: 'exists',
            formId: formData.setting_value?.id,
            version: formData.setting_value?.version
          });
        }
      } catch (err) {
        console.error(`[ENSURE FORMS] Error processing role ${role.id}:`, err);
        results.push({
          roleId: role.id,
          roleName: role.display_name || role.name,
          status: 'error',
          error: String(err)
        });
      }
    }
    
    const createdCount = results.filter(r => r.status === 'created').length;
    const existingCount = results.filter(r => r.status === 'exists').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    return sendSuccess(c, {
      results,
      summary: {
        total: results.length,
        created: createdCount,
        existing: existingCount,
        errors: errorCount
      },
      message: `Processed ${results.length} roles: ${createdCount} created, ${existingCount} existing, ${errorCount} errors`
    });
  } catch (error) {
    console.error('[ENSURE FORMS] Error:', error);
    return sendError(c, error, 500);
  }
});

export default app;

