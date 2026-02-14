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
 * - POST /admin/vendor/onboarding/:applicationId/review - Admin review
 * - POST /vendor/onboarding/activate - Activate vendor
 * - POST /vendor/setup/update-completion - Update setup completion
 * - POST /vendor/setup/go-live - Go live
 * 
 * Date: 2026-01-28
 * Phase: 4
 * ============================================================================
 */

import { Hono, Context } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { select, insert, update, query } from '../database/rds-connection';
import {
  SubmitVendorApplicationRequestSchema,
  SelectVendorRoleRequestSchema,
  SelectVendorTypeRequestSchema,
  AdminReviewApplicationRequestSchema,
} from '@warmpawz/api-contracts/vendors';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// PHASE 1: AUTH & ENTRY
// ============================================================================

class GetOnboardingStatusHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const requestId = context.requestId;
    
    if (!phone) {
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
      // ✅ FIX: Check if phone belongs to staff FIRST
      let isStaff = false;
      let staffInfo: any = null;
      
      try {
        const staffQuery = await query(`
          SELECT s.id, s.name, s.vendor_id, s.phone, s.role, s.is_active
          FROM staff s
          WHERE s.phone = $1 OR s.phone = $2
          LIMIT 1
        `, [phone, normalizedPhone]);
        
        if (staffQuery.rows && staffQuery.rows.length > 0) {
          const staff = staffQuery.rows[0];
          if (staff.vendor_id && staff.is_active !== false) {
            isStaff = true;
            staffInfo = {
              staff_id: staff.id,
              staff_name: staff.name,
              staff_role: staff.role,
              vendor_id: staff.vendor_id,
            };
            console.log(`[ONBOARDING STATUS] Phone ${phone} belongs to staff member ${staff.id}`);
          }
        }
      } catch (staffError: any) {
        console.warn('[ONBOARDING STATUS] Error checking staff:', staffError.message);
      }
      
      // Get or create vendor identity - try both phone formats
      let identity = await select('vendor_identity', { phone });
      if (identity.length === 0 && phone !== normalizedPhone) {
        identity = await select('vendor_identity', { phone: normalizedPhone });
      }
      
      if (identity.length === 0) {
        // ✅ FIX: If staff, create with ACTIVATED status; otherwise INIT
        const newIdentityData: any = {
          phone: normalizedPhone,
          onboarding_status: isStaff ? 'ACTIVATED' : 'INIT',
          metadata: isStaff ? { staff_id: staffInfo?.staff_id, created_via: 'staff_onboarding_status' } : {},
        };
        
        if (isStaff && staffInfo) {
          newIdentityData.vendor_id = staffInfo.vendor_id;
          newIdentityData.user_type = 'staff';
        }
        
        const newIdentity = await insert('vendor_identity', newIdentityData);
        identity = newIdentity;
        console.log(`[ONBOARDING STATUS] Created vendor_identity for ${normalizedPhone} with status: ${newIdentityData.onboarding_status}`);
      } else if (isStaff) {
        // ✅ FIX: If staff but existing identity doesn't have ACTIVATED, update it
        const existingIdentity = identity[0];
        if (existingIdentity.onboarding_status !== 'ACTIVATED') {
          console.log(`[ONBOARDING STATUS] Updating staff vendor_identity to ACTIVATED (was: ${existingIdentity.onboarding_status})`);
          await update('vendor_identity', { id: existingIdentity.id }, {
            onboarding_status: 'ACTIVATED',
            vendor_id: staffInfo?.vendor_id || existingIdentity.vendor_id,
            user_type: 'staff',
            metadata: {
              ...existingIdentity.metadata,
              staff_id: staffInfo?.staff_id,
              updated_via: 'staff_onboarding_status',
            },
            updated_at: new Date().toISOString(),
          });
          // Update local identity object
          existingIdentity.onboarding_status = 'ACTIVATED';
          existingIdentity.user_type = 'staff';
          existingIdentity.vendor_id = staffInfo?.vendor_id || existingIdentity.vendor_id;
        }
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

      // ✅ FIX: Include staff info in response for frontend staff detection
      return this.success({
        identity: vendorIdentity,
        application,
        role,
        nextStep: this.getNextStep(vendorIdentity.onboarding_status),
        is_staff: isStaff,
        staff_info: staffInfo,
      }, requestId);
    } catch (error: any) {
      console.error('Error getting onboarding status:', error);
      
      // If table doesn't exist or DB error, return a default INIT response
      // This allows new vendors to start the onboarding flow even if DB isn't fully configured
      if (error.message?.includes('does not exist') || 
          error.message?.includes('relation') ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('timeout')) {
        console.warn('[ONBOARDING] DB Error - returning default INIT status for phone:', phone);
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
      const identities = await select('vendor_identity', { phone });
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
      // Get vendor identity
      let identities = await select('vendor_identity', { phone });
      
      // ✅ FIX: Auto-create vendor identity if not found
      if (identities.length === 0) {
        console.log('📦 [SUBMIT] Creating new vendor identity for phone:', phone);
        const newIdentity = await insert('vendor_identity', {
          phone,
          onboarding_status: 'FORM_PENDING',
          metadata: {},
        });
        identities = newIdentity;
        
        // ✅ FIX: Check if there's an existing application for this phone that needs to be linked
        const existingApps = await query(
          `SELECT voa.* FROM vendor_onboarding_applications voa
           JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
           WHERE vi.phone = $1 AND voa.status IN ('REJECTED', 'DRAFT', 'CLARIFICATION_REQUIRED')
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
        }
      }

      let identity = identities[0];

      // ✅ FIX: Extract roleId and vendorType from payload or body if not in identity
      // Note: businessType (e.g., "veterinarian") is different from vendor_type (e.g., "solo" or "business")
      // vendor_type refers to whether the vendor is a solo provider or a business with staff
      const payloadRoleId = application_payload?.roleId || application_payload?.role_id || body.roleId || body.role_id;
      
      // Only use explicit vendor_type values, NOT businessType (which is the category like "veterinarian")
      let payloadVendorType = application_payload?.vendorType || application_payload?.vendor_type || 
                               body.vendorType || body.vendor_type;
      
      // Validate vendor_type is a valid value, otherwise default to 'business'
      if (!payloadVendorType || !['solo', 'business', 'center'].includes(payloadVendorType)) {
        payloadVendorType = 'business';
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
// PHASE 6: ADMIN DECISION FLOW
// ============================================================================

class AdminReviewApplicationHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const applicationId = context.event.pathParameters?.applicationId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!applicationId) {
      return this.error('Application ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // ✅ FIX: Validate that applicationId is a valid UUID format
    // This prevents errors like "invalid input syntax for type uuid: \"admin\""
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(applicationId)) {
      console.error(`[ADMIN-REVIEW] Invalid applicationId format: "${applicationId}"`);
      return this.error(
        `Invalid application ID format. Expected UUID, got: "${applicationId}"`,
        400,
        'VALIDATION_ERROR',
        undefined,
        requestId
      );
    }

    // Validate request with Zod schema
    const validationResult = AdminReviewApplicationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { action, admin_id, comments, rejection_reason } = validationResult.data;

    try {
      // Get application
      const apps = await select('vendor_onboarding_applications', {
        id: applicationId,
      });

      if (apps.length === 0) {
        return this.error('Application not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const application = apps[0];

      // Accept both UNDER_REVIEW and SUBMITTED (legacy: submit flow used to only set SUBMITTED on application)
      const isReviewable = application.status === 'UNDER_REVIEW' || application.status === 'SUBMITTED';
      if (!isReviewable) {
        return this.error(
          `Application is not in reviewable status (current: ${application.status}). Expected UNDER_REVIEW or SUBMITTED.`,
          400,
          'VALIDATION_ERROR',
          undefined,
          requestId
        );
      }

      // Get vendor identity
      const identities = await select('vendor_identity', {
        id: application.vendor_identity_id,
      });

      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const identity = identities[0];

      // Update application based on action
      let newStatus: string;
      let newOnboardingStatus: string;

      if (action === 'APPROVE') {
        newStatus = 'APPROVED';
        newOnboardingStatus = 'APPROVED';
        
        await update(
          'vendor_onboarding_applications',
          { id: applicationId },
          {
            status: newStatus,
            reviewed_by: admin_id,
            reviewed_at: new Date().toISOString(),
            admin_comments: comments || null,
            updated_at: new Date().toISOString(),
          }
        );
      } else if (action === 'REQUEST_CLARIFICATION') {
        if (!comments) {
          return this.error(
            'Comments are required for clarification request',
            400,
            'VALIDATION_ERROR',
            undefined,
            requestId
          );
        }

        newStatus = 'CLARIFICATION_REQUIRED';
        newOnboardingStatus = 'CLARIFICATION_REQUIRED';
        
        // Unlock application for editing
        await update(
          'vendor_onboarding_applications',
          { id: applicationId },
          {
            status: newStatus,
            reviewed_by: admin_id,
            reviewed_at: new Date().toISOString(),
            admin_comments: comments,
            is_locked: false,
            locked_at: null,
            updated_at: new Date().toISOString(),
          }
        );
      } else { // REJECT
        if (!rejection_reason) {
          return this.error(
            'Rejection reason is required',
            400,
            'VALIDATION_ERROR',
            undefined,
            requestId
          );
        }

        newStatus = 'REJECTED';
        newOnboardingStatus = 'REJECTED';
        
        // ✅ FIX: Unlock application when rejected so vendor can resubmit
        await update(
          'vendor_onboarding_applications',
          { id: applicationId },
          {
            status: newStatus,
            reviewed_by: admin_id,
            reviewed_at: new Date().toISOString(),
            rejection_reason,
            admin_comments: comments || null,
            is_locked: false,
            locked_at: null,
            updated_at: new Date().toISOString(),
          }
        );
      }

      // Transition onboarding status
      await query(
        `SELECT transition_onboarding_status($1, $2, $3, 'admin', $4, $5::jsonb)`,
        [
          identity.id,
          newOnboardingStatus,
          admin_id,
          action.toLowerCase(),
          JSON.stringify({ comments, rejection_reason }),
        ]
      );

      return this.success({
        message: `Application ${action.toLowerCase()}d successfully`,
        status: newStatus,
      }, requestId);
    } catch (error: any) {
      console.error('Error reviewing application:', error);
      return this.error(
        error.message || 'Failed to review application',
        500,
        'INTERNAL_ERROR',
        undefined,
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
  const reviewHandler = new AdminReviewApplicationHandlerEnhanced();

  // Phase 1: Auth & Entry
  app.get('/vendor/onboarding/status', async (c: Context) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result: any = await statusHandler.execute(event, context);
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

  // Phase 6: Admin Review
  app.post('/admin/vendor/onboarding/:applicationId/review', async (c: Context) => {
    // ✅ FIX: Extract applicationId from route parameter and validate
    const applicationId = c.req.param('applicationId');
    
    // Log for debugging
    console.log('[ADMIN-REVIEW] Route matched, applicationId from param:', applicationId);
    console.log('[ADMIN-REVIEW] Full URL path:', c.req.url);
    console.log('[ADMIN-REVIEW] All route params:', c.req.param());
    
    // Validate UUID format before proceeding
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!applicationId || !uuidRegex.test(applicationId)) {
      console.error(`[ADMIN-REVIEW] Invalid applicationId: "${applicationId}"`);
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid application ID format. Expected UUID, got: "${applicationId}"`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: randomUUID(),
          version: 'v1',
        },
      }, 400);
    }
    
    const event = await createApiGatewayEventWithBody(c);
    event.pathParameters = { applicationId };
    const context = createLambdaContext();
    const result: any = await reviewHandler.execute(event, context);
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

      // Check if vendor already exists in vendors table
      const existingVendors = await select('vendors', { phone });
      if (existingVendors.length > 0) {
        const vendor = existingVendors[0];
        // Update identity to ACTIVATED and vendor to active
        await update('vendor_identity', { id: identity.id }, {
          onboarding_status: 'ACTIVATED',
          updated_at: new Date().toISOString(),
        });
        await update('vendors', { id: vendor.id }, {
          status: 'approved',
          is_active: true,
          onboarding_status: 'ACTIVATED',
          updated_at: new Date().toISOString(),
        });
        return c.json({
          success: true,
          message: 'Vendor activated successfully',
          vendor_id: vendor.id,
          nextStep: '/dashboard',
        });
      }

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

      // Create vendor record from application
      const vendors = await insert('vendors', {
        phone: identity.phone,
        email: payload.email || identity.email || '',
        business_name: payload.businessName || '',
        owner_name: payload.fullName || payload.ownerName || '',
        role_id: application.role_id,
        vendor_type: application.vendor_type,
        vendor_identity_id: identity.id,
        onboarding_status: 'ACTIVATED',
        status: 'approved',
        is_active: true,
        address: payload.address || '',
        city: payload.city || '',
        state: payload.state || '',
        pincode: payload.pin || payload.pincode || '',
      });

      const vendor = vendors[0];

      // Update identity to ACTIVATED
      await update('vendor_identity', { id: identity.id }, {
        onboarding_status: 'ACTIVATED',
        updated_at: new Date().toISOString(),
      });

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

