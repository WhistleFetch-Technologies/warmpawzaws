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

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, update, insert, deleteRows } from '../database/rds-connection';

// ============================================================================
// PHASE 24: CATALOG SELECTORS
// ============================================================================

class GetVendorTypesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorTypes = await select('vendor_types', {});
    return this.success({ vendorTypes });
  }
}

class GetServiceStylesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const serviceStyles = await select('service_styles', {});
    return this.success({ serviceStyles });
  }
}

class GetRegionalAvailabilityHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const serviceId = context.event.pathParameters?.serviceId;
    if (!serviceId) {
      return this.error('Service ID is required', 400);
    }
    const availability = await select('service_regional_availability', { service_id: serviceId });
    return this.success({ availability });
  }
}

class UpdateRegionalAvailabilityHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const serviceId = context.event.pathParameters?.serviceId;
    const body = this.parseBody(context.event);
    if (!serviceId || !body.regions) {
      return this.error('Service ID and regions are required', 400);
    }
    // Update regional availability
    for (const region of body.regions) {
      await update(
        'service_regional_availability',
        { service_id: serviceId, region_id: region.regionId },
        region
      );
    }
    return this.success({ success: true });
  }
}

class GetRegionalPricingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const serviceId = context.event.pathParameters?.serviceId;
    if (!serviceId) {
      return this.error('Service ID is required', 400);
    }
    const pricing = await select('service_regional_pricing', { service_id: serviceId });
    return this.success({ pricing });
  }
}

class UpdateRegionalPricingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const serviceId = context.event.pathParameters?.serviceId;
    const body = this.parseBody(context.event);
    if (!serviceId || !body.pricing) {
      return this.error('Service ID and pricing are required', 400);
    }
    for (const price of body.pricing) {
      await update(
        'service_regional_pricing',
        { service_id: serviceId, region_id: price.regionId },
        price
      );
    }
    return this.success({ success: true });
  }
}

class GetRegionalPackagesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const regionId = context.event.queryStringParameters?.regionId;
    const status = context.event.queryStringParameters?.status;
    const filters: any = {};
    if (regionId) filters.region_id = regionId;
    if (status) filters.status = status;
    const packages = await select('regional_packages', filters);
    return this.success({ packages });
  }
}

class CreateRegionalPackageHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const regionId = context.event.pathParameters?.regionId;
    const body = this.parseBody(context.event);
    if (!regionId) {
      return this.error('Region ID is required', 400);
    }
    const pkg = await insert('regional_packages', {
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

class GetPlatformSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const settings = await select('platform_settings', {});
    return this.success({ settings: settings[0] || {} });
  }
}

class UpdatePlatformSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const existing = await select('platform_settings', {});
    if (existing.length > 0) {
      await update('platform_settings', { id: existing[0].id }, body);
    } else {
      await insert('platform_settings', body);
    }
    return this.success({ success: true });
  }
}

class GetRegionalCatalogHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const regionId = context.event.pathParameters?.regionId;
    if (!regionId) {
      return this.error('Region ID is required', 400);
    }
    const catalog = await select('regional_catalogs', { region_id: regionId });
    return this.success({ catalog: catalog[0] || null });
  }
}

class GetIntegratedServicesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const services = await select('integrated_services', {});
    return this.success({ services });
  }
}

class CreateIntegratedServiceHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const service = await insert('integrated_services', {
      ...body,
      created_at: new Date().toISOString(),
    });
    return this.success({ service });
  }
}

class UpdateIntegratedServiceStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const id = context.event.pathParameters?.id;
    const body = this.parseBody(context.event);
    if (!id) {
      return this.error('Service ID is required', 400);
    }
    await update('integrated_services', { id }, { status: body.status });
    return this.success({ success: true });
  }
}

class GetProblemCategoryMappingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const mappings = await select('problem_category_mappings', {});
    return this.success({ mappings });
  }
}

class CreateProblemCategoryMappingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const mapping = await insert('problem_category_mappings', {
      ...body,
      created_at: new Date().toISOString(),
    });
    return this.success({ mapping });
  }
}

class GetReschedulingPoliciesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const policies = await select('rescheduling_policies', {});
    return this.success({ policies });
  }
}

class CreateReschedulingPolicyHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const policy = await insert('rescheduling_policies', {
      ...body,
      created_at: new Date().toISOString(),
    });
    return this.success({ policy });
  }
}

// ============================================================================
// PHASE 26: RBAC & ROLES
// ============================================================================

class GetRBACStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roles = await select('roles', {});
    const users = await select('users', {});
    const permissions = await select('permissions', {});
    const assignments = await select('user_roles', {});
    
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

class GetRolesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roles = await select('roles', {});
    return this.success({ roles });
  }
}

class GetRBACUsersHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const users = await select('users', {});
    return this.success({ users });
  }
}

class GetPermissionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const permissions = await select('permissions', {});
    return this.success({ permissions });
  }
}

class CreateRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const role = await insert('roles', {
      ...body,
      created_at: new Date().toISOString(),
    });
    return this.success({ role });
  }
}

class GetRoleMigrationsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const migrations = await select('role_migrations', {});
    return this.success({ migrations });
  }
}

class CreateRoleMigrationHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const migration = await insert('role_migrations', {
      ...body,
      status: 'pending',
      started_at: new Date().toISOString(),
    });
    return this.success({ migration });
  }
}

class GetVendorSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const settings = await select('vendor_settings', {});
    return this.success({ settings: settings[0] || {} });
  }
}

class UpdateVendorSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const existing = await select('vendor_settings', {});
    if (existing.length > 0) {
      await update('vendor_settings', { id: existing[0].id }, body);
    } else {
      await insert('vendor_settings', body);
    }
    return this.success({ success: true });
  }
}

class GetEnterpriseSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const settings = await select('enterprise_settings', {});
    return this.success({ settings: settings[0] || {} });
  }
}

class UpdateEnterpriseSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const existing = await select('enterprise_settings', {});
    if (existing.length > 0) {
      await update('enterprise_settings', { id: existing[0].id }, body);
    } else {
      await insert('enterprise_settings', body);
    }
    return this.success({ success: true });
  }
}

// ============================================================================
// PHASE 27: SUPPORT & OPERATIONS
// ============================================================================

class GetSupportTicketsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const status = context.event.queryStringParameters?.status;
    const priority = context.event.queryStringParameters?.priority;
    const filters: any = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    const tickets = await select('support_tickets', filters);
    return this.success({ tickets });
  }
}

class CreateSupportTicketHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const ticket = await insert('support_tickets', {
      ...body,
      status: 'open',
      created_at: new Date().toISOString(),
    });
    return this.success({ ticket });
  }
}

class GetVendorSupportRequestsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const requests = await select('vendor_support_requests', {});
    return this.success({ requests });
  }
}

class GetOperationsStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
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

class GetContentItemsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const type = context.event.queryStringParameters?.type;
    const status = context.event.queryStringParameters?.status;
    const filters: any = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    const contents = await select('content_items', filters);
    return this.success({ contents });
  }
}

class CreateContentItemHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const content = await insert('content_items', {
      ...body,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    });
    return this.success({ content });
  }
}

class GetNotificationTemplatesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const type = context.event.queryStringParameters?.type;
    const category = context.event.queryStringParameters?.category;
    const filters: any = {};
    if (type) filters.type = type;
    if (category) filters.category = category;
    const templates = await select('notification_templates', filters);
    return this.success({ templates });
  }
}

class CreateNotificationTemplateHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const template = await insert('notification_templates', {
      ...body,
      created_at: new Date().toISOString(),
    });
    return this.success({ template });
  }
}

// ============================================================================
// PHASE 28: FINANCE & PAYMENTS
// ============================================================================

class GetPaymentDisputesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const status = context.event.queryStringParameters?.status;
    const priority = context.event.queryStringParameters?.priority;
    const filters: any = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    const disputes = await select('payment_disputes', filters);
    return this.success({ disputes });
  }
}

class ResolvePaymentDisputeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const id = context.event.pathParameters?.id;
    const body = this.parseBody(context.event);
    if (!id) {
      return this.error('Dispute ID is required', 400);
    }
    await update('payment_disputes', { id }, {
      status: 'resolved',
      resolution: body.resolution,
      resolved_at: new Date().toISOString(),
    });
    return this.success({ success: true });
  }
}

class GetRateChangesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const status = context.event.queryStringParameters?.status;
    const filters: any = {};
    if (status) filters.status = status;
    const rateChanges = await select('rate_changes', filters);
    return this.success({ rateChanges });
  }
}

class ApproveRateChangeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const id = context.event.pathParameters?.id;
    if (!id) {
      return this.error('Rate change ID is required', 400);
    }
    await update('rate_changes', { id }, {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    });
    return this.success({ success: true });
  }
}

class RejectRateChangeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const id = context.event.pathParameters?.id;
    const body = this.parseBody(context.event);
    if (!id) {
      return this.error('Rate change ID is required', 400);
    }
    await update('rate_changes', { id }, {
      status: 'rejected',
      reason: body.reason,
      reviewed_at: new Date().toISOString(),
    });
    return this.success({ success: true });
  }
}

class GetTransactionMonitoringHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const status = context.event.queryStringParameters?.status;
    const type = context.event.queryStringParameters?.type;
    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    const transactions = await select('transactions', filters);
    return this.success({ transactions });
  }
}

class ExportApplicationsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
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

class GetBookingRulesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const rules = await select('booking_rules', {});
    return this.success({ rules });
  }
}

class CreateBookingRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const rule = await insert('booking_rules', {
      ...body,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    return this.success({ rule });
  }
}

class GetScheduleSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const settings = await select('schedule_settings', {});
    return this.success({ settings: settings[0] || {} });
  }
}

class UpdateScheduleSettingsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const existing = await select('schedule_settings', {});
    if (existing.length > 0) {
      await update('schedule_settings', { id: existing[0].id }, body);
    } else {
      await insert('schedule_settings', body);
    }
    return this.success({ success: true });
  }
}

class GetOnboardingStepsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const steps = await select('onboarding_steps', {}, { orderBy: 'order', orderDirection: 'ASC' });
    return this.success({ steps });
  }
}

class CreateOnboardingStepHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const step = await insert('onboarding_steps', {
      ...body,
      created_at: new Date().toISOString(),
    });
    return this.success({ step });
  }
}

class GetPetIntelligenceHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const search = context.event.queryStringParameters?.search;
    const filters: any = {};
    // Add search logic if needed
    const pets = await select('pets', filters);
    return this.success({ pets });
  }
}

class GetAdminProfileHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const adminId = context.event.pathParameters?.adminId;
    if (!adminId) {
      return this.error('Admin ID is required', 400);
    }
    const admins = await select('admins', { id: adminId });
    return this.success({ admin: admins[0] || null });
  }
}

class UpdateAdminProfileHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const adminId = context.event.pathParameters?.adminId;
    const body = this.parseBody(context.event);
    if (!adminId) {
      return this.error('Admin ID is required', 400);
    }
    await update('admins', { id: adminId }, body);
    return this.success({ success: true });
  }
}

class GetRenewalNoticesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const notices = await select('renewal_notices', {});
    return this.success({ notices });
  }
}

class SendRenewalNoticeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const id = context.event.pathParameters?.id;
    if (!id) {
      return this.error('Notice ID is required', 400);
    }
    await update('renewal_notices', { id }, {
      notice_sent: true,
      sent_at: new Date().toISOString(),
    });
    return this.success({ success: true });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerAdminAdvancedEndpoints(app: Hono) {
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

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'admin-advanced-handler',
    functionVersion: '$LATEST',
  };
}

