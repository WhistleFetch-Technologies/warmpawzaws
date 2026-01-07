"use strict";
// ============================================================================
// VENDOR ONBOARDING API ENDPOINTS
// ============================================================================
// Complete database-driven onboarding flow with state machine
// All state transitions are persisted, no UI-only flows
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorOnboardingEndpoints = registerVendorOnboardingEndpoints;
const base_handler_1 = require("../base-handler");
const db_1 = require("../db");
// ============================================================================
// PHASE 1: AUTH & ENTRY
// ============================================================================
class GetOnboardingStatusHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const phone = context.event.queryStringParameters?.phone;
        if (!phone) {
            return this.error('Phone number is required', 400);
        }
        try {
            // Get or create vendor identity
            let identity = await (0, db_1.select)('vendor_identity', { phone });
            if (identity.length === 0) {
                // Create new identity with INIT status
                const newIdentity = await (0, db_1.insert)('vendor_identity', {
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
                const apps = await (0, db_1.select)('vendor_onboarding_applications', {
                    id: vendorIdentity.application_id,
                });
                application = apps.length > 0 ? apps[0] : null;
            }
            // Get role info if selected
            let role = null;
            if (vendorIdentity.selected_role_id) {
                const roles = await (0, db_1.select)('roles', {
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
        }
        catch (error) {
            console.error('Error getting onboarding status:', error);
            return this.error(error.message || 'Failed to get onboarding status', 500);
        }
    }
    getNextStep(status) {
        const stepMap = {
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
class GetAvailableRolesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        try {
            // Get all active roles
            const roles = await (0, db_1.select)('roles', { is_active: true });
            // Get permissions for each role
            const rolesWithConfig = await Promise.all(roles.map(async (role) => {
                const permissions = await (0, db_1.select)('role_permissions', {
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
            }));
            return this.success({ roles: rolesWithConfig });
        }
        catch (error) {
            console.error('Error getting roles:', error);
            return this.error(error.message || 'Failed to get roles', 500);
        }
    }
}
class SelectRoleHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { phone, role_id } = body;
        if (!phone || !role_id) {
            return this.error('Phone and role_id are required', 400);
        }
        try {
            // Get vendor identity
            const identities = await (0, db_1.select)('vendor_identity', { phone });
            if (identities.length === 0) {
                return this.error('Vendor identity not found', 404);
            }
            const identity = identities[0];
            // Validate role exists and is active
            const roles = await (0, db_1.select)('roles', { id: role_id, is_active: true });
            if (roles.length === 0) {
                return this.error('Role not found or inactive', 404);
            }
            // Update identity with selected role
            await (0, db_1.update)('vendor_identity', { id: identity.id }, {
                selected_role_id: role_id,
                updated_at: new Date().toISOString(),
            });
            // Transition to ROLE_PENDING if currently INIT
            if (identity.onboarding_status === 'INIT') {
                await (0, db_1.query)(`SELECT transition_onboarding_status($1, $2, NULL, 'system', 'role_selected', '{}'::jsonb)`, [identity.id, 'ROLE_PENDING']);
            }
            return this.success({
                message: 'Role selected successfully',
                nextStep: '/onboarding/vendor-type',
            });
        }
        catch (error) {
            console.error('Error selecting role:', error);
            return this.error(error.message || 'Failed to select role', 500);
        }
    }
}
// ============================================================================
// PHASE 3: VENDOR TYPE
// ============================================================================
class SelectVendorTypeHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
            const identities = await (0, db_1.select)('vendor_identity', { phone });
            if (identities.length === 0) {
                return this.error('Vendor identity not found', 404);
            }
            const identity = identities[0];
            if (!identity.selected_role_id) {
                return this.error('Role must be selected first', 400);
            }
            // Validate vendor_type is supported by role
            const roles = await (0, db_1.select)('roles', { id: identity.selected_role_id });
            if (roles.length === 0) {
                return this.error('Role not found', 404);
            }
            const role = roles[0];
            const supportedTypes = role.config?.vendorTypes || [];
            if (!supportedTypes.includes(vendor_type)) {
                return this.error(`Vendor type '${vendor_type}' is not supported for this role. Supported: ${supportedTypes.join(', ')}`, 400);
            }
            // Update identity
            await (0, db_1.update)('vendor_identity', { id: identity.id }, {
                vendor_type,
                updated_at: new Date().toISOString(),
            });
            // Transition to FORM_PENDING
            if (identity.onboarding_status === 'ROLE_PENDING') {
                await (0, db_1.query)(`SELECT transition_onboarding_status($1, $2, NULL, 'system', 'vendor_type_selected', '{}'::jsonb)`, [identity.id, 'FORM_PENDING']);
            }
            return this.success({
                message: 'Vendor type selected successfully',
                nextStep: '/onboarding/form',
            });
        }
        catch (error) {
            console.error('Error selecting vendor type:', error);
            return this.error(error.message || 'Failed to select vendor type', 500);
        }
    }
}
// ============================================================================
// PHASE 4: DYNAMIC ONBOARDING FORM
// ============================================================================
class GetOnboardingFormSchemaHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const phone = context.event.queryStringParameters?.phone;
        if (!phone) {
            return this.error('Phone number is required', 400);
        }
        try {
            // Get vendor identity
            const identities = await (0, db_1.select)('vendor_identity', { phone });
            if (identities.length === 0) {
                return this.error('Vendor identity not found', 404);
            }
            const identity = identities[0];
            if (!identity.selected_role_id || !identity.vendor_type) {
                return this.error('Role and vendor type must be selected first', 400);
            }
            // Get form schema from role config
            const schemaResult = await (0, db_1.query)(`SELECT get_onboarding_form_schema($1, $2) as schema`, [identity.selected_role_id, identity.vendor_type]);
            const schema = schemaResult.rows[0]?.schema;
            if (!schema) {
                return this.error('Form schema not found for this role and vendor type', 404);
            }
            // Get existing application if any
            let application = null;
            if (identity.application_id) {
                const apps = await (0, db_1.select)('vendor_onboarding_applications', {
                    id: identity.application_id,
                });
                application = apps.length > 0 ? apps[0] : null;
            }
            return this.success({
                schema,
                existingApplication: application,
                canEdit: !application || application.status === 'DRAFT' || application.status === 'CLARIFICATION_REQUIRED',
            });
        }
        catch (error) {
            console.error('Error getting form schema:', error);
            return this.error(error.message || 'Failed to get form schema', 500);
        }
    }
}
class SubmitApplicationHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { phone, application_payload, uploaded_documents } = body;
        if (!phone || !application_payload) {
            return this.error('Phone and application_payload are required', 400);
        }
        try {
            // Get vendor identity
            const identities = await (0, db_1.select)('vendor_identity', { phone });
            if (identities.length === 0) {
                return this.error('Vendor identity not found', 404);
            }
            const identity = identities[0];
            if (!identity.selected_role_id || !identity.vendor_type) {
                return this.error('Role and vendor type must be selected first', 400);
            }
            // Get form schema version
            const roles = await (0, db_1.select)('roles', { id: identity.selected_role_id });
            const formVersion = roles[0]?.config?.onboardingFormSchema?.[identity.vendor_type]?.version || '1.0';
            // Check if application exists
            let applicationId = identity.application_id;
            if (applicationId) {
                const apps = await (0, db_1.select)('vendor_onboarding_applications', {
                    id: applicationId,
                });
                if (apps.length > 0) {
                    const app = apps[0];
                    // Can only edit if DRAFT or CLARIFICATION_REQUIRED
                    if (app.status !== 'DRAFT' && app.status !== 'CLARIFICATION_REQUIRED') {
                        return this.error('Application is locked and cannot be edited', 403);
                    }
                    // Update existing application
                    await (0, db_1.update)('vendor_onboarding_applications', { id: applicationId }, {
                        application_payload,
                        uploaded_documents: uploaded_documents || app.uploaded_documents || [],
                        form_version: formVersion,
                        status: 'SUBMITTED',
                        submitted_at: new Date().toISOString(),
                        is_locked: true,
                        locked_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                }
            }
            else {
                // Create new application
                const newApp = await (0, db_1.insert)('vendor_onboarding_applications', {
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
                await (0, db_1.update)('vendor_identity', { id: identity.id }, { application_id: applicationId });
            }
            // Transition to UNDER_REVIEW
            if (identity.onboarding_status === 'FORM_PENDING' || identity.onboarding_status === 'CLARIFICATION_REQUIRED') {
                await (0, db_1.query)(`SELECT transition_onboarding_status($1, $2, NULL, 'vendor', 'application_submitted', '{}'::jsonb)`, [identity.id, 'UNDER_REVIEW']);
            }
            return this.success({
                message: 'Application submitted successfully',
                applicationId,
                nextStep: '/onboarding/pending-review',
            });
        }
        catch (error) {
            console.error('Error submitting application:', error);
            return this.error(error.message || 'Failed to submit application', 500);
        }
    }
}
// ============================================================================
// PHASE 6: ADMIN DECISION FLOW
// ============================================================================
class AdminReviewApplicationHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
            const apps = await (0, db_1.select)('vendor_onboarding_applications', {
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
            const identities = await (0, db_1.select)('vendor_identity', {
                id: application.vendor_identity_id,
            });
            if (identities.length === 0) {
                return this.error('Vendor identity not found', 404);
            }
            const identity = identities[0];
            // Update application based on action
            let newStatus;
            let newOnboardingStatus;
            if (action === 'APPROVE') {
                newStatus = 'APPROVED';
                newOnboardingStatus = 'APPROVED';
                await (0, db_1.update)('vendor_onboarding_applications', { id: applicationId }, {
                    status: newStatus,
                    reviewed_by: admin_id,
                    reviewed_at: new Date().toISOString(),
                    admin_comments: comments || null,
                    updated_at: new Date().toISOString(),
                });
            }
            else if (action === 'REQUEST_CLARIFICATION') {
                if (!comments) {
                    return this.error('Comments are required for clarification request', 400);
                }
                newStatus = 'CLARIFICATION_REQUIRED';
                newOnboardingStatus = 'CLARIFICATION_REQUIRED';
                // Unlock application for editing
                await (0, db_1.update)('vendor_onboarding_applications', { id: applicationId }, {
                    status: newStatus,
                    reviewed_by: admin_id,
                    reviewed_at: new Date().toISOString(),
                    admin_comments: comments,
                    is_locked: false,
                    locked_at: null,
                    updated_at: new Date().toISOString(),
                });
            }
            else { // REJECT
                if (!rejection_reason) {
                    return this.error('Rejection reason is required', 400);
                }
                newStatus = 'REJECTED';
                newOnboardingStatus = 'REJECTED';
                await (0, db_1.update)('vendor_onboarding_applications', { id: applicationId }, {
                    status: newStatus,
                    reviewed_by: admin_id,
                    reviewed_at: new Date().toISOString(),
                    rejection_reason,
                    admin_comments: comments || null,
                    updated_at: new Date().toISOString(),
                });
            }
            // Transition onboarding status
            await (0, db_1.query)(`SELECT transition_onboarding_status($1, $2, $3, 'admin', $4, $5::jsonb)`, [
                identity.id,
                newOnboardingStatus,
                admin_id,
                action.toLowerCase(),
                JSON.stringify({ comments, rejection_reason }),
            ]);
            return this.success({
                message: `Application ${action.toLowerCase()}d successfully`,
                status: newStatus,
            });
        }
        catch (error) {
            console.error('Error reviewing application:', error);
            return this.error(error.message || 'Failed to review application', 500);
        }
    }
}
// ============================================================================
// PHASE 7: GET STARTED → ACTIVATION
// ============================================================================
class ActivateVendorHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { phone } = body;
        if (!phone) {
            return this.error('Phone number is required', 400);
        }
        try {
            // Get vendor identity
            const identities = await (0, db_1.select)('vendor_identity', { phone });
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
            const apps = await (0, db_1.select)('vendor_onboarding_applications', {
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
            const vendors = await (0, db_1.insert)('vendors', vendorData);
            const vendor = vendors[0];
            // Create setup completion record
            await (0, db_1.insert)('vendor_setup_completion', {
                vendor_id: vendor.id,
                profile_completed: false,
                bank_account_completed: false,
                business_hours_completed: false,
                staff_management_completed: false,
                services_configured: false,
                is_go_live_ready: false,
            });
            // Transition to ACTIVATED
            await (0, db_1.query)(`SELECT transition_onboarding_status($1, $2, NULL, 'vendor', 'vendor_activated', $3::jsonb)`, [identity.id, 'ACTIVATED', JSON.stringify({ vendor_id: vendor.id })]);
            return this.success({
                message: 'Vendor activated successfully',
                vendor_id: vendor.id,
                nextStep: '/dashboard',
            });
        }
        catch (error) {
            console.error('Error activating vendor:', error);
            return this.error(error.message || 'Failed to activate vendor', 500);
        }
    }
}
// ============================================================================
// PHASE 8: POST-ACTIVATION SETUP
// ============================================================================
class UpdateSetupCompletionHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
            let setup = await (0, db_1.select)('vendor_setup_completion', { vendor_id });
            if (setup.length === 0) {
                const newSetup = await (0, db_1.insert)('vendor_setup_completion', {
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
            const stepField = `${step}_completed`;
            const stepAtField = `${step}_completed_at`;
            const updateData = {
                [stepField]: completed,
                updated_at: new Date().toISOString(),
            };
            if (completed) {
                updateData[stepAtField] = new Date().toISOString();
            }
            else {
                updateData[stepAtField] = null;
            }
            await (0, db_1.update)('vendor_setup_completion', { vendor_id }, updateData);
            // Check if all required steps are completed
            const updatedSetup = await (0, db_1.select)('vendor_setup_completion', { vendor_id });
            const updated = updatedSetup[0];
            const allRequired = updated.profile_completed &&
                updated.bank_account_completed &&
                updated.business_hours_completed &&
                updated.services_configured;
            if (allRequired && !updated.is_go_live_ready) {
                await (0, db_1.update)('vendor_setup_completion', { vendor_id }, {
                    is_go_live_ready: true,
                    go_live_ready_at: new Date().toISOString(),
                });
            }
            else if (!allRequired && updated.is_go_live_ready) {
                await (0, db_1.update)('vendor_setup_completion', { vendor_id }, {
                    is_go_live_ready: false,
                    go_live_ready_at: null,
                });
            }
            return this.success({
                message: 'Setup completion updated',
                is_go_live_ready: allRequired,
            });
        }
        catch (error) {
            console.error('Error updating setup completion:', error);
            return this.error(error.message || 'Failed to update setup completion', 500);
        }
    }
}
class GoLiveHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { vendor_id } = body;
        if (!vendor_id) {
            return this.error('vendor_id is required', 400);
        }
        try {
            // Check if go-live ready
            const readyResult = await (0, db_1.query)(`SELECT is_vendor_go_live_ready($1) as ready`, [vendor_id]);
            if (!readyResult.rows[0]?.ready) {
                return this.error('Vendor is not ready for go-live. Complete all required setup steps.', 400);
            }
            // Update setup completion
            await (0, db_1.update)('vendor_setup_completion', { vendor_id }, {
                go_live_at: new Date().toISOString(),
            });
            // Update vendor status
            await (0, db_1.update)('vendors', { id: vendor_id }, {
                is_active: true,
                status: 'active',
            });
            // TODO: Sync services to customer app (service catalog, discovery filters, etc.)
            return this.success({
                message: 'Vendor is now live!',
                go_live_at: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Error going live:', error);
            return this.error(error.message || 'Failed to go live', 500);
        }
    }
}
// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================
function registerVendorOnboardingEndpoints(app) {
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
//# sourceMappingURL=vendor-onboarding.js.map