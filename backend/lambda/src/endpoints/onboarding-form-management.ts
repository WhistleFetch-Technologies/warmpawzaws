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

/**
 * Get sections from fields with KYC-aware section mapping
 * Uses role-specific sections from KYC config
 */
function getSectionsFromFieldsWithKYC(fields: any[], kycSections?: any[]) {
  const sections: Record<string, any> = {};
  
  // Build section metadata from KYC sections
  const sectionMeta: Record<string, any> = {};
  
  if (kycSections && kycSections.length > 0) {
    kycSections.forEach((s: any) => {
      sectionMeta[s.id] = { 
        title: s.name, 
        order: s.order,
        description: s.description 
      };
    });
  }
  
  // Add default/legacy sections for backward compatibility
  const defaultSections: Record<string, any> = {
    'basic': { title: 'Basic Information', order: 1 },
    'identity_verification': { title: 'Identity Verification', order: 2 },
    'professional': { title: 'Professional Details', order: 3 },
    'business_registration': { title: 'Business Registration', order: 4 },
    'documents': { title: 'Documents', order: 5 },
    'declarations': { title: 'Declarations & Consent', order: 6 },
    'location': { title: 'Location & Service Area', order: 7 },
    'banking': { title: 'Banking Details', order: 8 },
    // Legacy sections
    'business_information': { title: 'Business Information', order: 1 },
    'location_information': { title: 'Location', order: 7 },
    'banking_information': { title: 'Banking Details', order: 8 },
    'document_verification': { title: 'Documents', order: 5 },
    'additional_information': { title: 'Additional Info', order: 9 },
  };
  
  // Merge: KYC sections take precedence
  Object.assign(sectionMeta, defaultSections);
  if (kycSections && kycSections.length > 0) {
    kycSections.forEach((s: any) => {
      sectionMeta[s.id] = { 
        title: s.name, 
        order: s.order,
        description: s.description 
      };
    });
  }

  // Group fields by section
  for (const field of fields) {
    const secKey = field.section || 'additional_information';
    if (!sections[secKey]) {
      sections[secKey] = {
        id: secKey,
        name: secKey,
        title: sectionMeta[secKey]?.title || formatTitle(secKey),
        order: sectionMeta[secKey]?.order || 99,
        description: sectionMeta[secKey]?.description || '',
        fields: [],
        isActive: true,
      };
    }
    sections[secKey].fields.push(field);
  }

  // Sort fields within each section by displayOrder
  Object.values(sections).forEach((section: any) => {
    section.fields.sort((a: any, b: any) => {
      const orderA = a.displayOrder || a.order || 0;
      const orderB = b.displayOrder || b.order || 0;
      return orderA - orderB;
    });
  });

  return Object.values(sections).sort((a: any, b: any) => a.order - b.order);
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
   * POST /admin/onboarding-fields/migrate-kyc
   * Migrate KYC-compliant fields to all active roles
   * Adds Aadhaar, PAN, Police Verification, and role-specific KYC fields
   */
  app.post('/admin/onboarding-fields/migrate-kyc', async (c) => {
    try {
      console.log('[KYC-MIGRATE] KYC migration endpoint called');
      
      // Import KYC field definitions
      const { 
        ROLE_KYC_CONFIGS, 
        getKYCFieldsForRole, 
        getSupportedKYCRoles,
        KYC_SECTIONS 
      } = await import('../lib/kyc-form-fields');
      
      // Get all active roles
      const activeRoles = await select('roles', { is_active: true }, {
        orderBy: 'name',
        orderDirection: 'ASC',
      });
      
      console.log(`[KYC-MIGRATE] Found ${activeRoles.length} active roles`);
      
      const results: any[] = [];
      let updated = 0;
      let created = 0;
      let skipped = 0;
      let errors = 0;
      
      // Get supported KYC roles
      const supportedRoles = getSupportedKYCRoles();
      
      for (const role of activeRoles) {
        try {
          const roleName = role.name;
          
          // Check if this role has KYC configuration
          if (!supportedRoles.includes(roleName) && !supportedRoles.includes(`${roleName}_solo`) && !supportedRoles.includes(`${roleName}_business`)) {
            console.log(`[KYC-MIGRATE] Skipping role ${roleName} - no KYC config`);
            skipped++;
            results.push({
              roleId: roleName,
              roleName: role.display_name || roleName,
              status: 'skipped',
              reason: 'No KYC configuration defined for this role',
            });
            continue;
          }
          
          // Get KYC fields for this role
          let kycFields = getKYCFieldsForRole(roleName);
          
          // If no fields found for base role, try with vendor type suffix
          if (kycFields.length === 0) {
            kycFields = getKYCFieldsForRole(roleName, 'solo');
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(roleName, 'business');
            }
          }
          
          if (kycFields.length === 0) {
            console.log(`[KYC-MIGRATE] No KYC fields found for role ${roleName}`);
            skipped++;
            results.push({
              roleId: roleName,
              roleName: role.display_name || roleName,
              status: 'skipped',
              reason: 'No KYC fields found',
            });
            continue;
          }
          
          // Check if form exists
          const existingForms = await select('onboarding_forms', { role_id: roleName });
          
          // Convert KYC fields to form field format
          const formFields = kycFields.map((f, idx) => ({
            id: f.id,
            fieldName: f.fieldName,
            label: f.label,
            type: f.type,
            section: f.section,
            isMandatory: f.isMandatory,
            required: f.required,
            requiresDocument: f.type === 'file',
            requiresVerification: f.requiresVerification || false,
            verificationEndpoint: f.verificationEndpoint || null,
            placeholder: f.placeholder || '',
            helpText: f.helpText || '',
            options: f.options || [],
            validation: f.validation || {},
            displayOrder: f.displayOrder,
            isActive: true,
            defaultValue: '',
            dependsOn: f.conditional || null,
            softBlock: f.softBlock || false,
            declarationText: f.declarationText || null,
          }));
          
          // Get KYC sections
          const roleConfig = ROLE_KYC_CONFIGS[roleName] || ROLE_KYC_CONFIGS[`${roleName}_solo`] || ROLE_KYC_CONFIGS[`${roleName}_business`];
          const sections = roleConfig?.sections || KYC_SECTIONS;
          
          if (existingForms.length > 0) {
            // Merge KYC fields with existing fields
            const existingFields = typeof existingForms[0].fields === 'string'
              ? JSON.parse(existingForms[0].fields)
              : existingForms[0].fields || [];
            
            // Keep existing non-KYC fields and add/update KYC fields
            const kycFieldIds = new Set(formFields.map(f => f.id));
            const nonKycFields = existingFields.filter((f: any) => !kycFieldIds.has(f.id));
            
            const mergedFields = [...nonKycFields, ...formFields];
            
            // Sort by section order then display order
            const sectionOrder: Record<string, number> = {};
            sections.forEach((s: any, idx: number) => {
              sectionOrder[s.id] = idx;
            });
            
            mergedFields.sort((a: any, b: any) => {
              const sectionA = sectionOrder[a.section] ?? 99;
              const sectionB = sectionOrder[b.section] ?? 99;
              if (sectionA !== sectionB) return sectionA - sectionB;
              return (a.displayOrder || 0) - (b.displayOrder || 0);
            });
            
            await update('onboarding_forms', { role_id: roleName }, {
              fields: JSON.stringify(mergedFields),
              sections: JSON.stringify(sections),
              version: (existingForms[0].version || 1) + 1,
              updated_at: new Date().toISOString(),
            });
            
            updated++;
            results.push({
              roleId: roleName,
              roleName: role.display_name || roleName,
              status: 'updated',
              kycFieldsAdded: formFields.length,
              totalFields: mergedFields.length,
            });
          } else {
            // Create new form with KYC fields
            await insert('onboarding_forms', {
              role_id: roleName,
              fields: JSON.stringify(formFields),
              sections: JSON.stringify(sections),
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
              kycFieldsAdded: formFields.length,
            });
          }
        } catch (error: any) {
          errors++;
          console.error(`[KYC-MIGRATE] Error processing role ${role.name}:`, error);
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
        message: `KYC migration completed: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors`,
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
      console.error('[KYC-MIGRATE] Error:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to migrate KYC fields' 
      }, 500);
    }
  });

  /**
   * GET /admin/onboarding-fields/:roleId
   * Get all onboarding fields for a specific role
   */
  app.get('/admin/onboarding-fields/:roleId', async (c) => {
    try {
      const { roleId } = c.req.param();

      // Ensure onboarding_forms table exists with sections column
      await query(`
        CREATE TABLE IF NOT EXISTS onboarding_forms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role_id VARCHAR(255) UNIQUE NOT NULL,
          fields JSONB NOT NULL,
          sections JSONB,
          status VARCHAR(50) DEFAULT 'active',
          version INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `).catch(() => {});
      
      // Add sections column if it doesn't exist (for existing tables)
      await query(`
        ALTER TABLE onboarding_forms ADD COLUMN IF NOT EXISTS sections JSONB
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

      // ✅ NEW: Import and merge KYC fields for the role
      try {
        const { 
          getKYCFieldsForRole, 
          ROLE_KYC_CONFIGS, 
          KYC_SECTIONS 
        } = await import('../lib/kyc-form-fields');
        
        // Get KYC fields for this role (use 'solo' as default for admin view)
        // Try both solo and business variants
        let kycFields = getKYCFieldsForRole(actualRoleName, 'solo');
        if (kycFields.length === 0) {
          kycFields = getKYCFieldsForRole(actualRoleName, 'business');
        }
        if (kycFields.length === 0) {
          kycFields = getKYCFieldsForRole(actualRoleName);
        }
        
        if (kycFields.length > 0) {
          console.log(`[GET /admin/onboarding-fields/:roleId] Adding ${kycFields.length} KYC fields for role ${actualRoleName}`);
          
          // Convert KYC fields to form field format
          const kycFormFields = kycFields.map((f: any) => ({
            id: f.id,
            fieldName: f.fieldName,
            name: f.fieldName, // Add 'name' for frontend compatibility
            label: f.label,
            type: f.type, // Includes 'aadhaar-otp', 'pan-verify', 'gst-verify', 'declaration'
            section: f.section,
            isMandatory: f.isMandatory,
            required: f.isMandatory,
            requiresVerification: f.requiresVerification || false,
            verificationEndpoint: f.verificationEndpoint || null,
            placeholder: f.placeholder || '',
            helpText: f.helpText || '',
            options: f.options || [],
            validation: f.validation || {},
            displayOrder: f.displayOrder || 0,
            order: f.displayOrder || 0,
            isActive: true,
            softBlock: f.softBlock || false,
            declarationText: f.declarationText || null,
            declarationType: f.declarationType || f.id, // Use explicit declarationType if set, otherwise fallback to id
          }));
          
          // Merge KYC fields with stored overrides: DB overrides (placeholder, label, helpText) apply on top of KYC defaults
          const kycFieldIds = new Set(kycFormFields.map((f: any) => f.id));
          const dbFields = [...fields]; // copy from onboarding_forms
          const nonKycFields = fields.filter((f: any) => !kycFieldIds.has(f.id) && !kycFieldIds.has(f.fieldName));
          const mergedKycFields = kycFormFields.map((kf: any) => {
            const stored = dbFields.find((f: any) => f.id === kf.id || f.fieldName === kf.id || f.name === kf.id);
            return stored ? { ...kf, ...stored } : kf;
          });
          fields = [...nonKycFields, ...mergedKycFields];
          
          console.log(`[GET /admin/onboarding-fields/:roleId] Total fields after merge: ${fields.length}`);
        }
        
        // Get role-specific sections from config
        const roleConfig = ROLE_KYC_CONFIGS[actualRoleName] || 
                          ROLE_KYC_CONFIGS[`${actualRoleName}_solo`] || 
                          ROLE_KYC_CONFIGS[`${actualRoleName}_business`];
        
        // Use role's sections if available, otherwise use all KYC sections
        const roleSections = roleConfig?.sections || KYC_SECTIONS;
        
        // Group fields by section using KYC-aware section mapping
        const sections = getSectionsFromFieldsWithKYC(fields, roleSections);
        
        return c.json({
          success: true,
          roleId: actualRoleName,
          roleName: role.display_name || actualRoleName,
          fields,
          sections,
          version: await getFormVersion(actualRoleName),
          kycFieldCount: kycFields.length,
        });
      } catch (kycError) {
        console.error('[GET /admin/onboarding-fields/:roleId] Error loading KYC fields:', kycError);
        // Fall through to return fields without KYC
      }

      // Fallback: If KYC import fails, return fields without KYC
      // Group fields by section (legacy)
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
   * Update an existing onboarding field, or create a stored override for a KYC field
   */
  app.put('/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
    try {
      const { roleId, fieldId } = c.req.param();
      const updates = await c.req.json();

      // Resolve role (same as GET) so alias roleId works and DB uses canonical name
      const role = await getRoleByName(roleId);
      if (!role) {
        return c.json({ error: 'Role not found', requestedRole: roleId }, 404);
      }
      const actualRoleName = role.name;

      let forms = await select('onboarding_forms', { role_id: actualRoleName });

      // Ensure table exists before insert
      await query(`
        CREATE TABLE IF NOT EXISTS onboarding_forms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role_id VARCHAR(255) UNIQUE NOT NULL,
          fields JSONB NOT NULL,
          sections JSONB,
          status VARCHAR(50) DEFAULT 'active',
          version INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `).catch(() => {});

      if (forms.length === 0) {
        // No form row yet: create one with this field as first stored override (e.g. KYC field)
        let kycBase: any = null;
        try {
          const { getKYCFieldsForRole } = await import('../lib/kyc-form-fields');
          const kycFields = getKYCFieldsForRole(actualRoleName, 'solo') || getKYCFieldsForRole(actualRoleName, 'business') || getKYCFieldsForRole(actualRoleName);
          kycBase = kycFields.find((f: any) => f.id === fieldId || f.fieldName === fieldId);
        } catch (_) {}
        const merged = kycBase
          ? { ...kycBase, id: fieldId, fieldName: fieldId, name: fieldId, ...updates, updatedAt: new Date().toISOString() }
          : { id: fieldId, fieldName: fieldId, name: fieldId, ...updates, updatedAt: new Date().toISOString() };
        await insert('onboarding_forms', {
          role_id: actualRoleName,
          fields: JSON.stringify([merged]),
          status: 'active',
          version: 1,
        });
        await incrementFormVersion(actualRoleName);
        return c.json({ success: true, field: merged, message: 'Field updated successfully' });
      }

      let fields: any[] = typeof forms[0].fields === 'string'
        ? JSON.parse(forms[0].fields)
        : forms[0].fields || [];

      const fieldIndex = fields.findIndex((f: any) => f.id === fieldId || f.fieldName === fieldId || f.name === fieldId);
      if (fieldIndex >= 0) {
        // Update existing stored field
        fields[fieldIndex] = {
          ...fields[fieldIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // KYC field not yet in DB: add stored override (GET will merge onto KYC default)
        let kycBase: any = null;
        try {
          const { getKYCFieldsForRole } = await import('../lib/kyc-form-fields');
          const kycFields = getKYCFieldsForRole(actualRoleName, 'solo') || getKYCFieldsForRole(actualRoleName, 'business') || getKYCFieldsForRole(actualRoleName);
          kycBase = kycFields.find((f: any) => f.id === fieldId || f.fieldName === fieldId);
        } catch (_) {}
        const merged = kycBase
          ? { ...kycBase, id: fieldId, fieldName: fieldId, name: fieldId, ...updates, updatedAt: new Date().toISOString() }
          : { id: fieldId, fieldName: fieldId, name: fieldId, ...updates, updatedAt: new Date().toISOString() };
        fields.push(merged);
      }

      await update('onboarding_forms', { role_id: actualRoleName }, {
        fields: JSON.stringify(fields),
        updated_at: new Date().toISOString(),
      });
      await incrementFormVersion(actualRoleName);

      const updatedField = fields[fieldIndex >= 0 ? fieldIndex : fields.length - 1];
      return c.json({
        success: true,
        field: updatedField,
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
