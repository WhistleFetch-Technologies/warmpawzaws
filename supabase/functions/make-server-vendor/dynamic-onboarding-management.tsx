import { Hono } from 'npm:hono@4';
import { getRolesRepository } from '../../lib/repositories/roles.ts';

/**
 * ========================================
 * DYNAMIC ONBOARDING FORM MANAGEMENT SYSTEM
 * ========================================
 * 
 * Enterprise-grade system for managing vendor onboarding forms dynamically
 * without modifying role configurations.
 * 
 * Features:
 * - Add/remove/edit onboarding fields
 * - Define field properties (type, mandatory, validation, etc.)
 * - Automatic document section generation
 * - Section-based organization
 * - Drag-and-drop field ordering
 * - Field type support: text, number, email, phone, dropdown, file, date, etc.
 * - Backward compatible with existing vendor onboarding
 * - Version control for form changes
 */

const app = new Hono();

/**
 * SYNC ONBOARDING FIELDS (Fix for missing/draft forms)
 * POST /make-server-3dd53475/admin/onboarding-fields/sync
 * 
 * ✅ SQL MIGRATION: Forces the onboarding fields SQL to match the Role Config.
 * Use this when Role Config is updated but Designer shows old fields.
 */
app.post("/make-server-3dd53475/admin/onboarding-fields/sync", async (c) => {
  try {
    console.log(`[SYNC FIELDS] Starting onboarding field sync...`);
    
    // ✅ SQL: Get all roles
    const rolesRepo = getRolesRepository();
    const allRoles = await rolesRepo.findAll();
    const results: Array<{ roleId: string; status: string; reason?: string; fieldsCount?: number; version?: number }> = [];

    for (const role of allRoles) {
      const roleId = role.name; // Use role name as ID
      
      // ✅ SQL: Get role config from SQL
      const roleConfig = role.config || {};
      
      if (!roleConfig || Object.keys(roleConfig).length === 0) {
        results.push({ roleId, status: 'skipped', reason: 'No Role Config' });
        continue;
      }

      // ✅ FIX: Preserve existing version - don't reset it
      const existingFields = roleConfig.onboardingFields?.fields || [];
      const existingVersion = roleConfig.onboardingFields?.version || 4; // Default to 4 if missing
      
      // 3. Generate Fields from Role Config
      // This converts the "Unified Schema" (Sections) into "Onboarding Designer" (Flat Fields)
      const newFields = await generateDefaultFieldsFromRole(roleConfig, roleId);
      
      if (newFields.length === 0) {
         results.push({ roleId, status: 'skipped', reason: 'No Fields Generated' });
         continue;
      }

      // ✅ FIX: Only update if fields actually changed, preserve version if same
      const existingFieldIds = existingFields.map((f: any) => f.id).sort().join(',');
      const newFieldIds = newFields.map((f: any) => f.id).sort().join(',');
      const fieldsChanged = existingFieldIds !== newFieldIds;
      
      // ✅ SQL: Update onboarding fields in role.config
      // ✅ FIX: Preserve existing version (minimum 4), only increment if fields changed
      const updatedConfig = {
        ...roleConfig,
        onboardingFields: {
          ...(roleConfig.onboardingFields || {}),
          fields: newFields,
          // Preserve version if fields unchanged, increment if changed, ensure minimum 4
          version: fieldsChanged ? Math.max(existingVersion + 1, 4) : Math.max(existingVersion, 4)
        }
      };
      
      await rolesRepo.setConfig(roleId, updatedConfig);

      const configVersion = updatedConfig.onboardingFields?.version || 4;

      results.push({ 
        roleId, 
        status: 'synced', 
        fieldsCount: newFields.length,
        version: configVersion
      });
      
      console.log(`[SYNC FIELDS] Synced role: ${roleId} (v${configVersion})`);
    }

    return c.json({
      success: true,
      message: 'Onboarding fields synced from Role Configs (SQL)',
      results
    });

  } catch (error) {
    console.error('[SYNC FIELDS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Supported field types
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
  URL: 'url'
};

// Standard sections
export const SECTIONS = {
  BUSINESS_INFO: 'business_information',
  ADDRESS_LOCATION: 'address_location',
  DOCUMENTS: 'document_verification',
  ADDITIONAL: 'additional_information'
};

// Default onboarding field configuration structure
interface OnboardingField {
  id: string;
  fieldName: string;
  label: string;
  type: string;
  section: string;
  isMandatory: boolean;
  requiresDocument: boolean;
  documentLabel?: string;
  documentDescription?: string;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  displayOrder: number;
  isActive: boolean;
  defaultValue?: any;
  dependsOn?: {
    fieldId: string;
    value: any;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all onboarding fields for a specific role
 * GET /make-server-3dd53475/admin/onboarding-fields/:roleId
 * ✅ SQL MIGRATION: Now reads from roles.config.onboardingFields
 */
app.get("/make-server-3dd53475/admin/onboarding-fields/:roleId", async (c) => {
  try {
    const { roleId } = c.req.param();
    
    console.log(`[ONBOARDING FIELDS] Fetching fields for role: ${roleId}`);

    // ✅ SQL: Get role configuration
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    // ✅ SQL: Get onboarding fields from role.config
    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    const customFields: OnboardingField[] = onboardingFields.fields || [];

    // If no custom fields exist, create default structure from role config
    if (customFields.length === 0) {
      console.log(`[ONBOARDING FIELDS] No custom fields found, using role defaults`);
      
      const defaultFields = await generateDefaultFieldsFromRole(roleConfig, roleId);
      
      // ✅ SQL: Save default fields to role.config
      const updatedConfig = {
        ...roleConfig,
        onboardingFields: {
          fields: defaultFields,
          version: 1
        }
      };
      await rolesRepo.setConfig(roleId, updatedConfig);
      
      return c.json({
        success: true,
        roleId,
        roleName: role.display_name || role.name,
        fields: defaultFields,
        sections: getSectionsFromFields(defaultFields),
        version: 1
      });
    }

    // Group fields by section
    const sections = getSectionsFromFields(customFields);

    console.log(`[ONBOARDING FIELDS] ✅ Found ${customFields.length} fields`);

    return c.json({
      success: true,
      roleId,
      roleName: role.display_name || role.name,
      fields: customFields,
      sections,
      version: onboardingFields.version || 1
    });

  } catch (error) {
    console.error('[ONBOARDING FIELDS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Create a new onboarding field
 * POST /make-server-3dd53475/admin/onboarding-fields/:roleId
 * ✅ SQL MIGRATION: Now saves to roles.config.onboardingFields
 */
app.post("/make-server-3dd53475/admin/onboarding-fields/:roleId", async (c) => {
  try {
    const { roleId } = c.req.param();
    const fieldData = await c.req.json();

    console.log(`[CREATE FIELD] Adding field to role: ${roleId}`, fieldData);

    // ✅ SQL: Validate role exists
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    // ✅ SQL: Get existing fields from role.config
    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    const existingFields: OnboardingField[] = onboardingFields.fields || [];

    // Generate unique field ID
    const fieldId = `field_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create new field
    const newField: OnboardingField = {
      id: fieldId,
      fieldName: fieldData.fieldName,
      label: fieldData.label,
      type: fieldData.type,
      section: fieldData.section,
      isMandatory: fieldData.isMandatory || false,
      requiresDocument: fieldData.requiresDocument || false,
      documentLabel: fieldData.documentLabel,
      documentDescription: fieldData.documentDescription,
      placeholder: fieldData.placeholder,
      helpText: fieldData.helpText,
      options: fieldData.options || [],
      validation: fieldData.validation || {},
      displayOrder: fieldData.displayOrder || existingFields.length,
      isActive: true,
      defaultValue: fieldData.defaultValue,
      dependsOn: fieldData.dependsOn,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to fields array
    existingFields.push(newField);

    // Sort by display order
    existingFields.sort((a, b) => a.displayOrder - b.displayOrder);

    // ✅ SQL: Save updated fields to role.config
    const updatedConfig = {
      ...roleConfig,
      onboardingFields: {
        ...onboardingFields,
        fields: existingFields,
        version: (onboardingFields.version || 0) + 1
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    console.log(`[CREATE FIELD] ✅ Field created: ${fieldId}`);

    return c.json({
      success: true,
      field: newField,
      message: 'Field created successfully'
    });

  } catch (error) {
    console.error('[CREATE FIELD] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Update an onboarding field
 * PUT /make-server-3dd53475/admin/onboarding-fields/:roleId/:fieldId
 * ✅ SQL MIGRATION: Now updates roles.config.onboardingFields
 */
app.put("/make-server-3dd53475/admin/onboarding-fields/:roleId/:fieldId", async (c) => {
  try {
    const { roleId, fieldId } = c.req.param();
    const updates = await c.req.json();

    console.log(`[UPDATE FIELD] Updating field ${fieldId} in role ${roleId}`);

    // ✅ SQL: Get role and existing fields
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    const fields: OnboardingField[] = onboardingFields.fields || [];
    const fieldIndex = fields.findIndex(f => f.id === fieldId);

    if (fieldIndex === -1) {
      return c.json({ error: 'Field not found' }, 404);
    }

    // Update field
    fields[fieldIndex] = {
      ...fields[fieldIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // ✅ SQL: Save updated fields to role.config
    const updatedConfig = {
      ...roleConfig,
      onboardingFields: {
        ...onboardingFields,
        fields: fields,
        version: (onboardingFields.version || 0) + 1
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    console.log(`[UPDATE FIELD] ✅ Field updated: ${fieldId}`);

    return c.json({
      success: true,
      field: fields[fieldIndex],
      message: 'Field updated successfully'
    });

  } catch (error) {
    console.error('[UPDATE FIELD] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Delete an onboarding field
 * DELETE /make-server-3dd53475/admin/onboarding-fields/:roleId/:fieldId
 * ✅ SQL MIGRATION: Now deletes from roles.config.onboardingFields
 */
app.delete("/make-server-3dd53475/admin/onboarding-fields/:roleId/:fieldId", async (c) => {
  try {
    const { roleId, fieldId } = c.req.param();

    console.log(`[DELETE FIELD] Deleting field ${fieldId} from role ${roleId}`);

    // ✅ SQL: Get role and existing fields
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    const fields: OnboardingField[] = onboardingFields.fields || [];
    const filteredFields = fields.filter(f => f.id !== fieldId);

    if (fields.length === filteredFields.length) {
      return c.json({ error: 'Field not found' }, 404);
    }

    // ✅ SQL: Save updated fields to role.config
    const updatedConfig = {
      ...roleConfig,
      onboardingFields: {
        ...onboardingFields,
        fields: filteredFields,
        version: (onboardingFields.version || 0) + 1
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    console.log(`[DELETE FIELD] ✅ Field deleted: ${fieldId}`);

    return c.json({
      success: true,
      message: 'Field deleted successfully'
    });

  } catch (error) {
    console.error('[DELETE FIELD] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Reorder fields within a section
 * PUT /make-server-3dd53475/admin/onboarding-fields/:roleId/reorder
 * ✅ SQL MIGRATION: Now updates roles.config.onboardingFields
 */
app.put("/make-server-3dd53475/admin/onboarding-fields/:roleId/reorder", async (c) => {
  try {
    const { roleId } = c.req.param();
    const { fieldOrders } = await c.req.json(); // Array of { fieldId, displayOrder }

    console.log(`[REORDER FIELDS] Reordering fields for role: ${roleId}`);

    // ✅ SQL: Get role and existing fields
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    const fields: OnboardingField[] = onboardingFields.fields || [];

    // Update display orders
    fieldOrders.forEach((order: any) => {
      const field = fields.find(f => f.id === order.fieldId);
      if (field) {
        field.displayOrder = order.displayOrder;
        field.updatedAt = new Date().toISOString();
      }
    });

    // Sort by display order
    fields.sort((a, b) => a.displayOrder - b.displayOrder);

    // ✅ SQL: Save updated fields to role.config
    const updatedConfig = {
      ...roleConfig,
      onboardingFields: {
        ...onboardingFields,
        fields: fields,
        version: (onboardingFields.version || 0) + 1
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    console.log(`[REORDER FIELDS] ✅ Fields reordered`);

    return c.json({
      success: true,
      fields,
      message: 'Fields reordered successfully'
    });

  } catch (error) {
    console.error('[REORDER FIELDS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});



/**
 * Get onboarding form for vendor application (public endpoint)
 * GET /make-server-3dd53475/onboarding-form/:roleId
 * ✅ SQL MIGRATION: Now reads from roles.config.onboardingFields
 */
app.get("/make-server-3dd53475/onboarding-form/:roleId", async (c) => {
  try {
    const { roleId } = c.req.param();

    console.log(`[ONBOARDING FORM] Fetching form for role: ${roleId}`);

    // ✅ SQL: Get role configuration
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    // ✅ SQL: Get onboarding fields from role.config (source of truth)
    // Deleted fields are NOT in the database, so they won't appear here
    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    const allFields: OnboardingField[] = onboardingFields.fields || [];
    let activeFields = allFields.filter(f => f.isActive !== false); // Include undefined as active

    console.log(`[ONBOARDING FORM] 📋 Found ${allFields.length} total fields in DB, ${activeFields.length} active for role: ${roleId}`);

    // ✅ CRITICAL: NEVER auto-generate if fields exist in DB (even if all inactive)
    // This prevents regenerating fields that were intentionally deleted
    // Only generate if database is completely empty (new role)
    if (allFields.length === 0) {
      console.log(`[ONBOARDING FORM] ⚠️ No fields found in database for new role, generating defaults...`);
      const defaultFields = await generateDefaultFieldsFromRole(roleConfig, roleId);
      if (defaultFields.length > 0) {
        // ✅ SQL: Save generated fields to role.config
        const updatedConfig = {
          ...roleConfig,
          onboardingFields: {
            fields: defaultFields,
            version: 1
          }
        };
        await rolesRepo.setConfig(roleId, updatedConfig);
        activeFields = defaultFields.filter(f => f.isActive !== false);
        console.log(`[ONBOARDING FORM] ✅ Auto-generated ${activeFields.length} fields for new role`);
      }
    } else {
      // Fields exist in DB - use them as-is (even if all inactive)
      console.log(`[ONBOARDING FORM] ✅ Using ${activeFields.length} active fields from database (${allFields.length - activeFields.length} inactive)`);
    }

    // Group fields by section
    const sections = getSectionsFromFields(activeFields);

    return c.json({
      success: true,
      roleId,
      roleName: role.display_name || role.name,
      fields: activeFields,
      sections,
      version: onboardingFields.version || 1
    });

  } catch (error) {
    console.error('[ONBOARDING FORM] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function generateDefaultFieldsFromRole(role: any, roleId: string): Promise<OnboardingField[]> {
  const fields: OnboardingField[] = [];
  let order = 0;

  // 1. Check for New Unified Structure (Nested Sections)
  if (role.onboardingFields?.sections) {
    console.log(`[GENERATE FIELDS] Using Unified Schema (Sections)`);
    for (const section of role.onboardingFields.sections) {
      for (const field of section.fields) {
         fields.push({
           id: field.id,
           fieldName: field.name,
           label: field.label,
           type: mapFieldType(field.type),
           section: section.name,
           isMandatory: field.validation?.required || false,
           requiresDocument: field.type === 'file',
           documentLabel: field.type === 'file' ? field.label : undefined,
           placeholder: '',
           helpText: field.helpText || '',
           options: field.options || [],
           validation: field.validation || {},
           displayOrder: order++,
           isActive: field.isActive !== false,
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString()
         } as any);
      }
    }
    return fields;
  }

  // 2. Fallback: Generate Basic Business Info (Universal)
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
    } as OnboardingField);
  }

  return fields;
}

function mapFieldType(type: string): string {
  const map: Record<string, string> = {
    'text': 'text',
    'textarea': 'textarea',
    'number': 'number',
    'email': 'email',
    'tel': 'phone',
    'phone': 'phone',
    'url': 'url',
    'select': 'dropdown',
    'file': 'file',
    'date': 'date',
    'map_pin': 'coordinates'
  };
  return map[type] || 'text';
}

function getSectionsFromFields(fields: OnboardingField[]) {
  const sections: Record<string, any> = {};
  
  const sectionMeta: Record<string, any> = {
    'business_information': { title: 'Business Information', order: 1 },
    'location_information': { title: 'Location', order: 2 },
    'banking_information': { title: 'Banking Details', order: 3 },
    'document_verification': { title: 'Documents', order: 4 },
    'documents': { title: 'Documents', order: 4 },
    'additional_information': { title: 'Additional Info', order: 5 }
  };

  for (const field of fields) {
    const secKey = field.section || 'additional_information';
    if (!sections[secKey]) {
      sections[secKey] = {
        id: secKey,
        name: secKey,
        title: sectionMeta[secKey]?.title || formatTitle(secKey),
        order: sectionMeta[secKey]?.order || 99,
        fields: []
      };
    }
    sections[secKey].fields.push(field);
  }

  return Object.values(sections).sort((a: any, b: any) => a.order - b.order);
}

function formatTitle(str: string) {
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * ✅ SQL MIGRATION: Get form version from roles.config.onboardingFields.version
 */
async function getFormVersion(roleId: string): Promise<number> {
  try {
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) return 1;
    
    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    return onboardingFields.version || 1;
  } catch (error) {
    console.error('[GET VERSION] Error:', error);
    return 1;
  }
}

/**
 * ✅ SQL MIGRATION: Increment form version in roles.config.onboardingFields.version
 */
async function incrementFormVersion(roleId: string) {
  try {
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) return;
    
    const roleConfig = role.config || {};
    const onboardingFields = roleConfig.onboardingFields || {};
    const currentVersion = onboardingFields.version || 0;
    
    const updatedConfig = {
      ...roleConfig,
      onboardingFields: {
        ...onboardingFields,
        version: currentVersion + 1
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);
  } catch (error) {
    console.error('[INCREMENT VERSION] Error:', error);
  }
}

export function registerDynamicOnboarding(mainApp: Hono) {
  mainApp.route('/', app);
}