"use strict";
/**
 * ============================================================================
 * ADMIN ADVANCED ENDPOINTS - PHASES 24-29
 * ============================================================================
 *
 * Endpoints for:
 * - Phase 24: Catalog Selectors
 * - Phase 25: Platform & Regions
 * - Phase 26: RBAC & Roles
 * - Phase 27: Support & Operations
 * - Phase 28: Finance & Payments
 * - Phase 29: Settings & Misc
 *
 * Date: 2025-01-28
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminAdvancedEndpoints = registerAdminAdvancedEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// PHASE 24: CATALOG SELECTORS
// ============================================================================
class GetVendorTypesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorTypes = await (0, rds_connection_1.select)('vendor_types', {});
        return this.success({ vendorTypes });
    }
}
class GetServiceStylesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const serviceStyles = await (0, rds_connection_1.select)('service_styles', {});
        return this.success({ serviceStyles });
    }
}
class GetRegionalAvailabilityHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const serviceId = context.event.pathParameters?.serviceId;
        if (!serviceId) {
            return this.error('Service ID is required', 400);
        }
        const availability = await (0, rds_connection_1.select)('service_regional_availability', { service_id: serviceId });
        return this.success({ availability });
    }
}
class UpdateRegionalAvailabilityHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const serviceId = context.event.pathParameters?.serviceId;
        const body = this.parseBody(context.event);
        if (!serviceId || !body.regions) {
            return this.error('Service ID and regions are required', 400);
        }
        // Update regional availability
        for (const region of body.regions) {
            await (0, rds_connection_1.update)('service_regional_availability', { service_id: serviceId, region_id: region.regionId }, region);
        }
        return this.success({ success: true });
    }
}
class GetRegionalPricingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const serviceId = context.event.pathParameters?.serviceId;
        if (!serviceId) {
            return this.error('Service ID is required', 400);
        }
        const pricing = await (0, rds_connection_1.select)('service_regional_pricing', { service_id: serviceId });
        return this.success({ pricing });
    }
}
class UpdateRegionalPricingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const serviceId = context.event.pathParameters?.serviceId;
        const body = this.parseBody(context.event);
        if (!serviceId || !body.pricing) {
            return this.error('Service ID and pricing are required', 400);
        }
        for (const price of body.pricing) {
            await (0, rds_connection_1.update)('service_regional_pricing', { service_id: serviceId, region_id: price.regionId }, price);
        }
        return this.success({ success: true });
    }
}
class GetRegionalPackagesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const regionId = context.event.queryStringParameters?.regionId;
        const status = context.event.queryStringParameters?.status;
        const filters = {};
        if (regionId)
            filters.region_id = regionId;
        if (status)
            filters.status = status;
        const packages = await (0, rds_connection_1.select)('regional_packages', filters);
        return this.success({ packages });
    }
}
class CreateRegionalPackageHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const regionId = context.event.pathParameters?.regionId;
        const body = this.parseBody(context.event);
        if (!regionId) {
            return this.error('Region ID is required', 400);
        }
        const pkg = await (0, rds_connection_1.insert)('regional_packages', {
            ...body,
            region_id: regionId,
            created_at: new Date().toISOString(),
        });
        return this.success({ package: pkg });
    }
}
// ============================================================================
// PHASE 25: PLATFORM & REGIONS
// ============================================================================
class GetPlatformSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const settings = await (0, rds_connection_1.select)('platform_settings', {});
        return this.success({ settings: settings[0] || {} });
    }
}
class UpdatePlatformSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const existing = await (0, rds_connection_1.select)('platform_settings', {});
        if (existing.length > 0) {
            await (0, rds_connection_1.update)('platform_settings', { id: existing[0].id }, body);
        }
        else {
            await (0, rds_connection_1.insert)('platform_settings', body);
        }
        return this.success({ success: true });
    }
}
class GetRegionalCatalogHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const regionId = context.event.pathParameters?.regionId;
        if (!regionId) {
            return this.error('Region ID is required', 400);
        }
        const catalog = await (0, rds_connection_1.select)('regional_catalogs', { region_id: regionId });
        return this.success({ catalog: catalog[0] || null });
    }
}
class GetIntegratedServicesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const services = await (0, rds_connection_1.select)('integrated_services', {});
        return this.success({ services });
    }
}
class CreateIntegratedServiceHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const service = await (0, rds_connection_1.insert)('integrated_services', {
            ...body,
            created_at: new Date().toISOString(),
        });
        return this.success({ service });
    }
}
class UpdateIntegratedServiceStatusHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const id = context.event.pathParameters?.id;
        const body = this.parseBody(context.event);
        if (!id) {
            return this.error('Service ID is required', 400);
        }
        await (0, rds_connection_1.update)('integrated_services', { id }, { status: body.status });
        return this.success({ success: true });
    }
}
class GetProblemCategoryMappingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const mappings = await (0, rds_connection_1.select)('problem_category_mappings', {});
        return this.success({ mappings });
    }
}
class CreateProblemCategoryMappingHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const mapping = await (0, rds_connection_1.insert)('problem_category_mappings', {
            ...body,
            created_at: new Date().toISOString(),
        });
        return this.success({ mapping });
    }
}
class GetReschedulingPoliciesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const policies = await (0, rds_connection_1.select)('rescheduling_policies', {});
        return this.success({ policies });
    }
}
class CreateReschedulingPolicyHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const policy = await (0, rds_connection_1.insert)('rescheduling_policies', {
            ...body,
            created_at: new Date().toISOString(),
        });
        return this.success({ policy });
    }
}
// ============================================================================
// PHASE 26: RBAC & ROLES
// ============================================================================
class GetRBACStatsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const roles = await (0, rds_connection_1.select)('roles', {});
        const users = await (0, rds_connection_1.select)('users', {});
        const permissions = await (0, rds_connection_1.select)('permissions', {});
        const assignments = await (0, rds_connection_1.select)('user_roles', {});
        return this.success({
            stats: {
                totalRoles: roles.length,
                totalUsers: users.length,
                totalPermissions: permissions.length,
                activeAssignments: assignments.length,
            },
        });
    }
}
class GetRolesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const roles = await (0, rds_connection_1.select)('roles', {});
        return this.success({ roles });
    }
}
class GetRBACUsersHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const users = await (0, rds_connection_1.select)('users', {});
        return this.success({ users });
    }
}
class GetPermissionsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const permissions = await (0, rds_connection_1.select)('permissions', {});
        return this.success({ permissions });
    }
}
class CreateRoleHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const role = await (0, rds_connection_1.insert)('roles', {
            ...body,
            created_at: new Date().toISOString(),
        });
        return this.success({ role });
    }
}
class GetRoleMigrationsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const migrations = await (0, rds_connection_1.select)('role_migrations', {});
        return this.success({ migrations });
    }
}
class CreateRoleMigrationHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const migration = await (0, rds_connection_1.insert)('role_migrations', {
            ...body,
            status: 'pending',
            started_at: new Date().toISOString(),
        });
        return this.success({ migration });
    }
}
class GetVendorSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const settings = await (0, rds_connection_1.select)('vendor_settings', {});
        return this.success({ settings: settings[0] || {} });
    }
}
class UpdateVendorSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const existing = await (0, rds_connection_1.select)('vendor_settings', {});
        if (existing.length > 0) {
            await (0, rds_connection_1.update)('vendor_settings', { id: existing[0].id }, body);
        }
        else {
            await (0, rds_connection_1.insert)('vendor_settings', body);
        }
        return this.success({ success: true });
    }
}
class GetEnterpriseSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const settings = await (0, rds_connection_1.select)('enterprise_settings', {});
        return this.success({ settings: settings[0] || {} });
    }
}
class UpdateEnterpriseSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const existing = await (0, rds_connection_1.select)('enterprise_settings', {});
        if (existing.length > 0) {
            await (0, rds_connection_1.update)('enterprise_settings', { id: existing[0].id }, body);
        }
        else {
            await (0, rds_connection_1.insert)('enterprise_settings', body);
        }
        return this.success({ success: true });
    }
}
// ============================================================================
// PHASE 27: SUPPORT & OPERATIONS
// ============================================================================
class GetSupportTicketsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const status = context.event.queryStringParameters?.status;
        const priority = context.event.queryStringParameters?.priority;
        const filters = {};
        if (status)
            filters.status = status;
        if (priority)
            filters.priority = priority;
        const tickets = await (0, rds_connection_1.select)('support_tickets', filters);
        return this.success({ tickets });
    }
}
class CreateSupportTicketHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const ticket = await (0, rds_connection_1.insert)('support_tickets', {
            ...body,
            status: 'open',
            created_at: new Date().toISOString(),
        });
        return this.success({ ticket });
    }
}
class GetVendorSupportRequestsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const requests = await (0, rds_connection_1.select)('vendor_support_requests', {});
        return this.success({ requests });
    }
}
class GetOperationsStatsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        // Mock stats - replace with actual system health checks
        const stats = {
            systemHealth: 'healthy',
            activeUsers: 0,
            apiLatency: 120,
            errorRate: 0.5,
            databaseStatus: 'online',
            lastBackup: new Date().toISOString(),
        };
        return this.success({ stats });
    }
}
class GetContentItemsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const type = context.event.queryStringParameters?.type;
        const status = context.event.queryStringParameters?.status;
        const filters = {};
        if (type)
            filters.type = type;
        if (status)
            filters.status = status;
        const contents = await (0, rds_connection_1.select)('content_items', filters);
        return this.success({ contents });
    }
}
class CreateContentItemHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const content = await (0, rds_connection_1.insert)('content_items', {
            ...body,
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
        });
        return this.success({ content });
    }
}
class GetNotificationTemplatesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const type = context.event.queryStringParameters?.type;
        const category = context.event.queryStringParameters?.category;
        const filters = {};
        if (type)
            filters.type = type;
        if (category)
            filters.category = category;
        const templates = await (0, rds_connection_1.select)('notification_templates', filters);
        return this.success({ templates });
    }
}
class CreateNotificationTemplateHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const template = await (0, rds_connection_1.insert)('notification_templates', {
            ...body,
            created_at: new Date().toISOString(),
        });
        return this.success({ template });
    }
}
// ============================================================================
// PHASE 28: FINANCE & PAYMENTS
// ============================================================================
class GetPaymentDisputesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const status = context.event.queryStringParameters?.status;
        const priority = context.event.queryStringParameters?.priority;
        const filters = {};
        if (status)
            filters.status = status;
        if (priority)
            filters.priority = priority;
        const disputes = await (0, rds_connection_1.select)('payment_disputes', filters);
        return this.success({ disputes });
    }
}
class ResolvePaymentDisputeHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const id = context.event.pathParameters?.id;
        const body = this.parseBody(context.event);
        if (!id) {
            return this.error('Dispute ID is required', 400);
        }
        await (0, rds_connection_1.update)('payment_disputes', { id }, {
            status: 'resolved',
            resolution: body.resolution,
            resolved_at: new Date().toISOString(),
        });
        return this.success({ success: true });
    }
}
class GetRateChangesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const status = context.event.queryStringParameters?.status;
        const filters = {};
        if (status)
            filters.status = status;
        const rateChanges = await (0, rds_connection_1.select)('rate_changes', filters);
        return this.success({ rateChanges });
    }
}
class ApproveRateChangeHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const id = context.event.pathParameters?.id;
        if (!id) {
            return this.error('Rate change ID is required', 400);
        }
        await (0, rds_connection_1.update)('rate_changes', { id }, {
            status: 'approved',
            reviewed_at: new Date().toISOString(),
        });
        return this.success({ success: true });
    }
}
class RejectRateChangeHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const id = context.event.pathParameters?.id;
        const body = this.parseBody(context.event);
        if (!id) {
            return this.error('Rate change ID is required', 400);
        }
        await (0, rds_connection_1.update)('rate_changes', { id }, {
            status: 'rejected',
            reason: body.reason,
            reviewed_at: new Date().toISOString(),
        });
        return this.success({ success: true });
    }
}
class GetTransactionMonitoringHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const status = context.event.queryStringParameters?.status;
        const type = context.event.queryStringParameters?.type;
        const filters = {};
        if (status)
            filters.status = status;
        if (type)
            filters.type = type;
        const transactions = await (0, rds_connection_1.select)('transactions', filters);
        return this.success({ transactions });
    }
}
class ExportApplicationsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        // Generate export file and return download URL
        // This would typically generate a file in S3 and return a presigned URL
        const downloadUrl = `https://s3.amazonaws.com/exports/applications-${Date.now()}.${body.format}`;
        return this.success({ downloadUrl });
    }
}
// ============================================================================
// PHASE 29: SETTINGS & MISC
// ============================================================================
class GetBookingRulesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const rules = await (0, rds_connection_1.select)('booking_rules', {});
        return this.success({ rules });
    }
}
class CreateBookingRuleHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const rule = await (0, rds_connection_1.insert)('booking_rules', {
            ...body,
            is_active: true,
            created_at: new Date().toISOString(),
        });
        return this.success({ rule });
    }
}
class GetScheduleSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const settings = await (0, rds_connection_1.select)('schedule_settings', {});
        return this.success({ settings: settings[0] || {} });
    }
}
class UpdateScheduleSettingsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const existing = await (0, rds_connection_1.select)('schedule_settings', {});
        if (existing.length > 0) {
            await (0, rds_connection_1.update)('schedule_settings', { id: existing[0].id }, body);
        }
        else {
            await (0, rds_connection_1.insert)('schedule_settings', body);
        }
        return this.success({ success: true });
    }
}
class GetOnboardingStepsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const steps = await (0, rds_connection_1.select)('onboarding_steps', {}, { orderBy: 'order', orderDirection: 'ASC' });
        return this.success({ steps });
    }
}
class CreateOnboardingStepHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const step = await (0, rds_connection_1.insert)('onboarding_steps', {
            ...body,
            created_at: new Date().toISOString(),
        });
        return this.success({ step });
    }
}
class GetPetIntelligenceHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const search = context.event.queryStringParameters?.search;
        const filters = {};
        // Add search logic if needed
        const pets = await (0, rds_connection_1.select)('pets', filters);
        return this.success({ pets });
    }
}
class GetAdminProfileHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const adminId = context.event.pathParameters?.adminId;
        if (!adminId) {
            return this.error('Admin ID is required', 400);
        }
        const admins = await (0, rds_connection_1.select)('admins', { id: adminId });
        return this.success({ admin: admins[0] || null });
    }
}
class UpdateAdminProfileHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const adminId = context.event.pathParameters?.adminId;
        const body = this.parseBody(context.event);
        if (!adminId) {
            return this.error('Admin ID is required', 400);
        }
        await (0, rds_connection_1.update)('admins', { id: adminId }, body);
        return this.success({ success: true });
    }
}
class GetRenewalNoticesHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const notices = await (0, rds_connection_1.select)('renewal_notices', {});
        return this.success({ notices });
    }
}
class SendRenewalNoticeHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const id = context.event.pathParameters?.id;
        if (!id) {
            return this.error('Notice ID is required', 400);
        }
        await (0, rds_connection_1.update)('renewal_notices', { id }, {
            notice_sent: true,
            sent_at: new Date().toISOString(),
        });
        return this.success({ success: true });
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerAdminAdvancedEndpoints(app) {
    // Phase 24: Catalog Selectors
    app.get('/admin/catalog/vendor-types', async (c) => {
        const handler = new GetVendorTypesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/catalog/service-styles', async (c) => {
        const handler = new GetServiceStylesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/catalog/services/:serviceId/regional-availability', async (c) => {
        const handler = new GetRegionalAvailabilityHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { serviceId: c.req.param('serviceId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/catalog/services/:serviceId/regional-availability', async (c) => {
        const handler = new UpdateRegionalAvailabilityHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { serviceId: c.req.param('serviceId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/catalog/services/:serviceId/regional-pricing', async (c) => {
        const handler = new GetRegionalPricingHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { serviceId: c.req.param('serviceId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/catalog/services/:serviceId/regional-pricing', async (c) => {
        const handler = new UpdateRegionalPricingHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { serviceId: c.req.param('serviceId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/catalog/regional-packages', async (c) => {
        const handler = new GetRegionalPackagesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/regions/:regionId/packages', async (c) => {
        const handler = new CreateRegionalPackageHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { regionId: c.req.param('regionId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Phase 25: Platform & Regions
    app.get('/admin/platform/settings', async (c) => {
        const handler = new GetPlatformSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/platform/settings', async (c) => {
        const handler = new UpdatePlatformSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/regions/:regionId/catalog', async (c) => {
        const handler = new GetRegionalCatalogHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { regionId: c.req.param('regionId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/integrated-services', async (c) => {
        const handler = new GetIntegratedServicesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/integrated-services', async (c) => {
        const handler = new CreateIntegratedServiceHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/integrated-services/:id/status', async (c) => {
        const handler = new UpdateIntegratedServiceStatusHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { id: c.req.param('id') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/problem-category-mappings', async (c) => {
        const handler = new GetProblemCategoryMappingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/problem-category-mappings', async (c) => {
        const handler = new CreateProblemCategoryMappingHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/rescheduling-policies', async (c) => {
        const handler = new GetReschedulingPoliciesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/rescheduling-policies', async (c) => {
        const handler = new CreateReschedulingPolicyHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Phase 26: RBAC & Roles
    app.get('/admin/rbac/stats', async (c) => {
        const handler = new GetRBACStatsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/rbac/roles', async (c) => {
        const handler = new GetRolesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/rbac/users', async (c) => {
        const handler = new GetRBACUsersHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/rbac/permissions', async (c) => {
        const handler = new GetPermissionsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/roles', async (c) => {
        const handler = new CreateRoleHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/role-migrations', async (c) => {
        const handler = new GetRoleMigrationsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/role-migrations', async (c) => {
        const handler = new CreateRoleMigrationHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/vendor-settings', async (c) => {
        const handler = new GetVendorSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/vendor-settings', async (c) => {
        const handler = new UpdateVendorSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/enterprise-settings', async (c) => {
        const handler = new GetEnterpriseSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/enterprise-settings', async (c) => {
        const handler = new UpdateEnterpriseSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Phase 27: Support & Operations
    app.get('/admin/support/tickets', async (c) => {
        const handler = new GetSupportTicketsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/support/tickets', async (c) => {
        const handler = new CreateSupportTicketHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/support/vendor-requests', async (c) => {
        const handler = new GetVendorSupportRequestsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/operations/stats', async (c) => {
        const handler = new GetOperationsStatsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/content', async (c) => {
        const handler = new GetContentItemsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/content', async (c) => {
        const handler = new CreateContentItemHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/notification-templates', async (c) => {
        const handler = new GetNotificationTemplatesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/notification-templates', async (c) => {
        const handler = new CreateNotificationTemplateHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Phase 28: Finance & Payments
    app.get('/admin/payment-disputes', async (c) => {
        const handler = new GetPaymentDisputesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/payment-disputes/:id/resolve', async (c) => {
        const handler = new ResolvePaymentDisputeHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { id: c.req.param('id') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/rate-changes', async (c) => {
        const handler = new GetRateChangesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/rate-changes/:id/approve', async (c) => {
        const handler = new ApproveRateChangeHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { id: c.req.param('id') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/rate-changes/:id/reject', async (c) => {
        const handler = new RejectRateChangeHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { id: c.req.param('id') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/transactions/monitoring', async (c) => {
        const handler = new GetTransactionMonitoringHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/applications/export', async (c) => {
        const handler = new ExportApplicationsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Phase 29: Settings & Misc
    app.get('/admin/settings/booking-rules', async (c) => {
        const handler = new GetBookingRulesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/settings/booking-rules', async (c) => {
        const handler = new CreateBookingRuleHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/settings/schedule', async (c) => {
        const handler = new GetScheduleSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/settings/schedule', async (c) => {
        const handler = new UpdateScheduleSettingsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/onboarding/steps', async (c) => {
        const handler = new GetOnboardingStepsHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/onboarding/steps', async (c) => {
        const handler = new CreateOnboardingStepHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/pets/intelligence', async (c) => {
        const handler = new GetPetIntelligenceHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/profile/:adminId', async (c) => {
        const handler = new GetAdminProfileHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { adminId: c.req.param('adminId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.put('/admin/profile/:adminId', async (c) => {
        const handler = new UpdateAdminProfileHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { adminId: c.req.param('adminId') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/renewal-notices', async (c) => {
        const handler = new GetRenewalNoticesHandler();
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/renewal-notices/:id/send', async (c) => {
        const handler = new SendRenewalNoticeHandler();
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { id: c.req.param('id') };
        const context = createLambdaContext();
        const result = await handler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
// Helper functions
function createApiGatewayEvent(req) {
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
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'admin-advanced-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=admin-advanced.js.map