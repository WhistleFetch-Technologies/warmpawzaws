/**
 * ============================================================================
 * ONBOARDING FORM API - CLEAN REWRITE
 * ============================================================================
 * 
 * Unified API for onboarding form management
 * - Simple, clean endpoints
 * - Proper versioning
 * - Full CRUD operations
 * - Clean error handling
 * 
 * Date: 2025-12-25
 * ============================================================================
 */

import { Hono } from 'npm:hono@4';
import { getDbClient } from '../../lib/db.ts';
import { getRolesRepository } from '../../lib/repositories/roles.ts';
import { requireAdminAuth } from './supabase-auth-helper.tsx';

// ============================================================================
// TYPES
// ============================================================================

interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  customMessage?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file' | 'map_pin';
  section: string;
  placeholder?: string;
  helpText?: string;
  validation?: FieldValidation;
  options?: SelectOption[];
  requiresDocument?: boolean;
  documentType?: string;
  documentLabel?: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface FormSection {
  id: string;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  fields: FormField[];
}

interface OnboardingForm {
  id: string;
  roleId: string;
  roleName: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  sections: FormSection[];
  documentSections?: FormSection[];
  metadata: {
    createdBy: string;
    createdAt: string;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
    publishedAt?: string;
    publishedBy?: string;
  };
  notes?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate default form for a role
 */
async function generateDefaultForm(roleId: string): Promise<OnboardingForm> {
  const rolesRepo = getRolesRepository();
  let roleName = roleId;
  
  try {
    const role = await rolesRepo.findById(roleId);
    if (role) {
      roleName = role.display_name || role.name || roleId;
    }
  } catch (err) {
    console.error(`[DEFAULT FORM] Error fetching role ${roleId}:`, err);
  }
  
  return {
    id: `form_${roleId}_${Date.now()}`,
    roleId,
    roleName,
    version: 1,
    status: 'draft',
    sections: [
      {
        id: 'business_information',
        name: 'business_information',
        title: 'Business Information',
        description: 'Basic business details',
        icon: 'Building',
        order: 1,
        isActive: true,
        fields: [
          {
            id: 'business_name',
            name: 'businessName',
            label: 'Business Name',
            type: 'text',
            section: 'business_information',
            placeholder: 'Enter business name',
            validation: { required: true },
            order: 1,
            isActive: true
          },
          {
            id: 'business_phone',
            name: 'businessPhone',
            label: 'Business Phone',
            type: 'tel',
            section: 'business_information',
            placeholder: '+91 1234567890',
            validation: { required: true },
            order: 2,
            isActive: true
          },
          {
            id: 'business_email',
            name: 'businessEmail',
            label: 'Business Email',
            type: 'email',
            section: 'business_information',
            placeholder: 'business@example.com',
            validation: { required: true },
            order: 3,
            isActive: true
          }
        ]
      },
      {
        id: 'address_location',
        name: 'address_location',
        title: 'Address & Location',
        description: 'Business address and location',
        icon: 'MapPin',
        order: 2,
        isActive: true,
        fields: [
          {
            id: 'address_line1',
            name: 'addressLine1',
            label: 'Address Line 1',
            type: 'text',
            section: 'address_location',
            placeholder: 'Street address',
            validation: { required: true },
            order: 1,
            isActive: true
          },
          {
            id: 'city',
            name: 'city',
            label: 'City',
            type: 'text',
            section: 'address_location',
            placeholder: 'City',
            validation: { required: true },
            order: 2,
            isActive: true
          },
          {
            id: 'pincode',
            name: 'pincode',
            label: 'Pincode',
            type: 'text',
            section: 'address_location',
            placeholder: '123456',
            validation: { required: true, pattern: '^[0-9]{6}$' },
            order: 3,
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
}

/**
 * Get latest form version for a role
 */
async function getLatestFormVersion(roleId: string): Promise<OnboardingForm | null> {
  const db = getDbClient();
  
  // Get active form
  const { data: activeForm } = await db
    .from('platform_settings')
    .select('*')
    .eq('setting_key', `onboarding:form:${roleId}:active`)
    .maybeSingle();
  
  if (activeForm?.setting_value) {
    return activeForm.setting_value as OnboardingForm;
  }
  
  // Get all version entries and find highest
  const { data: versionEntries } = await db
    .from('platform_settings')
    .select('*')
    .ilike('setting_key', `onboarding:form:${roleId}:version:%`)
    .order('updated_at', { ascending: false });
  
  if (!versionEntries || versionEntries.length === 0) {
    return null;
  }
  
  let latestForm: OnboardingForm | null = null;
  let highestVersion = 0;
  
  for (const entry of versionEntries) {
    const form = entry.setting_value as OnboardingForm;
    if (form && form.version > highestVersion) {
      highestVersion = form.version;
      latestForm = form;
    }
  }
  
  return latestForm;
}

/**
 * Save form to database
 */
async function saveForm(form: OnboardingForm, isActive: boolean = false): Promise<void> {
  const db = getDbClient();
  
  // Save to active key
  if (isActive || form.status === 'active') {
    await db
      .from('platform_settings')
      .upsert({
        setting_key: `onboarding:form:${form.roleId}:active`,
        setting_value: form,
        description: `Active onboarding form for ${form.roleName}`,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });
  }
  
  // Save version entry
  await db
    .from('platform_settings')
    .upsert({
      setting_key: `onboarding:form:${form.roleId}:version:${form.version}`,
      setting_value: form,
      description: `Version ${form.version} of onboarding form for ${form.roleName}`,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'setting_key'
    });
  
  // Update role config if active
  if (form.status === 'active') {
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(form.roleId);
    if (role) {
      await rolesRepo.update(form.roleId, {
        config: {
          ...role.config,
          onboardingForm: {
            formId: form.id,
            version: form.version,
            status: form.status
          }
        }
      });
    }
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

export function onboardingFormAPI(app: Hono) {
  // CORS handlers - MUST be simple and never throw errors
  app.options('/make-server-3dd53475/admin/onboarding-forms', (c) => {
    try {
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      c.header('Access-Control-Max-Age', '86400');
      return c.text('', 204);
    } catch (err) {
      // Fallback: just return 204 with basic CORS headers
      c.header('Access-Control-Allow-Origin', '*');
      return c.text('', 204);
    }
  });
  
  app.options('/make-server-3dd53475/admin/onboarding-forms/:roleId', (c) => {
    try {
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      c.header('Access-Control-Max-Age', '86400');
      return c.text('', 204);
    } catch (err) {
      // Fallback: just return 204 with basic CORS headers
      c.header('Access-Control-Allow-Origin', '*');
      return c.text('', 204);
    }
  });
  
  app.options('/make-server-3dd53475/vendor/onboarding-form/:roleId', (c) => {
    try {
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      c.header('Access-Control-Max-Age', '86400');
      return c.text('', 204);
    } catch (err) {
      // Fallback: just return 204 with basic CORS headers
      c.header('Access-Control-Allow-Origin', '*');
      return c.text('', 204);
    }
  });
  
  // ========================================
  // GET ALL FORMS (Admin) - Requires Auth
  // ========================================
  app.get('/make-server-3dd53475/admin/onboarding-forms', requireAdminAuth, async (c) => {
    try {
      const db = getDbClient();
      const { data } = await db
        .from('platform_settings')
        .select('*')
        .ilike('setting_key', 'onboarding:form:%:active');
      
      const forms = (data || [])
        .map((s: any) => s.setting_value)
        .filter((f: any) => f && f.roleId);
      
      return c.json({
        success: true,
        forms,
        total: forms.length
      });
    } catch (error) {
      console.error('[GET FORMS] Error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
  
  // ========================================
  // GET FORM BY ROLE (Admin) - Requires Auth
  // ========================================
  app.get('/make-server-3dd53475/admin/onboarding-forms/:roleId', requireAdminAuth, async (c) => {
    try {
      const { roleId } = c.req.param();
      
      if (!roleId) {
        return c.json({ success: false, error: 'roleId parameter is required' }, 400);
      }
      
      let form = await getLatestFormVersion(roleId);
      
      if (!form) {
        try {
          // Auto-generate default form
          form = await generateDefaultForm(roleId);
          await saveForm(form, false);
        } catch (genError) {
          console.error('[GET FORM] Error generating default form:', genError);
          // Return a minimal form structure even if generation fails
          form = {
            id: `form_${roleId}_${Date.now()}`,
            roleId,
            roleName: roleId,
            version: 1,
            status: 'draft' as const,
            sections: [],
            documentSections: [],
            metadata: {
              createdBy: 'system',
              createdAt: new Date().toISOString(),
              lastModifiedBy: 'system',
              lastModifiedAt: new Date().toISOString()
            }
          };
        }
      }
      
      // Cache control headers
      c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
      
      return c.json({
        success: true,
        form,
        isNew: !form.id.includes('_')
      });
    } catch (error) {
      console.error('[GET FORM] Error:', error);
      console.error('[GET FORM] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return c.json({ 
        success: false, 
        error: String(error),
        message: 'Failed to fetch onboarding form'
      }, 500);
    }
  });
  
  // ========================================
  // SAVE/UPDATE FORM (Admin) - Requires Auth
  // ========================================
  app.post('/make-server-3dd53475/admin/onboarding-forms/:roleId', requireAdminAuth, async (c) => {
    try {
      const { roleId } = c.req.param();
      const body = await c.req.json();
      const { sections, status, notes } = body;
      
      if (!sections || !Array.isArray(sections)) {
        return c.json({ success: false, error: 'Sections array is required' }, 400);
      }
      
      // Get existing form to determine next version
      const existingForm = await getLatestFormVersion(roleId);
      const nextVersion = existingForm ? existingForm.version + 1 : 1;
      
      // Get role info
      const rolesRepo = getRolesRepository();
      let roleName = roleId;
      try {
        const role = await rolesRepo.findById(roleId);
        if (role) {
          roleName = role.display_name || role.name || roleId;
        }
      } catch (err) {
        console.error(`[SAVE FORM] Error fetching role ${roleId}:`, err);
      }
      
      // Generate document sections
      const documentSections: FormSection[] = [];
      const documentFields: FormField[] = [];
      
      sections.forEach((section: FormSection) => {
        section.fields.forEach((field: FormField) => {
          if (field.requiresDocument && field.isActive) {
            documentFields.push({
              id: `doc_${field.id}`,
              name: `${field.name}_document`,
              label: field.documentLabel || `${field.label} - Document`,
              type: 'file',
              section: 'documents',
              validation: { required: field.validation?.required || false },
              acceptedFileTypes: field.acceptedFileTypes || ['image/*', 'application/pdf'],
              maxFileSize: field.maxFileSize || 5,
              documentType: field.documentType || field.name,
              order: field.order,
              isActive: true
            });
          }
        });
      });
      
      if (documentFields.length > 0) {
        documentSections.push({
          id: 'documents_section',
          name: 'documents',
          title: 'Document Verification',
          description: 'Upload required documents',
          icon: 'FileText',
          order: 1000,
          isActive: true,
          fields: documentFields
        });
      }
      
      // Create form object
      const form: OnboardingForm = {
        id: existingForm?.id || `form_${roleId}_${Date.now()}`,
        roleId,
        roleName,
        version: nextVersion,
        status: status || 'draft',
        sections: sections.map((s: FormSection, index: number) => ({
          ...s,
          order: s.order ?? index,
          isActive: s.isActive !== false,
          fields: s.fields.map((f: FormField, fIndex: number) => ({
            ...f,
            order: f.order ?? fIndex,
            isActive: f.isActive !== false,
            createdAt: f.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }))
        })),
        documentSections,
        metadata: {
          createdBy: existingForm?.metadata?.createdBy || 'admin',
          createdAt: existingForm?.metadata?.createdAt || new Date().toISOString(),
          lastModifiedBy: 'admin',
          lastModifiedAt: new Date().toISOString(),
          ...(status === 'active' && {
            publishedAt: new Date().toISOString(),
            publishedBy: 'admin'
          })
        },
        notes
      };
      
      // Save form
      await saveForm(form, status === 'active');
      
      // Verify save
      const savedForm = await getLatestFormVersion(roleId);
      if (!savedForm || savedForm.version !== form.version) {
        return c.json({ 
          success: false, 
          error: 'Failed to verify form save' 
        }, 500);
      }
      
      return c.json({
        success: true,
        form: savedForm,
        message: `Form saved successfully (version ${savedForm.version})`
      });
    } catch (error) {
      console.error('[SAVE FORM] Error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
  
  // ========================================
  // PUBLISH FORM (Admin)
  // ========================================
  app.post('/make-server-3dd53475/admin/onboarding-forms/:roleId/publish', requireAdminAuth, async (c) => {
    try {
      const { roleId } = c.req.param();
      
      const form = await getLatestFormVersion(roleId);
      if (!form) {
        return c.json({ success: false, error: 'Form not found' }, 404);
      }
      
      form.status = 'active';
      form.metadata.publishedAt = new Date().toISOString();
      form.metadata.publishedBy = 'admin';
      
      await saveForm(form, true);
      
      return c.json({
        success: true,
        form,
        message: 'Form published successfully'
      });
    } catch (error) {
      console.error('[PUBLISH FORM] Error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
  
  // ========================================
  // GET ACTIVE FORM (Vendor)
  // ========================================
  app.get('/make-server-3dd53475/vendor/onboarding-form/:roleId', async (c) => {
    try {
      const { roleId } = c.req.param();
      
      const db = getDbClient();
      const { data } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `onboarding:form:${roleId}:active`)
        .maybeSingle();
      
      let form: OnboardingForm | null = null;
      
      if (data?.setting_value) {
        form = data.setting_value as OnboardingForm;
        if (form.status !== 'active') {
          return c.json({
            success: false,
            error: 'No active form available for this role'
          }, 404);
        }
      } else {
        // Auto-generate and save default form
        form = await generateDefaultForm(roleId);
        form.status = 'active';
        await saveForm(form, true);
      }
      
      // Cache control
      c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
      
      return c.json({
        success: true,
        form,
        autoGenerated: !data
      });
    } catch (error) {
      console.error('[GET VENDOR FORM] Error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
  
  // ========================================
  // ARCHIVE FORM (Admin)
  // ========================================
  app.post('/make-server-3dd53475/admin/onboarding-forms/:roleId/archive', requireAdminAuth, async (c) => {
    try {
      const { roleId } = c.req.param();
      
      const form = await getLatestFormVersion(roleId);
      if (!form) {
        return c.json({ success: false, error: 'Form not found' }, 404);
      }
      
      form.status = 'archived';
      await saveForm(form, false);
      
      return c.json({
        success: true,
        form,
        message: 'Form archived successfully'
      });
    } catch (error) {
      console.error('[ARCHIVE FORM] Error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
  
  console.log('✅ Onboarding Form API registered');
}

