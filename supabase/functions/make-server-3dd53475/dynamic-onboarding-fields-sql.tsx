/**
 * ============================================================================
 * DYNAMIC ONBOARDING FIELDS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Custom onboarding field management:
 * - Get custom fields for a role
 * - Create or update custom field
 * - Delete custom field
 * - Reorder fields
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `platform_settings` or `configurations` table for onboarding fields
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 8)
 * KV Operations Removed: 8
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();

// Get custom fields for a role
app.get('/make-server-3dd53475/admin/onboarding-fields/:roleId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    
    // ✅ SQL: Get onboarding fields from platform_settings or configurations
    const { data: setting, error } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `onboarding_fields:${roleId}`)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching custom onboarding fields:', error);
      return c.json({ success: false, message: 'Failed to fetch fields', error: String(error) }, 500);
    }
    
    const fields = setting?.setting_value || [];
    
    return c.json({
      success: true,
      fields: fields
    });
  } catch (error) {
    console.error('Error fetching custom onboarding fields:', error);
    return c.json({ success: false, message: 'Failed to fetch fields', error: String(error) }, 500);
  }
});

// Create or update a custom field
app.post('/make-server-3dd53475/admin/onboarding-fields/:roleId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const body = await c.req.json();
    const { field, action } = body;

    if (!field || !field.fieldName || !field.fieldLabel) {
      return c.json({ success: false, message: 'Field name and label are required' }, 400);
    }

    // ✅ SQL: Get existing fields
    const { data: existingSetting } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `onboarding_fields:${roleId}`)
      .maybeSingle();
    
    const existingFields = existingSetting?.setting_value || [];
    
    let updatedFields;
    
    if (action === 'update') {
      // Update existing field
      updatedFields = existingFields.map((f: any) => 
        f.id === field.id ? field : f
      );
    } else {
      // Add new field
      updatedFields = [...existingFields, field];
    }
    
    // ✅ SQL: Save updated fields
    await db
      .from('platform_settings')
      .upsert({
        setting_key: `onboarding_fields:${roleId}`,
        setting_value: updatedFields,
        is_public: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    // Also maintain a schema registry for dynamic form generation
    await updateFieldSchema(roleId, field);

    return c.json({
      success: true,
      message: action === 'update' ? 'Field updated successfully' : 'Field created successfully',
      fields: updatedFields
    });
  } catch (error) {
    console.error('Error saving custom onboarding field:', error);
    return c.json({ success: false, message: 'Failed to save field', error: String(error) }, 500);
  }
});

// Delete a custom field
app.delete('/make-server-3dd53475/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const fieldId = c.req.param('fieldId');

    // ✅ SQL: Get existing fields
    const { data: existingSetting } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `onboarding_fields:${roleId}`)
      .maybeSingle();
    
    const existingFields = existingSetting?.setting_value || [];
    
    // Remove the field
    const updatedFields = existingFields.filter((f: any) => f.id !== fieldId);
    
    // ✅ SQL: Save updated fields
    await db
      .from('platform_settings')
      .upsert({
        setting_key: `onboarding_fields:${roleId}`,
        setting_value: updatedFields,
        is_public: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    return c.json({
      success: true,
      message: 'Field deleted successfully',
      fields: updatedFields
    });
  } catch (error) {
    console.error('Error deleting custom onboarding field:', error);
    return c.json({ success: false, message: 'Failed to delete field', error: String(error) }, 500);
  }
});

// Reorder fields
app.post('/make-server-3dd53475/admin/onboarding-fields/:roleId/reorder', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const body = await c.req.json();
    const { fields } = body;

    if (!fields || !Array.isArray(fields)) {
      return c.json({ success: false, message: 'Fields array is required' }, 400);
    }

    // ✅ SQL: Save reordered fields
    await db
      .from('platform_settings')
      .upsert({
        setting_key: `onboarding_fields:${roleId}`,
        setting_value: fields,
        is_public: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    return c.json({
      success: true,
      message: 'Field order updated successfully',
      fields
    });
  } catch (error) {
    console.error('Error reordering custom onboarding fields:', error);
    return c.json({ success: false, message: 'Failed to reorder fields', error: String(error) }, 500);
  }
});

// Helper function to update field schema registry
async function updateFieldSchema(roleId: string, field: any) {
  try {
    // ✅ SQL: Maintain a schema registry for easy access
    const schemaKey = `onboarding_schema:${roleId}`;
    
    const { data: existingSchema } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', schemaKey)
      .maybeSingle();
    
    const schema = existingSchema?.setting_value || { fields: {}, documentFields: [] };
    
    // Add field to schema
    schema.fields[field.fieldName] = {
      type: field.fieldType,
      label: field.fieldLabel,
      required: field.isMandatory,
      placeholder: field.placeholder,
      options: field.selectOptions
    };

    // Track document fields separately
    if (field.requiresDocument) {
      const docField = {
        fieldName: field.fieldName,
        documentLabel: field.documentLabel
      };
      
      const existingDocIndex = schema.documentFields.findIndex(
        (d: any) => d.fieldName === field.fieldName
      );
      
      if (existingDocIndex >= 0) {
        schema.documentFields[existingDocIndex] = docField;
      } else {
        schema.documentFields.push(docField);
      }
    }

    // ✅ SQL: Save schema
    await db
      .from('platform_settings')
      .upsert({
        setting_key: schemaKey,
        setting_value: schema,
        is_public: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });
  } catch (error) {
    console.error('Error updating field schema:', error);
  }
}

export default app;

