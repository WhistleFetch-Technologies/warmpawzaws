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
   * GET /admin/onboarding-fields/:roleId
   * Get all onboarding fields for a specific role
   */
  app.get('/admin/onboarding-fields/:roleId', async (c) => {
    try {
      const { roleId } = c.req.param();

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

      // Get role configuration
      const roles = await select('roles', { name: roleId });
      if (roles.length === 0) {
        return c.json({ error: 'Role not found' }, 404);
      }
      const role = roles[0];

      // Get custom onboarding fields configuration
      const forms = await select('onboarding_forms', { role_id: roleId });
      let fields: any[] = [];

      if (forms.length > 0) {
        // Parse JSONB fields
        fields = typeof forms[0].fields === 'string' 
          ? JSON.parse(forms[0].fields) 
          : forms[0].fields || [];
      }

      // If no fields found, return empty array (frontend will use default)
      if (fields.length === 0) {
        return c.json({
          success: true,
          roleId,
          roleName: role.display_name || role.name,
          fields: [],
          sections: [],
          version: 1,
        });
      }

      // Group fields by section
      const sections = getSectionsFromFields(fields);

      return c.json({
        success: true,
        roleId,
        roleName: role.display_name || role.name,
        fields,
        sections,
        version: await getFormVersion(roleId),
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

      // Validate role exists
      const roles = await select('roles', { name: roleId });
      if (roles.length === 0) {
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

      // Get role configuration
      const roles = await select('roles', { name: roleId });
      if (roles.length === 0) {
        return c.json({ error: 'Role not found' }, 404);
      }
      const role = roles[0];

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
   * POST /admin/onboarding-fields/sync
   * Sync onboarding fields from role configs (healing/migration endpoint)
   */
  app.post('/admin/onboarding-fields/sync', async (c) => {
    try {
      // Get all roles
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
              reason: 'Use /admin/roles/seed to create forms',
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
