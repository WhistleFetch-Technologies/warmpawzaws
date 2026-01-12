// ============================================================================
// VENDOR ONBOARDING API ENDPOINTS
// ============================================================================
// Complete database-driven onboarding flow with state machine
// All state transitions are persisted, no UI-only flows
// ============================================================================

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../base-handler';
import { select, insert, update, query } from '../db';

// ============================================================================
// PHASE 1: AUTH & ENTRY
// ============================================================================

class GetOnboardingStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    
    if (!phone) {
      return this.error('Phone number is required', 400);
    }

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
      });
    } catch (error: any) {
      console.error('Error getting onboarding status:', error);
      return this.error(error.message || 'Failed to get onboarding status', 500);
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
// PHASE 2: ROLE SELECTION (DYNAMIC)
// ============================================================================

class GetAvailableRolesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
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
            capabilities: permissions.map(p => p.permission_name),
            vendor_types_supported: role.config?.vendorTypes || ['solo', 'business'],
          };
        })
      );

      return this.success({ roles: rolesWithConfig });
    } catch (error: any) {
      console.error('Error getting roles:', error);
      return this.error(error.message || 'Failed to get roles', 500);
    }
  }
}

class SelectRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, role_id } = body;

    if (!phone || !role_id) {
      return this.error('Phone and role_id are required', 400);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      // Validate role exists and is active
      const roles = await select('roles', { id: role_id, is_active: true });
      if (roles.length === 0) {
        return this.error('Role not found or inactive', 404);
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
      });
    } catch (error: any) {
      console.error('Error selecting role:', error);
      return this.error(error.message || 'Failed to select role', 500);
    }
  }
}

// ============================================================================
// PHASE 3: VENDOR TYPE
// ============================================================================

class SelectVendorTypeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, vendor_type } = body;

    if (!phone || !vendor_type) {
      return this.error('Phone and vendor_type are required', 400);
    }

    if (!['solo', 'business'].includes(vendor_type)) {
      return this.error('Invalid vendor_type. Must be solo or business', 400);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      if (!identity.selected_role_id) {
        return this.error('Role must be selected first', 400);
      }

      // Validate vendor_type is supported by role
      const roles = await select('roles', { id: identity.selected_role_id });
      if (roles.length === 0) {
        return this.error('Role not found', 404);
      }

      const role = roles[0];
      const supportedTypes = role.config?.vendorTypes || [];
      
      if (!supportedTypes.includes(vendor_type)) {
        return this.error(
          `Vendor type '${vendor_type}' is not supported for this role. Supported: ${supportedTypes.join(', ')}`,
          400
        );
      }

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
      });
    } catch (error: any) {
      console.error('Error selecting vendor type:', error);
      return this.error(error.message || 'Failed to select vendor type', 500);
    }
  }
}

// ============================================================================
// PHASE 4: DYNAMIC ONBOARDING FORM
// ============================================================================

class GetOnboardingFormSchemaHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const roleId = context.event.queryStringParameters?.roleId;

    if (!phone && !roleId) {
      return this.error('Phone number or roleId is required', 400);
    }

    try {
      let selectedRoleId = roleId;

      // If phone is provided, get role from vendor identity
      if (phone && !roleId) {
        const identities = await select('vendor_identity', { phone });
        if (identities.length === 0) {
          return this.error('Vendor identity not found', 404);
        }

        const identity = identities[0];

        if (!identity.selected_role_id) {
          return this.error('Role must be selected first. Please select a role.', 400);
        }

        selectedRoleId = identity.selected_role_id;
      }

      if (!selectedRoleId) {
        return this.error('Role ID is required', 400);
      }

      // Get onboarding form for this role using the new endpoint structure
      // This matches the reference implementation: /onboarding-form/:roleId
      const forms = await select('onboarding_forms', { role_id: selectedRoleId });
      let fields: any[] = [];

      if (forms.length > 0) {
        // Parse JSONB fields
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

      // Get role info
      const roles = await select('roles', { name: selectedRoleId });
      const role = roles.length > 0 ? roles[0] : null;

      // Get existing application if phone was provided
      let application = null;
      if (phone) {
        const identities = await select('vendor_identity', { phone });
        if (identities.length > 0 && identities[0].application_id) {
          const apps = await select('vendor_onboarding_applications', {
            id: identities[0].application_id,
          });
          application = apps.length > 0 ? apps[0] : null;
        }
      }

      return this.success({
        success: true,
        roleId: selectedRoleId,
        roleName: role?.display_name || role?.name || selectedRoleId,
        fields: activeFields,
        sections: sectionsArray,
        schema: {
          fields: activeFields,
          sections: sectionsArray,
        },
        existingApplication: application,
        canEdit: !application || application.status === 'DRAFT' || application.status === 'CLARIFICATION_REQUIRED',
        version: forms.length > 0 ? (forms[0].version || 1) : 1,
      });
    } catch (error: any) {
      console.error('Error getting form schema:', error);
      return this.error(error.message || 'Failed to get form schema', 500);
    }
  }
}

class SubmitApplicationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone, application_payload, uploaded_documents } = body;

    if (!phone || !application_payload) {
      return this.error('Phone and application_payload are required', 400);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      if (!identity.selected_role_id || !identity.vendor_type) {
        return this.error('Role and vendor type must be selected first', 400);
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
            return this.error('Application is locked and cannot be edited', 403);
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
        await query(
          `SELECT transition_onboarding_status($1, $2, NULL, 'vendor', 'application_submitted', '{}'::jsonb)`,
          [identity.id, 'UNDER_REVIEW']
        );
      }

      return this.success({
        message: 'Application submitted successfully',
        applicationId,
        nextStep: '/onboarding/pending-review',
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      return this.error(error.message || 'Failed to submit application', 500);
    }
  }
}

// ============================================================================
// PHASE 6: ADMIN DECISION FLOW
// ============================================================================

class AdminReviewApplicationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const applicationId = context.event.pathParameters?.applicationId;
    const body = this.parseBody(context.event);
    const { action, admin_id, comments, rejection_reason } = body;

    if (!applicationId || !action || !admin_id) {
      return this.error('applicationId, action, and admin_id are required', 400);
    }

    if (!['APPROVE', 'REQUEST_CLARIFICATION', 'REJECT'].includes(action)) {
      return this.error('Invalid action. Must be APPROVE, REQUEST_CLARIFICATION, or REJECT', 400);
    }

    try {
      // Get application
      const apps = await select('vendor_onboarding_applications', {
        id: applicationId,
      });

      if (apps.length === 0) {
        return this.error('Application not found', 404);
      }

      const application = apps[0];

      if (application.status !== 'UNDER_REVIEW') {
        return this.error('Application is not in UNDER_REVIEW status', 400);
      }

      // Get vendor identity
      const identities = await select('vendor_identity', {
        id: application.vendor_identity_id,
      });

      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
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
          return this.error('Comments are required for clarification request', 400);
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
          return this.error('Rejection reason is required', 400);
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
      });
    } catch (error: any) {
      console.error('Error reviewing application:', error);
      return this.error(error.message || 'Failed to review application', 500);
    }
  }
}

// ============================================================================
// PHASE 7: GET STARTED → ACTIVATION
// ============================================================================

class ActivateVendorHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { phone } = body;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    try {
      // Get vendor identity
      const identities = await select('vendor_identity', { phone });
      if (identities.length === 0) {
        return this.error('Vendor identity not found', 404);
      }

      const identity = identities[0];

      if (identity.onboarding_status !== 'APPROVED') {
        return this.error('Vendor must be approved before activation', 400);
      }

      // Get application
      if (!identity.application_id) {
        return this.error('Application not found', 404);
      }

      const apps = await select('vendor_onboarding_applications', {
        id: identity.application_id,
      });

      if (apps.length === 0) {
        return this.error('Application not found', 404);
      }

      const application = apps[0];

      // Create vendor record from application
      const vendorData = {
        phone: identity.phone,
        email: application.application_payload.email || identity.email || '',
        business_name: application.application_payload.businessName || '',
        owner_name: application.application_payload.ownerName || '',
        role_id: application.role_id,
        vendor_type: application.vendor_type,
        vendor_identity_id: identity.id,
        onboarding_status: 'ACTIVATED',
        status: 'active',
        address: application.application_payload.address || '',
        city: application.application_payload.city || '',
        state: application.application_payload.state || '',
        pincode: application.application_payload.pincode || '',
        ...application.application_payload, // Include all other fields
      };

      const vendors = await insert('vendors', vendorData);
      const vendor = vendors[0];

      // Create setup completion record
      await insert('vendor_setup_completion', {
        vendor_id: vendor.id,
        profile_completed: false,
        bank_account_completed: false,
        business_hours_completed: false,
        staff_management_completed: false,
        services_configured: false,
        is_go_live_ready: false,
      });

      // Transition to ACTIVATED
      await query(
        `SELECT transition_onboarding_status($1, $2, NULL, 'vendor', 'vendor_activated', $3::jsonb)`,
        [identity.id, 'ACTIVATED', JSON.stringify({ vendor_id: vendor.id })]
      );

      return this.success({
        message: 'Vendor activated successfully',
        vendor_id: vendor.id,
        nextStep: '/dashboard',
      });
    } catch (error: any) {
      console.error('Error activating vendor:', error);
      return this.error(error.message || 'Failed to activate vendor', 500);
    }
  }
}

// ============================================================================
// PHASE 8: POST-ACTIVATION SETUP
// ============================================================================

class UpdateSetupCompletionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { vendor_id, step, completed } = body;

    if (!vendor_id || !step || typeof completed !== 'boolean') {
      return this.error('vendor_id, step, and completed are required', 400);
    }

    const validSteps = [
      'profile',
      'bank_account',
      'business_hours',
      'staff_management',
      'services',
    ];

    if (!validSteps.includes(step)) {
      return this.error(`Invalid step. Must be one of: ${validSteps.join(', ')}`, 400);
    }

    try {
      // Get or create setup completion record
      let setup = await select('vendor_setup_completion', { vendor_id });

      if (setup.length === 0) {
        const newSetup = await insert('vendor_setup_completion', {
          vendor_id,
          profile_completed: false,
          bank_account_completed: false,
          business_hours_completed: false,
          staff_management_completed: false,
          services_configured: false,
          is_go_live_ready: false,
        });
        setup = newSetup;
      }

      const setupRecord = setup[0];

      // Update step completion
      const stepField = `${step}_completed` as keyof typeof setupRecord;
      const stepAtField = `${step}_completed_at` as keyof typeof setupRecord;

      const updateData: any = {
        [stepField]: completed,
        updated_at: new Date().toISOString(),
      };

      if (completed) {
        updateData[stepAtField] = new Date().toISOString();
      } else {
        updateData[stepAtField] = null;
      }

      await update('vendor_setup_completion', { vendor_id }, updateData);

      // Check if all required steps are completed
      const updatedSetup = await select('vendor_setup_completion', { vendor_id });
      const updated = updatedSetup[0];

      const allRequired = 
        updated.profile_completed &&
        updated.bank_account_completed &&
        updated.business_hours_completed &&
        updated.services_configured;

      if (allRequired && !updated.is_go_live_ready) {
        await update(
          'vendor_setup_completion',
          { vendor_id },
          {
            is_go_live_ready: true,
            go_live_ready_at: new Date().toISOString(),
          }
        );
      } else if (!allRequired && updated.is_go_live_ready) {
        await update(
          'vendor_setup_completion',
          { vendor_id },
          {
            is_go_live_ready: false,
            go_live_ready_at: null,
          }
        );
      }

      return this.success({
        message: 'Setup completion updated',
        is_go_live_ready: allRequired,
      });
    } catch (error: any) {
      console.error('Error updating setup completion:', error);
      return this.error(error.message || 'Failed to update setup completion', 500);
    }
  }
}

class GoLiveHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { vendor_id } = body;

    if (!vendor_id) {
      return this.error('vendor_id is required', 400);
    }

    try {
      // Check if go-live ready
      const readyResult = await query(
        `SELECT is_vendor_go_live_ready($1) as ready`,
        [vendor_id]
      );

      if (!readyResult.rows[0]?.ready) {
        return this.error('Vendor is not ready for go-live. Complete all required setup steps.', 400);
      }

      // Update setup completion
      await update(
        'vendor_setup_completion',
        { vendor_id },
        {
          go_live_at: new Date().toISOString(),
        }
      );

      // Update vendor status
      await update(
        'vendors',
        { id: vendor_id },
        {
          is_active: true,
          status: 'active',
        }
      );

      // Sync services to customer app (service catalog, discovery filters, etc.)
      try {
        const { queueSearchIndexUpdate } = require('../utils/aws-clients');
        
        // Get all vendor services
        const vendorServices = await select('vendor_services', {
          vendor_id: vendorId,
          is_active: true,
        });
        
        // Queue search index updates for each service
        for (const service of vendorServices) {
          await queueSearchIndexUpdate('service', 'update', service.id, {
            vendor_id: vendorId,
            vendor_name: vendor.business_name,
            is_active: true,
          });
        }
        
        // Queue vendor index update
        await queueSearchIndexUpdate('vendor', 'update', vendorId, {
          is_active: true,
          status: 'active',
        });
        
        console.log(`✅ Services synced to search index for vendor ${vendorId}`);
      } catch (error: any) {
        console.warn('Failed to sync services to search index:', error);
        // Don't fail the go-live process if sync fails
      }

      return this.success({
        message: 'Vendor is now live!',
        go_live_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error going live:', error);
      return this.error(error.message || 'Failed to go live', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerVendorOnboardingEndpoints(app: Hono) {
  // Phase 1: Auth & Entry
  app.get('/vendor/onboarding/status', (c) => new GetOnboardingStatusHandler().handle(c));

  // Phase 2: Role Selection
  app.get('/vendor/onboarding/roles', (c) => new GetAvailableRolesHandler().handle(c));
  app.post('/vendor/onboarding/select-role', (c) => new SelectRoleHandler().handle(c));

  // Phase 3: Vendor Type
  app.post('/vendor/onboarding/select-vendor-type', (c) => new SelectVendorTypeHandler().handle(c));

  // Phase 4: Dynamic Form
  app.get('/vendor/onboarding/form-schema', (c) => new GetOnboardingFormSchemaHandler().handle(c));
  app.post('/vendor/onboarding/submit-application', (c) => new SubmitApplicationHandler().handle(c));

  // Phase 6: Admin Review
  app.post('/admin/vendor/onboarding/:applicationId/review', (c) => new AdminReviewApplicationHandler().handle(c));

  // Phase 7: Activation
  app.post('/vendor/onboarding/activate', (c) => new ActivateVendorHandler().handle(c));

  // Phase 8: Post-Activation Setup
  app.post('/vendor/setup/update-completion', (c) => new UpdateSetupCompletionHandler().handle(c));
  app.post('/vendor/setup/go-live', (c) => new GoLiveHandler().handle(c));
}
