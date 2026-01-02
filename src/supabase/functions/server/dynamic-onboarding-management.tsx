import { Hono } from 'hono';
import { getRolesRepository } from '../../../../supabase/lib/repositories/roles';

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
 * Forces the onboarding fields KV to match the Role Config KV.
 * Use this when Role Config (Seed) is updated but Designer shows old fields.
 */
app.post("/make-server-3dd53475/admin/onboarding-fields/sync", async (c) => {
  try {
    console.log(`[SYNC FIELDS] Starting onboarding field sync...`);
    
    // ✅ SQL: Get all roles from repository
    const rolesRepo = getRolesRepository();
    const rolesList = await rolesRepo.findAll();
    const results: any[] = [];

    for (const roleItem of rolesList) {
      const roleId = roleItem.id || roleItem.name;
      
      // ✅ SQL: Fetch Role Config from SQL (Source of Truth)
      const role = await rolesRepo.findById(roleId);
      
      if (!role || !role.config) {
        results.push({ roleId, status: 'skipped', reason: 'No Role Config' });
        continue;
      }

      // 3. Generate Fields from Role Config
      // This converts the "Unified Schema" (Sections) into "Onboarding Designer" (Flat Fields)
      const newFields = await generateDefaultFieldsFromRole(role.config, roleId);
      
      if (newFields.length === 0) {
         results.push({ roleId, status: 'skipped', reason: 'No Fields Generated' });
         continue;
      }

      // ✅ SQL: Update onboarding fields in role.config.onboardingFields.fields
      const configVersion = role.config.onboardingFields?.version || 3;
      const updatedConfig = {
        ...role.config,
        onboardingFields: {
          ...role.config.onboardingFields,
          fields: newFields,
          version: configVersion
        }
      };
      await rolesRepo.setConfig(roleId, updatedConfig);

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
      message: 'Onboarding fields synced from Role Configs',
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
 */
app.get("/make-server-3dd53475/admin/onboarding-fields/:roleId", async (c) => {
  try {
    const { roleId } = c.req.param();
    
    console.log(`[ONBOARDING FIELDS] Fetching fields for role: ${roleId}`);

    // ✅ SQL: Get role from repository
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    // ✅ SQL: Get custom onboarding fields from role.config
    const customFields = role.config?.onboardingFields?.fields || [];

    // If no custom fields exist, create default structure from role config
    if (customFields.length === 0) {
      console.log(`[ONBOARDING FIELDS] No custom fields found, using role defaults`);
      
      const defaultFields = await generateDefaultFieldsFromRole(role.config || {}, roleId);
      
      // ✅ SQL: Save default fields to role.config
      const updatedConfig = {
        ...role.config,
        onboardingFields: {
          ...role.config?.onboardingFields,
          fields: defaultFields,
          version: role.config?.onboardingFields?.version || 1
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
      version: await getFormVersion(roleId)
    });

  } catch (error) {
    console.error('[ONBOARDING FIELDS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Create a new onboarding field
 * POST /make-server-3dd53475/admin/onboarding-fields/:roleId
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
    const existingFields: OnboardingField[] = role.config?.onboardingFields?.fields || [];

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
      ...role.config,
      onboardingFields: {
        ...role.config?.onboardingFields,
        fields: existingFields
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    // Increment version
    await incrementFormVersion(roleId);

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

    const fields: OnboardingField[] = role.config?.onboardingFields?.fields || [];
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
      ...role.config,
      onboardingFields: {
        ...role.config?.onboardingFields,
        fields
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    // Increment version
    await incrementFormVersion(roleId);

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

    const fields: OnboardingField[] = role.config?.onboardingFields?.fields || [];
    const filteredFields = fields.filter(f => f.id !== fieldId);

    if (fields.length === filteredFields.length) {
      return c.json({ error: 'Field not found' }, 404);
    }

    // ✅ SQL: Save updated fields to role.config
    const updatedConfig = {
      ...role.config,
      onboardingFields: {
        ...role.config?.onboardingFields,
        fields: filteredFields
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    // Increment version
    await incrementFormVersion(roleId);

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

    const fields: OnboardingField[] = role.config?.onboardingFields?.fields || [];

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
      ...role.config,
      onboardingFields: {
        ...role.config?.onboardingFields,
        fields
      }
    };
    await rolesRepo.setConfig(roleId, updatedConfig);

    // Increment version
    await incrementFormVersion(roleId);

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
 */
app.get("/make-server-3dd53475/onboarding-form/:roleId", async (c) => {
  try {
    const { roleId } = c.req.param();

    console.log(`[ONBOARDING FORM] Fetching form for role: ${roleId}`);

    // ✅ SQL: Get role from repository
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ error: 'Role not found' }, 404);
    }

    // ✅ SQL: Get active onboarding fields from role.config
    const allFields: OnboardingField[] = role.config?.onboardingFields?.fields || [];
    let activeFields = allFields.filter(f => f.isActive);

    // If no fields found, try to generate from role config (Auto-Healing)
    if (activeFields.length === 0) {
      console.log(`[ONBOARDING FORM] No dynamic fields found, attempting to generate from role config...`);
      const defaultFields = await generateDefaultFieldsFromRole(role.config || {}, roleId);
      if (defaultFields.length > 0) {
        // ✅ SQL: Save default fields to role.config
        const updatedConfig = {
          ...role.config,
          onboardingFields: {
            ...role.config?.onboardingFields,
            fields: defaultFields,
            version: role.config?.onboardingFields?.version || 1
          }
        };
        await rolesRepo.setConfig(roleId, updatedConfig);
        activeFields = defaultFields.filter(f => f.isActive);
        console.log(`[ONBOARDING FORM] ✅ Auto-generated ${activeFields.length} fields`);
      }
    }

    // Group fields by section
    const sections = getSectionsFromFields(activeFields);

    return c.json({
      success: true,
      roleId,
      roleName: role.display_name || role.name,
      fields: activeFields,
      sections,
      version: await getFormVersion(roleId)
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

async function getFormVersion(roleId: string): Promise<number> {
  // ✅ SQL: Get version from role.config.onboardingFields.version
  const rolesRepo = getRolesRepository();
  const role = await rolesRepo.findById(roleId);
  return role?.config?.onboardingFields?.version || 1;
}

async function incrementFormVersion(roleId: string) {
  // ✅ SQL: Increment version in role.config.onboardingFields.version
  const rolesRepo = getRolesRepository();
  const role = await rolesRepo.findById(roleId);
  if (!role) {
    throw new Error(`Role not found: ${roleId}`);
  }
  
  const currentVersion = role.config?.onboardingFields?.version || 1;
  const updatedConfig = {
    ...role.config,
    onboardingFields: {
      ...role.config?.onboardingFields,
      version: currentVersion + 1
    }
  };
  await rolesRepo.setConfig(roleId, updatedConfig);
}

export function registerDynamicOnboarding(mainApp: Hono) {
  mainApp.route('/', app);
}