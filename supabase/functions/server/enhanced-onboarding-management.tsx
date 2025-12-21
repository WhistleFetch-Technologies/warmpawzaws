import { Hono } from 'npm:hono';

/**
 * ========================================
 * ENHANCED ONBOARDING FORM MANAGEMENT
 * ========================================
 * 
 * Comprehensive onboarding form builder and management system
 * 
 * Features:
 * - Section-based form management (Business Info, Address, Documents)
 * - Field-level configuration (type, validation, mandatory, etc.)
 * - Dynamic document requirements based on form fields
 * - Version control for form changes
 * - Preview and test capabilities
 * - No changes to role configuration needed
 * - Seamless integration with vendor onboarding APIs
 * 
 * Production-grade, enterprise-ready implementation
 */

export function enhancedOnboardingManagement(app: Hono, kv: any) {
  
  // ========================================
  // FORM CONFIGURATION STRUCTURE
  // ========================================
  
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
    name: string; // Field key in form data
    label: string; // Display label
    type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file';
    section: 'business_information' | 'address_location' | 'documents' | 'custom';
    placeholder?: string;
    helpText?: string;
    validation?: FieldValidation;
    options?: SelectOption[]; // For select, multiselect, radio
    requiresDocument?: boolean;
    documentType?: string; // Type of document to upload
    documentLabel?: string; // Label for document upload
    acceptedFileTypes?: string[]; // e.g., ['image/*', 'application/pdf']
    maxFileSize?: number; // in MB
    conditionalRender?: {
      field: string; // Field name to check
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    };
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
    documentSections: FormSection[]; // Auto-generated based on requiresDocument fields
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
  
  // ========================================
  // GET ALL ONBOARDING FORMS
  // ========================================
  
  /**
   * Get all onboarding forms (with filters)
   * GET /make-server-3dd53475/admin/onboarding-forms
   */
  app.get("/make-server-3dd53475/admin/onboarding-forms", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const status = c.req.query('status');
      
      console.log('[GET FORMS] Fetching onboarding forms', { roleId, status });
      
      // Get all form configurations
      const allForms = await kv.getByPrefix('onboarding:form:');
      
      let forms = allForms.filter((f: any) => f.id && f.roleId);
      
      // Apply filters
      if (roleId) {
        forms = forms.filter((f: any) => f.roleId === roleId);
      }
      
      if (status) {
        forms = forms.filter((f: any) => f.status === status);
      }
      
      // Sort by lastModifiedAt (newest first)
      forms.sort((a: any, b: any) => {
        const dateA = new Date(a.metadata?.lastModifiedAt || a.metadata?.createdAt || 0);
        const dateB = new Date(b.metadata?.lastModifiedAt || b.metadata?.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log(`[GET FORMS] ✅ Found ${forms.length} forms`);
      
      return c.json({
        success: true,
        forms,
        total: forms.length
      });
      
    } catch (error) {
      console.error('[GET FORMS] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ========================================
  // GET ONBOARDING FORM BY ROLE
  // ========================================
  
  /**
   * Get active onboarding form for a role
   * GET /make-server-3dd53475/admin/onboarding-forms/:roleId
   */
  app.get("/make-server-3dd53475/admin/onboarding-forms/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log('[GET FORM] Fetching form for role:', roleId);
      
      // STEP 1: Check for enhanced form (new system)
      const formKey = `onboarding:form:${roleId}:active`;
      let enhancedForm = await kv.get(formKey);
      
      if (enhancedForm) {
        console.log('[GET FORM] ✅ Enhanced form found:', enhancedForm.id);
        console.log('[GET FORM] 📋 Version:', enhancedForm.version, 'Status:', enhancedForm.status);
        
        // Add no-cache headers to prevent frontend caching
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        c.header('Pragma', 'no-cache');
        c.header('Expires', '0');
        
        return c.json({
          success: true,
          form: enhancedForm,
          isNew: false
        });
      }
      
      // STEP 2: No form exists - auto-generate default active form for this role
      console.log('[GET FORM] No enhanced form found, auto-generating default active form...');
      
      const autoGeneratedForm = generateDefaultActiveForm(roleId);
      
      // Save the auto-generated form
      await kv.set(formKey, autoGeneratedForm);
      await kv.set(`onboarding:form:${roleId}:version:${autoGeneratedForm.version}`, autoGeneratedForm);
      
      console.log('[GET FORM] ✅ Auto-generated active form:', autoGeneratedForm.id);
      console.log('[GET FORM] 📋 Version:', autoGeneratedForm.version, 'Status:', autoGeneratedForm.status);
      
      // Add no-cache headers
      c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
      
      return c.json({
        success: true,
        form: autoGeneratedForm,
        isNew: true,
        autoGenerated: true
      });
      
    } catch (error) {
      console.error('[GET FORM] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ========================================
  // CREATE OR UPDATE ONBOARDING FORM
  // ========================================
  
  /**
   * Create or update onboarding form
   * POST /make-server-3dd53475/admin/onboarding-forms/:roleId
   */
  app.post("/make-server-3dd53475/admin/onboarding-forms/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const { sections, status, notes, adminName } = await c.req.json();
      
      console.log('[SAVE FORM] Saving form for role:', roleId);
      console.log('[SAVE FORM] Sections count:', sections?.length);
      console.log('[SAVE FORM] Status:', status);
      
      // Validate sections
      if (!sections || !Array.isArray(sections)) {
        return c.json({ error: 'Sections array is required' }, 400);
      }
      
      // Get existing form or create new
      const existingForm = await kv.get(`onboarding:form:${roleId}:active`);
      
      // Auto-generate document sections based on fields with requiresDocument
      const documentSections: FormSection[] = [];
      const documentFields: FormField[] = [];
      
      sections.forEach((section: FormSection) => {
        section.fields.forEach((field: FormField) => {
          if (field.requiresDocument && field.isActive) {
            documentFields.push({
              id: `doc_${field.id}`,
              name: `${field.name}_document`,
              label: field.documentLabel || `${field.label} - Supporting Document`,
              type: 'file' as const,
              section: 'documents' as const,
              placeholder: `Upload ${field.documentLabel || field.label}`,
              helpText: `Please upload supporting document for ${field.label}`,
              validation: {
                required: field.validation?.required || false
              },
              acceptedFileTypes: field.acceptedFileTypes || ['image/*', 'application/pdf'],
              maxFileSize: field.maxFileSize || 5,
              documentType: field.documentType || field.name,
              order: field.order,
              isActive: true
            });
          }
        });
      });
      
      // Group document fields into sections
      if (documentFields.length > 0) {
        documentSections.push({
          id: 'documents_section',
          name: 'documents',
          title: 'Document Verification',
          description: 'Upload required supporting documents',
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
        roleName: existingForm?.roleName || roleId,
        version: existingForm ? existingForm.version + 1 : 1,
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
          createdBy: existingForm?.metadata?.createdBy || adminName || 'admin',
          createdAt: existingForm?.metadata?.createdAt || new Date().toISOString(),
          lastModifiedBy: adminName || 'admin',
          lastModifiedAt: new Date().toISOString(),
          ...(status === 'active' && {
            publishedAt: new Date().toISOString(),
            publishedBy: adminName || 'admin'
          })
        },
        notes
      };
      
      // Save form
      await kv.set(`onboarding:form:${roleId}:active`, form);
      await kv.set(`onboarding:form:${roleId}:version:${form.version}`, form);
      
      // If status is active, update the role's onboarding reference
      if (status === 'active') {
        const role = await kv.get(`role:config:${roleId}`);
        if (role) {
          role.onboardingFormId = form.id;
          role.onboardingFormVersion = form.version;
          role.updatedAt = new Date().toISOString();
          await kv.set(`role:config:${roleId}`, role);
          console.log('[SAVE FORM] ✅ Updated role reference');
        }
      }
      
      console.log('[SAVE FORM] ✅ Form saved:', form.id, 'Version:', form.version);
      
      return c.json({
        success: true,
        form,
        message: status === 'active' 
          ? 'Form published successfully and is now active for vendor onboarding'
          : 'Form saved as draft successfully'
      });
      
    } catch (error) {
      console.error('[SAVE FORM] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ========================================
  // GET FORM FOR VENDOR ONBOARDING
  // ========================================
  
  /**
   * Get active form for vendor onboarding (public-facing)
   * GET /make-server-3dd53475/vendor/onboarding-form/:roleId
   */
  app.get("/make-server-3dd53475/vendor/onboarding-form/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log('\\n🚀 ========== VENDOR ONBOARDING FORM REQUEST ==========');
      console.log('[VENDOR FORM] Timestamp:', new Date().toISOString());
      console.log('[VENDOR FORM] Method:', c.req.method);
      console.log('[VENDOR FORM] Full URL:', c.req.url);
      console.log('[VENDOR FORM] Path:', new URL(c.req.url).pathname);
      console.log('[VENDOR FORM] Role ID from param:', roleId);
      console.log('[VENDOR FORM] Headers:', {
        'content-type': c.req.header('content-type'),
        'authorization': c.req.header('authorization') ? 'Bearer ***' : 'NONE',
        'origin': c.req.header('origin'),
        'user-agent': c.req.header('user-agent')
      });
      console.log('========================================================\\n');
      
      // Get active form
      console.log('[VENDOR FORM] Checking KV for key:', `onboarding:form:${roleId}:active`);
      let form = await kv.get(`onboarding:form:${roleId}:active`);
      
      if (!form) {
        console.log('[VENDOR FORM] ⚠️ No form found in KV store');
      } else {
        console.log('[VENDOR FORM] ✓ Found form:', { id: form.id, status: form.status, version: form.version });
      }
      
      if (!form || form.status !== 'active') {
        console.log('[VENDOR FORM] No active form found, auto-generating...');
        
        // Auto-generate a default active form
        const autoGeneratedForm = generateDefaultActiveForm(roleId);
        
        console.log('[VENDOR FORM] Generated form:', {
          id: autoGeneratedForm.id,
          roleId: autoGeneratedForm.roleId,
          version: autoGeneratedForm.version,
          sectionsCount: autoGeneratedForm.sections.length
        });
        
        // Save the auto-generated form
        console.log('[VENDOR FORM] Saving to KV...');
        await kv.set(`onboarding:form:${roleId}:active`, autoGeneratedForm);
        await kv.set(`onboarding:form:${roleId}:version:${autoGeneratedForm.version}`, autoGeneratedForm);
        
        console.log('[VENDOR FORM] ✅ Auto-generated active form saved:', autoGeneratedForm.id);
        
        // Return the auto-generated form
        return c.json({
          success: true,
          form: autoGeneratedForm,
          autoGenerated: true
        });
      }
      
      // Filter only active sections and fields
      console.log('[VENDOR FORM] Filtering active sections and fields...');
      const activeSections = form.sections
        .filter((s: FormSection) => s.isActive)
        .map((s: FormSection) => ({
          ...s,
          fields: s.fields.filter((f: FormField) => f.isActive)
        }))
        .filter((s: FormSection) => s.fields.length > 0);
      
      const activeDocumentSections = form.documentSections
        .filter((s: FormSection) => s.isActive)
        .map((s: FormSection) => ({
          ...s,
          fields: s.fields.filter((f: FormField) => f.isActive)
        }))
        .filter((s: FormSection) => s.fields.length > 0);
      
      console.log('[VENDOR FORM] Active sections:', activeSections.length);
      console.log('[VENDOR FORM] Active document sections:', activeDocumentSections.length);
      console.log('[VENDOR FORM] ✅ Returning active form:', form.id);
      
      return c.json({
        success: true,
        form: {
          ...form,
          sections: activeSections,
          documentSections: activeDocumentSections
        }
      });
      
    } catch (error) {
      console.error('[VENDOR FORM] ❌ ERROR:', error);
      console.error('[VENDOR FORM] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return c.json({ 
        success: false,
        error: String(error),
        errorDetails: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : null
      }, 500);
    }
  });
  
  // ========================================
  // DELETE FORM FIELD
  // ========================================
  
  /**
   * Delete a field from a form
   * DELETE /make-server-3dd53475/admin/onboarding-forms/:roleId/fields/:fieldId
   */
  app.delete("/make-server-3dd53475/admin/onboarding-forms/:roleId/fields/:fieldId", async (c) => {
    try {
      const { roleId, fieldId } = c.req.param();
      
      console.log('[DELETE FIELD] Deleting field:', fieldId, 'from role:', roleId);
      
      const form = await kv.get(`onboarding:form:${roleId}:active`);
      
      if (!form) {
        return c.json({ error: 'Form not found' }, 404);
      }
      
      // Find and remove field
      let fieldFound = false;
      form.sections = form.sections.map((section: FormSection) => ({
        ...section,
        fields: section.fields.filter((field: FormField) => {
          if (field.id === fieldId) {
            fieldFound = true;
            return false;
          }
          return true;
        })
      }));
      
      if (!fieldFound) {
        return c.json({ error: 'Field not found' }, 404);
      }
      
      // Update form
      form.metadata.lastModifiedAt = new Date().toISOString();
      form.version += 1;
      
      await kv.set(`onboarding:form:${roleId}:active`, form);
      
      console.log('[DELETE FIELD] ✅ Field deleted successfully');
      
      return c.json({
        success: true,
        message: 'Field deleted successfully',
        form
      });
      
    } catch (error) {
      console.error('[DELETE FIELD] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ========================================
  // ARCHIVE FORM
  // ========================================
  
  /**
   * Archive a form
   * POST /make-server-3dd53475/admin/onboarding-forms/:roleId/archive
   */
  app.post("/make-server-3dd53475/admin/onboarding-forms/:roleId/archive", async (c) => {
    try {
      const { roleId } = c.req.param();
      const { adminName } = await c.req.json();
      
      console.log('[ARCHIVE FORM] Archiving form for role:', roleId);
      
      const form = await kv.get(`onboarding:form:${roleId}:active`);
      
      if (!form) {
        return c.json({ error: 'Form not found' }, 404);
      }
      
      form.status = 'archived';
      form.metadata.lastModifiedBy = adminName || 'admin';
      form.metadata.lastModifiedAt = new Date().toISOString();
      
      await kv.set(`onboarding:form:${roleId}:active`, form);
      await kv.set(`onboarding:form:${roleId}:archived:${Date.now()}`, form);
      
      console.log('[ARCHIVE FORM] ✅ Form archived successfully');
      
      return c.json({
        success: true,
        message: 'Form archived successfully'
      });
      
    } catch (error) {
      console.error('[ARCHIVE FORM] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ========================================
  // BULK MIGRATE ALL ROLES
  // ========================================
  
  /**
   * Migrate all roles to enhanced onboarding forms
   * POST /make-server-3dd53475/admin/onboarding-forms/migrate-all
   */
  app.post("/make-server-3dd53475/admin/onboarding-forms/migrate-all", async (c) => {
    try {
      console.log('[BULK MIGRATE] Starting bulk migration...');
      
      // Get all roles
      const roles = await kv.getByPrefix('role:config:');
      console.log('[BULK MIGRATE] Found roles:', roles.length);
      
      const results = [];
      
      for (const role of roles) {
        try {
          const roleId = role.id;
          console.log(`[BULK MIGRATE] Processing role: ${roleId}`);
          
          // Check if enhanced form already exists
          const existingForm = await kv.get(`onboarding:form:${roleId}:active`);
          
          if (existingForm) {
            console.log(`[BULK MIGRATE] ✓ Form already exists for ${roleId}`);
            results.push({
              roleId,
              status: 'skipped',
              message: 'Form already exists'
            });
            continue;
          }
          
          // Check for legacy config
          const legacyConfig = await kv.get(`onboarding:config:${roleId}`);
          
          if (!legacyConfig && !role) {
            console.log(`[BULK MIGRATE] ⚠ No legacy data for ${roleId}, creating default`);
          }
          
          // Migrate
          const migratedForm = migrateLegacyToEnhanced(roleId, role, legacyConfig);
          
          // Save
          await kv.set(`onboarding:form:${roleId}:active`, migratedForm);
          
          console.log(`[BULK MIGRATE] ✅ Migrated ${roleId}`);
          results.push({
            roleId,
            status: 'migrated',
            formId: migratedForm.id,
            version: migratedForm.version
          });
          
        } catch (roleError) {
          console.error(`[BULK MIGRATE] ❌ Error migrating ${role.id}:`, roleError);
          results.push({
            roleId: role.id,
            status: 'error',
            error: String(roleError)
          });
        }
      }
      
      console.log('[BULK MIGRATE] ✅ Bulk migration complete');
      
      return c.json({
        success: true,
        message: 'Bulk migration complete',
        results,
        summary: {
          total: roles.length,
          migrated: results.filter(r => r.status === 'migrated').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          errors: results.filter(r => r.status === 'error').length
        }
      });
      
    } catch (error) {
      console.error('[BULK MIGRATE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ========================================
  // GET FORM VERSIONS
  // ========================================
  
  /**
   * Get all versions of a form
   * GET /make-server-3dd53475/admin/onboarding-forms/:roleId/versions
   */
  app.get("/make-server-3dd53475/admin/onboarding-forms/:roleId/versions", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log('[GET VERSIONS] Fetching versions for role:', roleId);
      
      const allVersions = await kv.getByPrefix(`onboarding:form:${roleId}:version:`);
      
      // Sort by version number (newest first)
      allVersions.sort((a: any, b: any) => b.version - a.version);
      
      console.log('[GET VERSIONS] ✅ Found versions:', allVersions.length);
      
      return c.json({
        success: true,
        versions: allVersions,
        total: allVersions.length
      });
      
    } catch (error) {
      console.error('[GET VERSIONS] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  
  /**
   * Convert role configuration fields to new section format
   */
  function convertRoleFieldsToSections(role: any): FormSection[] {
    const sections: FormSection[] = [];
    
    // Business Information section
    if (role.onboardingFields?.business) {
      sections.push({
        id: 'business_information',
        name: 'business_information',
        title: 'Business Information',
        description: 'Basic business and owner information',
        icon: 'Building',
        order: 1,
        isActive: true,
        fields: Object.keys(role.onboardingFields.business).map((key, index) => ({
          id: `business_${key}`,
          name: key,
          label: formatLabel(key),
          type: inferFieldType(key),
          section: 'business_information' as const,
          validation: { required: true },
          order: index,
          isActive: true
        }))
      });
    }
    
    // Address & Location section
    if (role.onboardingFields?.address) {
      sections.push({
        id: 'address_location',
        name: 'address_location',
        title: 'Address & Location',
        description: 'Business address and location details',
        icon: 'MapPin',
        order: 2,
        isActive: true,
        fields: Object.keys(role.onboardingFields.address).map((key, index) => ({
          id: `address_${key}`,
          name: key,
          label: formatLabel(key),
          type: inferFieldType(key),
          section: 'address_location' as const,
          validation: { required: true },
          order: index,
          isActive: true
        }))
      });
    }
    
    return sections;
  }
  
  function formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  function inferFieldType(key: string): FormField['type'] {
    const lowerKey = key.toLowerCase();
    
    if (lowerKey.includes('email')) return 'email';
    if (lowerKey.includes('phone') || lowerKey.includes('mobile')) return 'tel';
    if (lowerKey.includes('pincode') || lowerKey.includes('zip')) return 'number';
    if (lowerKey.includes('description') || lowerKey.includes('about')) return 'textarea';
    
    return 'text';
  }
  
  // ========================================
  // MIGRATION HELPER
  // ========================================
  
  /**
   * Migrates legacy onboarding config to enhanced format
   */
  function migrateLegacyToEnhanced(roleId: string, role: any, legacyConfig: any): any {
    const sections: any[] = [];
    let fieldOrder = 0;
    
    // Business Information Section
    const businessFields: any[] = [];
    
    // Standard business fields
    const standardBusinessFields = [
      { name: 'businessName', label: 'Business Name', type: 'text', required: true },
      { name: 'ownerName', label: 'Owner Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'yearsOfExperience', label: 'Years of Experience', type: 'number', required: false },
      { name: 'licenseNumber', label: 'License Number', type: 'text', required: false },
      { name: 'gstNumber', label: 'GST Number', type: 'text', required: false }
    ];
    
    standardBusinessFields.forEach(field => {
      businessFields.push({
        id: `field_${field.name}_${Date.now()}_${fieldOrder}`,
        name: field.name,
        label: field.label,
        type: field.type,
        section: 'business_information',
        validation: { required: field.required },
        order: fieldOrder++,
        isActive: true
      });
    });
    
    // Add custom fields from legacy config
    if (role?.onboardingFields?.custom) {
      role.onboardingFields.custom.forEach((customField: any, index: number) => {
        businessFields.push({
          id: `field_custom_${index}_${Date.now()}_${fieldOrder}`,
          name: customField.name || `custom_${index}`,
          label: customField.label || customField.name || `Custom Field ${index + 1}`,
          type: customField.type || 'text',
          section: 'business_information',
          placeholder: customField.placeholder,
          helpText: customField.helpText,
          validation: customField.validation || {},
          options: customField.options,
          order: fieldOrder++,
          isActive: true
        });
      });
    }
    
    if (legacyConfig?.custom) {
      legacyConfig.custom.forEach((customField: any, index: number) => {
        // Avoid duplicates
        if (!businessFields.find(f => f.name === customField.name)) {
          businessFields.push({
            id: `field_legacy_${index}_${Date.now()}_${fieldOrder}`,
            name: customField.name || `legacy_${index}`,
            label: customField.label || customField.name || `Field ${index + 1}`,
            type: customField.type || 'text',
            section: 'business_information',
            placeholder: customField.placeholder,
            helpText: customField.helpText,
            validation: customField.validation || {},
            options: customField.options,
            order: fieldOrder++,
            isActive: true
          });
        }
      });
    }
    
    sections.push({
      id: 'business_information',
      name: 'business_information',
      title: 'Business Information',
      description: 'Basic business and owner details',
      icon: 'Building',
      order: 1,
      isActive: true,
      fields: businessFields
    });
    
    // Address & Location Section
    const addressFields: any[] = [
      {
        id: `field_address_${Date.now()}_${fieldOrder}`,
        name: 'address',
        label: 'Business Address',
        type: 'textarea',
        section: 'address_location',
        validation: { required: true },
        order: fieldOrder++,
        isActive: true
      },
      {
        id: `field_city_${Date.now()}_${fieldOrder}`,
        name: 'city',
        label: 'City',
        type: 'text',
        section: 'address_location',
        validation: { required: true },
        order: fieldOrder++,
        isActive: true
      },
      {
        id: `field_state_${Date.now()}_${fieldOrder}`,
        name: 'state',
        label: 'State',
        type: 'text',
        section: 'address_location',
        validation: { required: true },
        order: fieldOrder++,
        isActive: true
      },
      {
        id: `field_pincode_${Date.now()}_${fieldOrder}`,
        name: 'pincode',
        label: 'Pincode',
        type: 'text',
        section: 'address_location',
        validation: { required: true, maxLength: 6 },
        order: fieldOrder++,
        isActive: true
      }
    ];
    
    sections.push({
      id: 'address_location',
      name: 'address_location',
      title: 'Address & Location',
      description: 'Business address and location information',
      icon: 'MapPin',
      order: 2,
      isActive: true,
      fields: addressFields
    });
    
    // Documents Section (from legacy documentRequirements)
    const documentFields: any[] = [];
    
    if (role?.documentRequirements && Array.isArray(role.documentRequirements)) {
      role.documentRequirements.forEach((doc: any, index: number) => {
        documentFields.push({
          id: `field_doc_${index}_${Date.now()}_${fieldOrder}`,
          name: doc.type || `document_${index}`,
          label: doc.label || doc.name || `Document ${index + 1}`,
          type: 'file',
          section: 'documents',
          documentType: doc.type,
          documentLabel: doc.label,
          acceptedFileTypes: doc.acceptedTypes || ['image/jpeg', 'image/png', 'application/pdf'],
          validation: { required: doc.required || false },
          order: fieldOrder++,
          isActive: true
        });
      });
    }
    
    if (documentFields.length > 0) {
      sections.push({
        id: 'documents',
        name: 'documents',
        title: 'Documents',
        description: 'Required document uploads',
        icon: 'FileText',
        order: 3,
        isActive: true,
        fields: documentFields
      });
    }
    
    return {
      id: `form_${roleId}_migrated_${Date.now()}`,
      roleId,
      roleName: role?.displayName || role?.name || roleId,
      version: 1,
      status: 'active', // Mark as active since it was being used
      sections,
      documentSections: [], // Will be auto-generated on save
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'migration',
        migrated: true,
        migratedFrom: 'legacy_onboarding_config'
      },
      notes: 'Auto-migrated from legacy onboarding configuration'
    };
  }
  
  // ========================================
  // AUTO-GENERATION HELPER
  // ========================================
  
  /**
   * Generates a default active form for a role
   */
  function generateDefaultActiveForm(roleId: string): any {
    const sections: any[] = [];
    let fieldOrder = 0;
    
    // Business Information Section
    const businessFields: any[] = [];
    
    // Standard business fields
    const standardBusinessFields = [
      { name: 'businessName', label: 'Business Name', type: 'text', required: true },
      { name: 'ownerName', label: 'Owner Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'yearsOfExperience', label: 'Years of Experience', type: 'number', required: false },
      { name: 'licenseNumber', label: 'License Number', type: 'text', required: false },
      { name: 'gstNumber', label: 'GST Number', type: 'text', required: false }
    ];
    
    standardBusinessFields.forEach(field => {
      businessFields.push({
        id: `field_${field.name}_${Date.now()}_${fieldOrder}`,
        name: field.name,
        label: field.label,
        type: field.type,
        section: 'business_information',
        validation: { required: field.required },
        order: fieldOrder++,
        isActive: true
      });
    });
    
    sections.push({
      id: 'business_information',
      name: 'business_information',
      title: 'Business Information',
      description: 'Basic business and owner details',
      icon: 'Building',
      order: 1,
      isActive: true,
      fields: businessFields
    });
    
    // Address & Location Section
    const addressFields: any[] = [
      {
        id: `field_address_${Date.now()}_${fieldOrder}`,
        name: 'address',
        label: 'Business Address',
        type: 'textarea',
        section: 'address_location',
        validation: { required: true },
        order: fieldOrder++,
        isActive: true
      },
      {
        id: `field_city_${Date.now()}_${fieldOrder}`,
        name: 'city',
        label: 'City',
        type: 'text',
        section: 'address_location',
        validation: { required: true },
        order: fieldOrder++,
        isActive: true
      },
      {
        id: `field_state_${Date.now()}_${fieldOrder}`,
        name: 'state',
        label: 'State',
        type: 'text',
        section: 'address_location',
        validation: { required: true },
        order: fieldOrder++,
        isActive: true
      },
      {
        id: `field_pincode_${Date.now()}_${fieldOrder}`,
        name: 'pincode',
        label: 'Pincode',
        type: 'text',
        section: 'address_location',
        validation: { required: true, maxLength: 6 },
        order: fieldOrder++,
        isActive: true
      }
    ];
    
    sections.push({
      id: 'address_location',
      name: 'address_location',
      title: 'Address & Location',
      description: 'Business address and location information',
      icon: 'MapPin',
      order: 2,
      isActive: true,
      fields: addressFields
    });
    
    return {
      id: `form_${roleId}_default_${Date.now()}`,
      roleId,
      roleName: roleId,
      version: 1,
      status: 'active', // Mark as active since it was being used
      sections,
      documentSections: [], // Will be auto-generated on save
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        autoGenerated: true
      },
      notes: 'Auto-generated default form'
    };
  }
}