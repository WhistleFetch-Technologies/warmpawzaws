import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getRolesRepository } from '../../lib/repositories/roles.ts';

/**
 * ========================================
 * ENHANCED ONBOARDING FORM MANAGEMENT - SQL VERSION
 * ========================================
 * 
 * Comprehensive onboarding form builder and management system
 * 
 * ✅ MIGRATED TO SQL: Uses platform_settings table instead of KV
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

export function enhancedOnboardingManagement(app: Hono) {
  
  // ✅ CORS: Explicit OPTIONS handlers for onboarding endpoints
  // These MUST be simple and never throw errors
  app.options("/make-server-3dd53475/admin/onboarding-forms", (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    c.header('Access-Control-Max-Age', '86400');
    return c.text('', 204);
  });
  
  app.options("/make-server-3dd53475/admin/onboarding-forms/:roleId", (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    c.header('Access-Control-Max-Age', '86400');
    return c.text('', 204);
  });
  
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
      
      // ✅ SQL MIGRATION: Get all form configurations from platform_settings
      const db = getDbClient();
      const { data: formSettings } = await db
        .from('platform_settings')
        .select('*')
        .like('setting_key', 'onboarding:form:%:active');
      
      let forms = (formSettings || [])
        .map((setting: any) => setting.setting_value)
        .filter((f: any) => f && f.id && f.roleId);
      
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
      
      // ✅ SQL MIGRATION: Read from platform_settings instead of KV
      const db = getDbClient();
      
      // ✅ CRITICAL FIX: Get the LATEST version by checking ALL version entries
      // Use separate queries for active form and version entries to ensure we find everything
      console.log('[GET FORM] Fetching all forms for role:', roleId);
      
      // Query 1: Get active form
      const activeFormKey = `onboarding:form:${roleId}:active`;
      console.log('[GET FORM] Querying for active form with key:', activeFormKey);
      const { data: activeFormSetting, error: activeError } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', activeFormKey)
        .maybeSingle();
      
      console.log('[GET FORM] Active form query result:', {
        found: !!activeFormSetting,
        key: activeFormSetting?.setting_key,
        has_error: !!activeError,
        error: activeError ? String(activeError) : null,
        form_version: activeFormSetting ? (activeFormSetting.setting_value as any)?.version : null,
        form_id: activeFormSetting ? (activeFormSetting.setting_value as any)?.id : null
      });
      
      // Query 2: Get all version entries
      const versionPattern = `onboarding:form:${roleId}:version:%`;
      console.log('[GET FORM] Querying for version entries with pattern:', versionPattern);
      const { data: versionSettings, error: versionsError } = await db
        .from('platform_settings')
        .select('*')
        .ilike('setting_key', versionPattern)
        .order('updated_at', { ascending: false });
      
      console.log('[GET FORM] Version entries query result:', {
        found_count: versionSettings?.length || 0,
        has_error: !!versionsError,
        error: versionsError ? String(versionsError) : null,
        keys: versionSettings?.map((s: any) => s.setting_key) || []
      });
      
      // Query 3: Also check for any other forms with this roleId (fallback)
      const fallbackPattern = `onboarding:form:${roleId}%`;
      console.log('[GET FORM] Querying for all forms with pattern:', fallbackPattern);
      const { data: allFormSettingsFallback, error: fallbackError } = await db
        .from('platform_settings')
        .select('*')
        .ilike('setting_key', fallbackPattern)
        .order('updated_at', { ascending: false });
      
      console.log('[GET FORM] Fallback query result:', {
        found_count: allFormSettingsFallback?.length || 0,
        has_error: !!fallbackError,
        error: fallbackError ? String(fallbackError) : null,
        keys: allFormSettingsFallback?.map((s: any) => s.setting_key) || []
      });
      
      // Combine all forms (prioritize active and version entries, then add fallback)
      const allFormSettings: any[] = [];
      const seenKeys = new Set<string>();
      
      if (activeFormSetting && activeFormSetting.setting_key) {
        allFormSettings.push(activeFormSetting);
        seenKeys.add(activeFormSetting.setting_key);
      }
      if (versionSettings && versionSettings.length > 0) {
        versionSettings.forEach((s: any) => {
          if (s && s.setting_key && !seenKeys.has(s.setting_key)) {
            allFormSettings.push(s);
            seenKeys.add(s.setting_key);
          }
        });
      }
      if (allFormSettingsFallback && allFormSettingsFallback.length > 0) {
        allFormSettingsFallback.forEach((s: any) => {
          if (s && s.setting_key && !seenKeys.has(s.setting_key)) {
            allFormSettings.push(s);
            seenKeys.add(s.setting_key);
          }
        });
      }
      
      console.log('[GET FORM] Combined query result:', {
        active_form_found: !!activeFormSetting,
        active_form_version: activeFormSetting ? (activeFormSetting.setting_value as any)?.version : null,
        version_entries_found: versionSettings?.length || 0,
        fallback_entries_found: allFormSettingsFallback?.length || 0,
        total_forms_found: allFormSettings.length,
        has_active_error: !!activeError,
        has_versions_error: !!versionsError,
        has_fallback_error: !!fallbackError,
        found_keys: allFormSettings.map((s: any) => s?.setting_key).filter(Boolean),
        active_form_preview: activeFormSetting ? {
          key: activeFormSetting.setting_key,
          version: (activeFormSetting.setting_value as any)?.version,
          status: (activeFormSetting.setting_value as any)?.status,
          id: (activeFormSetting.setting_value as any)?.id
        } : null
      });
      
      const allFormsError = activeError || versionsError || fallbackError;
      
      if (allFormsError) {
        console.error('[GET FORM] ❌ Error fetching forms from SQL:', allFormsError);
        // Don't throw - fall through to auto-generate
      }
      
      
      
      let latestForm: any = null;
      let latestVersion = 0;
      let latestFormSetting: any = null;
      
      // ✅ CRITICAL: Find the form with the highest version number
      // Handle both string and number versions from JSONB
      if (allFormSettings && allFormSettings.length > 0) {
        console.log('[GET FORM] Found', allFormSettings.length, 'form entries for role:', roleId);
        console.log('[GET FORM] All form keys:', allFormSettings.map((s: any) => s?.setting_key).filter(Boolean));
        
        for (const setting of allFormSettings) {
          if (!setting) continue;
          if (setting.setting_value) {
            // ✅ CRITICAL: Handle JSONB - it might be a string that needs parsing
            let form: any = setting.setting_value;
            if (typeof form === 'string') {
              try {
                form = JSON.parse(form);
                console.log('[GET FORM] Parsed JSON string to object for key:', setting.setting_key);
              } catch (parseError) {
                console.error('[GET FORM] Failed to parse setting_value as JSON:', parseError);
                continue; // Skip this form if we can't parse it
              }
            }
            
            // ✅ CRITICAL: Handle both string and number versions
            let formVersion = 0;
            if (form.version !== undefined && form.version !== null) {
              if (typeof form.version === 'number') {
                formVersion = form.version;
              } else if (typeof form.version === 'string') {
                formVersion = parseInt(form.version, 10) || 0;
              }
            }
            
            console.log('[GET FORM] Checking form:', {
              setting_key: setting.setting_key,
              version: formVersion,
              version_type: typeof form.version,
              status: form.status,
              form_id: form.id,
              raw_version: form.version,
              current_latest: latestVersion,
              setting_value_type: typeof setting.setting_value
            });
            
            // ✅ CRITICAL: Only consider forms with valid versions > 0
            // Also prioritize active forms over draft forms
            if (formVersion > 0 && formVersion > latestVersion) {
              latestVersion = formVersion;
              latestForm = form;
              latestFormSetting = setting;
              console.log('[GET FORM] ✅ New latest version found:', formVersion, 'from key:', setting.setting_key);
            } else if (formVersion > 0 && formVersion === latestVersion && form.status === 'active') {
              // If same version, prefer active over draft
              if (!latestForm || latestForm.status !== 'active') {
                latestForm = form;
                latestFormSetting = setting;
                console.log('[GET FORM] ✅ Updated to active form with same version:', formVersion);
              }
            }
          } else {
            console.log('[GET FORM] ⚠️ Setting has no setting_value:', setting.setting_key);
          }
        }
      } else {
        console.log('[GET FORM] ⚠️ No form settings found in allFormSettings array');
      }
      
      console.log('[GET FORM] Final selection:', {
        latest_version: latestVersion,
        latest_form_id: latestForm?.id,
        latest_setting_key: latestFormSetting?.setting_key
      });
      
      if (latestForm && latestFormSetting) {
        // ✅ CRITICAL: Verify version is present and is a number
        if (!latestForm.version || typeof latestForm.version !== 'number') {
          console.error('[GET FORM] ⚠️ WARNING: Form version is missing or invalid!', {
            version: latestForm.version,
            version_type: typeof latestForm.version
          });
          // Set default version if missing
          latestForm.version = latestForm.version || 1;
        }
        
        console.log('[GET FORM] ✅ Latest form found in SQL:', {
          form_id: latestForm.id,
          version: latestForm.version,
          status: latestForm.status,
          sections_count: latestForm.sections?.length,
          setting_key: latestFormSetting.setting_key,
          updated_at: latestFormSetting.updated_at,
          total_forms_found: allFormSettings?.length || 0
        });
        
        // Add no-cache headers to prevent frontend caching
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        c.header('Pragma', 'no-cache');
        c.header('Expires', '0');
        
        // ✅ CRITICAL: Return form directly from database (latest version)
        return c.json({
          success: true,
          form: latestForm, // ✅ Use latestForm (highest version found)
          isNew: false,
          version: latestForm.version // ✅ Explicitly include version
        }, 200);
      }
      
      // STEP 2: No form exists - auto-generate default active form for this role
      console.log('[GET FORM] No enhanced form found in SQL, auto-generating default active form...');
      
      const autoGeneratedForm = await generateDefaultActiveForm(roleId);
      const formKey = `onboarding:form:${roleId}:active`;
      
      // ✅ SQL MIGRATION: Save the auto-generated form to platform_settings
      const { data: savedAutoForm, error: autoFormError } = await db
        .from('platform_settings')
        .upsert({
          setting_key: formKey,
          setting_value: autoGeneratedForm,
          // NOTE: setting_type column doesn't exist in actual database schema
          description: `Onboarding form for role ${roleId}`,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        })
        .select();
      
      if (autoFormError) {
        console.error('[GET FORM] ❌ Error saving auto-generated form:', autoFormError);
        throw autoFormError;
      }
      console.log('[GET FORM] ✅ Auto-generated form saved:', savedAutoForm?.[0]?.setting_key);
      
      // Also save version
      const { data: savedAutoVersion, error: autoVersionError } = await db
        .from('platform_settings')
        .upsert({
          setting_key: `onboarding:form:${roleId}:version:${autoGeneratedForm.version}`,
          setting_value: autoGeneratedForm,
          // NOTE: setting_type column doesn't exist in actual database schema
          description: `Onboarding form version ${autoGeneratedForm.version} for role ${roleId}`,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        })
        .select();
      
      if (autoVersionError) {
        console.error('[GET FORM] ❌ Error saving auto-generated version:', autoVersionError);
        // Don't throw - version save is optional
      } else {
        console.log('[GET FORM] ✅ Auto-generated version saved:', savedAutoVersion?.[0]?.setting_key);
      }
      
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[GET FORM] Error details:', { errorMessage, errorStack });
      return c.json({ 
        success: false,
        error: errorMessage,
        details: errorStack ? 'See server logs for details' : undefined
      }, 500);
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
      
      // ✅ CRITICAL: Get existing form from platform_settings
      // ✅ FIX: Query ALL forms for this role to find the highest version
      const db = getDbClient();
      const formKey = `onboarding:form:${roleId}:active`;
      
      // First, try to get the active form
      const { data: existingFormSetting, error: fetchError } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', formKey)
        .maybeSingle();
      
      if (fetchError) {
        console.error('[SAVE FORM] Error fetching active form:', fetchError);
      }
      
      // ✅ CRITICAL: Also query ALL version entries to find the highest version
      const { data: allVersionSettings, error: versionsError } = await db
        .from('platform_settings')
        .select('*')
        .ilike('setting_key', `onboarding:form:${roleId}:version:%`)
        .order('updated_at', { ascending: false });
      
      if (versionsError) {
        console.error('[SAVE FORM] Error fetching version entries:', versionsError);
      }
      
      // Find the highest version from all entries
      let existingForm = existingFormSetting?.setting_value as any;
      let highestVersion = existingForm?.version || 0;
      
      if (allVersionSettings && allVersionSettings.length > 0) {
        for (const versionSetting of allVersionSettings) {
          const versionForm = versionSetting.setting_value as any;
          const versionNum = versionForm?.version && typeof versionForm.version === 'number' 
            ? versionForm.version 
            : (typeof versionForm?.version === 'string' ? parseInt(versionForm.version, 10) || 0 : 0);
          
          if (versionNum > highestVersion) {
            highestVersion = versionNum;
            existingForm = versionForm; // Use the form with highest version as base
          }
        }
      }
      
      console.log('[SAVE FORM] Existing form from DB:', {
        found: !!existingForm,
        existing_version: existingForm?.version,
        highest_version_found: highestVersion,
        existing_status: existingForm?.status,
        existing_id: existingForm?.id,
        version_entries_found: allVersionSettings?.length || 0
      });
      
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
      
      // ✅ CRITICAL: Calculate version correctly
      // Use the highest version found (from active form or version entries)
      // If no form exists, start at 1. Otherwise increment from highest version
      const currentVersion = highestVersion > 0 ? highestVersion : (existingForm?.version || 0);
      const nextVersion = currentVersion > 0 
        ? currentVersion + 1 
        : 1;
      
      console.log('[SAVE FORM] Version calculation:', {
        existing_form_version: existingForm?.version,
        highest_version_found: highestVersion,
        current_version: currentVersion,
        next_version: nextVersion,
        is_new_form: !existingForm && highestVersion === 0
      });
      
      // Create form object
      const form: OnboardingForm = {
        id: existingForm?.id || `form_${roleId}_${Date.now()}`,
        roleId,
        roleName: existingForm?.roleName || roleId,
        version: nextVersion, // ✅ CRITICAL: Use calculated next version
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
      
      // ✅ SQL MIGRATION: Save form to platform_settings
      // IMPORTANT: Always save to 'active' key, regardless of status (vendor endpoint reads from 'active')
      console.log('[SAVE FORM] Attempting to save form to SQL:', {
        setting_key: `onboarding:form:${roleId}:active`,
        form_id: form.id,
        form_status: form.status,
        form_version: form.version,
        sections_count: form.sections?.length,
        form_size: JSON.stringify(form).length
      });
      
      // ✅ CRITICAL: Ensure form status is set correctly before saving
      // If status is 'active', make sure the form.status is also 'active'
      if (status === 'active') {
        form.status = 'active';
        console.log('[SAVE FORM] Setting form status to active for vendor access');
      }
      
      // ✅ SQL MIGRATION: Save form to platform_settings
      // CRITICAL: Use explicit error handling and verification
      console.log('[SAVE FORM] Preparing to save form to SQL:', {
        setting_key: `onboarding:form:${roleId}:active`,
        form_id: form.id,
        form_status: form.status,
        form_version: form.version,
        sections_count: form.sections?.length,
        form_size_bytes: JSON.stringify(form).length
      });
      
      // Validate form object before saving
      try {
        JSON.stringify(form); // This will throw if form has circular references
      } catch (jsonError) {
        console.error('[SAVE FORM] Form object is not serializable:', jsonError);
        throw new Error(`Form object cannot be serialized: ${jsonError}`);
      }
      
      const upsertPayload = {
          setting_key: `onboarding:form:${roleId}:active`,
          setting_value: form,
        description: status === 'active' 
          ? `Active onboarding form for role ${roleId}` 
          : `Draft onboarding form for role ${roleId}`,
          updated_at: new Date().toISOString(),
      };
      
      console.log('[SAVE FORM] Upsert payload prepared:', {
        setting_key: upsertPayload.setting_key,
        has_setting_value: !!upsertPayload.setting_value,
        description: upsertPayload.description
      });
      
      // ✅ CRITICAL: Save form with explicit error handling and verification
      console.log('[SAVE FORM] Executing upsert to database...');
      const settingKey = `onboarding:form:${roleId}:active`;
      
      const { data: savedForm, error: saveError } = await db
        .from('platform_settings')
        .upsert(upsertPayload, {
          onConflict: 'setting_key'
        })
        .select();
      
      if (saveError) {
        console.error('[SAVE FORM] ❌ CRITICAL ERROR saving form to SQL:', {
          error: saveError,
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint,
          code: saveError.code
        });
        return c.json({ 
          success: false,
          error: `Failed to save form: ${saveError.message}`,
          details: saveError.details,
          hint: saveError.hint
        }, 500);
      }
      
      if (!savedForm || savedForm.length === 0) {
        console.error('[SAVE FORM] ❌ CRITICAL: Upsert returned no data:', { savedForm });
        return c.json({ 
          success: false,
          error: 'Failed to save form: No data returned from upsert'
        }, 500);
      }
      
      const savedFormRecord = savedForm[0];
      
      // ✅ CRITICAL: Verify the saved form by reading it back from database
      const savedFormValue = savedFormRecord?.setting_value as any;
      console.log('[SAVE FORM] Upsert returned data:', {
        setting_key: savedFormRecord?.setting_key,
        saved_form_id: savedFormValue?.id,
        saved_form_status: savedFormValue?.status,
        saved_form_version: savedFormValue?.version,
        saved_sections_count: savedFormValue?.sections?.length,
        updated_at: savedFormRecord?.updated_at
      });
      
      // ✅ CRITICAL: Wait a moment for DB to sync, then re-read to verify persistence
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay for DB sync
      
      // ✅ CRITICAL: Re-read from database to verify persistence
      const { data: verifyForm, error: verifyError } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `onboarding:form:${roleId}:active`)
        .maybeSingle();
      
      if (verifyError) {
        console.error('[SAVE FORM] ❌ CRITICAL: Error verifying saved form:', verifyError);
        return c.json({ 
          success: false,
          error: `Form saved but verification failed: ${verifyError.message}`
        }, 500);
      }
      
      if (!verifyForm || !verifyForm.setting_value) {
        console.error('[SAVE FORM] ❌ CRITICAL: Form not found after save!', {
          verifyForm_exists: !!verifyForm,
          setting_value_exists: !!verifyForm?.setting_value
        });
        return c.json({ 
          success: false,
          error: 'Form was not persisted to database'
        }, 500);
      }
      
      const verifiedFormValue = verifyForm.setting_value as any;
      console.log('[SAVE FORM] ✅ Verification successful:', {
        verified_form_id: verifiedFormValue?.id,
        verified_status: verifiedFormValue?.status,
        verified_sections: verifiedFormValue?.sections?.length,
        verified_version: verifiedFormValue?.version,
        verified_sections_sample: verifiedFormValue?.sections?.slice(0, 2).map((s: any) => ({
          id: s.id,
          name: s.name,
          fields_count: s.fields?.length
        }))
      });
      
      // ✅ CRITICAL: Verify version matches expected version
      if (verifiedFormValue?.version !== form.version) {
        console.error('[SAVE FORM] ❌ CRITICAL: Version mismatch after save!', {
          expected_version: form.version,
          actual_version: verifiedFormValue?.version
        });
        return c.json({ 
          success: false,
          error: `Form saved but version mismatch: expected ${form.version}, got ${verifiedFormValue?.version}`
        }, 500);
      }
      
      // ✅ CRITICAL: Verify the saved form has the correct status
      if (status === 'active' && verifiedFormValue?.status !== 'active') {
        console.error('[SAVE FORM] ⚠️ WARNING: Form saved but status is not active!', {
          expected_status: 'active',
          actual_status: verifiedFormValue?.status
        });
        // Don't fail, but log the warning
      }
      
      // Use verified form data
      const savedFormData = verifiedFormValue;
      
      // ✅ CRITICAL: Verify version is correctly persisted
      console.log('[SAVE FORM] ✅ Verified form version:', {
        version: savedFormData.version,
        status: savedFormData.status,
        form_id: savedFormData.id
      });
      
      // Save version (optional - for version history)
      // ✅ CRITICAL: Use verified form data, not the constructed form
      try {
        const { data: savedVersion, error: versionError } = await db
        .from('platform_settings')
        .upsert({
            setting_key: `onboarding:form:${roleId}:version:${savedFormData.version}`,
            setting_value: savedFormData, // Use verified form from database
            description: `Onboarding form version ${savedFormData.version} for role ${roleId}`,
          updated_at: new Date().toISOString(),
          }, {
            onConflict: 'setting_key'
          })
          .select();
        
        if (versionError) {
          console.error('[SAVE FORM] Error saving version to SQL (non-critical):', versionError);
          // Don't throw - version save is optional
        } else {
          console.log('[SAVE FORM] Version saved to SQL:', savedVersion?.[0]?.setting_key);
        }
      } catch (versionErr) {
        console.error('[SAVE FORM] Exception saving version (non-critical):', versionErr);
        // Continue - version save is optional
      }
      
      // ✅ CRITICAL: Final verification - ensure the form is actually in the database
      // Wait a moment for DB to sync, then do a final check
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay for DB sync
      
      const { data: finalCheck, error: finalCheckError } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `onboarding:form:${roleId}:active`)
        .maybeSingle();
      
      if (finalCheckError) {
        console.error('[SAVE FORM] ⚠️ Error in final version check:', finalCheckError);
        return c.json({ 
          success: false,
          error: `Form saved but final verification failed: ${finalCheckError.message}`
        }, 500);
      }
      
      if (!finalCheck || !finalCheck.setting_value) {
        console.error('[SAVE FORM] ❌ CRITICAL: Form not found in final check!');
        return c.json({ 
          success: false,
          error: 'Form was not found in database after save'
        }, 500);
      }
      
      const finalForm = finalCheck.setting_value as any;
      console.log('[SAVE FORM] ✅ Final version check:', {
        active_form_version: finalForm.version,
        expected_version: savedFormData.version,
        versions_match: finalForm.version === savedFormData.version,
        sections_count_match: finalForm.sections?.length === savedFormData.sections?.length
      });
      
      // If versions don't match, this is a critical error - force update
      if (finalForm.version !== savedFormData.version) {
        console.error('[SAVE FORM] ❌ CRITICAL: Active form version mismatch! Forcing update...', {
          active_version: finalForm.version,
          expected_version: savedFormData.version
        });
        
        // Force update the active form with the correct version
        const { error: forceUpdateError } = await db
          .from('platform_settings')
          .update({
            setting_value: savedFormData,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', `onboarding:form:${roleId}:active`);
        
        if (forceUpdateError) {
          console.error('[SAVE FORM] ❌ Failed to force update active form:', forceUpdateError);
          return c.json({ 
            success: false,
            error: `Form saved but version mismatch and force update failed: ${forceUpdateError.message}`
          }, 500);
        } else {
          console.log('[SAVE FORM] ✅ Force updated active form with correct version');
          
          // Re-verify after force update
          await new Promise(resolve => setTimeout(resolve, 100));
          const { data: reVerify, error: reVerifyError } = await db
            .from('platform_settings')
            .select('*')
            .eq('setting_key', `onboarding:form:${roleId}:active`)
            .maybeSingle();
          
          if (reVerifyError || !reVerify?.setting_value) {
            console.error('[SAVE FORM] ❌ Failed to verify after force update');
            return c.json({ 
              success: false,
              error: 'Form update failed verification'
            }, 500);
          }
          
          const reVerifiedForm = reVerify.setting_value as any;
          if (reVerifiedForm.version !== savedFormData.version) {
            console.error('[SAVE FORM] ❌ Version still incorrect after force update');
            return c.json({ 
              success: false,
              error: 'Form version still incorrect after force update'
            }, 500);
          }
          
          console.log('[SAVE FORM] ✅ Form verified after force update');
        }
      }
      
      // ✅ SQL MIGRATION: If status is active, update the role's onboarding reference in SQL
      // ✅ CRITICAL: Use verified form data
      if (status === 'active') {
        try {
        const rolesRepo = getRolesRepository();
        const role = await rolesRepo.findById(roleId);
        if (role) {
            // Update role config with form reference using verified form data
          const roleConfig = (role.config as any) || {};
          await rolesRepo.update(roleId, {
            config: {
              ...roleConfig,
                onboardingFormId: savedFormData.id,
                onboardingFormVersion: savedFormData.version,
              updatedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          });
            console.log('[SAVE FORM] Updated role reference in SQL');
          }
        } catch (roleUpdateErr) {
          console.error('[SAVE FORM] Error updating role reference (non-critical):', roleUpdateErr);
          // Don't fail the save if role update fails
        }
      }
      
      console.log('[SAVE FORM] ✅ Form successfully saved and verified:', {
        form_id: savedFormData?.id,
        version: savedFormData?.version,
        status: savedFormData?.status,
        sections_count: savedFormData?.sections?.length,
        setting_key: `onboarding:form:${roleId}:active`
      });
      
      // ✅ CRITICAL: One final database check to ensure form is actually there
      // Wait 500ms for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: finalVerification, error: finalVerificationError } = await db
        .from('platform_settings')
        .select('setting_key, setting_value')
        .eq('setting_key', `onboarding:form:${roleId}:active`)
        .maybeSingle();
      
      if (finalVerificationError) {
        console.error('[SAVE FORM] ⚠️ Final verification error (non-critical):', finalVerificationError);
      } else if (!finalVerification || !finalVerification.setting_value) {
        console.error('[SAVE FORM] ❌ CRITICAL: Form missing in final verification!');
        return c.json({
          success: false,
          error: 'Form was not persisted to database after all verification steps'
        }, 500);
      } else {
        const finalForm = finalVerification.setting_value as any;
        console.log('[SAVE FORM] ✅ Final verification passed:', {
          version: finalForm.version,
          sections_count: finalForm.sections?.length
        });
      }
      
      // ✅ CRITICAL: Return the verified form from database, not the constructed one
      // This ensures the frontend receives exactly what's in the database
      return c.json({
        success: true,
        form: savedFormData, // Use verified form from database
        message: status === 'active' 
          ? 'Form published successfully and is now active for vendor onboarding'
          : 'Form saved as draft successfully'
      }, 200);
      
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
      
      // ✅ SQL MIGRATION: Get active form from platform_settings
      // ✅ CRITICAL FIX: Get the LATEST version by checking ALL version entries
      const db = getDbClient();
      console.log('[VENDOR FORM] Fetching all forms for role:', roleId);
      
      // Query 1: Get active form
      const { data: activeFormSetting, error: activeError } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `onboarding:form:${roleId}:active`)
        .maybeSingle();
      
      // Query 2: Get all version entries
      const { data: versionSettings, error: versionsError } = await db
        .from('platform_settings')
        .select('*')
        .ilike('setting_key', `onboarding:form:${roleId}:version:%`)
        .order('updated_at', { ascending: false });
      
      // Combine all forms
      const allFormSettings: any[] = [];
      if (activeFormSetting) {
        allFormSettings.push(activeFormSetting);
      }
      if (versionSettings && versionSettings.length > 0) {
        allFormSettings.push(...versionSettings);
      }
      
      console.log('[VENDOR FORM] Query result:', {
        active_form_found: !!activeFormSetting,
        version_entries_found: versionSettings?.length || 0,
        total_forms_found: allFormSettings.length,
        has_active_error: !!activeError,
        has_versions_error: !!versionsError,
        found_keys: allFormSettings.map((s: any) => s?.setting_key).filter(Boolean)
      });
      
      const allFormsError = activeError || versionsError;
      
      if (allFormsError) {
        console.error('[VENDOR FORM] ❌ Error fetching forms from SQL:', allFormsError);
        throw allFormsError;
      }
      
      let latestForm: any = null;
      let latestVersion = 0;
      let latestFormSetting: any = null;
      
      // ✅ CRITICAL: Find the form with the highest version number
      // Handle both string and number versions from JSONB
      if (allFormSettings && allFormSettings.length > 0) {
        console.log('[VENDOR FORM] Found', allFormSettings.length, 'form entries for role:', roleId);
        
        for (const setting of allFormSettings) {
          if (!setting) continue;
          if (setting.setting_value) {
            const form = setting.setting_value as any;
            // ✅ CRITICAL: Handle both string and number versions
            let formVersion = 0;
            if (form.version !== undefined && form.version !== null) {
              if (typeof form.version === 'number') {
                formVersion = form.version;
              } else if (typeof form.version === 'string') {
                formVersion = parseInt(form.version, 10) || 0;
              }
            }
            
            console.log('[VENDOR FORM] Checking form:', {
              setting_key: setting.setting_key,
              version: formVersion,
              version_type: typeof form.version,
              status: form.status
            });
            
            if (formVersion > latestVersion) {
              latestVersion = formVersion;
              latestForm = form;
              latestFormSetting = setting;
              console.log('[VENDOR FORM] ✅ New latest version found:', formVersion);
            }
          }
        }
      }
      
      console.log('[VENDOR FORM] Final selection:', {
        latest_version: latestVersion,
        latest_form_id: latestForm?.id,
        latest_setting_key: latestFormSetting?.setting_key
      });
      
      console.log('[VENDOR FORM] Database query result:', {
        total_forms_found: allFormSettings?.length || 0,
        latest_version: latestVersion,
        latest_form_found: !!latestForm,
        latest_setting_key: latestFormSetting?.setting_key,
        latest_form_status: latestForm?.status
      });
      
      let form = latestForm;
      
      if (!form) {
        console.log('[VENDOR FORM] ⚠️ No form found in SQL for role:', roleId);
        console.log('[VENDOR FORM] Checking query results:', {
          active_form_found: !!activeFormSetting,
          version_entries_found: versionSettings?.length || 0,
          total_forms_found: allFormSettings.length
        });
      } else {
        console.log('[VENDOR FORM] ✓ Found latest form in SQL:', { 
          id: form.id, 
          status: form.status, 
          version: form.version,
          sections_count: form.sections?.length,
          form_keys: Object.keys(form),
          updated_at: latestFormSetting?.updated_at,
          setting_key: latestFormSetting?.setting_key
        });
        
        // ✅ CRITICAL: Verify version is present and is a number
        if (!form.version || typeof form.version !== 'number') {
          console.error('[VENDOR FORM] ⚠️ WARNING: Form version is missing or invalid!', {
            version: form.version,
            version_type: typeof form.version
          });
          // Set default version if missing
          form.version = form.version || 1;
        }
        
        // ✅ CRITICAL: Log that we're returning the latest version
        console.log('[VENDOR FORM] ✅ Returning form with version:', form.version);
      }
      
      // ✅ CRITICAL FIX: Only auto-generate if form doesn't exist
      // If form exists but status is 'draft', DO NOT overwrite it - admin must publish it first
      if (!form) {
        console.log('[VENDOR FORM] No form found, auto-generating default form...');
        
        // Auto-generate a default active form
        const autoGeneratedForm = await generateDefaultActiveForm(roleId);
        
        console.log('[VENDOR FORM] Generated form:', {
          id: autoGeneratedForm.id,
          roleId: autoGeneratedForm.roleId,
          version: autoGeneratedForm.version,
          sectionsCount: autoGeneratedForm.sections.length
        });
        
        // ✅ SQL MIGRATION: Save the auto-generated form to platform_settings
        console.log('[VENDOR FORM] Saving to SQL...');
        const { data: savedVendorForm, error: vendorFormError } = await db
          .from('platform_settings')
          .upsert({
            setting_key: `onboarding:form:${roleId}:active`,
            setting_value: autoGeneratedForm,
            // NOTE: setting_type column doesn't exist in actual database schema
            description: `Auto-generated active onboarding form for role ${roleId}`,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'setting_key'
          })
          .select();
        
        if (vendorFormError) {
          console.error('[VENDOR FORM] Error saving form:', vendorFormError);
          throw vendorFormError;
        }
        console.log('[VENDOR FORM] Form saved:', savedVendorForm?.[0]?.setting_key);
        
        const { data: savedVendorVersion, error: vendorVersionError } = await db
          .from('platform_settings')
          .upsert({
            setting_key: `onboarding:form:${roleId}:version:${autoGeneratedForm.version}`,
            setting_value: autoGeneratedForm,
            // NOTE: setting_type column doesn't exist in actual database schema
            description: `Onboarding form version ${autoGeneratedForm.version} for role ${roleId}`,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'setting_key'
          })
          .select();
        
        if (vendorVersionError) {
          console.error('[VENDOR FORM] ❌ Error saving version:', vendorVersionError);
          // Don't throw - version save is optional
        } else {
          console.log('[VENDOR FORM] ✅ Version saved:', savedVendorVersion?.[0]?.setting_key);
        }
        
        console.log('[VENDOR FORM] ✅ Auto-generated active form saved:', autoGeneratedForm.id);
        
        // Return the auto-generated form
        return c.json({
          success: true,
          form: autoGeneratedForm,
          autoGenerated: true
        });
      } else if (form && form.status !== 'active') {
        // ✅ CRITICAL: If form exists but status is not 'active', return error instead of overwriting
        console.log('[VENDOR FORM] Form exists but status is not active:', form.status);
        console.log('[VENDOR FORM] Admin must publish the form first - NOT auto-generating');
        return c.json({
          success: false,
          error: 'No active onboarding form available. The form is saved as draft and must be published by admin first.',
          formStatus: form.status,
          hasDraftForm: true,
          message: 'Please contact admin to publish the onboarding form.'
        }, 404);
      }
      
      // Form exists and status is 'active' - proceed with filtering
      // Filter only active sections and fields
      console.log('[VENDOR FORM] Form is active, filtering active sections and fields...');
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
      console.log('[VENDOR FORM] ✅ Returning active form:', form.id, 'Version:', form.version);
      
      // ✅ CRITICAL: Ensure version is included in response
      return c.json({
        success: true,
        form: {
          ...form,
          version: form.version, // ✅ Explicitly include version
          sections: activeSections,
          documentSections: activeDocumentSections
        },
        version: form.version // ✅ Also include at top level for easy access
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
      
      // ✅ SQL MIGRATION: Get form from platform_settings
      const db = getDbClient();
      const formKey = `onboarding:form:${roleId}:active`;
      const { data: formSetting } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', formKey)
        .maybeSingle();
      
      if (!formSetting || !formSetting.setting_value) {
        return c.json({ error: 'Form not found' }, 404);
      }
      
      const form = formSetting.setting_value as any;
      
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
      
      // ✅ SQL MIGRATION: Save updated form to platform_settings
      await db
        .from('platform_settings')
        .upsert({
          setting_key: formKey,
          setting_value: form,
          // NOTE: setting_type column doesn't exist in actual database schema
          description: `Onboarding form for role ${roleId}`,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });
      
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
      
      // ✅ SQL MIGRATION: Get form from platform_settings
      const db = getDbClient();
      const formKey = `onboarding:form:${roleId}:active`;
      const { data: formSetting } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', formKey)
        .maybeSingle();
      
      if (!formSetting || !formSetting.setting_value) {
        return c.json({ error: 'Form not found' }, 404);
      }
      
      const form = formSetting.setting_value as any;
      
      form.status = 'archived';
      form.metadata.lastModifiedBy = adminName || 'admin';
      form.metadata.lastModifiedAt = new Date().toISOString();
      
      // ✅ SQL MIGRATION: Save archived form to platform_settings
      await db
        .from('platform_settings')
        .upsert({
          setting_key: formKey,
          setting_value: form,
          // NOTE: setting_type column doesn't exist in actual database schema
          description: `Archived onboarding form for role ${roleId}`,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });
      
      await db
        .from('platform_settings')
        .upsert({
          setting_key: `onboarding:form:${roleId}:archived:${Date.now()}`,
          setting_value: form,
          // NOTE: setting_type column doesn't exist in actual database schema
          description: `Archived onboarding form snapshot for role ${roleId}`,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });
      
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
      // ✅ SQL MIGRATION: Get roles from SQL instead of KV
      const rolesRepo = getRolesRepository();
      const allRoles = await rolesRepo.findAll();
      const roles = allRoles.map((role: any) => ({
        id: role.name, // Use name as roleId
        ...role.config, // Spread config
        ...role, // Include role properties
      }));
      console.log('[BULK MIGRATE] Found roles:', roles.length);
      
      const results: Array<{
        roleId: string;
        status: 'skipped' | 'migrated' | 'error';
        message?: string;
        formId?: any;
        version?: any;
        error?: string;
      }> = [];
      
      for (const role of roles) {
        try {
          const roleId = role.id;
          console.log(`[BULK MIGRATE] Processing role: ${roleId}`);
          
          // ✅ SQL MIGRATION: Check if enhanced form already exists in platform_settings
          const db = getDbClient();
          const formKey = `onboarding:form:${roleId}:active`;
          const { data: existingFormSetting } = await db
            .from('platform_settings')
            .select('*')
            .eq('setting_key', formKey)
            .maybeSingle();
          
          if (existingFormSetting && existingFormSetting.setting_value) {
            console.log(`[BULK MIGRATE] ✓ Form already exists for ${roleId}`);
            results.push({
              roleId: roleId as string,
              status: 'skipped',
              message: 'Form already exists'
            });
            continue;
          }
          
          // ✅ SQL MIGRATION: Check for legacy config in platform_settings
          const { data: legacyConfigSetting } = await db
            .from('platform_settings')
            .select('*')
            .eq('setting_key', `onboarding:config:${roleId}`)
            .maybeSingle();
          
          const legacyConfig = legacyConfigSetting?.setting_value;
          
          if (!legacyConfig && !role) {
            console.log(`[BULK MIGRATE] ⚠ No legacy data for ${roleId}, creating default`);
          }
          
          // Migrate
          const migratedForm = migrateLegacyToEnhanced(roleId, role, legacyConfig);
          
          // ✅ SQL MIGRATION: Save to platform_settings
          await db
            .from('platform_settings')
            .upsert({
              setting_key: formKey,
              setting_value: migratedForm,
              // NOTE: setting_type column doesn't exist in actual database schema
              description: `Migrated onboarding form for role ${roleId}`,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'setting_key'
            });
          
          console.log(`[BULK MIGRATE] ✅ Migrated ${roleId}`);
          results.push({
            roleId: roleId as string,
            status: 'migrated',
            formId: migratedForm.id,
            version: migratedForm.version
          });
          
        } catch (roleError) {
          console.error(`[BULK MIGRATE] ❌ Error migrating ${role.id}:`, roleError);
          results.push({
            roleId: role.id as string,
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
          migrated: results.filter((r) => r.status === 'migrated').length,
          skipped: results.filter((r) => r.status === 'skipped').length,
          errors: results.filter((r) => r.status === 'error').length
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
      
      // ✅ SQL MIGRATION: Get all versions from platform_settings
      const db = getDbClient();
      const { data: versionSettings } = await db
        .from('platform_settings')
        .select('*')
        .like('setting_key', `onboarding:form:${roleId}:version:%`);
      
      const allVersions = (versionSettings || [])
        .map((setting: any) => setting.setting_value)
        .filter((v: any) => v && v.version);
      
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
  async function generateDefaultActiveForm(roleId: string): Promise<any> {
    // Try to get role info, but don't fail if it doesn't exist
    let role: any = null;
    try {
      const rolesRepo = getRolesRepository();
      role = await rolesRepo.findById(roleId);
    } catch (roleError) {
      console.log('[GENERATE FORM] Could not fetch role info (non-critical):', roleError);
      // Continue with default values
    }
    
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
      roleName: role?.displayName || role?.name || roleId,
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