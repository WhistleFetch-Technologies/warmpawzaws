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
  // Do not map clinic names onto veterinarian — clinic uses vet_clinic / veterinary_clinic onboarding + KYC
  'veterinarian': ['veterinarian', 'vet', 'Veterinarian', 'vet_solo'],
  'vet_solo': ['vet_solo', 'veterinarian', 'vet', 'Veterinarian'],
  'vet_clinic': ['vet_clinic', 'veterinary_clinic'],
  'veterinary_clinic': ['veterinary_clinic', 'vet_clinic'],
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

  // Vendor catalogue passes roles.id (UUID); admin designer uses role name — support both first.
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(roleId || '').trim());
  if (uuidLike) {
    const byId = await query(
      'SELECT * FROM roles WHERE id = $1::uuid AND is_active = true LIMIT 1',
      [roleId.trim()]
    );
    if (byId.rows?.length) {
      console.log(`[getRoleByName] Resolved UUID to role name: ${byId.rows[0].name}`);
      return byId.rows[0];
    }
  }
  
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
  
  // ✅ FIX: Correct section order as per requirements
  // Order: 1. Business Information, 2. Local Information, 3. Identity Verification, 
  // 4. Documents, 5. Professional, 6. Permissions, 7. Declaration
  const defaultSections: Record<string, any> = {
    'business_information': { title: 'Business Information', order: 1 },
    'location_information': { title: 'Local Information', order: 2 },
    'identity_verification': { title: 'Identity Verification', order: 3 },
    'documents': { title: 'Documents', order: 4 },
    'professional': { title: 'Professional', order: 5 },
    'permissions': { title: 'Permissions', order: 6 }, // ✅ NEW: Permissions section
    'declarations': { title: 'Declaration', order: 7 },
    // Legacy/backward compatibility mappings
    'basic': { title: 'Business Information', order: 1 },
    'location': { title: 'Local Information', order: 2 },
    'business_registration': { title: 'Professional', order: 5 }, // Map to professional
    'document_verification': { title: 'Documents', order: 4 },
    'banking': { title: 'Banking Details', order: 8 },
    'banking_information': { title: 'Banking Details', order: 8 },
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

      // ✅ PRE-DEDUPLICATION: Remove obvious duplicates from database fields first
      const preSeenIds = new Set<string>();
      const preSeenFieldNames = new Set<string>();
      const initialCount = fields.length;
      
      fields = fields.filter((f: any) => {
        const id = f.id || '';
        const fieldName = f.fieldName || f.name || '';
        
        // Skip if duplicate by ID
        if (id && preSeenIds.has(id)) {
          console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Pre-dedup: Removing duplicate by ID: ${id} (${f.label || 'unknown'})`);
          return false;
        }
        
        // Skip if duplicate by fieldName (but allow if it's a new_field that will be checked later)
        if (fieldName && preSeenFieldNames.has(fieldName) && fieldName !== 'new_field') {
          console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Pre-dedup: Removing duplicate by fieldName: ${fieldName} (${f.label || 'unknown'})`);
          return false;
        }
        
        // Mark as seen
        if (id) preSeenIds.add(id);
        if (fieldName) preSeenFieldNames.add(fieldName);
        
        return true;
      });
      
      if (fields.length < initialCount) {
        console.log(`[GET /admin/onboarding-fields/:roleId] Pre-deduplication removed ${initialCount - fields.length} duplicate(s). Remaining: ${fields.length}`);
      }

      // ✅ NEW: Import and merge KYC fields for the role
      try {
        const { 
          getKYCFieldsForRole, 
          ROLE_KYC_CONFIGS, 
          KYC_SECTIONS 
        } = await import('../lib/kyc-form-fields');
        
        // Get KYC fields for this role
        // ✅ FIX: For business roles (clinic, business), prioritize 'business' vendorType
        // Check role config to determine if it's a business role
        const roleConfigCheck = ROLE_KYC_CONFIGS[actualRoleName] || 
                                ROLE_KYC_CONFIGS[`${actualRoleName}_solo`] || 
                                ROLE_KYC_CONFIGS[`${actualRoleName}_business`];
        const isBusinessRole = roleConfigCheck?.vendorTypes?.includes('business') || 
                              actualRoleName.includes('clinic') || 
                              actualRoleName.includes('business') ||
                              actualRoleName === 'vet_clinic' ||
                              actualRoleName === 'veterinary_clinic';
        
        let kycFields: any[] = [];
        if (isBusinessRole) {
          // For business roles, try business first, then solo, then default
          kycFields = getKYCFieldsForRole(actualRoleName, 'business');
          if (kycFields.length === 0) {
            kycFields = getKYCFieldsForRole(actualRoleName, 'solo');
          }
          if (kycFields.length === 0) {
            kycFields = getKYCFieldsForRole(actualRoleName);
          }
        } else {
          // For solo roles, try solo first, then business, then default
          kycFields = getKYCFieldsForRole(actualRoleName, 'solo');
          if (kycFields.length === 0) {
            kycFields = getKYCFieldsForRole(actualRoleName, 'business');
          }
          if (kycFields.length === 0) {
            kycFields = getKYCFieldsForRole(actualRoleName);
          }
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
          
          // ✅ AGGRESSIVE DEDUPLICATION: Remove duplicates and new_field conflicts
          const kycFieldIds = new Set(kycFormFields.map((f: any) => f.id));
          const kycFieldNames = new Set(kycFormFields.map((f: any) => f.fieldName || f.name));
          const kycFieldLabels = new Set(kycFormFields.map((f: any) => (f.label || '').toLowerCase().trim()));
          
          // Build a map of KYC fields by semantic key (label + type + section) for duplicate detection
          const kycSemanticMap = new Map<string, any>();
          kycFormFields.forEach((kf: any) => {
            const semanticKey = `${(kf.label || '').toLowerCase().trim()}_${kf.type}_${kf.section}`;
            kycSemanticMap.set(semanticKey, kf);
          });
          
          const dbFields = [...fields]; // copy from onboarding_forms
          
          // ✅ STEP 1: Filter out fields that match KYC by ID, fieldName, or name
          const nonKycFields = fields.filter((f: any) => {
            // Skip if it's a KYC field by ID/fieldName/name
            if (kycFieldIds.has(f.id) || kycFieldNames.has(f.fieldName) || kycFieldNames.has(f.name)) {
              return false;
            }
            
            // ✅ STEP 2: Remove fields with fieldName="new_field" that duplicate KYC fields semantically
            if (f.fieldName === 'new_field' || f.fieldName === 'newField' || f.fieldName === 'new-field') {
              const fieldLabel = (f.label || '').toLowerCase().trim();
              const semanticKey = `${fieldLabel}_${f.type}_${f.section}`;
              
              // If this new_field semantically matches a KYC field, remove it
              if (kycSemanticMap.has(semanticKey)) {
                console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Removing duplicate new_field: "${f.label}" (matches KYC field)`);
                return false;
              }
              
              // Also check if label contains keywords that match KYC fields
              const labelKeywords = ['aadhaar', 'aadhar', 'pan', 'gst', 'cancelled cheque', 'cancellation cheque', 'cancelled check'];
              const matchedKeyword = labelKeywords.find(keyword => fieldLabel.includes(keyword.toLowerCase()));
              if (matchedKeyword) {
                // Check if any KYC field has similar label
                const hasMatchingKyc = Array.from(kycSemanticMap.values()).some((kf: any) => {
                  const kycLabel = (kf.label || '').toLowerCase();
                  return kycLabel.includes(matchedKeyword.toLowerCase()) && kf.section === f.section;
                });
                if (hasMatchingKyc) {
                  console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Removing duplicate new_field: "${f.label}" (matches KYC keyword: ${matchedKeyword})`);
                  return false;
                }
              }
            }
            
            return true;
          });
          
          // ✅ STEP 3: Merge KYC fields with stored overrides (DB overrides apply on top of KYC defaults)
          const mergedKycFields = kycFormFields.map((kf: any) => {
            const stored = dbFields.find((f: any) => f.id === kf.id || f.fieldName === kf.id || f.name === kf.id);
            return stored ? { ...kf, ...stored } : kf;
          });
          
          // ✅ STEP 4: For business roles, remove solo-specific Aadhaar fields if business-specific ones exist
          // Determine vendor type from role config
          const roleConfig = ROLE_KYC_CONFIGS[actualRoleName] || 
                            ROLE_KYC_CONFIGS[`${actualRoleName}_solo`] || 
                            ROLE_KYC_CONFIGS[`${actualRoleName}_business`];
          const isBusinessRole = roleConfig?.vendorTypes?.includes('business') || 
                                actualRoleName.includes('clinic') || 
                                actualRoleName.includes('business') ||
                                actualRoleName === 'vet_clinic' ||
                                actualRoleName === 'veterinary_clinic';
          
          if (isBusinessRole) {
            const hasOwnerAadhaar = mergedKycFields.some((f: any) => 
              f.id === 'ownerAadhaarNumber' || f.fieldName === 'ownerAadhaarNumber'
            );
            
            if (hasOwnerAadhaar) {
              // Remove solo-specific aadhaarNumber if ownerAadhaarNumber exists
              const soloAadhaarIndex = mergedKycFields.findIndex((f: any) => 
                f.id === 'aadhaarNumber' && f.fieldName === 'aadhaarNumber'
              );
              if (soloAadhaarIndex >= 0) {
                console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Removing solo-specific aadhaarNumber (business has ownerAadhaarNumber)`);
                mergedKycFields.splice(soloAadhaarIndex, 1);
              }
              
              // Also remove from nonKycFields if present
              const soloAadhaarInNonKyc = nonKycFields.findIndex((f: any) => 
                f.id === 'aadhaarNumber' || f.fieldName === 'aadhaarNumber'
              );
              if (soloAadhaarInNonKyc >= 0) {
                console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Removing solo-specific aadhaarNumber from non-KYC fields`);
                nonKycFields.splice(soloAadhaarInNonKyc, 1);
              }
            }
          }
          
          // ✅ STEP 5: AGGRESSIVE Final deduplication using multiple criteria
          const finalFieldsMap = new Map<string, any>();
          const seenIds = new Set<string>();
          const seenFieldNames = new Set<string>();
          const seenSemanticKeys = new Set<string>();
          
          // Helper to generate semantic key for duplicate detection
          const getSemanticKey = (f: any) => {
            const label = (f.label || '').toLowerCase().trim().replace(/\s+/g, '_');
            const type = f.type || 'text';
            const section = f.section || 'additional_information';
            return `${label}_${type}_${section}`;
          };
          
          // Add non-KYC fields first (lower priority)
          nonKycFields.forEach((f: any) => {
            const id = f.id || '';
            const fieldName = f.fieldName || f.name || '';
            const semanticKey = getSemanticKey(f);
            
            // Skip if already seen by any criteria
            if (id && seenIds.has(id)) {
              console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Skipping duplicate by ID: ${id} (${f.label})`);
              return;
            }
            if (fieldName && seenFieldNames.has(fieldName)) {
              console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Skipping duplicate by fieldName: ${fieldName} (${f.label})`);
              return;
            }
            if (seenSemanticKeys.has(semanticKey)) {
              console.log(`[GET /admin/onboarding-fields/:roleId] ⚠️ Skipping duplicate by semantic key: ${semanticKey} (${f.label})`);
              return;
            }
            
            // Mark as seen
            if (id) seenIds.add(id);
            if (fieldName) seenFieldNames.add(fieldName);
            seenSemanticKeys.add(semanticKey);
            
            // Use ID as primary key, fallback to fieldName, then semantic key
            const key = id || fieldName || semanticKey;
            finalFieldsMap.set(key, f);
          });
          
          // Add merged KYC fields (higher priority - overwrites duplicates)
          mergedKycFields.forEach((f: any) => {
            const id = f.id || '';
            const fieldName = f.fieldName || f.name || '';
            const semanticKey = getSemanticKey(f);
            
            // Mark as seen (KYC fields take precedence)
            if (id) seenIds.add(id);
            if (fieldName) seenFieldNames.add(fieldName);
            seenSemanticKeys.add(semanticKey);
            
            // Use ID as primary key, fallback to fieldName, then semantic key
            const key = id || fieldName || semanticKey;
            finalFieldsMap.set(key, f); // Overwrite if exists
          });
          
          fields = Array.from(finalFieldsMap.values());
          
          console.log(`[GET /admin/onboarding-fields/:roleId] Total fields after aggressive deduplication: ${fields.length} (IDs: ${seenIds.size}, FieldNames: ${seenFieldNames.size}, Semantic: ${seenSemanticKeys.size})`);
        }
        
        // Get role-specific sections from config
        const roleConfig = ROLE_KYC_CONFIGS[actualRoleName] || 
                          ROLE_KYC_CONFIGS[`${actualRoleName}_solo`] || 
                          ROLE_KYC_CONFIGS[`${actualRoleName}_business`];
        
        // Use role's sections if available, otherwise use all KYC sections
        const roleSections = roleConfig?.sections || KYC_SECTIONS;
        
        // ✅ FIX: Filter out inactive fields (including KYC fields with stored override isActive=false)
        // Admin UI should only show active fields
        const activeFields = fields.filter((f: any) => f.isActive !== false);
        
        // Group fields by section using KYC-aware section mapping (only active fields)
        const sections = getSectionsFromFieldsWithKYC(activeFields, roleSections);
        
        return c.json({
          success: true,
          roleId: actualRoleName,
          roleName: role.display_name || actualRoleName,
          fields: activeFields, // ✅ FIX: Return only active fields
          sections,
          version: await getFormVersion(actualRoleName),
          kycFieldCount: kycFields.length,
        });
      } catch (kycError) {
        console.error('[GET /admin/onboarding-fields/:roleId] Error loading KYC fields:', kycError);
        // Fall through to return fields without KYC
      }

      // Fallback: If KYC import fails, return fields without KYC
      // ✅ FIX: Filter out inactive fields
      const activeFields = fields.filter((f: any) => f.isActive !== false);
      // Group fields by section (legacy)
      const sections = getSectionsFromFields(activeFields);

      return c.json({
        success: true,
        roleId: actualRoleName,
        roleName: role.display_name || actualRoleName,
        fields: activeFields, // ✅ FIX: Return only active fields
        sections,
        version: await getFormVersion(actualRoleName),
      });
    } catch (error: any) {
      console.error('Error fetching onboarding fields:', error);
      return c.json({ error: error.message || 'Failed to fetch onboarding fields' }, 500);
    }
  });

  /**
   * GET /admin/onboarding-fields/:roleId/:fieldId
   * Get a specific onboarding field by ID
   * ✅ FIX: Also check KYC fields (same as GET all fields endpoint)
   */
  app.get('/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
    try {
      const { roleId, fieldId } = c.req.param();

      // ✅ FIX: Resolve role (same as PUT/DELETE) so alias roleId works
      const role = await getRoleByName(roleId);
      if (!role) {
        return c.json({ error: 'Role not found', requestedRole: roleId }, 404);
      }
      const actualRoleName = role.name;

      const forms = await select('onboarding_forms', { role_id: actualRoleName });
      if (forms.length === 0) {
        return c.json({ error: 'Form not found for this role' }, 404);
      }

      let dbFields: any[] = typeof forms[0].fields === 'string'
        ? JSON.parse(forms[0].fields)
        : forms[0].fields || [];

      // ✅ FIX: First check database fields
      let field = dbFields.find((f: any) => 
        f.id === fieldId || 
        f.fieldName === fieldId || 
        f.name === fieldId
      );

      // ✅ FIX: If not found in DB, check KYC fields (same logic as GET all fields)
      if (!field) {
        try {
          const { getKYCFieldsForRole, ROLE_KYC_CONFIGS } = await import('../lib/kyc-form-fields');
          
          const roleConfigCheck = ROLE_KYC_CONFIGS[actualRoleName] || 
                                  ROLE_KYC_CONFIGS[`${actualRoleName}_solo`] || 
                                  ROLE_KYC_CONFIGS[`${actualRoleName}_business`];
          const isBusinessRole = roleConfigCheck?.vendorTypes?.includes('business') || 
                                actualRoleName.includes('clinic') || 
                                actualRoleName.includes('business') ||
                                actualRoleName === 'vet_clinic' ||
                                actualRoleName === 'veterinary_clinic';
          
          let kycFields: any[] = [];
          if (isBusinessRole) {
            kycFields = getKYCFieldsForRole(actualRoleName, 'business');
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName, 'solo');
            }
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName);
            }
          } else {
            kycFields = getKYCFieldsForRole(actualRoleName, 'solo');
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName, 'business');
            }
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName);
            }
          }
          
          // Convert KYC field to form field format and check for stored override
          const kycField = kycFields.find((f: any) => 
            f.id === fieldId || f.fieldName === fieldId
          );
          
          if (kycField) {
            const kycFormField = {
              id: kycField.id,
              fieldName: kycField.fieldName,
              name: kycField.fieldName,
              label: kycField.label,
              type: kycField.type,
              section: kycField.section,
              isMandatory: kycField.isMandatory,
              required: kycField.required,
              requiresVerification: kycField.requiresVerification || false,
              verificationEndpoint: kycField.verificationEndpoint || null,
              placeholder: kycField.placeholder || '',
              helpText: kycField.helpText || '',
              options: kycField.options || [],
              validation: kycField.validation || {},
              displayOrder: kycField.displayOrder,
              order: kycField.displayOrder,
              isActive: true,
              softBlock: kycField.softBlock || false,
              declarationText: kycField.declarationText || null,
              declarationType: kycField.declarationType || kycField.id,
            };
            
            // Check for stored override in DB
            const storedOverride = dbFields.find((f: any) => 
              f.id === fieldId || f.fieldName === fieldId || f.name === fieldId
            );
            
            // Merge stored override on top of KYC default
            field = storedOverride ? { ...kycFormField, ...storedOverride } : kycFormField;
          }
        } catch (kycError) {
          console.error('[GET /admin/onboarding-fields/:roleId/:fieldId] Error loading KYC fields:', kycError);
        }
      }

      if (!field) {
        console.log(`[GET /admin/onboarding-fields/:roleId/:fieldId] Field "${fieldId}" not found in role "${actualRoleName}"`);
        console.log(`[GET] Available DB field IDs:`, dbFields.map((f: any) => f.id || f.fieldName || f.name).join(', '));
        return c.json({ error: 'Field not found' }, 404);
      }

      return c.json({
        success: true,
        field,
        roleId: actualRoleName,
        roleName: role.display_name || actualRoleName,
        isKycField: !dbFields.find((f: any) => f.id === fieldId || f.fieldName === fieldId || f.name === fieldId),
      });
    } catch (error: any) {
      console.error('Error fetching onboarding field:', error);
      return c.json({ error: error.message || 'Failed to fetch field' }, 500);
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

      // ✅ FIX: Validate role exists with case-insensitive fallback and use actual role name
      const role = await getRoleByName(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      const actualRoleName = role.name;

      // Get existing fields (use actual role name from DB)
      const forms = await select('onboarding_forms', { role_id: actualRoleName });
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

      // Save updated fields (use actual role name from DB)
      if (forms.length > 0) {
        await update('onboarding_forms', { role_id: actualRoleName }, {
          fields: JSON.stringify(existingFields),
          updated_at: new Date().toISOString(),
        });
        await incrementFormVersion(actualRoleName);
      } else {
        await insert('onboarding_forms', {
          role_id: actualRoleName,
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
   * ✅ FIX: Match fields by id, fieldName, or name (same as PUT endpoint)
   * ✅ FIX: Resolve role aliases using getRoleByName (same as PUT endpoint)
   * ✅ FIX: Handle KYC fields by creating stored override with isActive=false
   */
  app.delete('/admin/onboarding-fields/:roleId/:fieldId', async (c) => {
    try {
      const { roleId, fieldId } = c.req.param();

      // ✅ FIX: Resolve role (same as PUT) so alias roleId works and DB uses canonical name
      const role = await getRoleByName(roleId);
      if (!role) {
        return c.json({ error: 'Role not found', requestedRole: roleId }, 404);
      }
      const actualRoleName = role.name;

      // Ensure table exists
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

      let forms = await select('onboarding_forms', { role_id: actualRoleName });
      
      let fields: any[] = [];
      if (forms.length > 0) {
        fields = typeof forms[0].fields === 'string'
          ? JSON.parse(forms[0].fields)
          : forms[0].fields || [];
      }

      // ✅ FIX: Match field by id, fieldName, or name (same logic as PUT endpoint)
      const fieldIndex = fields.findIndex((f: any) => 
        f.id === fieldId || 
        f.fieldName === fieldId || 
        f.name === fieldId
      );

      // ✅ FIX: If field not in DB, check if it's a KYC field
      let isKycField = false;
      let kycFieldBase: any = null;
      
      if (fieldIndex < 0) {
        try {
          const { getKYCFieldsForRole, ROLE_KYC_CONFIGS } = await import('../lib/kyc-form-fields');
          
          const roleConfigCheck = ROLE_KYC_CONFIGS[actualRoleName] || 
                                  ROLE_KYC_CONFIGS[`${actualRoleName}_solo`] || 
                                  ROLE_KYC_CONFIGS[`${actualRoleName}_business`];
          const isBusinessRole = roleConfigCheck?.vendorTypes?.includes('business') || 
                                actualRoleName.includes('clinic') || 
                                actualRoleName.includes('business') ||
                                actualRoleName === 'vet_clinic' ||
                                actualRoleName === 'veterinary_clinic';
          
          let kycFields: any[] = [];
          if (isBusinessRole) {
            kycFields = getKYCFieldsForRole(actualRoleName, 'business');
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName, 'solo');
            }
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName);
            }
          } else {
            kycFields = getKYCFieldsForRole(actualRoleName, 'solo');
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName, 'business');
            }
            if (kycFields.length === 0) {
              kycFields = getKYCFieldsForRole(actualRoleName);
            }
          }
          
          kycFieldBase = kycFields.find((f: any) => 
            f.id === fieldId || f.fieldName === fieldId
          );
          
          if (kycFieldBase) {
            isKycField = true;
            console.log(`[DELETE] Field "${fieldId}" is a KYC field - creating stored override with isActive=false`);
          }
        } catch (kycError) {
          console.error('[DELETE] Error checking KYC fields:', kycError);
        }
      }

      if (fieldIndex < 0 && !isKycField) {
        console.log(`[DELETE /admin/onboarding-fields/:roleId/:fieldId] Field "${fieldId}" not found in role "${actualRoleName}"`);
        console.log(`[DELETE] Available field IDs:`, fields.map((f: any) => f.id || f.fieldName || f.name).join(', '));
        return c.json({ error: 'Field not found' }, 404);
      }

      let deletedField: any;

      if (isKycField) {
        // ✅ FIX: For KYC fields, create a stored override with isActive=false
        // This will hide the field when GET merges KYC fields with stored overrides
        const storedOverride = {
          id: fieldId,
          fieldName: fieldId,
          name: fieldId,
          label: kycFieldBase.label,
          type: kycFieldBase.type,
          section: kycFieldBase.section,
          isActive: false, // ✅ KEY: Mark as inactive to hide it
          isMandatory: kycFieldBase.isMandatory,
          required: kycFieldBase.required,
          requiresVerification: kycFieldBase.requiresVerification || false,
          verificationEndpoint: kycFieldBase.verificationEndpoint || null,
          placeholder: kycFieldBase.placeholder || '',
          helpText: kycFieldBase.helpText || '',
          options: kycFieldBase.options || [],
          validation: kycFieldBase.validation || {},
          displayOrder: kycFieldBase.displayOrder || 0,
          softBlock: kycFieldBase.softBlock || false,
          declarationText: kycFieldBase.declarationText || null,
          declarationType: kycFieldBase.declarationType || fieldId,
          updatedAt: new Date().toISOString(),
          deletedAt: new Date().toISOString(), // Mark as deleted
        };
        
        // Check if override already exists
        const existingOverrideIndex = fields.findIndex((f: any) => 
          f.id === fieldId || f.fieldName === fieldId || f.name === fieldId
        );
        
        if (existingOverrideIndex >= 0) {
          // Update existing override
          fields[existingOverrideIndex] = storedOverride;
          deletedField = storedOverride;
        } else {
          // Add new override
          fields.push(storedOverride);
          deletedField = storedOverride;
        }
      } else {
        // Regular field - remove from array
        deletedField = fields[fieldIndex];
        fields.splice(fieldIndex, 1);

        // Reorder remaining fields
        fields.forEach((f: any, idx: number) => {
          f.displayOrder = idx;
          f.updatedAt = new Date().toISOString();
        });
      }

      // Save updated fields
      if (forms.length > 0) {
        await update('onboarding_forms', { role_id: actualRoleName }, {
          fields: JSON.stringify(fields),
          updated_at: new Date().toISOString(),
        });
      } else {
        await insert('onboarding_forms', {
          role_id: actualRoleName,
          fields: JSON.stringify(fields),
          status: 'active',
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      await incrementFormVersion(actualRoleName);

      console.log(`[DELETE /admin/onboarding-fields/:roleId/:fieldId] Successfully ${isKycField ? 'deactivated (KYC field)' : 'deleted'} field "${fieldId}" from role "${actualRoleName}"`);

      return c.json({
        success: true,
        message: isKycField ? 'KYC field deactivated successfully (stored override created)' : 'Field deleted successfully',
        deletedField: {
          id: deletedField.id,
          fieldName: deletedField.fieldName || deletedField.name,
          label: deletedField.label,
        },
        isKycField,
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
