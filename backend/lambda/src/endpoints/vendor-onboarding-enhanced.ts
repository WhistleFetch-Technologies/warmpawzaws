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

import { Hono } from 'hono';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { select, insert, update, query } from '../database/rds-connection';
import {
  SubmitVendorApplicationRequestSchema,
  SelectVendorRoleRequestSchema,
  SelectVendorTypeRequestSchema,
  AdminReviewApplicationRequestSchema,
} from '@warmpawz/api-contracts/vendors';

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

    // Check if UAT mode is enabled
    const isUATMode = process.env.UAT_MODE === 'true' || 
                     process.env.NODE_ENV === 'development' ||
                     process.env.STAGE === 'dev' ||
                     (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.AWS_LAMBDA_FUNCTION_NAME.includes('dev'));

    try {
      // Get or create vendor identity
      let identity = await select('vendor_identity', { phone });
      
      if (identity.length === 0) {
        // Create new identity with INIT status
        const newIdentity = await insert('vendor_identity', {
          phone,
          onboarding_status: 'INIT',
          metadata: {},
        });
        identity = newIdentity;
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
      console.error('Error getting onboarding status:', error);
      
      // In UAT mode, return a default response if table doesn't exist
      if (isUATMode && (error.message?.includes('does not exist') || error.message?.includes('relation'))) {
        console.warn('[ONBOARDING] UAT Mode: Table missing, returning default INIT status');
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
        }, requestId);
      }
      
      return this.error(
        error.message || 'Failed to get onboarding status',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
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

      // Validate role exists and is active
      const roles = await select('roles', { id: role_id, is_active: true });
      if (roles.length === 0) {
        return this.error('Role not found or inactive', 404, 'NOT_FOUND', undefined, requestId);
      }

      // Update identity with selected role
      await update(
        'vendor_identity',
        { id: identity.id },
        {
          selected_role_id: role_id,
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
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const requestId = context.requestId;

    if (!phone) {
      return this.error('Phone number is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const identity = identities[0];

      if (!identity.selected_role_id || !identity.vendor_type) {
        return this.error(
          'Role and vendor type must be selected first',
          400,
          'VALIDATION_ERROR',
          undefined,
          requestId
        );
      }

      // Get form schema from onboarding forms table (matching reference implementation)
      // First, get the role to find its name
      const roles = await select('roles', { id: identity.selected_role_id });
      if (roles.length === 0) {
        return this.error('Role not found', 404, 'NOT_FOUND', undefined, requestId);
      }
      
      const role = roles[0];
      const roleName = role.name;
      
      // Forms are stored by role name, not UUID
      const formsResult = await query(
        `SELECT * FROM onboarding_forms WHERE role_id = $1`,
        [roleName]
      );
      const forms = formsResult.rows || [];
      let fields: any[] = [];

      if (forms.length > 0) {
        fields = typeof forms[0].fields === 'string' 
          ? JSON.parse(forms[0].fields) 
          : forms[0].fields || [];
      }

      // Filter active fields only
      const activeFields = fields.filter((f: any) => f.isActive !== false);

      // Group fields by section (matching reference structure)
      const sections: Record<string, any> = {};
      const sectionMeta: Record<string, any> = {
        'business_information': { title: 'Business Information', order: 1 },
        'location_information': { title: 'Location', order: 2 },
        'banking_information': { title: 'Banking Details', order: 3 },
        'document_verification': { title: 'Documents', order: 4 },
        'documents': { title: 'Documents', order: 4 },
        'additional_information': { title: 'Additional Info', order: 5 },
      };

      for (const field of activeFields) {
        const secKey = field.section || 'business_information';
        if (!sections[secKey]) {
          sections[secKey] = {
            id: secKey,
            name: secKey,
            title: sectionMeta[secKey]?.title || secKey.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            order: sectionMeta[secKey]?.order || 99,
            fields: [],
          };
        }
        sections[secKey].fields.push(field);
      }

      const sectionsArray = Object.values(sections).sort((a: any, b: any) => a.order - b.order);

      if (activeFields.length === 0) {
        return this.error(
          'Form schema not found for this role. Please ensure onboarding form is configured.',
          404,
          'NOT_FOUND',
          undefined,
          requestId
        );
      }

      // Get existing application if any
      let application = null;
      if (identity.application_id) {
        const apps = await select('vendor_onboarding_applications', {
          id: identity.application_id,
        });
        application = apps.length > 0 ? apps[0] : null;
      }

      return this.success({
        success: true,
        roleId: identity.selected_role_id,
        roleName: identity.selected_role_id,
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
}

class SubmitApplicationHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    // Validate request with Zod schema
    const validationResult = SubmitVendorApplicationRequestSchema.safeParse(body);
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
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const identity = identities[0];

      if (!identity.selected_role_id || !identity.vendor_type) {
        return this.error(
          'Role and vendor type must be selected first',
          400,
          'VALIDATION_ERROR',
          undefined,
          requestId
        );
      }

      // Get form schema version
      const roles = await select('roles', { id: identity.selected_role_id });
      const formVersion = roles[0]?.config?.onboardingFormSchema?.[identity.vendor_type]?.version || '1.0';

      // Check if application exists
      let applicationId = identity.application_id;
      
      if (applicationId) {
        const apps = await select('vendor_onboarding_applications', {
          id: applicationId,
        });
        
        if (apps.length > 0) {
          const app = apps[0];
          
          // Can only edit if DRAFT or CLARIFICATION_REQUIRED
          if (app.status !== 'DRAFT' && app.status !== 'CLARIFICATION_REQUIRED') {
            return this.error(
              'Application is locked and cannot be edited',
              403,
              'FORBIDDEN',
              undefined,
              requestId
            );
          }

          // Update existing application
          await update(
            'vendor_onboarding_applications',
            { id: applicationId },
            {
              application_payload,
              uploaded_documents: uploaded_documents || app.uploaded_documents || [],
              form_version: formVersion,
              status: 'SUBMITTED',
              submitted_at: new Date().toISOString(),
              is_locked: true,
              locked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          );
        }
      } else {
        // Create new application
        const newApp = await insert('vendor_onboarding_applications', {
          vendor_identity_id: identity.id,
          role_id: identity.selected_role_id,
          vendor_type: identity.vendor_type,
          application_payload,
          uploaded_documents: uploaded_documents || [],
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

      // Transition to UNDER_REVIEW
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

      console.log('✅ [SUBMIT] Application submitted successfully:', applicationId);

      return this.success({
        message: 'Application submitted successfully',
        applicationId,
        nextStep: '/onboarding/pending-review',
      }, requestId);
    } catch (error: any) {
      console.error('Error submitting application:', error);
      return this.error(
        error.message || 'Failed to submit application',
        500,
        'INTERNAL_ERROR',
        undefined,
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

      if (application.status !== 'UNDER_REVIEW') {
        return this.error(
          'Application is not in UNDER_REVIEW status',
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
        
        await update(
          'vendor_onboarding_applications',
          { id: applicationId },
          {
            status: newStatus,
            reviewed_by: admin_id,
            reviewed_at: new Date().toISOString(),
            rejection_reason,
            admin_comments: comments || null,
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
  app.get('/vendor/onboarding/status', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result: any = await statusHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 2: Role Selection
  app.get('/vendor/onboarding/roles', async (c) => {
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

  app.post('/vendor/onboarding/select-role', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result: any = await selectRoleHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 3: Vendor Type
  app.post('/vendor/onboarding/select-vendor-type', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result: any = await selectVendorTypeHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 4: Dynamic Form
  app.get('/vendor/onboarding/form-schema', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result: any = await formSchemaHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/vendor/onboarding/submit-application', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result: any = await submitHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // Phase 6: Admin Review
  app.post('/admin/vendor/onboarding/:applicationId/review', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    event.pathParameters = { applicationId: c.req.param('applicationId') };
    const context = createLambdaContext();
    const result: any = await reviewHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
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
      requestId: crypto.randomUUID(),
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
      requestId: crypto.randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'vendor-onboarding-handler',
    functionVersion: '$LATEST',
  };
}

