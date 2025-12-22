import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Get custom fields for a role
app.get('/admin/onboarding-fields/:roleId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    
    const fields = await kv.get(`onboarding_fields:${roleId}`);
    
    return c.json({
      success: true,
      fields: fields || []
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

    // Get existing fields
    const existingFields = await kv.get(`onboarding_fields:${roleId}`) || [];
    
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
    
    // Save updated fields
    await kv.set(`onboarding_fields:${roleId}`, updatedFields);

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
app.delete('/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const fieldId = c.req.param('fieldId');

    // Get existing fields
    const existingFields = await kv.get(`onboarding_fields:${roleId}`) || [];
    
    // Remove the field
    const updatedFields = existingFields.filter((f: any) => f.id !== fieldId);
    
    // Save updated fields
    await kv.set(`onboarding_fields:${roleId}`, updatedFields);

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

    // Save reordered fields
    await kv.set(`onboarding_fields:${roleId}`, fields);

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
    // Maintain a schema registry for easy access
    const schemaKey = `onboarding_schema:${roleId}`;
    const schema = await kv.get(schemaKey) || { fields: {}, documentFields: [] };
    
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

    await kv.set(schemaKey, schema);
  } catch (error) {
    console.error('Error updating field schema:', error);
  }
}

export default app;
