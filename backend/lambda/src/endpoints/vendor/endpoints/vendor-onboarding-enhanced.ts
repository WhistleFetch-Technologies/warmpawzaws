/**
 * ============================================================================
 * VENDOR ONBOARDING ENDPOINTS - ENHANCED VERSION (PHASE 4)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * - Fixed database import path
 * 
 * Endpoints:
 * - GET /vendor/onboarding/status - Get onboarding status
 * - GET /vendor/onboarding/roles - Get available roles
 * - POST /vendor/onboarding/select-role - Select role
 * - POST /vendor/onboarding/select-vendor-type - Select vendor type
 * - GET /vendor/onboarding/form-schema - Get form schema
 * - POST /vendor/onboarding/submit-application - Submit application
 * - POST /vendor/onboarding/activate - Activate vendor
 * - Admin approve/reject: POST /admin/vendor/application/:applicationId/approve|reject (not this router)
 * - POST /vendor/setup/update-completion - Update setup completion
 * - POST /vendor/setup/go-live - Go live
 * 
 * Date: 2026-01-28
 * Phase: 4
 * ============================================================================
 */

import { Hono, Context } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../handler/base-handler-enhanced';
import { select, insert, update, query } from '../../../database/rds-connection';
import {
  SubmitVendorApplicationRequestSchema,
  SelectVendorRoleRequestSchema,
  SelectVendorTypeRequestSchema,
} from '@warmpawz/api-contracts/vendors';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { inferVendorKindFromServiceCategory } from './vendor-profile.vendor';

// ============================================================================
// PHASE 1: AUTH & ENTRY
// ============================================================================

class GetOnboardingStatusHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const requestId = context.requestId;
    
    console.log('[GetOnboardingStatusHandlerEnhanced] Handler called');
    console.log('[GetOnboardingStatusHandlerEnhanced] Phone from query params:', phone);
    console.log('[GetOnboardingStatusHandlerEnhanced] Request ID:', requestId);
    
    if (!phone) {
      console.log('[GetOnboardingStatusHandlerEnhanced] Missing phone parameter');
      return this.error('Phone number is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // ✅ FIX: Normalize phone number for database lookups
    const phoneDigits = phone.replace(/\D/g, '');
    const normalizedPhone = phoneDigits.length > 10 
      ? phoneDigits.slice(-10)
      : phoneDigits.length === 9 
        ? '0' + phoneDigits
        : phoneDigits;

    // Check if UAT mode is enabled - ONLY check UAT_MODE env variable
    const isUATMode = process.env.UAT_MODE === 'true';

    try {
      // Get or create vendor identity - try both phone formats
      // ✅ SECURITY: Filter out soft-deleted records so deleted users are treated as new
      let identity = await select('vendor_identity', { phone });
      if (identity.length === 0 && phone !== normalizedPhone) {
        identity = await select('vendor_identity', { phone: normalizedPhone });
      }
      
      // ✅ CRITICAL FIX: Filter out deleted records AND records pointing to deleted vendors
      identity = identity.filter((vi: any) => {
        // Check if vendor_identity itself is deleted
        const isDeleted = vi.is_deleted === true || 
          vi.is_deleted === 't' ||
          (typeof vi.is_deleted === 'string' && vi.is_deleted.toLowerCase() === 'true');
        
        if (isDeleted) {
          return false; // Exclude deleted vendor_identity records
        }
        
        // ✅ NEW: If vendor_identity points to a vendor_id, we should still allow it
        // The vendor check will happen separately, but we don't want to reuse
        // a deleted vendor_identity that points to a deleted vendor
        // For now, allow it - the vendor creation will handle checking if vendor is deleted
        return true;
      });
      
      if (identity.length === 0) {
        // Create new vendor identity with INIT status
        // ✅ CRITICAL FIX: Start with empty metadata, don't copy from deleted records
        const newIdentityData: any = {
          phone: normalizedPhone,
          onboarding_status: 'INIT',
          metadata: {}, // Always start with clean metadata
        };
        
        const newIdentity = await insert('vendor_identity', newIdentityData);
        identity = newIdentity;
        console.log(`[ONBOARDING STATUS] Created new vendor_identity for ${normalizedPhone} with status: INIT`);
      } else {
        console.log(`[ONBOARDING STATUS] Found existing active vendor_identity for ${normalizedPhone}`);
      }

      const vendorIdentity = identity[0];
      
      // Get application if exists
      let application = null;
      if (vendorIdentity.application_id) {
        const apps = await select('vendor_onboarding_applications', {
          id: vendorIdentity.application_id,
        });
        application = apps.length > 0 ? apps[0] : null;
      }

      // Get role info if selected
      let role = null;
      if (vendorIdentity.selected_role_id) {
        const roles = await select('roles', {
          id: vendorIdentity.selected_role_id,
          is_active: true,
        });
        role = roles.length > 0 ? roles[0] : null;
      }

      return this.success({
        identity: vendorIdentity,
        application,
        role,
        nextStep: this.getNextStep(vendorIdentity.onboarding_status),
      }, requestId);
    } catch (error: any) {
      console.error('[GetOnboardingStatusHandlerEnhanced] Error caught in catch block');
      console.error('[GetOnboardingStatusHandlerEnhanced] Error message:', error?.message);
      console.error('[GetOnboardingStatusHandlerEnhanced] Error stack:', error?.stack);
      console.error('[GetOnboardingStatusHandlerEnhanced] Error code:', error?.code);
      console.error('[GetOnboardingStatusHandlerEnhanced] Full error:', error);
      
      // If table doesn't exist or DB error, return a default INIT response
      // This allows new vendors to start the onboarding flow even if DB isn't fully configured
      if (error.message?.includes('does not exist') || 
          error.message?.includes('relation') ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('timeout')) {
        console.warn('[GetOnboardingStatusHandlerEnhanced] DB Error - returning default INIT status for phone:', phone);
        return this.success({
          identity: {
            phone,
            onboarding_status: 'INIT',
            metadata: {},
            created_at: new Date().toISOString(),
          },
          application: null,
          role: null,
          nextStep: '/onboarding/role-selection',
          _warning: 'Using default status due to database connectivity issue',
        }, requestId);
      }
      
      // For other errors, still return a valid response with error info
      // rather than a 500, to allow frontend to handle gracefully
      console.error('[ONBOARDING] Unexpected error:', error.message);
      return this.success({
        identity: {
          phone,
          onboarding_status: 'INIT',
          metadata: {},
          created_at: new Date().toISOString(),
        },
        application: null,
        role: null,
        nextStep: '/onboarding/role-selection',
        _error: error.message || 'Unknown error',
      }, requestId);
    }
  }

  private getNextStep(status: string): string {
    const stepMap: Record<string, string> = {
      INIT: '/onboarding/role-selection',
      ROLE_PENDING: '/onboarding/vendor-type',
      FORM_PENDING: '/onboarding/form',
      UNDER_REVIEW: '/onboarding/pending-review',
      CLARIFICATION_REQUIRED: '/onboarding/clarification',
      APPROVED: '/onboarding/approved',
      REJECTED: '/onboarding/rejected',
      ACTIVATED: '/dashboard',
    };
    return stepMap[status] || '/onboarding/role-selection';
  }
}

// ============================================================================
// PHASE 2: ROLE SELECTION
// ============================================================================

class GetAvailableRolesHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const requestId = context.requestId;

    try {
      // Get all active roles
      const roles = await select('roles', { is_active: true });
      
      // Get permissions for each role
      const rolesWithConfig = await Promise.all(
        roles.map(async (role) => {
          const permissions = await select('role_permissions', {
            role_id: role.id,
          });
          
          return {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            config: role.config || {},
            capabilities: permissions.map((p: any) => p.permission_name),
            vendor_types_supported: role.config?.vendorTypes || ['solo', 'business'],
          };
        })
      );

      return this.success({ roles: rolesWithConfig }, requestId);
    } catch (error: any) {
      console.error('Error getting roles:', error);
      // Graceful degradation: return empty roles array instead of 500
      if (error.message?.includes('does not exist') || 
          error.message?.includes('relation') ||
          error.message?.includes('roles')) {
        console.warn('[Vendor Onboarding Roles] Table not found, returning empty list');
        return this.success({ roles: [] }, requestId);
      }
      // For other errors, also return gracefully
      return this.success({ 
        roles: [],
        message: `Failed to get roles: ${error.message}`,
      }, requestId);
    }
  }
}

class SelectRoleHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    // Validate request with Zod schema
    const validationResult = SelectVendorRoleRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { phone, role_id } = validationResult.data;

    try {
      // Get vendor identity
      // ✅ CRITICAL FIX: Filter out deleted vendor_identity records
      let identities = await select('vendor_identity', { phone });
      identities = identities.filter((vi: any) => {
        const isDeleted = vi.is_deleted === true || 
          vi.is_deleted === 't' ||
          (typeof vi.is_deleted === 'string' && vi.is_deleted.toLowerCase() === 'true');
        return !isDeleted;
      });
      
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const identity = identities[0];

      // Validate role exists and is active (support both UUID id and canonical name)
      let roles = await select('roles', { id: role_id, is_active: true });
      if (roles.length === 0) {
        roles = await select('roles', { name: role_id, is_active: true });
      }
      if (roles.length === 0) {
        return this.error('Role not found or inactive', 404, 'NOT_FOUND', undefined, requestId);
      }
      const selectedRole = roles[0];
      const resolvedRoleId = selectedRole.id;

      // Update identity with selected role (store DB id so downstream uses consistent id)
      await update(
        'vendor_identity',
        { id: identity.id },
        {
          selected_role_id: resolvedRoleId,
          updated_at: new Date().toISOString(),
        }
      );

      // Transition to ROLE_PENDING if currently INIT
      if (identity.onboarding_status === 'INIT') {
        await query(
          `SELECT transition_onboarding_status($1, $2, NULL, 'system', 'role_selected', '{}'::jsonb)`,
          [identity.id, 'ROLE_PENDING']
        );
      }

      return this.success({
        message: 'Role selected successfully',
        nextStep: '/onboarding/vendor-type',
      }, requestId);
    } catch (error: any) {
      console.error('Error selecting role:', error);
      return this.error(
        error.message || 'Failed to select role',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// PHASE 3: VENDOR TYPE
// ============================================================================

class SelectVendorTypeHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    // Validate request with Zod schema
    const validationResult = SelectVendorTypeRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { phone, vendor_type } = validationResult.data;

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const identity = identities[0];

      if (!identity.selected_role_id) {
        return this.error('Role must be selected first', 400, 'VALIDATION_ERROR', undefined, requestId);
      }

      // Validate vendor_type is supported by role
      const roles = await select('roles', { id: identity.selected_role_id });
      if (roles.length === 0) {
        return this.error('Role not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const role = roles[0];
      // Removed vendorTypes validation since we're no longer distinguishing between solo/business
      // All vendors will be set to 'business' type by default
      // const supportedTypes = role.config?.vendorTypes || [];
      // if (!supportedTypes.includes(vendor_type)) {
      //   return this.error(...);
      // }

      // Update identity
      await update(
        'vendor_identity',
        { id: identity.id },
        {
          vendor_type,
          updated_at: new Date().toISOString(),
        }
      );

      // Transition to FORM_PENDING
      if (identity.onboarding_status === 'ROLE_PENDING') {
        await query(
          `SELECT transition_onboarding_status($1, $2, NULL, 'system', 'vendor_type_selected', '{}'::jsonb)`,
          [identity.id, 'FORM_PENDING']
        );
      }

      return this.success({
        message: 'Vendor type selected successfully',
        nextStep: '/onboarding/form',
      }, requestId);
    } catch (error: any) {
      console.error('Error selecting vendor type:', error);
      return this.error(
        error.message || 'Failed to select vendor type',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// PHASE 4: DYNAMIC ONBOARDING FORM
// ============================================================================

class GetOnboardingFormSchemaHandlerEnhanced extends BaseHandlerEnhanced {
  // Default form fields when no role is selected
  private static DEFAULT_FORM_FIELDS = [
    {
      id: 'businessName', name: 'businessName', label: 'Business Name', type: 'text',
      section: 'business_information', placeholder: 'Enter your business name',
      validation: { required: true, minLength: 3 }, order: 1, isActive: true
    },
    {
      id: 'fullName', name: 'fullName', label: 'Full Name', type: 'text',
      section: 'business_information', placeholder: 'Enter your full name',
      validation: { required: true }, order: 2, isActive: true
    },
    {
      id: 'email', name: 'email', label: 'Email Address', type: 'email',
      section: 'business_information', placeholder: 'your@email.com',
      validation: { required: true }, order: 3, isActive: true
    },
    {
      id: 'phone', name: 'phone', label: 'Contact Number', type: 'tel',
      section: 'business_information', placeholder: '+91 XXXXX XXXXX',
      validation: { required: true }, order: 4, isActive: true
    },
    {
      id: 'address', name: 'address', label: 'Business Address', type: 'textarea',
      section: 'location_information', placeholder: 'Enter complete address',
      validation: { required: true }, order: 5, isActive: true
    },
    {
      id: 'city', name: 'city', label: 'City', type: 'text',
      section: 'location_information', placeholder: 'Enter city',
      validation: { required: true }, order: 6, isActive: true
    },
    {
      id: 'pincode', name: 'pincode', label: 'Pincode', type: 'text',
      section: 'location_information', placeholder: 'Enter pincode',
      validation: { required: true, pattern: '^[0-9]{6}$' }, order: 7, isActive: true
    },
  ];

  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const roleIdParam = context.event.queryStringParameters?.roleId;
    const vendorTypeParam = context.event.queryStringParameters?.vendorType;
    const requestId = context.requestId;

    if (!phone && !roleIdParam) {
      return this.error('Phone number or roleId is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      let selectedRoleId = roleIdParam;
      let vendorType = vendorTypeParam || 'business';
      let identity: any = null;

      // If phone is provided, try to get vendor identity
      if (phone) {
        const identities = await select('vendor_identity', { phone });
        if (identities.length > 0) {
          identity = identities[0];
          // Use identity values if available, fallback to query params
          selectedRoleId = identity.selected_role_id || roleIdParam;
          vendorType = identity.vendor_type || vendorTypeParam || 'business';
        }
      }

      // ✅ FIX: If no role is selected, return default form fields instead of error
      if (!selectedRoleId) {
        console.log('⚠️ [FORM SCHEMA] No role selected, returning DEFAULT FIELDS');
        const defaultSections = this.getSectionsFromFields(GetOnboardingFormSchemaHandlerEnhanced.DEFAULT_FORM_FIELDS);
        return this.success({
          success: true,
          roleId: null,
          roleName: 'default',
          fields: GetOnboardingFormSchemaHandlerEnhanced.DEFAULT_FORM_FIELDS,
          sections: defaultSections,
          schema: {
            fields: GetOnboardingFormSchemaHandlerEnhanced.DEFAULT_FORM_FIELDS,
            sections: defaultSections,
          },
          message: 'Using default form fields. Select a role for role-specific fields.',
        }, requestId);
      }

      // Get form schema from onboarding forms table (matching reference implementation)
      // First, get the role to find its name
      const roles = await select('roles', { id: selectedRoleId });
      let roleName = 'default';
      
      if (roles.length > 0) {
        roleName = roles[0].name;
      } else {
        // selectedRoleId might be a role name, not UUID
        roleName = selectedRoleId;
      }
      
      console.log(`📋 [FORM SCHEMA] Looking for form for role: ${roleName} (UUID: ${selectedRoleId})`);
      
      // Forms are stored by role name, not UUID - try both
      const formsResult = await query(
        `SELECT * FROM onboarding_forms WHERE role_id = $1 OR role_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [roleName, selectedRoleId]
      );
      const forms = formsResult.rows || [];
      let fields: any[] = [];

      if (forms.length > 0) {
        console.log(`✅ [FORM SCHEMA] Found existing form for role ${roleName}`);
        fields = typeof forms[0].fields === 'string' 
          ? JSON.parse(forms[0].fields) 
          : forms[0].fields || [];
      } else {
        // ✅ FIX: Return default fields instead of error when no form exists
        console.log(`⚠️ [FORM SCHEMA] No form found for role ${roleName}, using DEFAULT FIELDS`);
        fields = GetOnboardingFormSchemaHandlerEnhanced.DEFAULT_FORM_FIELDS;
      }

      // Filter active fields only
      const activeFields = fields.filter((f: any) => f.isActive !== false);

      // ✅ FIX: If no active fields, use default fields
      if (activeFields.length === 0) {
        console.log(`⚠️ [FORM SCHEMA] No active fields found, using DEFAULT FIELDS`);
        const defaultSections = this.getSectionsFromFields(GetOnboardingFormSchemaHandlerEnhanced.DEFAULT_FORM_FIELDS);
        return this.success({
          success: true,
          roleId: selectedRoleId,
          roleName: roleName,
          fields: GetOnboardingFormSchemaHandlerEnhanced.DEFAULT_FORM_FIELDS,
          sections: defaultSections,
          schema: {
            fields: GetOnboardingFormSchemaHandlerEnhanced.DEFAULT_FORM_FIELDS,
            sections: defaultSections,
          },
        }, requestId);
      }

      // Group fields by section
      const sectionsArray = this.getSectionsFromFields(activeFields);

      console.log(`✅ [FORM SCHEMA] Returning ${activeFields.length} fields in ${sectionsArray.length} sections`);

      // Get existing application if any
      let application = null;
      if (identity?.application_id) {
        const apps = await select('vendor_onboarding_applications', {
          id: identity.application_id,
        });
        application = apps.length > 0 ? apps[0] : null;
      }

      return this.success({
        success: true,
        roleId: selectedRoleId,
        roleName: roleName,
        fields: activeFields,
        sections: sectionsArray,
        schema: {
          fields: activeFields,
          sections: sectionsArray,
        },
        existingApplication: application,
        canEdit: !application || application.status === 'DRAFT' || application.status === 'CLARIFICATION_REQUIRED',
      }, requestId);
    } catch (error: any) {
      console.error('Error getting form schema:', error);
      return this.error(
        error.message || 'Failed to get form schema',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }

  // Helper method to group fields by section
  private getSectionsFromFields(fields: any[]): any[] {
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
      const secKey = field.section || 'business_information';
      if (!sections[secKey]) {
        sections[secKey] = {
          id: secKey,
          name: secKey,
          title: sectionMeta[secKey]?.title || secKey.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          order: sectionMeta[secKey]?.order || 99,
          isActive: true,
          fields: [],
        };
      }
      // Ensure each field has isActive property set
      const fieldWithActive = { ...field, isActive: field.isActive !== false };
      sections[secKey].fields.push(fieldWithActive);
    }

    return Object.values(sections).sort((a: any, b: any) => a.order - b.order);
  }
}

class SubmitApplicationHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    // ✅ FIX: Handle both wrapped (application_payload) and unwrapped payload formats
    // Some frontends send: { phone, application_payload: {...}, uploaded_documents: [...] }
    // Others send: { phone, businessName, roleId, ... } (flat structure)
    let normalizedBody = body;
    
    if (!body.application_payload && body.businessName) {
      // Convert flat structure to expected format
      const { phone, uploaded_documents, specializations, agreedToTerms, ...restFields } = body;
      normalizedBody = {
        phone,
        application_payload: restFields,
        uploaded_documents: uploaded_documents || [],
      };
      console.log('📦 [SUBMIT] Normalized flat payload to wrapped format');
    }

    // Validate request with Zod schema
    const validationResult = SubmitVendorApplicationRequestSchema.safeParse(normalizedBody);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { phone, application_payload, uploaded_documents } = validationResult.data;

    try {
      // ✅ FIX: Get vendor identity - filter out deleted records and prefer newest non-APPROVED/ACTIVATED
      // This ensures we use the correct identity when multiple exist for the same phone
      const identityResult = await query(
        `SELECT * FROM vendor_identity 
         WHERE phone = $1 
           AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
         ORDER BY 
           CASE 
             WHEN onboarding_status NOT IN ('APPROVED', 'ACTIVATED') THEN 0
             ELSE 1
           END,
           created_at DESC
         LIMIT 1`,
        [phone]
      );
      
      let identities = identityResult.rows || [];
      let identity: any = null;
      
      // ✅ FIX: Auto-create vendor identity if not found
      if (identities.length === 0) {
        console.log('📦 [SUBMIT] Creating new vendor identity for phone:', phone);
        const newIdentity = await insert('vendor_identity', {
          phone,
          onboarding_status: 'FORM_PENDING',
          metadata: {},
        });
        identities = newIdentity;
        identity = newIdentity[0];
        
        // ✅ FIX: Check if there's an existing application for this phone that needs to be linked
        const existingApps = await query(
          `SELECT voa.* FROM vendor_onboarding_applications voa
           JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
           WHERE vi.phone = $1 
             AND voa.status IN ('REJECTED', 'DRAFT', 'CLARIFICATION_REQUIRED')
             AND (vi.is_deleted IS NULL OR vi.is_deleted = false OR vi.is_deleted = 'f')
           ORDER BY voa.submitted_at DESC
           LIMIT 1`,
          [phone]
        );
        
        if (existingApps.rows && existingApps.rows.length > 0) {
          const existingApp = existingApps.rows[0];
          console.log(`📦 [SUBMIT] Found existing application ${existingApp.id} for phone ${phone}, linking to new identity`);
          // Update application to point to new identity
          await update(
            'vendor_onboarding_applications',
            { id: existingApp.id },
            { vendor_identity_id: newIdentity[0].id }
          );
          // Update identity to point to application
          await update(
            'vendor_identity',
            { id: newIdentity[0].id },
            { application_id: existingApp.id }
          );
          // Refresh identity with updated application_id
          const refreshed = await select('vendor_identity', { id: newIdentity[0].id });
          if (refreshed.length > 0) {
            identity = refreshed[0];
          }
        }
      } else {
        identity = identities[0];
        console.log(`📦 [SUBMIT] Using vendor_identity ${identity.id} with onboarding_status: ${identity.onboarding_status}`);
        
        // ✅ CRITICAL FIX: Check if this vendor_identity's vendor_id points to a deleted vendor
        // If it does, create a NEW vendor_identity for this new application
        if (identity.vendor_id) {
          const vendorCheck = await query(
            `SELECT id, is_deleted FROM vendors WHERE id = $1 LIMIT 1`,
            [identity.vendor_id]
          ).catch(() => ({ rows: [] }));
          
          if (vendorCheck.rows.length > 0) {
            const vendor = vendorCheck.rows[0];
            const isVendorDeleted = vendor.is_deleted === true || 
              vendor.is_deleted === 't' ||
              (typeof vendor.is_deleted === 'string' && vendor.is_deleted.toLowerCase() === 'true');
            
            if (isVendorDeleted) {
              console.log(`⚠️ [SUBMIT] Vendor_identity ${identity.id} points to deleted vendor ${identity.vendor_id} - creating NEW vendor_identity`);
              // Create a NEW vendor_identity for this new application
              const newIdentity = await insert('vendor_identity', {
                phone,
                onboarding_status: 'FORM_PENDING',
                metadata: {},
                selected_role_id: identity.selected_role_id, // Preserve role if set
                vendor_type: identity.vendor_type, // Preserve vendor_type if set
              });
              identity = newIdentity[0];
              console.log(`✅ [SUBMIT] Created new vendor_identity ${identity.id} for new application`);
            }
          }
        }
      }

      // ✅ Safety check: Ensure identity exists
      if (!identity) {
        return this.error(
          'Failed to create or retrieve vendor identity',
          500,
          'INTERNAL_ERROR',
          undefined,
          requestId
        );
      }

      // ✅ FIX: Extract roleId and vendorType from payload or body if not in identity
      // Note: businessType (e.g., "veterinarian") is different from vendor_type (e.g., "solo" or "business")
      // vendor_type refers to whether the vendor is a solo provider or a business with staff
      const payloadRoleId = application_payload?.roleId || application_payload?.role_id || body.roleId || body.role_id;
      
      // Only use explicit vendor_type values, NOT businessType (which is the profession like "veterinarian").
      // Service category codes (e.g. vet_solo) encode solo vs business — use them when vendorType is omitted.
      let payloadVendorType = application_payload?.vendorType || application_payload?.vendor_type || 
                               body.vendorType || body.vendor_type;
      
      if (!payloadVendorType || !['solo', 'business', 'center'].includes(payloadVendorType)) {
        const fromCat = inferVendorKindFromServiceCategory(
          application_payload?.serviceCategory ??
            application_payload?.service_category ??
            body.serviceCategory ??
            body.service_category
        );
        payloadVendorType = fromCat || 'business';
      }

      // ✅ FIX: Auto-update vendor_identity with role and vendor_type from payload if missing
      if ((!identity.selected_role_id || !identity.vendor_type) && (payloadRoleId || payloadVendorType)) {
        console.log('📦 [SUBMIT] Auto-setting role and vendor_type from payload:', {
          payloadRoleId,
          payloadVendorType,
          currentRoleId: identity.selected_role_id,
          currentVendorType: identity.vendor_type
        });
        
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        
        if (!identity.selected_role_id && payloadRoleId) {
          updateData.selected_role_id = payloadRoleId;
        }
        if (!identity.vendor_type && payloadVendorType) {
          updateData.vendor_type = payloadVendorType;
        }
        // Also update onboarding_status to FORM_PENDING if it's still INIT or ROLE_PENDING
        if (['INIT', 'ROLE_PENDING'].includes(identity.onboarding_status)) {
          updateData.onboarding_status = 'FORM_PENDING';
        }
        
        await update('vendor_identity', { id: identity.id }, updateData);
        
        // Refresh identity with updated values
        const refreshedIdentities = await select('vendor_identity', { id: identity.id });
        if (refreshedIdentities.length > 0) {
          identity = refreshedIdentities[0];
        }
        
        console.log('✅ [SUBMIT] Updated vendor_identity with role and vendor_type');
      }

      // Final check - if still no role or vendor_type, return error with helpful message
      if (!identity.selected_role_id && !payloadRoleId) {
        return this.error(
          'Role ID is required. Please provide roleId in the payload or select a role first.',
          400,
          'VALIDATION_ERROR',
          undefined,
          requestId
        );
      }
      
      // Use payloadVendorType as fallback if identity.vendor_type is still not set
      const effectiveVendorType = identity.vendor_type || payloadVendorType || 'business';
      const effectiveRoleId = identity.selected_role_id || payloadRoleId;

      const pl = application_payload as Record<string, unknown>;
      const vd = validationResult.data as typeof validationResult.data & {
        referralCode?: string;
        referral_code?: string;
      };
      const referralFromSubmit =
        vd.referralCode || vd.referral_code || pl?.referralCode || pl?.referral_code;
      if (referralFromSubmit !== undefined && referralFromSubmit !== null && String(referralFromSubmit).trim() !== '') {
        const { validateAndStoreReferralCodeForVendorApplication } = await import(
          '../../../lib/services/referral-service'
        );
        const storeRes = await validateAndStoreReferralCodeForVendorApplication({
          vendorIdentityId: identity.id,
          phone,
          referralCodeRaw: String(referralFromSubmit),
        });
        if (!storeRes.success) {
          return this.error(
            storeRes.error || 'Invalid referral code',
            400,
            'VALIDATION_ERROR',
            undefined,
            requestId
          );
        }
        const refreshedIdentities = await select('vendor_identity', { id: identity.id });
        if (refreshedIdentities.length > 0) {
          identity = refreshedIdentities[0];
        }
      }

      // Get form schema version
      const roles = await select('roles', { id: effectiveRoleId });
      const formVersion = roles[0]?.config?.onboardingFormSchema?.[effectiveVendorType]?.version || '1.0';

      // Check if application exists
      let applicationId = identity.application_id;
      
      if (applicationId) {
        const apps = await select('vendor_onboarding_applications', {
          id: applicationId,
        });
        
        if (apps.length > 0) {
          const app = apps[0];
          
          // ✅ FIX: Allow editing if DRAFT, CLARIFICATION_REQUIRED, or REJECTED (vendor can resubmit after rejection)
          if (app.status !== 'DRAFT' && app.status !== 'CLARIFICATION_REQUIRED' && app.status !== 'REJECTED') {
            return this.error(
              'Application is locked and cannot be edited',
              403,
              'FORBIDDEN',
              undefined,
              requestId
            );
          }

          // ✅ FIX: Validate and sanitize JSONB data before saving
          let sanitizedPayload = application_payload;
          let sanitizedDocuments = uploaded_documents || app.uploaded_documents || [];
          
          // ✅ DEBUG: Log uploaded_documents before processing
          console.log(`📸 [SUBMIT] Processing uploaded_documents for application ${applicationId}:`);
          console.log(`📸 [SUBMIT] uploaded_documents type: ${typeof uploaded_documents}, isArray: ${Array.isArray(uploaded_documents)}`);
          console.log(`📸 [SUBMIT] uploaded_documents count: ${Array.isArray(uploaded_documents) ? uploaded_documents.length : 'N/A'}`);
          if (Array.isArray(uploaded_documents) && uploaded_documents.length > 0) {
            console.log(`📸 [SUBMIT] Document types: ${uploaded_documents.map((d: any) => `${d.type || d.name || 'unknown'}`).join(', ')}`);
            const profilePhotoDoc = uploaded_documents.find((d: any) => 
              d.type === 'profilePhoto' || d.type === 'profile_photo' || d.name === 'profilePhoto'
            );
            if (profilePhotoDoc) {
              console.log(`📸 [SUBMIT] ✅ Profile photo found in uploaded_documents: type=${profilePhotoDoc.type}, url=${profilePhotoDoc.url}`);
            } else {
              console.log(`📸 [SUBMIT] ⚠️ Profile photo NOT found in uploaded_documents`);
            }
          }
          
          // Ensure uploaded_documents is an array
          if (!Array.isArray(sanitizedDocuments)) {
            console.warn('⚠️ [SUBMIT] uploaded_documents is not an array, converting:', sanitizedDocuments);
            sanitizedDocuments = [];
          }
          
          // Validate application_payload can be serialized
          try {
            JSON.stringify(sanitizedPayload);
          } catch (error) {
            console.error('❌ [SUBMIT] Invalid application_payload (circular reference or invalid value):', error);
            return this.error(
              'Invalid application data: contains circular references or non-serializable values',
              400,
              'VALIDATION_ERROR',
              undefined,
              requestId
            );
          }

          // Update existing application
          await update(
            'vendor_onboarding_applications',
            { id: applicationId },
            {
              vendor_identity_id: identity.id, // ✅ FIX: Update to point to current identity
              application_payload: sanitizedPayload,
              uploaded_documents: sanitizedDocuments,
              form_version: formVersion,
              status: 'SUBMITTED',
              submitted_at: new Date().toISOString(),
              is_locked: true,
              locked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          );
          
          // ✅ FIX: Ensure vendor_identity.application_id is also updated
          await update(
            'vendor_identity',
            { id: identity.id },
            { application_id: applicationId }
          );
        }
      } else {
        // ✅ FIX: Validate and sanitize JSONB data before saving
        let sanitizedDocuments = uploaded_documents || [];
        
        // ✅ DEBUG: Log pincode in application_payload for new application - AGGRESSIVE LOGGING
        console.log(`📍 [SUBMIT] ========== PINCODE DEBUG START (NEW APPLICATION) ==========`);
        console.log(`📍 [SUBMIT] Checking pincode in application_payload for NEW application:`);
        console.log(`📍 [SUBMIT] application_payload.pin: '${application_payload?.pin || 'undefined'}'`);
        console.log(`📍 [SUBMIT] application_payload.pincode: '${application_payload?.pincode || 'undefined'}'`);
        console.log(`📍 [SUBMIT] application_payload.pinCode: '${application_payload?.pinCode || 'undefined'}'`);
        console.log(`📍 [SUBMIT] application_payload keys: ${Object.keys(application_payload || {}).join(', ')}`);
        console.log(`📍 [SUBMIT] Full application_payload (first 2000 chars):`, JSON.stringify(application_payload).substring(0, 2000));
        if (application_payload) {
          // Check for any field that might contain pincode
          Object.keys(application_payload).forEach(key => {
            if (key.toLowerCase().includes('pin') || key.toLowerCase().includes('code')) {
              console.log(`📍 [SUBMIT] ✅ Found potential pincode field: ${key} = '${application_payload[key]}'`);
            }
          });
        }
        console.log(`📍 [SUBMIT] ========== PINCODE DEBUG END (NEW APPLICATION) ==========`);
        
        // ✅ DEBUG: Log uploaded_documents for new application
        console.log(`📸 [SUBMIT] Creating new application with uploaded_documents:`);
        console.log(`📸 [SUBMIT] uploaded_documents type: ${typeof uploaded_documents}, isArray: ${Array.isArray(uploaded_documents)}`);
        console.log(`📸 [SUBMIT] uploaded_documents count: ${Array.isArray(uploaded_documents) ? uploaded_documents.length : 'N/A'}`);
        if (Array.isArray(uploaded_documents) && uploaded_documents.length > 0) {
          console.log(`📸 [SUBMIT] Document types: ${uploaded_documents.map((d: any) => `${d.type || d.name || 'unknown'}`).join(', ')}`);
          const profilePhotoDoc = uploaded_documents.find((d: any) => 
            d.type === 'profilePhoto' || d.type === 'profile_photo' || d.name === 'profilePhoto'
          );
          if (profilePhotoDoc) {
            console.log(`📸 [SUBMIT] ✅ Profile photo found: type=${profilePhotoDoc.type}, url=${profilePhotoDoc.url}`);
          } else {
            console.log(`📸 [SUBMIT] ⚠️ Profile photo NOT found in uploaded_documents`);
          }
        }
        
        // Ensure uploaded_documents is an array
        if (!Array.isArray(sanitizedDocuments)) {
          console.warn('⚠️ [SUBMIT] uploaded_documents is not an array, converting:', sanitizedDocuments);
          sanitizedDocuments = [];
        }
        
        // Validate application_payload can be serialized
        try {
          JSON.stringify(application_payload);
        } catch (error) {
          console.error('❌ [SUBMIT] Invalid application_payload (circular reference or invalid value):', error);
          return this.error(
            'Invalid application data: contains circular references or non-serializable values',
            400,
            'VALIDATION_ERROR',
            undefined,
            requestId
          );
        }

        // Create new application
        const newApp = await insert('vendor_onboarding_applications', {
          vendor_identity_id: identity.id,
          role_id: effectiveRoleId,
          vendor_type: effectiveVendorType,
          application_payload,
          uploaded_documents: sanitizedDocuments,
          form_version: formVersion,
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
          is_locked: true,
          locked_at: new Date().toISOString(),
        });
        
        applicationId = newApp[0].id;

        // Link application to identity
        await update(
          'vendor_identity',
          { id: identity.id },
          { application_id: applicationId }
        );
      }

      // Transition to UNDER_REVIEW - BOTH vendor_identity AND vendor_onboarding_applications
      if (identity.onboarding_status === 'FORM_PENDING' || identity.onboarding_status === 'CLARIFICATION_REQUIRED') {
        try {
          // Try stored procedure first
          await query(
            `SELECT transition_onboarding_status($1, $2, NULL, 'vendor', 'application_submitted', '{}'::jsonb)`,
            [identity.id, 'UNDER_REVIEW']
          );
        } catch (transitionError) {
          console.warn('⚠️ [SUBMIT] Stored procedure failed, using direct update:', transitionError);
          // Fallback: Direct update if stored procedure doesn't exist
          await update(
            'vendor_identity',
            { id: identity.id },
            { 
              onboarding_status: 'UNDER_REVIEW',
              updated_at: new Date().toISOString()
            }
          );
        }
      }

      // CRITICAL FIX: Update vendor_onboarding_applications.status to UNDER_REVIEW
      // Review API expects application.status === 'UNDER_REVIEW', but we had only been updating vendor_identity
      await update(
        'vendor_onboarding_applications',
        { id: applicationId },
        { status: 'UNDER_REVIEW', updated_at: new Date().toISOString() }
      );

      console.log('✅ [SUBMIT] Application submitted successfully:', applicationId);

      return this.success({
        message: 'Application submitted successfully',
        applicationId,
        nextStep: '/onboarding/pending-review',
      }, requestId);
    } catch (error: any) {
      console.error('❌ [SUBMIT] Error submitting application:', error);
      // ✅ FIX: Properly extract error message from various error formats
      let errorMessage = 'Failed to submit application';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error?.error && typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error?.detail && typeof error.detail === 'string') {
        errorMessage = error.detail; // PostgreSQL error detail
      } else if (typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = 'Failed to submit application (unknown error)';
        }
      }
      console.error('❌ [SUBMIT] Error message:', errorMessage);
      return this.error(
        errorMessage,
        500,
        'INTERNAL_ERROR',
        { originalError: error?.code || error?.name || 'Unknown' },
        requestId
      );
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerVendorOnboardingEndpointsEnhanced(app: Hono) {
  const statusHandler = new GetOnboardingStatusHandlerEnhanced();
  const rolesHandler = new GetAvailableRolesHandlerEnhanced();
  const selectRoleHandler = new SelectRoleHandlerEnhanced();
  const selectVendorTypeHandler = new SelectVendorTypeHandlerEnhanced();
  const formSchemaHandler = new GetOnboardingFormSchemaHandlerEnhanced();
  const submitHandler = new SubmitApplicationHandlerEnhanced();

  // Phase 1: Auth & Entry
  app.get('/vendor/onboarding/status', async (c: Context) => {
    const phone = c.req.query('phone');
    console.log('[ENDPOINT-ENHANCED] /vendor/onboarding/status called');
    console.log('[ENDPOINT-ENHANCED] Phone parameter:', phone);
    console.log('[ENDPOINT-ENHANCED] Request URL:', c.req.url);
    console.log('[ENDPOINT-ENHANCED] Request method:', c.req.method);
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    console.log('[ENDPOINT-ENHANCED] Calling statusHandler.execute()');
    const result: any = await statusHandler.execute(event, context);
    console.log('[ENDPOINT-ENHANCED] Handler returned status:', result.statusCode);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 2: Role Selection
  app.get('/vendor/onboarding/roles', async (c: Context) => {
    try {
      const event = createApiGatewayEvent(c.req);
      const context = createLambdaContext();
      const result: any = await rolesHandler.execute(event, context);
      const body = JSON.parse(result.body);
      // Ensure we always return 200 even if handler returns error status
      if (body.success === false || result.statusCode >= 400) {
        return c.json({
          success: true,
          data: { roles: [] },
          message: body.error?.message || body.error || 'Roles table not found.',
        }, 200);
      }
      return c.json(body, result.statusCode);
    } catch (error: any) {
      // Catch any errors from handler execution or JSON parsing
      console.error('[Vendor Onboarding Roles Route] Error:', error);
      return c.json({
        success: true,
        data: { roles: [] },
        message: error.message || 'Failed to get roles.',
      }, 200);
    }
  });

  app.post('/vendor/onboarding/select-role', async (c: Context) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result: any = await selectRoleHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 3: Vendor Type
  app.post('/vendor/onboarding/select-vendor-type', async (c: Context) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result: any = await selectVendorTypeHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 4: Dynamic Form
  app.get('/vendor/onboarding/form-schema', async (c: Context) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result: any = await formSchemaHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/vendor/onboarding/submit-application', async (c: Context) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result: any = await submitHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 7: Activate Vendor
  app.post('/vendor/onboarding/activate', async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { phone } = body;

      if (!phone) {
        return c.json({ success: false, error: 'Phone number is required' }, 400);
      }

      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return c.json({ success: false, error: 'Vendor identity not found' }, 404);
      }

      const identity = identities[0];

      if (identity.onboarding_status !== 'APPROVED') {
        return c.json({ success: false, error: 'Vendor must be approved before activation' }, 400);
      }

      // Get application first (needed for both existing and new vendor flows)
      const applications = await select('vendor_onboarding_applications', { vendor_identity_id: identity.id });
      const application = applications.length > 0 ? applications[0] : null;
      const payload = application?.application_payload || {};

      const activationReferralRaw =
        (body as { referralCode?: string; referral_code?: string; pendingReferralCode?: string; pending_referral_code?: string })
          .referralCode ??
        (body as { referral_code?: string }).referral_code ??
        (body as { pendingReferralCode?: string }).pendingReferralCode ??
        (body as { pending_referral_code?: string }).pending_referral_code;
      const activationReferralCode =
        activationReferralRaw != null && String(activationReferralRaw).trim() !== ''
          ? String(activationReferralRaw).trim().toUpperCase()
          : '';
      const baseReferralMeta =
        identity.metadata && typeof identity.metadata === 'object' && !Array.isArray(identity.metadata)
          ? ({ ...(identity.metadata as Record<string, unknown>) } as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      const referralMetadataForLink: Record<string, unknown> = {
        ...baseReferralMeta,
        ...(activationReferralCode ? { referral_code: activationReferralCode } : {}),
      };

      if (activationReferralCode) {
        try {
          const { validateAndStoreReferralCodeForVendorApplication } = await import(
            '../../../lib/services/referral-service'
          );
          const storeRes = await validateAndStoreReferralCodeForVendorApplication({
            vendorIdentityId: identity.id,
            referralCodeRaw: activationReferralCode,
            phone: String(identity.phone || phone || ''),
          });
          if (!storeRes.success) {
            console.warn('[VENDOR-ACTIVATION] referral reserve on activate (non-fatal):', storeRes.error);
          }
        } catch (refPreErr) {
          console.warn('[VENDOR-ACTIVATION] referral reserve on activate failed (non-fatal):', refPreErr);
        }
      }

      // Check if vendor already exists in vendors table
      // ✅ CRITICAL FIX: Use SQL filtering to exclude deleted vendors - only find active vendors
      // This ensures that if only deleted vendors exist, we create a NEW vendor with a NEW ID
      const existingVendorsResult = await query(
        `SELECT * FROM vendors 
         WHERE phone = $1 
         AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
         LIMIT 1`,
        [phone]
      );
      
      if (existingVendorsResult.rows && existingVendorsResult.rows.length > 0) {
        const vendor = existingVendorsResult.rows[0];
        
        // ✅ FIX: Extract profile photo from application and update vendor if missing
        let profilePhotoUrl: string | null = vendor.profile_photo_url;
        
        if (!profilePhotoUrl && application) {
          const uploadedDocuments = application.uploaded_documents || [];
          console.log(`📸 [VENDOR-ACTIVATION] Existing vendor found, checking for profile photo (current: ${profilePhotoUrl})`);
          console.log(`📸 [VENDOR-ACTIVATION] Uploaded documents count: ${uploadedDocuments.length}`);
          
          if (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0) {
            console.log(`📸 [VENDOR-ACTIVATION] Uploaded documents types: ${uploadedDocuments.map((d: any) => d.type || d.name || 'unknown').join(', ')}`);
            
            const profilePhotoDoc = uploadedDocuments.find((doc: any) => 
              doc.type === 'profilePhoto' || 
              doc.type === 'profile_photo' || 
              doc.name === 'profilePhoto' ||
              (doc.name && doc.name.toLowerCase().includes('profile') && doc.name.toLowerCase().includes('photo'))
            );
            
            if (profilePhotoDoc && profilePhotoDoc.url) {
              const photoUrl = profilePhotoDoc.url;
              console.log(`📸 [VENDOR-ACTIVATION] Found profile photo for existing vendor: type=${profilePhotoDoc.type}, url=${photoUrl}`);
              if (photoUrl.includes('amazonaws.com')) {
                try {
                  const urlObj = new URL(photoUrl);
                  profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
                } catch (e) {
                  const match = photoUrl.match(/vendors\/[^?]+/);
                  profilePhotoUrl = match ? match[0] : photoUrl;
                }
              } else {
                profilePhotoUrl = photoUrl;
              }
              console.log(`📸 [VENDOR-ACTIVATION] ✅ Extracted profile photo for existing vendor: ${profilePhotoUrl}`);
            }
          }
          
          // Fallback: Check application_payload
          if (!profilePhotoUrl && payload.profilePhoto) {
            const photoUrl = payload.profilePhoto;
            if (photoUrl.includes('amazonaws.com')) {
              try {
                const urlObj = new URL(photoUrl);
                profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
              } catch (e) {
                const match = photoUrl.match(/vendors\/[^?]+/);
                profilePhotoUrl = match ? match[0] : photoUrl;
              }
            } else {
              profilePhotoUrl = photoUrl;
            }
            console.log(`📸 [VENDOR-ACTIVATION] Extracted profile photo from application_payload for existing vendor: ${profilePhotoUrl}`);
          }
        }
        
        // ✅ FIX: Extract service_radius from payload (for existing vendor update)
        let serviceRadius: number | null = null;
        const radiusFields = ['service_radius', 'serviceRadius', 'serviceRadiusKm', 'radius', 'radiusKm', 'service_radius_km', 'serviceArea', 'service_area'];
        for (const field of radiusFields) {
          if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
            const radiusValue = typeof payload[field] === 'string' ? parseFloat(payload[field]) : Number(payload[field]);
            if (!isNaN(radiusValue) && radiusValue > 0) {
              serviceRadius = radiusValue;
              break;
            }
          }
        }
        
        // Update identity to ACTIVATED and vendor to active (including profile photo if found)
        await update('vendor_identity', { id: identity.id }, {
          onboarding_status: 'ACTIVATED',
          updated_at: new Date().toISOString(),
        });
        
        // ✅ CRITICAL FIX: Clean metadata - remove any deleted_at, deleted_by, deletion_reason from vendor metadata
        const vendorMetadata = vendor.metadata || {};
        const cleanMetadata = { ...vendorMetadata };
        delete cleanMetadata.deleted_at;
        delete cleanMetadata.deleted_by;
        delete cleanMetadata.deletion_reason;
        delete cleanMetadata.deleted_vendor_id;
        
        const vendorUpdateData: any = {
          status: 'approved',
          is_active: true,
          is_deleted: false, // ✅ CRITICAL: Ensure vendor is not marked as deleted
          onboarding_status: 'ACTIVATED',
          updated_at: new Date().toISOString(),
          metadata: cleanMetadata, // ✅ CRITICAL: Use cleaned metadata without deleted fields
        };
        
        // ✅ FIX: Update profile_photo_url if we found it and vendor doesn't have one
        if (profilePhotoUrl && !vendor.profile_photo_url) {
          vendorUpdateData.profile_photo_url = profilePhotoUrl;
          console.log(`📸 [VENDOR-ACTIVATION] ✅ Updating existing vendor with profile photo: ${profilePhotoUrl}`);
        }
        
        // ✅ FIX: Update service_radius if we found it and vendor doesn't have one
        if (serviceRadius && !vendor.service_radius) {
          vendorUpdateData.service_radius = serviceRadius;
          console.log(`📍 [VENDOR-ACTIVATION] ✅ Updating existing vendor with service_radius: ${serviceRadius} km`);
        } else if (!serviceRadius) {
          console.log(`📍 [VENDOR-ACTIVATION] ⚠️ No valid service_radius found in payload for existing vendor`);
        }

        // ✅ FIX: Sync location from onboarding application — previously only new vendors got pincode/address/city/state
        const { extractPincodeFromPayload } = await import('../../../utils/extract-profile-photo');
        const pincodeFromApplication = extractPincodeFromPayload(payload);
        if (pincodeFromApplication) {
          vendorUpdateData.pincode = pincodeFromApplication;
          console.log(`📍 [VENDOR-ACTIVATION] ✅ Updating existing vendor pincode from application: '${pincodeFromApplication}'`);
        }
        const addrFromApp = typeof payload.address === 'string' ? payload.address.trim() : '';
        if (addrFromApp) {
          vendorUpdateData.address = addrFromApp;
        }
        const cityFromApp = typeof payload.city === 'string' ? payload.city.trim() : '';
        if (cityFromApp) {
          vendorUpdateData.city = cityFromApp;
        }
        const stateFromApp = typeof payload.state === 'string' ? payload.state.trim() : '';
        if (stateFromApp) {
          vendorUpdateData.state = stateFromApp;
        }
        
        await update('vendors', { id: vendor.id }, vendorUpdateData);
        console.log(`✅ [VENDOR-ACTIVATION] Updated vendor ${vendor.id} - cleaned metadata and set is_deleted: false`);

        try {
          const { linkVendorOnboardingReferralsFromIdentityMetadata } = await import(
            '../../../lib/services/referral-service'
          );
          await linkVendorOnboardingReferralsFromIdentityMetadata({
            vendorId: vendor.id,
            phone: identity.phone,
            metadata: referralMetadataForLink,
            vendorIdentityId: identity.id,
          });
        } catch (refError: unknown) {
          console.error('[VENDOR-ACTIVATION] Error linking referral:', refError);
        }
        
        return c.json({
          success: true,
          message: 'Vendor activated successfully',
          vendor_id: vendor.id,
          nextStep: '/dashboard',
        });
      }

      // Application and payload already fetched above (for both existing and new vendor flows)
      if (!application) {
        return c.json({ success: false, error: 'Application not found' }, 404);
      }
      
      // ✅ FIX: Extract profile photo from uploaded_documents and save to profile_photo_url
      let profilePhotoUrl: string | null = null;
      
      // First, check uploaded_documents array
      const uploadedDocuments = application.uploaded_documents || [];
      console.log(`📸 [VENDOR-ACTIVATION] Checking uploaded_documents (count: ${uploadedDocuments.length})`);
      if (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0) {
        console.log(`📸 [VENDOR-ACTIVATION] Uploaded documents types: ${uploadedDocuments.map((d: any) => d.type || d.name || 'unknown').join(', ')}`);
        
        // Look for profile photo in uploaded documents
        const profilePhotoDoc = uploadedDocuments.find((doc: any) => 
          doc.type === 'profilePhoto' || 
          doc.type === 'profile_photo' || 
          doc.name === 'profilePhoto' ||
          (doc.name && doc.name.toLowerCase().includes('profile') && doc.name.toLowerCase().includes('photo'))
        );
        
        if (profilePhotoDoc && profilePhotoDoc.url) {
          const photoUrl = profilePhotoDoc.url;
          console.log(`📸 [VENDOR-ACTIVATION] Found profile photo document: type=${profilePhotoDoc.type}, name=${profilePhotoDoc.name}, url=${photoUrl}`);
          if (photoUrl.includes('amazonaws.com')) {
            try {
              const urlObj = new URL(photoUrl);
              profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
            } catch (e) {
              const match = photoUrl.match(/vendors\/[^?]+/);
              profilePhotoUrl = match ? match[0] : photoUrl;
            }
          } else {
            profilePhotoUrl = photoUrl;
          }
          console.log(`📸 [VENDOR-ACTIVATION] ✅ Extracted profile photo from uploaded_documents: ${profilePhotoUrl}`);
        } else {
          console.warn(`⚠️ [VENDOR-ACTIVATION] Profile photo document not found in uploaded_documents`);
        }
      } else {
        console.warn(`⚠️ [VENDOR-ACTIVATION] No uploaded_documents found or empty array`);
      }
      
      // Fallback: Check application_payload for profilePhoto field
      if (!profilePhotoUrl && payload.profilePhoto) {
        const photoUrl = payload.profilePhoto;
        if (photoUrl.includes('amazonaws.com')) {
          try {
            const urlObj = new URL(photoUrl);
            profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
          } catch (e) {
            const match = photoUrl.match(/vendors\/[^?]+/);
            profilePhotoUrl = match ? match[0] : photoUrl;
          }
        } else {
          profilePhotoUrl = photoUrl;
        }
        console.log(`📸 [VENDOR-ACTIVATION] Extracted profile photo from application_payload: ${profilePhotoUrl}`);
      }

      // ✅ DEBUG: Log pincode extraction - check all possible field names
      console.log(`📍 [VENDOR-ACTIVATION] Extracting pincode from payload:`);
      console.log(`📍 [VENDOR-ACTIVATION] payload.pin: ${payload.pin || 'undefined'}`);
      console.log(`📍 [VENDOR-ACTIVATION] payload.pincode: ${payload.pincode || 'undefined'}`);
      console.log(`📍 [VENDOR-ACTIVATION] payload.pinCode: ${payload.pinCode || 'undefined'}`);
      console.log(`📍 [VENDOR-ACTIVATION] Full payload keys: ${Object.keys(payload).join(', ')}`);
      
      // ✅ DEBUG: Log service_radius extraction - AGGRESSIVE LOGGING
      console.log(`📍 [VENDOR-ACTIVATION] ========== SERVICE_RADIUS DEBUG START ==========`);
      console.log(`📍 [VENDOR-ACTIVATION] Checking for service_radius in payload:`);
      const radiusFields = ['service_radius', 'serviceRadius', 'serviceRadiusKm', 'radius', 'radiusKm', 'service_radius_km', 'serviceArea', 'service_area'];
      radiusFields.forEach(field => {
        if (payload[field] !== undefined) {
          console.log(`📍 [VENDOR-ACTIVATION] Found field '${field}': ${payload[field]} (type: ${typeof payload[field]})`);
        }
      });
      console.log(`📍 [VENDOR-ACTIVATION] Full payload (first 3000 chars):`, JSON.stringify(payload).substring(0, 3000));
      console.log(`📍 [VENDOR-ACTIVATION] ========== SERVICE_RADIUS DEBUG END ==========`);
      
      // ✅ FIX: Use utility function to extract pincode
      const { extractPincodeFromPayload } = await import('../../../utils/extract-profile-photo');
      const pincodeValue = extractPincodeFromPayload(payload);
      
      // ✅ FIX: Extract service_radius from payload (check multiple field names)
      let serviceRadius: number | null = null;
      console.log(`📍 [VENDOR-ACTIVATION] Extracting service_radius from payload:`);
      for (const field of radiusFields) {
        if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
          const radiusValue = typeof payload[field] === 'string' ? parseFloat(payload[field]) : Number(payload[field]);
          if (!isNaN(radiusValue) && radiusValue > 0) {
            serviceRadius = radiusValue;
            console.log(`📍 [VENDOR-ACTIVATION] ✅ Found service_radius in field '${field}': ${serviceRadius} km`);
            break;
          }
        }
      }
      if (!serviceRadius) {
        console.log(`📍 [VENDOR-ACTIVATION] ⚠️ No valid service_radius found in payload`);
      }

      // Create vendor record from application
      console.log(`📍 [VENDOR-ACTIVATION] No active vendor found - creating NEW vendor with NEW ID`);
      console.log(`📍 [VENDOR-ACTIVATION] Creating vendor with pincode: '${pincodeValue || '(empty)'}', service_radius: ${serviceRadius || 'null'}`);
      
      // ✅ CRITICAL FIX: Generate a new unique vendor ID
      // Check if identity.vendor_id points to an existing vendor (even if deleted)
      // If it does, generate a completely new UUID to avoid reusing deleted vendor IDs
      let proposedVendorId = identity.vendor_id || randomUUID();
      
      // Check if a vendor with this ID already exists (including deleted ones)
      const existingVendorCheck = await query(
        `SELECT id FROM vendors WHERE id = $1 LIMIT 1`,
        [proposedVendorId]
      ).catch(() => ({ rows: [] }));
      
      let finalVendorId = proposedVendorId;
      if (existingVendorCheck.rows && existingVendorCheck.rows.length > 0) {
        // Vendor ID already exists (may be deleted or active) - generate new unique UUID
        finalVendorId = randomUUID();
        console.log(`⚠️ [VENDOR-ACTIVATION] Vendor ID ${proposedVendorId} already exists - generating new unique ID: ${finalVendorId}`);
      } else {
        // If identity.vendor_id was used and doesn't exist, we can use it
        // But if identity.vendor_id is null/undefined, randomUUID() was already used
        if (!identity.vendor_id) {
          finalVendorId = randomUUID();
          console.log(`✅ [VENDOR-ACTIVATION] Generated new unique vendor ID: ${finalVendorId}`);
        } else {
          console.log(`✅ [VENDOR-ACTIVATION] Using vendor ID from identity: ${finalVendorId}`);
        }
      }
      
      // ✅ CRITICAL FIX: Clean metadata - remove any deleted_at, deleted_by, deletion_reason from payload
      // This prevents copying deleted metadata from previous vendors
      const cleanMetadata = payload.metadata ? { ...payload.metadata } : {};
      delete cleanMetadata.deleted_at;
      delete cleanMetadata.deleted_by;
      delete cleanMetadata.deletion_reason;
      delete cleanMetadata.deleted_vendor_id;
      
      // Resolve default tier/commission from vendor_tiers
      let resolvedTierName: string = 'Basic';
      let resolvedCommission: number = 15;
      try {
        const tierRes = await query(
          `SELECT tier_name, commission_rate
           FROM vendor_tiers
           WHERE is_active = true
           ORDER BY is_default DESC NULLS LAST, tier_level ASC
           LIMIT 1`
        ).catch(() => ({ rows: [] as any[] }));
        if (tierRes.rows && tierRes.rows.length > 0) {
          resolvedTierName = tierRes.rows[0].tier_name || resolvedTierName;
          const cr = parseFloat(tierRes.rows[0].commission_rate || '15');
          if (!isNaN(cr)) resolvedCommission = cr;
        }
      } catch {}

      const appVt = application.vendor_type;
      const vendorTypeForRow =
        appVt === 'solo' || appVt === 'business'
          ? appVt
          : inferVendorKindFromServiceCategory(
              payload.serviceCategory ?? payload.service_category
            ) || 'business';

      const vendors = await insert('vendors', {
        id: finalVendorId, // ✅ CRITICAL: Explicitly set new unique ID
        phone: identity.phone,
        email: payload.email || identity.email || '',
        business_name: payload.businessName || '',
        owner_name: payload.fullName || payload.ownerName || '',
        role_id: application.role_id,
        vendor_type: vendorTypeForRow,
        vendor_identity_id: identity.id,
        onboarding_status: 'ACTIVATED',
        status: 'approved',
        is_active: true,
        is_deleted: false, // ✅ CRITICAL FIX: Always set to false for new vendors
        tier: resolvedTierName,
        commission_percentage: resolvedCommission,
        address: payload.address || '',
        city: payload.city || '',
        state: payload.state || '',
        pincode: pincodeValue || '', // ✅ FIX: Use extracted pincode value (empty string if not found)
        profile_photo_url: profilePhotoUrl, // ✅ FIX: Save profile photo from onboarding
        service_radius: serviceRadius, // ✅ FIX: Save service_radius from onboarding
        metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : {}, // ✅ Use cleaned metadata
      });
      
      const createdVendor = vendors[0];
      console.log(`📍 [VENDOR-ACTIVATION] ✅ NEW vendor created with ID: ${createdVendor.id}`);
      console.log(`📍 [VENDOR-ACTIVATION] ✅ Vendor pincode saved: '${createdVendor.pincode || '(empty)'}'`);
      
      // ✅ CRITICAL FIX: Immediately verify the vendor was created correctly and is not deleted
      const verifyVendor = await query(
        `SELECT id, is_deleted, metadata FROM vendors WHERE id = $1 LIMIT 1`,
        [createdVendor.id]
      ).catch(() => ({ rows: [] }));
      
      if (verifyVendor.rows.length > 0) {
        const vendor = verifyVendor.rows[0];
        const isDeleted = vendor.is_deleted === true || 
          vendor.is_deleted === 't' ||
          (typeof vendor.is_deleted === 'string' && vendor.is_deleted.toLowerCase() === 'true');
        
        if (isDeleted) {
          console.error(`❌ [VENDOR-ACTIVATION] CRITICAL: Vendor ${createdVendor.id} was created but is marked as deleted! Fixing...`);
          // Force fix: set is_deleted to false and clean metadata
          await query(
            `UPDATE vendors 
             SET is_deleted = false, 
                 metadata = '{}'::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [createdVendor.id]
          );
          console.log(`✅ [VENDOR-ACTIVATION] Fixed vendor ${createdVendor.id} - set is_deleted to false and cleaned metadata`);
        } else {
          console.log(`✅ [VENDOR-ACTIVATION] Verified vendor ${createdVendor.id} is active (is_deleted: ${vendor.is_deleted})`);
        }
      }
      
      // ✅ CRITICAL FIX: Only update NON-DELETED vendor_identity records
      // Verify the identity is not deleted before updating
      const verifyIdentity = await query(
        `SELECT id, is_deleted FROM vendor_identity WHERE id = $1 LIMIT 1`,
        [identity.id]
      ).catch(() => ({ rows: [] }));
      
      if (verifyIdentity.rows.length > 0) {
        const identityCheck = verifyIdentity.rows[0];
        const isIdentityDeleted = identityCheck.is_deleted === true || 
          identityCheck.is_deleted === 't' ||
          (typeof identityCheck.is_deleted === 'string' && identityCheck.is_deleted.toLowerCase() === 'true');
        
        if (!isIdentityDeleted) {
          // ✅ CRITICAL FIX: Update vendor_identity to link the new vendor_id
          // This ensures vendor_identity.vendor_id points to the correct (new) vendors record
          if (identity.vendor_id !== createdVendor.id) {
            try {
              await query(
                `UPDATE vendor_identity 
                 SET vendor_id = $1, updated_at = NOW()
                 WHERE id = $2 AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')`,
                [createdVendor.id, identity.id]
              );
              console.log(`✅ [VENDOR-ACTIVATION] Linked new vendor_id ${createdVendor.id} to vendor_identity ${identity.id}`);
            } catch (linkErr: any) {
              console.warn(`⚠️ [VENDOR-ACTIVATION] Failed to link vendor_id (non-critical):`, linkErr.message);
            }
          }
        } else {
          console.warn(`⚠️ [VENDOR-ACTIVATION] Cannot link vendor_id to deleted vendor_identity ${identity.id}`);
        }
      } else {
        console.warn(`⚠️ [VENDOR-ACTIVATION] Vendor identity ${identity.id} not found for linking`);
      }
      
      // ✅ VERIFY: Double-check the saved pincode
      const verifyVendorPincode = await select('vendors', { id: createdVendor.id });
      if (verifyVendorPincode.length > 0) {
        console.log(`📍 [VENDOR-ACTIVATION] ✅ VERIFIED: Vendor pincode in DB: '${verifyVendorPincode[0].pincode || '(empty)'}'`);
      }

      const vendor = vendors[0];

      // ✅ CRITICAL FIX: Update identity to ACTIVATED and link vendor_id
      // Only update if identity is not deleted (already verified above)
      const identityCheckResult = await query(
        `SELECT id, is_deleted FROM vendor_identity WHERE id = $1 LIMIT 1`,
        [identity.id]
      ).catch(() => ({ rows: [] }));
      
      if (identityCheckResult.rows.length > 0) {
        const identityCheck = identityCheckResult.rows[0];
        const isIdentityDeleted = identityCheck.is_deleted === true || 
          identityCheck.is_deleted === 't' ||
          (typeof identityCheck.is_deleted === 'string' && identityCheck.is_deleted.toLowerCase() === 'true');
        
        if (!isIdentityDeleted) {
          await update('vendor_identity', { id: identity.id }, {
            onboarding_status: 'ACTIVATED',
            vendor_id: vendor.id,
            updated_at: new Date().toISOString(),
          });
          console.log(`✅ [VENDOR-ACTIVATION] Updated vendor_identity ${identity.id} to ACTIVATED and linked vendor_id ${vendor.id}`);
        } else {
          console.warn(`⚠️ [VENDOR-ACTIVATION] Cannot update deleted vendor_identity ${identity.id}`);
        }
      }

      // Link referral (metadata and/or `referrals` / `vendor_referrals` rows from submit).
      try {
        const { linkVendorOnboardingReferralsFromIdentityMetadata } = await import(
          '../../../lib/services/referral-service'
        );
        await linkVendorOnboardingReferralsFromIdentityMetadata({
          vendorId: vendor.id,
          phone: identity.phone,
          metadata: referralMetadataForLink,
          vendorIdentityId: identity.id,
        });
      } catch (refError: any) {
        console.error('[VENDOR-ACTIVATION] Error linking referral:', refError);
      }

      return c.json({
        success: true,
        message: 'Vendor activated successfully',
        vendor_id: vendor.id,
        nextStep: '/dashboard',
      });
    } catch (error: any) {
      console.error('Error activating vendor:', error);
      return c.json({ success: false, error: error.message || 'Failed to activate vendor' }, 500);
    }
  });

  /**
   * POST /vendor/onboarding/fix-profile-photo
   * Retroactively extract and save profile photo from application for existing vendors
   */
  app.post('/vendor/onboarding/fix-profile-photo', async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { vendorId, phone } = body;

      if (!vendorId && !phone) {
        return c.json({ success: false, error: 'Vendor ID or phone is required' }, 400);
      }

      // Get vendor
      const vendors = vendorId 
        ? await select('vendors', { id: vendorId })
        : await select('vendors', { phone });
      
      if (vendors.length === 0) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Skip if vendor already has profile photo
      if (vendor.profile_photo_url) {
        return c.json({
          success: true,
          message: 'Vendor already has profile photo',
          vendor_id: vendor.id,
          profile_photo_url: vendor.profile_photo_url,
        });
      }

      // Get vendor identity
      const identities = await select('vendor_identity', { 
        vendor_id: vendor.id 
      });
      
      if (identities.length === 0) {
        // Try by phone
        const identitiesByPhone = await select('vendor_identity', { phone: vendor.phone });
        if (identitiesByPhone.length === 0) {
          return c.json({ success: false, error: 'Vendor identity not found' }, 404);
        }
        identities.push(...identitiesByPhone);
      }

      const identity = identities[0];

      // Get application
      if (!identity.application_id) {
        return c.json({ success: false, error: 'Application not found' }, 404);
      }

      const apps = await select('vendor_onboarding_applications', { id: identity.application_id });
      if (apps.length === 0) {
        return c.json({ success: false, error: 'Application not found' }, 404);
      }

      const application = apps[0];
      const payload = application.application_payload || {};
      
      // Extract profile photo
      let profilePhotoUrl: string | null = null;
      const uploadedDocuments = application.uploaded_documents || [];
      
      console.log(`📸 [FIX-PROFILE-PHOTO] Checking uploaded_documents (count: ${uploadedDocuments.length})`);
      
      if (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0) {
        console.log(`📸 [FIX-PROFILE-PHOTO] Document types: ${uploadedDocuments.map((d: any) => d.type || d.name || 'unknown').join(', ')}`);
        
        const profilePhotoDoc = uploadedDocuments.find((doc: any) => 
          doc.type === 'profilePhoto' || 
          doc.type === 'profile_photo' || 
          doc.name === 'profilePhoto' ||
          (doc.name && doc.name.toLowerCase().includes('profile') && doc.name.toLowerCase().includes('photo'))
        );
        
        if (profilePhotoDoc && profilePhotoDoc.url) {
          const photoUrl = profilePhotoDoc.url;
          console.log(`📸 [FIX-PROFILE-PHOTO] Found profile photo: type=${profilePhotoDoc.type}, url=${photoUrl}`);
          
          if (photoUrl.includes('amazonaws.com')) {
            try {
              const urlObj = new URL(photoUrl);
              profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
            } catch (e) {
              const match = photoUrl.match(/vendors\/[^?]+/) || photoUrl.match(/[a-f0-9-]+\/[^?]+/);
              profilePhotoUrl = match ? match[0] : photoUrl;
            }
          } else {
            profilePhotoUrl = photoUrl;
          }
          console.log(`📸 [FIX-PROFILE-PHOTO] ✅ Extracted: ${profilePhotoUrl}`);
        }
      }
      
      // Fallback: Check application_payload
      if (!profilePhotoUrl && payload.profilePhoto) {
        const photoUrl = payload.profilePhoto;
        if (photoUrl.includes('amazonaws.com')) {
          try {
            const urlObj = new URL(photoUrl);
            profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
          } catch (e) {
            const match = photoUrl.match(/vendors\/[^?]+/) || photoUrl.match(/[a-f0-9-]+\/[^?]+/);
            profilePhotoUrl = match ? match[0] : photoUrl;
          }
        } else {
          profilePhotoUrl = photoUrl;
        }
        console.log(`📸 [FIX-PROFILE-PHOTO] Extracted from payload: ${profilePhotoUrl}`);
      }

      if (!profilePhotoUrl) {
        return c.json({ 
          success: false, 
          error: 'Profile photo not found in application documents' 
        }, 404);
      }

      // Update vendor
      await update('vendors', { id: vendor.id }, {
        profile_photo_url: profilePhotoUrl,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Profile photo updated successfully',
        vendor_id: vendor.id,
        profile_photo_url: profilePhotoUrl,
      });
    } catch (error: any) {
      console.error('Error fixing profile photo:', error);
      return c.json({ success: false, error: error.message || 'Failed to fix profile photo' }, 500);
    }
  });

  /**
   * POST /vendor/onboarding/fix-pincode
   * Retroactively extract and save pincode from application for existing vendors
   */
  app.post('/vendor/onboarding/fix-pincode', async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { vendorId, phone } = body;

      if (!vendorId && !phone) {
        return c.json({ success: false, error: 'Vendor ID or phone is required' }, 400);
      }

      // Get vendor
      const vendors = vendorId 
        ? await select('vendors', { id: vendorId })
        : await select('vendors', { phone });
      
      if (vendors.length === 0) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // ✅ FIX: Check if vendor has a valid (non-placeholder) pincode
      const placeholderValues = ['000000', '0000000', '00000000', '123456', '000000', ''];
      const currentPincode = vendor.pincode ? vendor.pincode.trim() : '';
      const hasValidPincode = currentPincode && 
                              !placeholderValues.includes(currentPincode) && 
                              /^\d{6}$/.test(currentPincode);
      
      if (hasValidPincode) {
        return c.json({
          success: true,
          message: 'Vendor already has valid pincode',
          vendor_id: vendor.id,
          pincode: vendor.pincode,
        });
      }
      
      // If vendor has placeholder pincode, continue to fix it
      if (currentPincode) {
        console.log(`📍 [FIX-PINCODE] Vendor has placeholder pincode '${currentPincode}', attempting to fix...`);
      }

      // Get vendor identity
      const identities = await select('vendor_identity', { 
        vendor_id: vendor.id 
      });
      
      if (identities.length === 0) {
        // Try by phone
        const identitiesByPhone = await select('vendor_identity', { phone: vendor.phone });
        if (identitiesByPhone.length === 0) {
          return c.json({ success: false, error: 'Vendor identity not found' }, 404);
        }
        identities.push(...identitiesByPhone);
      }

      const identity = identities[0];

      // Get application
      if (!identity.application_id) {
        return c.json({ success: false, error: 'Application not found' }, 404);
      }

      const apps = await select('vendor_onboarding_applications', { id: identity.application_id });
      if (apps.length === 0) {
        return c.json({ success: false, error: 'Application not found' }, 404);
      }

      const application = apps[0];
      const payload = application.application_payload || {};
      
      // ✅ FIX: Use utility function to extract pincode
      const { extractPincodeFromPayload } = await import('../../../utils/extract-profile-photo');
      const pincodeValue = extractPincodeFromPayload(payload);
      
      console.log(`📍 [FIX-PINCODE] Checking pincode in application_payload:`);
      console.log(`📍 [FIX-PINCODE] payload keys: ${Object.keys(payload).join(', ')}`);
      console.log(`📍 [FIX-PINCODE] Extracted pincode: '${pincodeValue || '(empty)'}'`);

      if (!pincodeValue) {
        return c.json({ 
          success: false, 
          error: 'Pincode not found in application data' 
        }, 404);
      }

      // Update vendor
      await update('vendors', { id: vendor.id }, {
        pincode: pincodeValue,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Pincode updated successfully',
        vendor_id: vendor.id,
        pincode: pincodeValue,
      });
    } catch (error: any) {
      console.error('Error fixing pincode:', error);
      return c.json({ success: false, error: error.message || 'Failed to fix pincode' }, 500);
    }
  });

  /**
   * POST /vendor/onboarding/test-pincode
   * Test endpoint to directly set pincode for testing purposes
   */
  app.post('/vendor/onboarding/test-pincode', async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { vendorId, pincode } = body;

      if (!vendorId || !pincode) {
        return c.json({ success: false, error: 'Vendor ID and pincode are required' }, 400);
      }

      // Validate pincode format
      if (!/^\d{6}$/.test(pincode)) {
        return c.json({ success: false, error: 'Pincode must be 6 digits' }, 400);
      }

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }

      // Update vendor
      await update('vendors', { id: vendorId }, {
        pincode: pincode,
        updated_at: new Date().toISOString(),
      });

      // Verify it was saved
      const updatedVendors = await select('vendors', { id: vendorId });
      const savedPincode = updatedVendors[0]?.pincode;

      return c.json({
        success: true,
        message: 'Pincode updated successfully',
        vendor_id: vendorId,
        pincode: savedPincode,
      });
    } catch (error: any) {
      console.error('Error testing pincode:', error);
      return c.json({ success: false, error: error.message || 'Failed to test pincode' }, 500);
    }
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

async function createApiGatewayEventWithBody(c: any): Promise<any> {
  const body = await c.req.json().catch(() => ({}));
  
  // Get headers
  const headers: Record<string, string> = {};
  try {
    if (c.req.raw && c.req.raw.headers) {
      const rawHeaders = c.req.raw.headers;
      for (const key in rawHeaders) {
        const value = rawHeaders[key];
        if (value) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
      }
    } else {
      const contentType = c.req.header('content-type');
      const authorization = c.req.header('authorization');
      if (contentType) headers['content-type'] = contentType;
      if (authorization) headers['authorization'] = authorization;
    }
  } catch (e) {
    console.warn('[VENDOR-ONBOARDING] Error processing headers:', e);
  }

  const url = new URL(c.req.url);
  return {
    rawPath: url.pathname,
    rawQueryString: url.search.substring(1),
    headers,
    body: JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'vendor-onboarding-handler',
    functionVersion: '$LATEST',
  };
}

