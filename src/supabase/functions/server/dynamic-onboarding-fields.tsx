// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getRolesRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

// Get custom fields for a role
app.get('/admin/onboarding-fields/:roleId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    
    // ✅ SQL: Get onboarding fields from roles.config or onboarding_fields table
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    const fields = role?.config?.onboardingFields || role?.onboardingFields || [];
    
    return c.json({
      success: true,
      fields: Array.isArray(fields) ? fields : []
    });
  } catch (error) {
    console.error('Error fetching custom onboarding fields:', error);
    return c.json({ success: false, message: 'Failed to fetch fields', error: String(error) }, 500);
  }
});

// Create or update a custom field
app.post('/admin/onboarding-fields/:roleId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const body = await c.req.json();
    const { field, action } = body;

    if (!field || !field.fieldName || !field.fieldLabel) {
      return c.json({ success: false, message: 'Field name and label are required' }, 400);
    }

    // ✅ SQL: Get existing fields from role config
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ success: false, message: 'Role not found' }, 404);
    }
    
    const existingFields = role.config?.onboardingFields || role.onboardingFields || [];
    
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
    
    // ✅ SQL: Save updated fields to role config
    await rolesRepo.update(roleId, {
      config: {
        ...(role.config || {}),
        onboardingFields: updatedFields
      }
    });

    // ✅ SQL: Update field schema registry
    await updateFieldSchema(roleId, field, updatedFields);

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
app.delete('/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const fieldId = c.req.param('fieldId');

    // ✅ SQL: Get existing fields and remove field
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ success: false, message: 'Role not found' }, 404);
    }
    
    const existingFields = role.config?.onboardingFields || role.onboardingFields || [];
    const updatedFields = existingFields.filter((f: any) => f.id !== fieldId);
    
    // ✅ SQL: Save updated fields to role config
    await rolesRepo.update(roleId, {
      config: {
        ...(role.config || {}),
        onboardingFields: updatedFields
      }
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
app.post('/admin/onboarding-fields/:roleId/reorder', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const body = await c.req.json();
    const { fields } = body;

    if (!fields || !Array.isArray(fields)) {
      return c.json({ success: false, message: 'Fields array is required' }, 400);
    }

    // ✅ SQL: Save reordered fields to role config
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) {
      return c.json({ success: false, message: 'Role not found' }, 404);
    }
    
    await rolesRepo.update(roleId, {
      config: {
        ...(role.config || {}),
        onboardingFields: fields
      }
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

// ✅ SQL: Helper function to update field schema registry in role config
async function updateFieldSchema(roleId: string, field: any, allFields?: any[]) {
  try {
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) return;
    
    const schema = role.config?.onboardingSchema || { fields: {}, documentFields: [] };
    
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

    // ✅ SQL: Save schema to role config
    await rolesRepo.update(roleId, {
      config: {
        ...(role.config || {}),
        onboardingSchema: schema,
        onboardingFields: allFields || role.config?.onboardingFields || []
      }
    });
  } catch (error) {
    console.error('Error updating field schema:', error);
  }
}

export default app;
