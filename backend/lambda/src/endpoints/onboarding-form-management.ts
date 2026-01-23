/**
 * ============================================================================
 * ONBOARDING FORM MANAGEMENT ENDPOINTS
 * ============================================================================
 * 
 * Based on reference implementation from Figma/Supabase
 * Manages dynamic onboarding form fields for vendor roles
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// FIELD TYPE CONSTANTS
// ============================================================================

export const FIELD_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  PHONE: 'phone',
  NUMBER: 'number',
  TEXTAREA: 'textarea',
  DROPDOWN: 'dropdown',
  MULTI_SELECT: 'multi_select',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  DATE: 'date',
  FILE: 'file',
  ADDRESS: 'address',
  COORDINATES: 'coordinates',
  BANK_DETAILS: 'bank_details',
  URL: 'url',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getFormVersion(roleId: string): Promise<number> {
  try {
    const result = await query('SELECT version FROM onboarding_forms WHERE role_id = $1', [roleId]);
    return result.rows?.[0]?.version || 1;
  } catch {
    return 1;
  }
}

async function incrementFormVersion(roleId: string) {
  const version = await getFormVersion(roleId);
  await query('UPDATE onboarding_forms SET version = $1, updated_at = NOW() WHERE role_id = $2', [version + 1, roleId]);
}

/**
 * Role name aliases/mappings for common variations
 */
const ROLE_NAME_ALIASES: Record<string, string[]> = {
  'veterinarian': ['veterinarian', 'vet', 'Veterinarian', 'vet_solo', 'vet_clinic', 'veterinary_clinic'],
  'vet_solo': ['vet_solo', 'veterinarian', 'vet', 'Veterinarian'],
  'vet_clinic': ['vet_clinic', 'veterinary_clinic', 'veterinarian', 'vet'],
  'veterinary_clinic': ['veterinary_clinic', 'vet_clinic', 'veterinarian', 'vet'],
  'pet_walker': ['pet_walker', 'walker', 'Pet Walker'],
  'pet_groomer': ['pet_groomer', 'groomer', 'Pet Grooming Salon'],
  'diagnostics_center': ['diagnostics_center', 'diagnostic_center', 'diagnostics'],
};

/**
 * Get role by name with case-insensitive fallback and alias support
 * Only returns active roles
 * Tries: exact match -> case-insensitive -> aliases -> partial match
 */
async function getRoleByName(roleId: string): Promise<any | null> {
  console.log(`[getRoleByName] Looking up role: "${roleId}"`);
  
  // Try exact match first (only active roles)
  let roles = await select('roles', { name: roleId, is_active: true });
  console.log(`[getRoleByName] Exact match for "${roleId}": ${roles.length} results`);
  
  // If exact match fails, try case-insensitive lookup (only active roles)
  if (roles.length === 0) {
    console.log(`[getRoleByName] Trying case-insensitive lookup for "${roleId}"`);
    const caseInsensitiveResult = await query(
      'SELECT * FROM roles WHERE LOWER(name) = LOWER($1) AND is_active = true LIMIT 1',
      [roleId]
    );
    roles = caseInsensitiveResult.rows || [];
    console.log(`[getRoleByName] Case-insensitive match: ${roles.length} results`);
  }
  
  // If still no match, try aliases (only active roles)
  if (roles.length === 0) {
    const normalizedRoleId = roleId.toLowerCase();
    const aliases = ROLE_NAME_ALIASES[normalizedRoleId] || ROLE_NAME_ALIASES[roleId] || [];
    
    if (aliases.length > 0) {
      console.log(`[getRoleByName] Trying aliases for "${roleId}":`, aliases);
      for (const alias of aliases) {
        const aliasResult = await query(
          'SELECT * FROM roles WHERE LOWER(name) = LOWER($1) AND is_active = true LIMIT 1',
          [alias]
        );
        if (aliasResult.rows && aliasResult.rows.length > 0) {
          roles = aliasResult.rows;
          console.log(`[getRoleByName] Found role via alias "${alias}": ${roles[0].name}`);
          break;
        }
      }
    }
  }
  
  // If still no match, try partial match (contains) - only active roles
  if (roles.length === 0) {
    console.log(`[getRoleByName] Trying partial match for "${roleId}"`);
    const partialResult = await query(
      'SELECT * FROM roles WHERE LOWER(name) LIKE LOWER($1) AND is_active = true LIMIT 1',
      [`%${roleId}%`]
    );
    roles = partialResult.rows || [];
    console.log(`[getRoleByName] Partial match: ${roles.length} results`);
  }
  
  // If still no match, log all available active roles for debugging
  if (roles.length === 0) {
    const activeRoles = await select('roles', { is_active: true }, { limit: 100 });
    const roleNames = activeRoles.map((r: any) => r.name).join(', ');
    console.log(`[getRoleByName] Active role "${roleId}" not found. Available active roles:`, roleNames);
  }
  
  return roles.length > 0 ? roles[0] : null;
}

function getSectionsFromFields(fields: any[]) {
  const sections: Record<string, any> = {};
  
  const sectionMeta: Record<string, any> = {
    'business_information': { title: 'Business Information', order: 1 },
    'location_information': { title: 'Location', order: 2 },
    'banking_information': { title: 'Banking Details', order: 3 },
    'document_verification': { title: 'Documents', order: 4 },
    'documents': { title: 'Documents', order: 4 },
    'additional_information': { title: 'Additional Info', order: 5 },
  };

  for (const field of fields) {
    const secKey = field.section || 'additional_information';
    if (!sections[secKey]) {
      sections[secKey] = {
        id: secKey,
        name: secKey,
        title: sectionMeta[secKey]?.title || formatTitle(secKey),
        order: sectionMeta[secKey]?.order || 99,
        fields: [],
      };
    }
    sections[secKey].fields.push(field);
  }

  return Object.values(sections).sort((a: any, b: any) => a.order - b.order);
}

function formatTitle(str: string) {
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function registerOnboardingFormManagementEndpoints(app: Hono) {
  /**
   * POST /admin/onboarding-fields/migrate
   * Migrate onboarding forms for all active roles
   * MUST be registered BEFORE parameterized routes to avoid route conflicts
   */
  app.post('/admin/onboarding-fields/migrate', async (c) => {
    try {
      console.log('[MIGRATE] Migration endpoint called');
      
      // This endpoint doesn't require a body
      // Check if body exists before trying to parse
      const hasBody = c.req.header('content-length') && parseInt(c.req.header('content-length') || '0') > 0;
      if (hasBody) {
        try {
          await c.req.json().catch(() => ({}));
        } catch {
          // Ignore body parsing errors
        }
      }
      
      // Get all active roles
      console.log('[MIGRATE] Querying active roles...');
      const activeRoles = await select('roles', { is_active: true }, {
        orderBy: 'name',
        orderDirection: 'ASC',
      });
      
      console.log(`[MIGRATE] Found ${activeRoles.length} active roles`);
      
      if (activeRoles.length === 0) {
        return c.json({
          success: false,
          message: 'No active roles found',
          summary: { totalRoles: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
          results: [],
        });
      }
      
      const results: any[] = [];
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Standard onboarding fields (same as role-seeding.ts)
      const STANDARD_ONBOARDING_FIELDS = [
        {
          fieldName: 'businessName',
          label: 'Business Name',
          type: 'text',
          section: 'business_information',
          isMandatory: true,
          displayOrder: 1,
        },
        {
          fieldName: 'fullName',
          label: 'Contact Person Name',
          type: 'text',
          section: 'business_information',
          isMandatory: true,
          displayOrder: 2,
        },
        {
          fieldName: 'phone',
          label: 'Phone Number',
          type: 'phone',
          section: 'business_information',
          isMandatory: true,
          displayOrder: 3,
        },
        {
          fieldName: 'email',
          label: 'Email',
          type: 'email',
          section: 'business_information',
          isMandatory: true,
          displayOrder: 4,
        },
        {
          fieldName: 'businessType',
          label: 'Business Type',
          type: 'dropdown',
          section: 'business_information',
          isMandatory: true,
          options: ['Solo Practitioner', 'Clinic', 'Home Service', 'Mobile Unit'],
          displayOrder: 5,
        },
        {
          fieldName: 'address',
          label: 'Address',
          type: 'textarea',
          section: 'location_information',
          isMandatory: true,
          displayOrder: 6,
        },
        {
          fieldName: 'city',
          label: 'City',
          type: 'text',
          section: 'location_information',
          isMandatory: true,
          displayOrder: 7,
        },
        {
          fieldName: 'state',
          label: 'State',
          type: 'text',
          section: 'location_information',
          isMandatory: true,
          displayOrder: 8,
        },
        {
          fieldName: 'pin',
          label: 'PIN Code',
          type: 'text',
          section: 'location_information',
          isMandatory: true,
          displayOrder: 9,
        },
        {
          fieldName: 'gstNumber',
          label: 'GST Number',
          type: 'text',
          section: 'business_information',
          isMandatory: false,
          displayOrder: 10,
        },
      ];

      for (const role of activeRoles) {
        try {
          const roleName = role.name;
          
          // Check if form exists
          const existingForms = await select('onboarding_forms', { role_id: roleName });
          
          // Create fields array
          const fields = STANDARD_ONBOARDING_FIELDS.map((f, idx) => ({
            id: `field_${roleName}_${idx + 1}`,
            fieldName: f.fieldName,
            label: f.label,
            type: f.type,
            section: f.section,
            isMandatory: f.isMandatory,
            requiresDocument: false,
            placeholder: '',
            helpText: '',
            options: f.options || [],
            validation: {},
            displayOrder: f.displayOrder || idx + 1,
            isActive: true,
            defaultValue: '',
            dependsOn: null,
          }));

          if (existingForms.length > 0) {
            // Form exists - update it to ensure it has standard fields
            await update('onboarding_forms', { role_id: roleName }, {
              fields: JSON.stringify(fields),
              status: 'active',
              updated_at: new Date().toISOString(),
            });
            updated++;
            results.push({
              roleId: roleName,
              roleName: role.display_name || roleName,
              status: 'updated',
              fieldsCount: fields.length,
            });
          } else {
            // Form doesn't exist - create it
            await insert('onboarding_forms', {
              role_id: roleName,
              fields: JSON.stringify(fields),
              status: 'active',
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            created++;
            results.push({
              roleId: roleName,
              roleName: role.display_name || roleName,
              status: 'created',
              fieldsCount: fields.length,
            });
          }
        } catch (error: any) {
          errors++;
          console.error(`[MIGRATE] Error processing role ${role.name}:`, error);
          results.push({
            roleId: role.name,
            roleName: role.display_name || role.name,
            status: 'error',
            error: error.message,
          });
        }
      }

      return c.json({
        success: true,
        message: `Migration completed: ${created} created, ${updated} updated, ${errors} errors`,
        summary: {
          totalRoles: activeRoles.length,
          created,
          updated,
          skipped,
          errors,
        },
        results,
      });
    } catch (error: any) {
      console.error('Error migrating onboarding fields:', error);
      return c.json({ error: error.message || 'Failed to migrate onboarding fields' }, 500);
    }
  });

  /**
   * GET /admin/onboarding-fields/:roleId
   * Get all onboarding fields for a specific role
   */
  app.get('/admin/onboarding-fields/:roleId', async (c) => {
    try {
      const { roleId } = c.req.param();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/892f647a-2ee5-41db-bfad-3ff67af0ff8d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding-form-management.ts:102',message:'Route matched - roleId extracted',data:{roleId,rawPath:c.req.path,method:c.req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Ensure onboarding_forms table exists
      await query(`
        CREATE TABLE IF NOT EXISTS onboarding_forms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role_id VARCHAR(255) UNIQUE NOT NULL,
          fields JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'active',
          version INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `).catch(() => {});

      // Get role configuration with case-insensitive fallback
      // Only check active roles
      console.log(`[GET /admin/onboarding-fields/:roleId] Looking up active role: "${roleId}"`);
      const role = await getRoleByName(roleId);
      
      if (!role) {
        console.error(`[GET /admin/onboarding-fields/:roleId] Active role "${roleId}" not found`);
        // Get all active roles for better error message
        const activeRoles = await select('roles', { is_active: true }, { limit: 100 });
        const roleNames = activeRoles.map((r: any) => r.name).join(', ');
        return c.json({ 
          error: 'Role not found',
          requestedRole: roleId,
          availableRoles: roleNames ? roleNames.split(', ') : [],
          hint: 'Only active roles are available. Available active roles listed above.'
        }, 404);
      }
      
      // Verify role is active
      if (!role.is_active) {
        console.error(`[GET /admin/onboarding-fields/:roleId] Role "${roleId}" is not active`);
        return c.json({ 
          error: 'Role is not active',
          requestedRole: roleId,
          hint: 'Only active roles can have onboarding forms.'
        }, 404);
      }
      
      console.log(`[GET /admin/onboarding-fields/:roleId] Found active role: ${role.name} (display: ${role.display_name})`);

      // Get custom onboarding fields configuration
      // Use the actual role.name from database, not the roleId parameter (which might be an alias)
      const actualRoleName = role.name;
      const forms = await select('onboarding_forms', { role_id: actualRoleName });
      let fields: any[] = [];

      if (forms.length > 0) {
        // Parse JSONB fields
        fields = typeof forms[0].fields === 'string' 
          ? JSON.parse(forms[0].fields) 
          : forms[0].fields || [];
      }

      // If no fields found, return empty array (frontend will use default)
      // This is NOT an error - the form just hasn't been created yet
      if (fields.length === 0) {
        console.log(`[GET /admin/onboarding-fields/:roleId] No form found for role "${actualRoleName}", returning empty form`);
        return c.json({
          success: true,
          roleId: actualRoleName,
          roleName: role.display_name || actualRoleName,
          fields: [],
          sections: [],
          version: 1,
        });
      }

      // Group fields by section
      const sections = getSectionsFromFields(fields);

      return c.json({
        success: true,
        roleId: actualRoleName,
        roleName: role.display_name || actualRoleName,
        fields,
        sections,
        version: await getFormVersion(actualRoleName),
      });
    } catch (error: any) {
      console.error('Error fetching onboarding fields:', error);
      return c.json({ error: error.message || 'Failed to fetch onboarding fields' }, 500);
    }
  });

  /**
   * POST /admin/onboarding-fields/:roleId
   * Create a new onboarding field
   */
  app.post('/admin/onboarding-fields/:roleId', async (c) => {
    try {
      const { roleId } = c.req.param();
      const fieldData = await c.req.json();

      // Validate role exists with case-insensitive fallback
      const role = await getRoleByName(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }

      // Get existing fields
      const forms = await select('onboarding_forms', { role_id: roleId });
      let existingFields: any[] = [];

      if (forms.length > 0) {
        existingFields = typeof forms[0].fields === 'string'
          ? JSON.parse(forms[0].fields)
          : forms[0].fields || [];
      }

      // Generate unique field ID
      const fieldId = `field_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Create new field
      const newField: any = {
        id: fieldId,
        fieldName: fieldData.fieldName || fieldData.name || `field_${fieldId}`,
        label: fieldData.label || fieldData.fieldName || 'New Field',
        type: fieldData.type || 'text',
        section: fieldData.section || 'business_information',
        isMandatory: fieldData.isMandatory !== undefined ? fieldData.isMandatory : (fieldData.required || false),
        required: fieldData.isMandatory !== undefined ? fieldData.isMandatory : (fieldData.required || false),
        requiresDocument: fieldData.requiresDocument || false,
        documentLabel: fieldData.documentLabel,
        documentDescription: fieldData.documentDescription,
        placeholder: fieldData.placeholder || '',
        helpText: fieldData.helpText || fieldData.description || '',
        options: fieldData.options || [],
        validation: fieldData.validation || {},
        displayOrder: fieldData.displayOrder !== undefined ? fieldData.displayOrder : existingFields.length,
        isActive: fieldData.isActive !== false,
        defaultValue: fieldData.defaultValue,
        dependsOn: fieldData.dependsOn,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to fields array
      existingFields.push(newField);

      // Sort by display order
      existingFields.sort((a: any, b: any) => a.displayOrder - b.displayOrder);

      // Save updated fields
      if (forms.length > 0) {
        await update('onboarding_forms', { role_id: roleId }, {
          fields: JSON.stringify(existingFields),
          updated_at: new Date().toISOString(),
        });
        await incrementFormVersion(roleId);
      } else {
        await insert('onboarding_forms', {
          role_id: roleId,
          fields: JSON.stringify(existingFields),
          status: 'active',
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        field: newField,
        message: 'Field created successfully',
      });
    } catch (error: any) {
      console.error('Error creating onboarding field:', error);
      return c.json({ error: error.message || 'Failed to create field' }, 500);
    }
  });

  /**
   * PUT /admin/onboarding-fields/:roleId/:fieldId
   * Update an existing onboarding field
   */
  app.put('/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
    try {
      const { roleId, fieldId } = c.req.param();
      const updates = await c.req.json();

      const forms = await select('onboarding_forms', { role_id: roleId });
      if (forms.length === 0) {
        return c.json({ error: 'Form not found for this role' }, 404);
      }

      let fields: any[] = typeof forms[0].fields === 'string'
        ? JSON.parse(forms[0].fields)
        : forms[0].fields || [];

      const fieldIndex = fields.findIndex((f: any) => f.id === fieldId);
      if (fieldIndex === -1) {
        return c.json({ error: 'Field not found' }, 404);
      }

      // Update field
      fields[fieldIndex] = {
        ...fields[fieldIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Save updated fields
      await update('onboarding_forms', { role_id: roleId }, {
        fields: JSON.stringify(fields),
        updated_at: new Date().toISOString(),
      });
      await incrementFormVersion(roleId);

      return c.json({
        success: true,
        field: fields[fieldIndex],
        message: 'Field updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating onboarding field:', error);
      return c.json({ error: error.message || 'Failed to update field' }, 500);
    }
  });

  /**
   * DELETE /admin/onboarding-fields/:roleId/:fieldId
   * Delete an onboarding field
   */
  app.delete('/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
    try {
      const { roleId, fieldId } = c.req.param();

      const forms = await select('onboarding_forms', { role_id: roleId });
      if (forms.length === 0) {
        return c.json({ error: 'Form not found for this role' }, 404);
      }

      let fields: any[] = typeof forms[0].fields === 'string'
        ? JSON.parse(forms[0].fields)
        : forms[0].fields || [];

      const filteredFields = fields.filter((f: any) => f.id !== fieldId);
      if (fields.length === filteredFields.length) {
        return c.json({ error: 'Field not found' }, 404);
      }

      // Reorder remaining fields
      filteredFields.forEach((f: any, idx: number) => {
        f.displayOrder = idx;
        f.updatedAt = new Date().toISOString();
      });

      // Save updated fields
      await update('onboarding_forms', { role_id: roleId }, {
        fields: JSON.stringify(filteredFields),
        updated_at: new Date().toISOString(),
      });
      await incrementFormVersion(roleId);

      return c.json({
        success: true,
        message: 'Field deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting onboarding field:', error);
      return c.json({ error: error.message || 'Failed to delete field' }, 500);
    }
  });

  /**
   * PUT /admin/onboarding-fields/:roleId/reorder
   * Reorder fields within a section
   */
  app.put('/admin/onboarding-fields/:roleId/reorder', async (c) => {
    try {
      const { roleId } = c.req.param();
      const { fieldOrders } = await c.req.json(); // Array of { fieldId, displayOrder }

      const forms = await select('onboarding_forms', { role_id: roleId });
      if (forms.length === 0) {
        return c.json({ error: 'Form not found for this role' }, 404);
      }

      let fields: any[] = typeof forms[0].fields === 'string'
        ? JSON.parse(forms[0].fields)
        : forms[0].fields || [];

      // Update display orders
      fieldOrders.forEach((order: any) => {
        const field = fields.find((f: any) => f.id === order.fieldId);
        if (field) {
          field.displayOrder = order.displayOrder;
          field.updatedAt = new Date().toISOString();
        }
      });

      // Sort by display order
      fields.sort((a: any, b: any) => a.displayOrder - b.displayOrder);

      // Save updated fields
      await update('onboarding_forms', { role_id: roleId }, {
        fields: JSON.stringify(fields),
        updated_at: new Date().toISOString(),
      });
      await incrementFormVersion(roleId);

      return c.json({
        success: true,
        fields,
        message: 'Fields reordered successfully',
      });
    } catch (error: any) {
      console.error('Error reordering onboarding fields:', error);
      return c.json({ error: error.message || 'Failed to reorder fields' }, 500);
    }
  });

  /**
   * GET /onboarding-form/:roleId
   * Public endpoint: Get onboarding form for vendor application
   */
  app.get('/onboarding-form/:roleId', async (c) => {
    try {
      const { roleId } = c.req.param();

      // Get role configuration with case-insensitive fallback
      const role = await getRoleByName(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }

      // Get active onboarding fields
      const forms = await select('onboarding_forms', { role_id: roleId });
      let activeFields: any[] = [];

      if (forms.length > 0) {
        const allFields: any[] = typeof forms[0].fields === 'string'
          ? JSON.parse(forms[0].fields)
          : forms[0].fields || [];
        activeFields = allFields.filter((f: any) => f.isActive !== false);
      }

      // Group fields by section
      const sections = getSectionsFromFields(activeFields);

      return c.json({
        success: true,
        roleId,
        roleName: role.display_name || role.name,
        fields: activeFields,
        sections,
        version: await getFormVersion(roleId),
      });
    } catch (error: any) {
      console.error('Error fetching onboarding form:', error);
      return c.json({ error: error.message || 'Failed to fetch onboarding form' }, 500);
    }
  });

  /**
   * POST /admin/forms
   * Save/update onboarding form configuration
   */
  app.post('/admin/forms', async (c) => {
    try {
      const { id, name, roleId, fields } = await c.req.json();

      if (!roleId && !id) {
        return c.json({ error: 'roleId or id is required' }, 400);
      }

      const targetRoleId = roleId || id;

      // Check if form already exists
      const existingForms = await select('onboarding_forms', { role_id: targetRoleId });

      if (existingForms.length > 0) {
        // Update existing form
        await update('onboarding_forms', { role_id: targetRoleId }, {
          name: name || existingForms[0].name,
          fields: JSON.stringify(fields),
          updated_at: new Date().toISOString(),
        });
      } else {
        // Create new form
        await insert('onboarding_forms', {
          role_id: targetRoleId,
          name: name || `${targetRoleId} Onboarding Form`,
          fields: JSON.stringify(fields),
        });
      }

      return c.json({
        success: true,
        message: 'Form saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving form:', error);
      return c.json({ error: error.message || 'Failed to save form' }, 500);
    }
  });

  /**
   * POST /admin/onboarding-fields/sync
   * Sync onboarding fields from role configs (healing/migration endpoint)
   * @deprecated Use /admin/onboarding-fields/migrate instead
   */
  app.post('/admin/onboarding-fields/sync', async (c) => {
    try {
      // Get all active roles
      const roles = await select('roles', { is_active: true });
      const results: any[] = [];

      for (const role of roles) {
        try {
          // Check if form exists
          const forms = await select('onboarding_forms', { role_id: role.name });
          
          // If form doesn't exist, create a basic one from standard fields
          if (forms.length === 0) {
            // Standard fields will be created by seeding endpoint
            results.push({
              roleId: role.name,
              status: 'skipped',
              reason: 'Use /admin/onboarding-fields/migrate to create forms',
            });
            continue;
          }

          // If form exists, update version
          const version = await getFormVersion(role.name);
          await incrementFormVersion(role.name);

          results.push({
            roleId: role.name,
            status: 'synced',
            version: version + 1,
          });
        } catch (error: any) {
          results.push({
            roleId: role.name,
            status: 'error',
            error: error.message,
          });
        }
      }

      return c.json({
        success: true,
        message: 'Onboarding fields sync completed',
        results,
      });
    } catch (error: any) {
      console.error('Error syncing onboarding fields:', error);
      return c.json({ error: error.message || 'Failed to sync onboarding fields' }, 500);
    }
  });
}
