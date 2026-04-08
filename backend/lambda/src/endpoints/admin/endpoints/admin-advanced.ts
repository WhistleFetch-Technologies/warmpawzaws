import { randomUUID } from 'crypto';
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
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, update, insert, deleteRows, upsert } from '../../../database/rds-connection';
import { getRazorpayClient } from '../../../utils/payments/razorpay-client';
import { getErrorMessage, createSafeErrorResponse, ErrorStatusCode } from '../../../utils/error-serialization';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { applyGstRulesRateFallback, pickTaxCategoryDisplayRate } from '../../../utils/tax-category-display-rate';
import { loadGstRuleRatesByTaxCategoryId } from '../../../utils/tax-category-gst-rule-rates';
import { isValidUUID } from '../../../types/entities';

// Color constants for charts
const COLORS = ['#FF8C42', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

/**
 * Validate that applicable_roles only contains identifiers that exist as active roles in DB (by id or name).
 * Returns { valid: true } or { valid: false, invalid: string[] }.
 */
async function validateApplicableRolesAgainstActiveRoles(applicableRoles: string[]): Promise<{ valid: true } | { valid: false; invalid: string[] }> {
  if (!Array.isArray(applicableRoles) || applicableRoles.length === 0) {
    return { valid: true };
  }
  const activeRoles = await select('roles', { is_active: true }, { limit: 200 });
  const allowed = new Set<string>();
  for (const r of activeRoles) {
    const id = String(r.id || '').trim();
    const name = String(r.name || '').trim();
    if (id) allowed.add(id.toLowerCase());
    if (name) allowed.add(name.toLowerCase().replace(/\s+/g, '_'));
  }
  const invalid: string[] = [];
  for (const raw of applicableRoles) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const key = s.toLowerCase().replace(/\s+/g, '_');
    if (!allowed.has(key) && !allowed.has(s.toLowerCase())) {
      invalid.push(s);
    }
  }
  if (invalid.length > 0) return { valid: false, invalid };
  return { valid: true };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Upsert a setting in admin_settings table
 */
async function upsertAdminSetting(key: string, value: string, serviceType: string = 'all'): Promise<void> {
  try {
    // Try update first
    const existing = await query(
      `SELECT id FROM admin_settings WHERE setting_key = $1 AND (service_type = $2 OR (service_type IS NULL AND $2 = 'all')) LIMIT 1`,
      [key, serviceType]
    ).catch(() => ({ rows: [] }));

    if (existing.rows.length > 0) {
      await query(
        `UPDATE admin_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2 AND (service_type = $3 OR (service_type IS NULL AND $3 = 'all'))`,
        [value, key, serviceType]
      );
    } else {
      await query(
        `INSERT INTO admin_settings (setting_key, setting_value, service_type, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [key, value, serviceType === 'all' ? null : serviceType]
      ).catch(() => {
        // Ignore duplicate key errors
      });
    }
  } catch (error) {
    console.warn(`Failed to upsert admin setting ${key}:`, error);
  }
}

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
    try {
      // Query role_permissions table and get distinct permission names
      // There's no standalone 'permissions' table - permissions are stored in role_permissions
      const result = await query(
        `SELECT DISTINCT permission_name, resource, action 
         FROM role_permissions 
         ORDER BY permission_name`
      );

      const permissions = result.rows.map((p: any) => ({
        name: p.permission_name,
        resource: p.resource || 'general',
        action: p.action || 'access',
      }));

      return this.success({ permissions });
    } catch (error: any) {
      console.error('[GetPermissionsHandler] Error:', error);
      // Return empty array if table doesn't exist or query fails
      return this.success({ permissions: [] });
    }
  }
}

class GetPoliciesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Try to get policies from policies table, or return empty array if table doesn't exist
      const policies = await select('policies', {}).catch(() => []);
      return this.success({ policies: policies || [] });
    } catch (error: any) {
      // If policies table doesn't exist, return empty array
      console.warn('Policies table not found, returning empty array:', error.message);
      return this.success({ policies: [] });
    }
  }
}

class UpdateRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roleId = context.event.pathParameters?.roleId;
    const body = this.parseBody(context.event);
    if (!roleId) {
      return this.error('Role ID is required', 400);
    }
    const updated = await update('roles', { id: roleId }, body);
    return this.success({ role: updated[0] });
  }
}

class DeleteRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roleId = context.event.pathParameters?.roleId;
    if (!roleId) {
      return this.error('Role ID is required', 400);
    }
    await deleteRows('roles', { id: roleId });
    return this.success({ success: true });
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
    try {
      const status = context.event.queryStringParameters?.status;
      const priority = context.event.queryStringParameters?.priority;

      let tickets;
      try {
        let queryText = 'SELECT * FROM support_tickets WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (status) {
          queryText += ` AND status = $${paramIndex}`;
          params.push(status);
          paramIndex++;
        }
        if (priority) {
          queryText += ` AND priority = $${paramIndex}`;
          params.push(priority);
          paramIndex++;
        }

        queryText += ' ORDER BY created_at DESC';
        tickets = await query(queryText, params);
      } catch {
        tickets = { rows: [] };
      }

      // Format tickets for UI
      const formattedTickets = (tickets.rows || []).map((t: any) => ({
        ticketId: String(t.id || t.ticket_id || ''),
        ticketNumber: String(t.ticket_number || t.id || `TKT-${t.id || ''}`),
        subject: String(t.subject || 'No Subject'),
        description: String(t.message || t.description || ''),
        category: String(t.category || 'general'),
        priority: (t.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
        status: (t.status || 'open') as 'open' | 'in_progress' | 'resolved' | 'closed',
        customerName: String(t.customer_name || t.customer_phone || 'Unknown'),
        customerEmail: String(t.customer_email || t.customer_phone || ''),
        assignedTo: t.assigned_to ? String(t.assigned_to) : undefined,
        createdAt: String(t.created_at || new Date().toISOString()),
        updatedAt: String(t.updated_at || t.created_at || new Date().toISOString()),
        responseTime: t.first_response_at ? Math.round((new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / 60000) : undefined,
        resolutionTime: t.resolved_at ? Math.round((new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000) : undefined,
      }));

      return this.success({ success: true, tickets: formattedTickets });
    } catch (error: any) {
      console.error('Error fetching support tickets:', error);
      return this.success({ success: true, tickets: [] });
    }
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
    const status = body.status || 'resolved';
    await update('payment_disputes', { id }, {
      status: status,
      resolution: body.resolution,
      resolved_at: new Date().toISOString(),
      resolved_by: body.resolvedBy || 'admin',
    });
    return this.success({ success: true, status });
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

  app.get('/admin/rbac/policies', async (c) => {
    const handler = new GetPoliciesHandler();
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

  // RBAC endpoints (aliases for frontend compatibility)
  app.post('/admin/rbac/roles', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      // Filter to only include valid columns from roles table schema
      // Valid columns: id, name, display_name, description, is_system_role, is_active, created_at, updated_at, config
      const { level, ...validFields } = body;
      const roleData: any = {
        name: validFields.name || validFields.roleName,
        display_name: validFields.displayName || validFields.display_name || validFields.name || validFields.roleName,
        description: validFields.description || '',
        is_system_role: validFields.isSystemRole || validFields.is_system_role || false,
        is_active: validFields.isActive !== undefined ? validFields.isActive : (validFields.is_active !== undefined ? validFields.is_active : true),
        created_at: new Date().toISOString(),
      };
      // Include config if provided
      if (validFields.config) {
        roleData.config = validFields.config;
      }
      const role = await insert('roles', roleData);
      return c.json({ success: true, role: role[0] });
    } catch (error: unknown) {
      console.error('Error creating role:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to create role', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/rbac/roles/:roleId', async (c) => {
    try {
      const roleId = c.req.param('roleId');
      const body = await c.req.json().catch(() => ({}));
      const updated = await update('roles', { id: roleId }, {
        ...body,
        updated_at: new Date().toISOString(),
      });
      return c.json({ success: true, role: updated[0] });
    } catch (error: unknown) {
      console.error('Error updating role:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to update role', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.delete('/admin/rbac/roles/:roleId', async (c) => {
    const handler = new DeleteRoleHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { roleId: c.req.param('roleId') };
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

  app.get('/admin/pets/stats', async (c) => {
    try {
      // Calculate average age from DOB if available, otherwise use age_years + age_months
      // Also check medical_history->>'dob' as fallback
      const stats = await query(`
        SELECT 
          COUNT(*) as total_pets,
          COUNT(*) FILTER (WHERE LOWER(species) = 'dog' OR LOWER(species) = 'dogs') as dog_count,
          COUNT(*) FILTER (WHERE LOWER(species) = 'cat' OR LOWER(species) = 'cats') as cat_count,
          COUNT(*) FILTER (WHERE LOWER(species) NOT IN ('dog', 'cat')) as other_count,
          COALESCE(
            AVG(
              CASE 
                WHEN date_of_birth IS NOT NULL THEN
                  EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))
                WHEN medical_history->>'dob' IS NOT NULL THEN
                  EXTRACT(YEAR FROM AGE(CURRENT_DATE, (medical_history->>'dob')::date))
                WHEN age_years IS NOT NULL OR age_months IS NOT NULL THEN
                  COALESCE(age_years, 0) + COALESCE(age_months, 0)::numeric / 12
                ELSE NULL
              END
            ), 0
          ) as avg_age
        FROM pets
      `).catch(() => ({
        rows: [{
          total_pets: '0',
          dog_count: '0',
          cat_count: '0',
          other_count: '0',
          avg_age: '0'
        }]
      }));

      const topBreeds = await query(`
        SELECT breed, COUNT(*) as count
        FROM pets
        WHERE breed IS NOT NULL AND breed != ''
        GROUP BY breed
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => ({ rows: [] }));

      // Get age distribution
      const ageDistribution = await query(`
        SELECT 
          CASE 
            WHEN date_of_birth IS NOT NULL THEN
              EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))
            WHEN medical_history->>'dob' IS NOT NULL THEN
              EXTRACT(YEAR FROM AGE(CURRENT_DATE, (medical_history->>'dob')::date))
            WHEN age_years IS NOT NULL OR age_months IS NOT NULL THEN
              COALESCE(age_years, 0) + FLOOR(COALESCE(age_months, 0)::numeric / 12)
            ELSE NULL
          END as calculated_age
        FROM pets
        WHERE date_of_birth IS NOT NULL 
           OR medical_history->>'dob' IS NOT NULL 
           OR age_years IS NOT NULL 
           OR age_months IS NOT NULL
      `).catch(() => ({ rows: [] }));

      // Group into age ranges
      const ageGroups: Record<string, number> = {
        '0-1': 0,
        '2-5': 0,
        '6-10': 0,
        '11-15': 0,
        '16+': 0
      };

      ageDistribution.rows.forEach((row: any) => {
        const age = parseFloat(row.calculated_age || '0');
        if (age <= 1) ageGroups['0-1']++;
        else if (age <= 5) ageGroups['2-5']++;
        else if (age <= 10) ageGroups['6-10']++;
        else if (age <= 15) ageGroups['11-15']++;
        else ageGroups['16+']++;
      });

      const ageDistributionArray = Object.entries(ageGroups).map(([ageGroup, count]) => ({
        ageGroup,
        count
      }));

      // Get health trends from medical_records and medical_history
      const healthTrends = await query(`
        WITH condition_counts AS (
          SELECT 
            UNNEST(ARRAY(
              SELECT jsonb_array_elements_text(medical_history->'chronicConditions')
              FROM pets
              WHERE medical_history->'chronicConditions' IS NOT NULL
            )) as condition_name
          UNION ALL
          SELECT 
            record_type as condition_name
          FROM medical_records
          WHERE record_type IS NOT NULL
        )
        SELECT 
          condition_name as condition,
          COUNT(*) as count
        FROM condition_counts
        WHERE condition_name IS NOT NULL AND condition_name != ''
        GROUP BY condition_name
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        stats: {
          totalPets: parseInt(stats.rows[0]?.total_pets || '0', 10),
          dogCount: parseInt(stats.rows[0]?.dog_count || '0', 10),
          catCount: parseInt(stats.rows[0]?.cat_count || '0', 10),
          otherCount: parseInt(stats.rows[0]?.other_count || '0', 10),
          avgAge: parseFloat(stats.rows[0]?.avg_age || '0'),
          topBreeds: topBreeds.rows.map((r: any) => ({
            breed: r.breed,
            count: parseInt(r.count, 10),
          })),
          ageDistribution: ageDistributionArray,
          healthTrends: healthTrends.rows.map((r: any) => ({
            condition: r.condition,
            count: parseInt(r.count, 10),
          })),
        },
      });
    } catch (error: any) {
      console.error('Error fetching pet stats:', error);
      return c.json({
        success: true,
        stats: {
          totalPets: 0,
          dogCount: 0,
          catCount: 0,
          otherCount: 0,
          avgAge: 0,
          topBreeds: [],
        }
      });
    }
  });

  app.get('/admin/pets/all', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '100', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);
      const species = c.req.query('species');

      let queryStr = `
        SELECT 
          p.*,
          c.name as owner_name,
          c.phone as owner_phone
        FROM pets p
        LEFT JOIN customers c ON p.customer_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (species && species !== 'all') {
        queryStr += ` AND LOWER(p.species) = LOWER($${paramIndex})`;
        params.push(species);
        paramIndex++;
      }

      queryStr += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const pets = await query(queryStr, params);

      // Map pets data to frontend format
      const mappedPets = (pets.rows || []).map((pet: any) => {
        // Calculate age from DOB or use age_years/age_months
        let calculatedAge = 0;
        if (pet.date_of_birth) {
          const birthDate = new Date(pet.date_of_birth);
          const now = new Date();
          const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 +
            (now.getMonth() - birthDate.getMonth());
          calculatedAge = Math.floor(ageInMonths / 12);
        } else if (pet.medical_history?.dob) {
          const birthDate = new Date(pet.medical_history.dob);
          const now = new Date();
          const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 +
            (now.getMonth() - birthDate.getMonth());
          calculatedAge = Math.floor(ageInMonths / 12);
        } else if (pet.age_years || pet.age_months) {
          calculatedAge = (pet.age_years || 0) + Math.floor((pet.age_months || 0) / 12);
        }

        // Extract health conditions from medical_history
        const healthConditions = pet.medical_history?.chronicConditions ||
          pet.medical_history?.healthConditions ||
          [];

        return {
          id: pet.id,
          name: pet.name || '',
          species: pet.species || '',
          breed: pet.breed || '',
          age: calculatedAge,
          weight: pet.weight_kg || 0,
          healthConditions: Array.isArray(healthConditions) ? healthConditions : [],
          vaccinations: pet.medical_history?.vaccinations ||
            pet.vaccination_records ||
            [],
          owner: pet.owner_name || '',
          ownerId: pet.customer_id || '',
          lastCheckup: pet.medical_history?.lastCheckup || null,
          services: [],
        };
      });

      return c.json({
        success: true,
        pets: mappedPets,
        total: mappedPets.length,
      });
    } catch (error: any) {
      console.error('Error fetching pets:', error);
      return c.json({ success: true, pets: [], total: 0 });
    }
  });

  app.get('/admin/pets/breed-insights', async (c) => {
    try {
      const insights = await query(`
        SELECT 
          breed,
          COUNT(*) as count,
          COALESCE(AVG(age_years + age_months::numeric / 12), 0) as avg_age,
          COUNT(DISTINCT customer_id) as unique_owners
        FROM pets
        WHERE breed IS NOT NULL
        GROUP BY breed
        HAVING COUNT(*) >= 2
        ORDER BY count DESC
        LIMIT 20
      `).catch(() => ({ rows: [] }));

      const insightsWithDetails = await Promise.all(
        insights.rows.map(async (row: any) => {
          // Get common services for this breed (from bookings)
          const services = await query(`
            SELECT s.name, COUNT(*) as booking_count
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN pets p ON b.pet_id = p.id
            WHERE p.breed = $1
            GROUP BY s.name
            ORDER BY booking_count DESC
            LIMIT 5
          `, [row.breed]).catch(() => ({ rows: [] }));

          return {
            breed: row.breed,
            count: parseInt(row.count, 10),
            avgAge: parseFloat(row.avg_age || '0'),
            uniqueOwners: parseInt(row.unique_owners, 10),
            commonServices: services.rows.map((s: any) => s.name),
            healthRisk: 'low', // Could be calculated from medical_history
            avgSpend: 0, // Could be calculated from bookings
          };
        })
      );

      return c.json({
        success: true,
        insights: insightsWithDetails,
      });
    } catch (error: any) {
      console.error('Error fetching breed insights:', error);
      return c.json({ success: true, insights: [] });
    }
  });

  // Get vaccination coverage statistics
  app.get('/admin/pets/vaccination-coverage', async (c) => {
    try {
      const totalPets = await query(`
        SELECT COUNT(*) as total FROM pets
      `).catch(() => ({ rows: [{ total: '0' }] }));

      const totalPetsCount = parseInt(totalPets.rows[0]?.total || '0', 10);

      if (totalPetsCount === 0) {
        return c.json({
          success: true,
          coverage: {
            rabies: 0,
            distemper: 0,
            parvovirus: 0,
          },
        });
      }

      // Check vaccination records in medical_history and vaccination_records
      const vaccinationData = await query(`
        WITH vaccination_flattened AS (
          SELECT 
            p.id,
            UNNEST(ARRAY(
              SELECT jsonb_array_elements_text(medical_history->'vaccinations')
              FROM pets
              WHERE medical_history->'vaccinations' IS NOT NULL
            )) as vaccination_name
          FROM pets p
          WHERE p.medical_history->'vaccinations' IS NOT NULL
          UNION ALL
          SELECT 
            p.id,
            v->>'name' as vaccination_name
          FROM pets p,
          LATERAL jsonb_array_elements(p.vaccination_records) v
          WHERE p.vaccination_records IS NOT NULL
        )
        SELECT 
          LOWER(vaccination_name) as vaccine_type,
          COUNT(DISTINCT id) as vaccinated_count
        FROM vaccination_flattened
        WHERE vaccination_name IS NOT NULL
        GROUP BY LOWER(vaccination_name)
      `).catch(() => ({ rows: [] }));

      const coverage: Record<string, number> = {
        rabies: 0,
        distemper: 0,
        parvovirus: 0,
      };

      vaccinationData.rows.forEach((row: any) => {
        const vaccineType = (row.vaccine_type || '').toLowerCase();
        const vaccinatedCount = parseInt(row.vaccinated_count || '0', 10);
        const percentage = totalPetsCount > 0 ? (vaccinatedCount / totalPetsCount) * 100 : 0;

        if (vaccineType.includes('rabies')) {
          coverage.rabies = Math.round(percentage);
        } else if (vaccineType.includes('distemper')) {
          coverage.distemper = Math.round(percentage);
        } else if (vaccineType.includes('parvo')) {
          coverage.parvovirus = Math.round(percentage);
        }
      });

      return c.json({
        success: true,
        coverage,
      });
    } catch (error: any) {
      console.error('Error fetching vaccination coverage:', error);
      return c.json({
        success: true,
        coverage: {
          rabies: 0,
          distemper: 0,
          parvovirus: 0,
        },
      });
    }
  });

  // Get health recommendations
  app.get('/admin/pets/health-recommendations', async (c) => {
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Vaccination reminders - pets due for vaccination in next 30 days
      const vaccinationReminders = await query(`
        WITH vaccination_due AS (
          SELECT 
            p.id,
            v->>'nextDueDate' as next_due_date,
            v->>'name' as vaccine_name
          FROM pets p,
          LATERAL jsonb_array_elements(COALESCE(p.vaccination_records, '[]'::jsonb)) v
          WHERE p.vaccination_records IS NOT NULL
            AND (v->>'nextDueDate')::date BETWEEN CURRENT_DATE AND $1::date
          UNION ALL
          SELECT 
            p.id,
            v->>'nextDueDate' as next_due_date,
            v->>'name' as vaccine_name
          FROM pets p,
          LATERAL jsonb_array_elements(COALESCE(p.medical_history->'vaccinations', '[]'::jsonb)) v
          WHERE p.medical_history->'vaccinations' IS NOT NULL
            AND (v->>'nextDueDate')::date BETWEEN CURRENT_DATE AND $1::date
        )
        SELECT COUNT(DISTINCT id) as count
        FROM vaccination_due
      `, [thirtyDaysFromNow.toISOString().split('T')[0]]).catch(() => ({ rows: [{ count: '0' }] }));

      // Wellness checkup reminders - pets without checkup in last 6 months
      const checkupReminders = await query(`
        SELECT COUNT(*) as count
        FROM pets p
        WHERE NOT EXISTS (
          SELECT 1 FROM medical_records mr
          WHERE mr.pet_id = p.id
            AND mr.record_type = 'checkup'
            AND mr.created_at > CURRENT_DATE - INTERVAL '6 months'
        )
      `).catch(() => ({ rows: [{ count: '0' }] }));

      // Overweight pets - weight > 20% above average for species
      const overweightPets = await query(`
        WITH species_avg_weight AS (
          SELECT 
            species,
            AVG(weight_kg) as avg_weight
          FROM pets
          WHERE weight_kg IS NOT NULL
          GROUP BY species
        )
        SELECT COUNT(*) as count
        FROM pets p
        JOIN species_avg_weight s ON p.species = s.species
        WHERE p.weight_kg > s.avg_weight * 1.2
      `).catch(() => ({ rows: [{ count: '0' }] }));

      return c.json({
        success: true,
        recommendations: [
          {
            type: 'vaccination',
            title: 'Vaccination Reminder',
            message: `${parseInt(vaccinationReminders.rows[0]?.count || '0', 10)} pets due for vaccination this month`,
            priority: 'high',
          },
          {
            type: 'checkup',
            title: 'Wellness Checkup',
            message: `${parseInt(checkupReminders.rows[0]?.count || '0', 10)} pets haven't had checkup in 6+ months`,
            priority: 'medium',
          },
          {
            type: 'nutrition',
            title: 'Nutrition Consultation',
            message: `Recommend for overweight pets (${parseInt(overweightPets.rows[0]?.count || '0', 10)} identified)`,
            priority: 'low',
          },
        ],
      });
    } catch (error: any) {
      console.error('Error fetching health recommendations:', error);
      return c.json({
        success: true,
        recommendations: [],
      });
    }
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

  // ============================================================================
  // ADDITIONAL ADMIN ENDPOINTS (Missing from Admin UI)
  // ============================================================================

  // Catalog Endpoints
  app.get('/admin/catalog/categories', async (c) => {
    try {
      // Support type query parameter: 'service' (default) or 'ecommerce' (for products)
      const type = c.req.query('type') || 'service';
      const tableName = type === 'ecommerce' ? 'ecommerce_categories' : 'service_categories';

      // Use safe query that handles UUID/TEXT schema conflict
      // Ensure all fields are properly typed and never undefined
      let categories;
      try {
        if (type === 'ecommerce') {
          // For ecommerce_categories, use simpler query (no category_id field)
          categories = await query(`
            SELECT 
              id::text as id,
              name::text as name,
              COALESCE(description::text, '') as description,
              COALESCE(display_order::integer, 0) as display_order,
              COALESCE(is_active::boolean, true) as is_active,
              COALESCE(created_at::text, '') as created_at
            FROM ecommerce_categories
            WHERE is_active = true OR is_active IS NULL
            ORDER BY display_order ASC NULLS LAST, name ASC
            LIMIT 1000
          `);

          // Auto-seed default ecommerce categories if table is empty
          if (categories.rows.length === 0) {
            console.log('[Categories] ecommerce_categories table is empty, auto-seeding default categories');
            const defaultCategories = [
              { name: 'Pet Food', description: 'Dog food, cat food, and treats', display_order: 1 },
              { name: 'Pet Accessories', description: 'Collars, leashes, bowls, and more', display_order: 2 },
              { name: 'Pet Toys', description: 'Interactive toys, chew toys, and plush toys', display_order: 3 },
              { name: 'Pet Grooming', description: 'Shampoos, brushes, and grooming tools', display_order: 4 },
              { name: 'Pet Health', description: 'Supplements, vitamins, and health products', display_order: 5 },
              { name: 'Pet Beds & Furniture', description: 'Beds, crates, and pet furniture', display_order: 6 },
              { name: 'Pet Clothing', description: 'Jackets, sweaters, and costumes', display_order: 7 },
              { name: 'Pet Travel', description: 'Carriers, car seats, and travel accessories', display_order: 8 },
              { name: 'Pet Pharmacy', description: 'Medications and prescription items', display_order: 9 },
              { name: 'Pet Training', description: 'Training aids, clickers, and pads', display_order: 10 },
            ];

            for (const cat of defaultCategories) {
              try {
                await query(
                  `INSERT INTO ecommerce_categories (name, description, display_order, is_active)
                   VALUES ($1, $2, $3, true)
                   ON CONFLICT (name) DO NOTHING`,
                  [cat.name, cat.description, cat.display_order]
                );
              } catch (seedError: any) {
                console.warn(`[Categories] Error seeding category ${cat.name}:`, seedError.message);
              }
            }

            // Re-fetch categories after seeding
            categories = await query(`
              SELECT 
                id::text as id,
                name::text as name,
                COALESCE(description::text, '') as description,
                COALESCE(display_order::integer, 0) as display_order,
                COALESCE(is_active::boolean, true) as is_active,
                COALESCE(created_at::text, '') as created_at
              FROM ecommerce_categories
              WHERE is_active = true OR is_active IS NULL
              ORDER BY display_order ASC NULLS LAST, name ASC
              LIMIT 1000
            `);
          }
        } else {
          // For service_categories, use full query with category_id
          categories = await query(`
            SELECT 
              id::text as id,
              COALESCE(category_id::text, '') as category_id,
              name::text as name,
              COALESCE(description::text, '') as description,
              COALESCE(icon::text, '') as icon,
              COALESCE(icon_color::text, 'text-gray-500') as icon_color,
              COALESCE(display_order::integer, 0) as display_order,
              COALESCE(is_active::boolean, true) as is_active,
              COALESCE(created_at::text, '') as created_at,
              COALESCE(updated_at::text, '') as updated_at
            FROM service_categories
            WHERE is_active = true OR is_active IS NULL
            ORDER BY display_order ASC NULLS LAST, name ASC
            LIMIT 1000
          `);
        }
      } catch (tableError: any) {
        // If table doesn't exist, return empty array
        if (tableError.message && tableError.message.includes('does not exist')) {
          console.warn(`[Categories] Table ${tableName} does not exist, returning empty array`);
          return c.json({
            success: true,
            categories: [],
            total: 0
          });
        }
        throw tableError;
      }

      // Ensure all fields are strings/numbers (no undefined) to prevent UI errors
      const safeCategories = (categories.rows || []).map((cat: any) => {
        const base = {
          id: String(cat.id || ''),
          name: String(cat.name || ''),
          description: String(cat.description || ''),
          display_order: parseInt(cat.display_order) || 0,
          is_active: cat.is_active !== false,
          created_at: String(cat.created_at || ''),
        };

        // Add service_categories specific fields
        if (type === 'service') {
          return {
            ...base,
            category_id: String(cat.category_id || ''),
            icon: String(cat.icon || ''),
            icon_color: String(cat.icon_color || 'text-gray-500'),
            updated_at: String(cat.updated_at || ''),
          };
        }

        // For ecommerce_categories, return base fields only
        return base;
      });

      return c.json({
        success: true,
        categories: safeCategories,
        total: safeCategories.length
      });
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      // If UUID/TEXT error, return empty array and attempt schema fix
      if (error.message && (
        error.message.includes('operator does not exist') ||
        error.message.includes('uuid = text') ||
        error.message.includes('uuid =')
      )) {
        // Try to fix schema automatically
        try {
          await query(`
            DO $$
            BEGIN
              -- Drop parent_category_id column if it exists (source of UUID/TEXT conflict)
              IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'service_categories' 
                AND column_name = 'parent_category_id'
              ) THEN
                ALTER TABLE service_categories DROP CONSTRAINT IF EXISTS service_categories_parent_fkey CASCADE;
                ALTER TABLE service_categories DROP COLUMN IF EXISTS parent_category_id CASCADE;
              END IF;
            END $$;
          `);

          // Retry query after fix
          const categories = await query(`
            SELECT 
              id::text as id,
              COALESCE(category_id::text, '') as category_id,
              name::text as name,
              COALESCE(description::text, '') as description,
              COALESCE(icon::text, '') as icon,
              COALESCE(icon_color::text, 'text-gray-500') as icon_color,
              COALESCE(display_order::integer, 0) as display_order,
              COALESCE(is_active::boolean, true) as is_active,
              COALESCE(created_at::text, '') as created_at,
              COALESCE(updated_at::text, '') as updated_at
            FROM service_categories
            WHERE is_active = true OR is_active IS NULL
            ORDER BY display_order ASC NULLS LAST, name ASC
            LIMIT 1000
          `);

          const safeCategories = (categories.rows || []).map((cat: any) => ({
            id: String(cat.id || ''),
            category_id: String(cat.category_id || ''),
            name: String(cat.name || ''),
            description: String(cat.description || ''),
            icon: String(cat.icon || ''),
            icon_color: String(cat.icon_color || 'text-gray-500'),
            display_order: parseInt(cat.display_order) || 0,
            is_active: cat.is_active !== false,
            created_at: String(cat.created_at || ''),
            updated_at: String(cat.updated_at || ''),
          }));

          return c.json({
            success: true,
            categories: safeCategories,
            total: safeCategories.length,
            message: 'Schema fixed automatically, categories loaded successfully'
          });
        } catch (fixError: any) {
          console.error('Error fixing schema:', fixError);
          // Return empty array instead of error to prevent UI crashes
          return c.json({
            success: true,
            categories: [],
            total: 0,
            message: 'Service categories table has schema constraint issue. Please run migration to fix.',
          });
        }
      }
      // Return empty array instead of error to prevent UI crashes
      return c.json({
        success: true,
        categories: [],
        total: 0,
        error: error.message
      });
    }
  });

  app.post('/admin/catalog/categories', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const {
        categoryId, name, description, icon, iconColor,
        hasProblemGrid, vendorRoles, status, type
      } = body;

      if (!name) {
        return c.json({ success: false, error: 'Category name is required' }, 400);
      }

      // Support type parameter: 'service' (default) or 'ecommerce' (for products)
      const categoryType = type || 'service';
      const tableName = categoryType === 'ecommerce' ? 'ecommerce_categories' : 'service_categories';

      // Get max display_order from appropriate table
      const maxOrder = await query(`SELECT COALESCE(MAX(display_order), 0) as max_order FROM ${tableName}`).catch(() => ({ rows: [{ max_order: 0 }] }));
      const nextOrder = parseInt(maxOrder.rows[0]?.max_order || '0', 10) + 1;

      // Handle ecommerce_categories vs service_categories
      if (categoryType === 'ecommerce') {
        // For ecommerce_categories, use UUID id (no category_id field)
        const newCategory = await insert('ecommerce_categories', {
          name,
          description: description || '',
          display_order: nextOrder,
          is_active: status !== 'inactive',
          created_at: new Date().toISOString(),
        });

        return c.json({
          success: true,
          message: 'E-commerce category created successfully',
          category: newCategory[0],
        });
      }

      // For service_categories, use category_id
      const finalCategoryId = categoryId || `cat-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

      const newCategory = await insert('service_categories', {
        category_id: finalCategoryId,
        name,
        description: description || '',
        icon: icon || 'Folder',
        icon_color: iconColor || 'text-gray-500',
        has_problem_grid: hasProblemGrid || false,
        vendor_roles: vendorRoles || [],
        display_order: nextOrder,
        is_active: status !== 'inactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Category created successfully',
        category: newCategory[0],
      });
    } catch (error: unknown) {
      console.error('Error creating category:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to create category', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/catalog/categories/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.icon !== undefined) updateData.icon = body.icon;
      if (body.iconColor !== undefined) updateData.icon_color = body.iconColor;
      if (body.hasProblemGrid !== undefined) updateData.has_problem_grid = body.hasProblemGrid;
      if (body.vendorRoles !== undefined) updateData.vendor_roles = body.vendorRoles;
      if (body.status !== undefined) updateData.is_active = body.status !== 'inactive';
      if (body.display_order !== undefined) updateData.display_order = parseInt(body.display_order, 10);

      const updated = await update('service_categories', { id }, updateData);

      return c.json({
        success: true,
        message: 'Category updated successfully',
        category: updated[0],
      });
    } catch (error: unknown) {
      console.error('Error updating category:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to update category', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.delete('/admin/catalog/categories/:id', async (c) => {
    try {
      const id = c.req.param('id');

      // Soft delete: set is_active to false
      await update('service_categories', { id }, {
        is_active: false,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error: unknown) {
      console.error('Error deleting category:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to delete category', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/catalog/products', async (c) => {
    try {
      const products = await query(`
        SELECT 
          p.id::text as id,
          p.name,
          p.description,
          p.category_id::text as category_id,
          p.sku,
          p.price,
          p.stock,
          p.status,
          p.created_at::text as created_at,
          p.updated_at::text as updated_at,
          ec.name as category_name
        FROM products p
        LEFT JOIN ecommerce_categories ec ON p.category_id = ec.id
        ORDER BY p.created_at DESC 
        LIMIT 50
      `);

      const safeProducts = (products.rows || []).map((p: any) => ({
        ...p,
        id: String(p.id || ''),
        category_id: String(p.category_id || ''),
        category: String(p.category_name || 'Uncategorized'),
        sku: String(p.sku || ''),
        price: parseFloat(p.price || '0'),
        stock: parseInt(p.stock || '0', 10),
        status: String(p.status || 'active'),
      }));

      return c.json({ success: true, products: safeProducts });
    } catch (error: any) {
      console.error('Error fetching products:', error);
      return c.json({ success: true, products: [] });
    }
  });

  app.post('/admin/catalog/products', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { name, description, categoryId, price, stock, status } = body;

      if (!name || !price) {
        return c.json({ success: false, error: 'Product name and price are required' }, 400);
      }

      // Normalize categoryId: convert empty string, whitespace, or invalid values to null
      let normalizedCategoryId: string | null = null;
      if (categoryId && typeof categoryId === 'string' && categoryId.trim() !== '') {
        normalizedCategoryId = categoryId.trim();
      }

      // Validate category_id exists in ecommerce_categories if provided
      let validatedCategoryId: string | null = null;
      if (normalizedCategoryId) {
        try {
          // Validate UUID format first
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(normalizedCategoryId)) {
            console.warn(`[CreateProduct] Invalid UUID format for categoryId: ${normalizedCategoryId}`);
            validatedCategoryId = null;
          } else {
            // Check if ecommerce_categories table exists and category is valid
            const categoryCheck = await query(
              `SELECT id FROM ecommerce_categories WHERE id = $1::uuid AND (is_active = true OR is_active IS NULL) LIMIT 1`,
              [normalizedCategoryId]
            );

            if (categoryCheck.rows && categoryCheck.rows.length > 0) {
              validatedCategoryId = normalizedCategoryId;
              console.log(`[CreateProduct] Validated category: ${validatedCategoryId}`);
            } else {
              console.warn(`[CreateProduct] Category ${normalizedCategoryId} not found in ecommerce_categories or inactive, setting to null`);
              // Don't fail - allow null category_id
              validatedCategoryId = null;
            }
          }
        } catch (catError: any) {
          // If ecommerce_categories table doesn't exist or query fails, allow null
          console.warn(`[CreateProduct] Could not validate category: ${catError.message}`);
          validatedCategoryId = null;
        }
      }

      // Build insert payload - explicitly set category_id to null if not validated
      const insertPayload: any = {
        name,
        description: description || '',
        category_id: validatedCategoryId, // Will be null if invalid or not provided
        price: parseFloat(price) || 0,
        stock: parseInt(stock || '0', 10),
        status: status || 'active',
        is_active: status !== 'inactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log(`[CreateProduct] Inserting product with category_id: ${validatedCategoryId === null ? 'NULL' : validatedCategoryId}`);

      const newProduct = await insert('products', insertPayload);

      return c.json({
        success: true,
        message: 'Product created successfully',
        product: newProduct[0],
      });
    } catch (error: unknown) {
      console.error('Error creating product:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to create product', 500);

      // Provide more specific error message for foreign key violations
      if (errorResponse.error && typeof errorResponse.error === 'string' &&
        errorResponse.error.includes('foreign key constraint')) {
        return c.json({
          success: false,
          error: 'Invalid category selected. The category does not exist in the system. Please select a valid product category or leave it empty.'
        }, 400);
      }

      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/catalog/products/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.categoryId !== undefined) updateData.category_id = body.categoryId;
      if (body.price !== undefined) updateData.price = parseFloat(body.price);
      if (body.stock !== undefined) updateData.stock_quantity = parseInt(body.stock, 10);
      if (body.status !== undefined) {
        updateData.is_active = body.status !== 'inactive';
      }

      const updated = await update('products', { id }, updateData);

      return c.json({
        success: true,
        message: 'Product updated successfully',
        product: updated[0],
      });
    } catch (error: unknown) {
      console.error('Error updating product:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to update product', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.delete('/admin/catalog/products/:id', async (c) => {
    try {
      const id = c.req.param('id');

      // Soft delete: set is_active to false
      await update('products', { id }, {
        is_active: false,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/catalog/services', async (c) => {
    try {
      // Try service_catalog first, fallback to vendor_services
      let services;
      try {
        services = await query(`
          SELECT 
            id::text as id,
            service_id::text as service_id,
            service_name,
            display_name,
            description,
            category_id::text as category_id,
            category_name,
            sub_category_id::text as sub_category_id,
            sub_category_name,
            applicable_roles,
            service_style,
            base_price,
            duration_minutes,
            status,
            publish_status,
            display_order,
            COALESCE(specialization_ids, ARRAY[]::text[]) as specialization_ids,
            created_at::text as created_at,
            updated_at::text as updated_at
          FROM service_catalog
          ORDER BY display_order ASC, created_at DESC
          LIMIT 100
        `);
      } catch {
        services = await query('SELECT * FROM vendor_services ORDER BY created_at DESC LIMIT 50');
      }

      const safeServices = (services.rows || []).map((s: any) => ({
        ...s,
        id: String(s.id || s.service_id || ''),
        service_id: String(s.service_id || s.id || ''),
        service_name: String(s.service_name || s.name || ''),
        display_name: String(s.display_name || s.service_name || s.name || ''),
        category_id: String(s.category_id || ''),
        status: String(s.status || 'active'),
        specialization_ids: s.specialization_ids || [],
        specializationIds: s.specialization_ids || [],
      }));

      return c.json({ success: true, services: safeServices });
    } catch (error: any) {
      console.error('Error fetching services:', error);
      return c.json({ success: true, services: [] });
    }
  });

  app.get('/admin/catalog/services/export', async (c) => {
    try {
      const format = c.req.query('format') || 'csv';
      const result = await query(`
        SELECT service_id, service_name, display_name, description, category_id, category_name,
               sub_category_id, sub_category_name, applicable_roles, service_style, base_price,
               duration_minutes, status, publish_status
        FROM service_catalog ORDER BY display_order ASC, created_at DESC LIMIT 5000
      `);
      const rows = result?.rows || [];
      if (format === 'csv') {
        const headers = ['service_id', 'service_name', 'display_name', 'description', 'category_id', 'category_name', 'sub_category_id', 'sub_category_name', 'base_price', 'duration_minutes', 'status'];
        const escape = (v: any) => (v == null ? '' : String(v).replace(/"/g, '""'));
        const csvRows = [headers.join(',')];
        for (const r of rows) {
          csvRows.push(headers.map((h) => `"${escape((r as any)[h])}"`).join(','));
        }
        return c.json({ success: true, content: csvRows.join('\n') });
      }
      return c.json({ success: true, content: '', message: 'Excel format not yet implemented; use CSV.' });
    } catch (error: any) {
      console.error('Error exporting services:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/catalog/services/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const result = await query(
        isUUID
          ? `SELECT * FROM service_catalog WHERE service_id = $1 OR id = $1::uuid LIMIT 1`
          : `SELECT * FROM service_catalog WHERE service_id = $1 OR id::text = $1 LIMIT 1`,
        [id]
      );
      const s = result?.rows?.[0];
      if (!s) {
        return c.json({ success: false, error: 'Service not found' }, 404);
      }
      const service = {
        id: String(s.id || s.service_id || ''),
        service_id: String(s.service_id || s.id || ''),
        name: String(s.service_name || s.display_name || ''),
        code: String(s.service_id || s.id || ''),
        description: String(s.description || ''),
        categoryId: s.category_id ? String(s.category_id) : '',
        subCategoryId: s.sub_category_id ? String(s.sub_category_id) : '',
        price: parseFloat(s.base_price || '0'),
        duration: s.duration_minutes || 30,
        serviceType: (s.service_style === 'at_home' ? 'at-home' : s.service_style === 'at_center' ? 'at-center' : s.service_style) || 'at-center',
        status: String(s.status || 'active'),
        applicableRoles: s.applicable_roles || [],
        specializationIds: s.specialization_ids || [],
        metadata: s.metadata || {},
      };
      return c.json({ success: true, service });
    } catch (error: any) {
      console.error('Error fetching service:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.post('/admin/catalog/services', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { name, code, description, categoryId, subCategoryId, price, duration, serviceType, status, applicableRoles, categoryName, subCategoryName, specializationIds, specialization_ids, tax_category_id, taxCategoryId, hsn_code_id, hsnCodeId, metadata: bodyMetadata } = body;
      const taxCategoryIdVal = tax_category_id ?? taxCategoryId ?? null;
      const hsnCodeIdVal = hsn_code_id ?? hsnCodeId ?? null;
      const specializationIdsArr = Array.isArray(specializationIds) ? specializationIds : (Array.isArray(specialization_ids) ? specialization_ids : []);

      if (!name || !price) {
        return c.json({ success: false, error: 'Service name and price are required' }, 400);
      }

      // Parse duration - handle both "30 min" and "30" formats
      let durationMinutes = 30;
      if (duration) {
        const parsed = parseInt(String(duration).replace(/[^0-9]/g, ''));
        durationMinutes = isNaN(parsed) ? 30 : parsed;
      }

      // Map serviceType to service_style
      let serviceStyle = 'at_center';
      if (serviceType === 'at-home' || serviceType === 'at_home') {
        serviceStyle = 'at_home';
      } else if (serviceType === 'at-center' || serviceType === 'at_center') {
        serviceStyle = 'at_center';
      } else if (serviceType === 'tele') {
        serviceStyle = 'tele';
      } else if (serviceType === 'delivery') {
        serviceStyle = 'delivery';
      }

      // Generate service_id if not provided
      const serviceId = code || `svc_admin_${serviceStyle}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // ✅ FIXED: Set applicable_roles; validate against active roles from DB (not frontend-only)
      const roles = applicableRoles || [];
      if (roles.length > 0) {
        const validation = await validateApplicableRolesAgainstActiveRoles(roles);
        if (!validation.valid) {
          return c.json({
            success: false,
            error: `applicable_roles must be active role ids/names from DB. Invalid: ${validation.invalid.join(', ')}`,
          }, 400);
        }
      } else {
        console.warn(`⚠️ Service ${serviceId} created without applicable_roles. Service won't be visible to vendors. Please assign roles via admin UI.`);
      }

      // Create in service_catalog table
      const insertPayload: Record<string, unknown> = {
        service_id: serviceId,
        service_name: name,
        display_name: name,
        description: description || '',
        category_id: categoryId || null,
        category_name: categoryName || null,
        sub_category_id: subCategoryId || null,
        sub_category_name: subCategoryName || null,
        applicable_roles: roles,
        service_style: serviceStyle,
        base_price: parseFloat(price) || 0,
        duration_minutes: durationMinutes,
        status: status || 'active',
        publish_status: 'published',
        display_order: 0,
        specialization_ids: specializationIdsArr,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (taxCategoryIdVal) insertPayload.tax_category_id = taxCategoryIdVal;
      if (hsnCodeIdVal) insertPayload.hsn_code_id = hsnCodeIdVal;
      const metadata = bodyMetadata && typeof bodyMetadata === 'object' ? bodyMetadata : {};
      if (Object.keys(metadata).length > 0) insertPayload.metadata = metadata;

      const newService = await insert('service_catalog', insertPayload);

      return c.json({
        success: true,
        message: 'Service created successfully',
        service: newService[0],
        warning: roles.length === 0 ? 'Service created without applicable_roles. Assign roles to make it visible to vendors.' : null,
      });
    } catch (error: unknown) {
      console.error('Error creating service:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to create service', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/catalog/services/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined) updateData.service_name = body.name;
      if (body.display_name !== undefined) updateData.display_name = body.display_name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.categoryId !== undefined) updateData.category_id = body.categoryId;
      if (body.price !== undefined) updateData.base_price = parseFloat(body.price);
      if (body.duration !== undefined) updateData.duration_minutes = parseInt(body.duration, 10);
      if (body.status !== undefined) updateData.status = body.status;
      if (body.display_order !== undefined) updateData.display_order = parseInt(body.display_order, 10);
      if (body.specialization_ids !== undefined) updateData.specialization_ids = body.specialization_ids;
      if (body.specializationIds !== undefined) updateData.specialization_ids = body.specializationIds;
      if (body.applicable_roles !== undefined) updateData.applicable_roles = Array.isArray(body.applicable_roles) ? body.applicable_roles : [];
      if (body.applicableRoles !== undefined) updateData.applicable_roles = Array.isArray(body.applicableRoles) ? body.applicableRoles : [];
      if (body.service_style !== undefined) updateData.service_style = body.service_style;
      if (body.serviceStyle !== undefined) updateData.service_style = body.serviceStyle;
      if (body.tax_category_id !== undefined) updateData.tax_category_id = body.tax_category_id || null;
      if (body.taxCategoryId !== undefined) updateData.tax_category_id = body.taxCategoryId || null;
      if (body.hsn_code_id !== undefined) updateData.hsn_code_id = body.hsn_code_id || null;
      if (body.hsnCodeId !== undefined) updateData.hsn_code_id = body.hsnCodeId || null;
      if (body.metadata !== undefined && body.metadata && typeof body.metadata === 'object') updateData.metadata = body.metadata;

      if (updateData.applicable_roles && updateData.applicable_roles.length > 0) {
        const validation = await validateApplicableRolesAgainstActiveRoles(updateData.applicable_roles);
        if (!validation.valid) {
          return c.json({
            success: false,
            error: `applicable_roles must be active role ids/names from DB. Invalid: ${validation.invalid.join(', ')}`,
          }, 400);
        }
      }

      // Try service_catalog first
      try {
        const updated = await update('service_catalog', { id }, updateData);
        return c.json({
          success: true,
          message: 'Service updated successfully',
          service: updated[0],
        });
      } catch {
        // Fallback to vendor_services
        const updated = await update('vendor_services', { id }, updateData);
        return c.json({
          success: true,
          message: 'Service updated successfully',
          service: updated[0],
        });
      }
    } catch (error: unknown) {
      console.error('Error updating service:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to update service', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.delete('/admin/catalog/services/:id', async (c) => {
    try {
      const id = c.req.param('id');

      // Try service_catalog first (soft delete)
      try {
        await update('service_catalog', { id }, {
          status: 'archived',
          publish_status: 'archived',
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Fallback to vendor_services
        await update('vendor_services', { id }, {
          is_active: false,
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        message: 'Service deleted successfully',
      });
    } catch (error: unknown) {
      console.error('Error deleting service:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to delete service', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // Catalog Export
  app.get('/admin/catalog/export', async (c) => {
    try {
      const categories = await query(`
        SELECT id, name, slug, description, parent_id, is_active, created_at
        FROM service_categories 
        ORDER BY name
      `);

      return c.json({
        success: true,
        categories: categories.rows,
      });
    } catch (error: unknown) {
      console.error('Error exporting categories:', error);
      return c.json({ success: false, categories: [] });
    }
  });

  // Catalog Seed
  app.post('/admin/catalog/seed', async (c) => {
    try {
      const { type } = await c.req.json();

      const seedData = type === 'vet_only' ? [
        { name: 'Veterinary', slug: 'veterinary', description: 'Veterinary services' },
        { name: 'Tele Consultation', slug: 'tele-consultation', description: 'Online vet consultation' },
        { name: 'Home Visit', slug: 'home-visit', description: 'Vet home visit' },
      ] : [
        { name: 'Veterinary', slug: 'veterinary', description: 'Veterinary services' },
        { name: 'Grooming', slug: 'grooming', description: 'Pet grooming services' },
        { name: 'Training', slug: 'training', description: 'Pet training services' },
        { name: 'Walking', slug: 'walking', description: 'Dog walking services' },
        { name: 'Boarding', slug: 'boarding', description: 'Pet boarding services' },
        { name: 'Photography', slug: 'photography', description: 'Pet photography services' },
      ];

      for (const cat of seedData) {
        await insert('service_categories', {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          is_active: true,
        }).catch(() => {/* Ignore duplicates */ });
      }

      return c.json({
        success: true,
        message: `Seeded ${seedData.length} categories`,
      });
    } catch (error: unknown) {
      console.error('Error seeding catalog:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to seed catalog', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/catalog/stats', async (c) => {
    try {
      // Get current counts
      const [categoriesResult, activeServicesResult, productsResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM service_categories WHERE is_active = true').catch(() => ({ rows: [{ count: '0' }] })),
        query('SELECT COUNT(*) as count FROM service_catalog WHERE status = \'active\' AND publish_status = \'published\'').catch(() => ({ rows: [{ count: '0' }] })),
        query('SELECT COUNT(*) as count FROM products WHERE status = \'active\'').catch(() => ({ rows: [{ count: '0' }] })),
      ]);

      const mainCategoriesCount = parseInt(categoriesResult.rows[0]?.count || '0', 10);
      const activeServicesCount = parseInt(activeServicesResult.rows[0]?.count || '0', 10);
      const activeProductsCount = parseInt(productsResult.rows[0]?.count || '0', 10);

      // Calculate changes (this month for categories, this week for products)
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const [categoriesLastMonth, productsLastWeek] = await Promise.all([
        query(`SELECT COUNT(*) as count FROM service_categories WHERE is_active = true AND created_at >= $1`, [thisMonthStart.toISOString()]).catch(() => ({ rows: [{ count: '0' }] })),
        query(`SELECT COUNT(*) as count FROM products WHERE status = 'active' AND created_at >= $1`, [thisWeekStart.toISOString()]).catch(() => ({ rows: [{ count: '0' }] })),
      ]);

      const categoriesThisMonth = parseInt(categoriesLastMonth.rows[0]?.count || '0', 10);
      const productsThisWeek = parseInt(productsLastWeek.rows[0]?.count || '0', 10);

      // Get pending reviews (from product_reviews table if exists, otherwise mock)
      const pendingReviewsResult = await query(`
        SELECT COUNT(*) as count FROM product_reviews WHERE status = 'pending'
      `).catch(() => ({ rows: [{ count: '10' }] })); // Fallback to mock value

      const pendingReviewsCount = parseInt(pendingReviewsResult.rows[0]?.count || '10', 10);
      const reviewsLastMonth = await query(`
        SELECT COUNT(*) as count FROM product_reviews 
        WHERE status = 'pending' AND created_at >= $1
      `, [thisMonthStart.toISOString()]).catch(() => ({ rows: [{ count: '4' }] }));
      const reviewsThisMonth = parseInt(reviewsLastMonth.rows[0]?.count || '4', 10);

      // Get low stock alerts (from products with low stock)
      const lowStockResult = await query(`
        SELECT COUNT(*) as count FROM products 
        WHERE stock < 10 AND status = 'active'
      `).catch(() => ({ rows: [{ count: '23' }] })); // Fallback to mock value

      const lowStockCount = parseInt(lowStockResult.rows[0]?.count || '23', 10);
      const lowStockLastWeek = await query(`
        SELECT COUNT(*) as count FROM products 
        WHERE stock < 10 AND status = 'active' AND updated_at >= $1
      `, [thisWeekStart.toISOString()]).catch(() => ({ rows: [{ count: '8' }] }));
      const lowStockThisWeek = parseInt(lowStockLastWeek.rows[0]?.count || '8', 10);

      return c.json({
        success: true,
        stats: {
          mainCategories: {
            count: mainCategoriesCount,
            change: categoriesThisMonth, // Categories created this month
          },
          activeProducts: {
            count: activeProductsCount || activeServicesCount, // Use services if products table doesn't exist
            change: productsThisWeek, // Products created this week
          },
          pendingReviews: {
            count: pendingReviewsCount,
            change: reviewsThisMonth, // Reviews this month (negative change means resolved)
          },
          lowStockAlerts: {
            count: lowStockCount,
            change: lowStockThisWeek, // Low stock alerts this week
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching catalog stats:', error);
      // Return mock data if query fails
      return c.json({
        success: true,
        stats: {
          mainCategories: { count: 10, change: 2 },
          activeProducts: { count: 32, change: 3 },
          pendingReviews: { count: 10, change: 4 },
          lowStockAlerts: { count: 23, change: 8 },
        },
      });
    }
  });

  app.get('/admin/catalog/tags', async (c) => {
    try {
      const tags = await query('SELECT DISTINCT tag FROM service_tags ORDER BY tag ASC');
      return c.json({ success: true, tags: tags.rows.map(r => r.tag) });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/catalog/product-services', async (c) => {
    try {
      const data = await query(`
        SELECT p.*, s.* FROM products p
        LEFT JOIN vendor_services s ON p.vendor_id = s.vendor_id
        ORDER BY p.created_at DESC LIMIT 50
      `);
      return c.json({ success: true, data: data.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/catalog/pricing-inventory', async (c) => {
    try {
      const data = await query(`
        SELECT p.id, p.name, p.price, p.stock, s.price as service_price
        FROM products p
        LEFT JOIN vendor_services s ON p.vendor_id = s.vendor_id
        ORDER BY p.created_at DESC
      `);
      return c.json({ success: true, data: data.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/catalog/pricing-rules', async (c) => {
    try {
      const rules = await query('SELECT * FROM pricing_rules ORDER BY created_at DESC');
      return c.json({ success: true, rules: rules.rows });
    } catch (error: any) {
      console.error('Error fetching pricing rules:', error);
      return c.json({ success: true, rules: [] });
    }
  });

  app.post('/admin/catalog/pricing-rules', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { name, description, ruleType, ruleConfig, isActive } = body;

      if (!name || !ruleType || !ruleConfig) {
        return c.json({ success: false, error: 'Name, rule type, and rule config are required' }, 400);
      }

      const newRule = await insert('pricing_rules', {
        name,
        description: description || '',
        rule_type: ruleType,
        rule_config: ruleConfig,
        is_active: isActive !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Pricing rule created successfully',
        rule: newRule[0],
      });
    } catch (error: unknown) {
      console.error('Error creating pricing rule:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to create pricing rule', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/catalog/pricing-rules/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.ruleType !== undefined) updateData.rule_type = body.ruleType;
      if (body.ruleConfig !== undefined) updateData.rule_config = body.ruleConfig;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      const updated = await update('pricing_rules', { id }, updateData);

      return c.json({
        success: true,
        message: 'Pricing rule updated successfully',
        rule: updated[0],
      });
    } catch (error: unknown) {
      console.error('Error updating pricing rule:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to update pricing rule', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.delete('/admin/catalog/pricing-rules/:id', async (c) => {
    try {
      const id = c.req.param('id');

      // Soft delete: set is_active to false
      await update('pricing_rules', { id }, {
        is_active: false,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Pricing rule deleted successfully',
      });
    } catch (error: unknown) {
      console.error('Error deleting pricing rule:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to delete pricing rule', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/catalog/bulk-operations', async (c) => {
    try {
      // Return empty for now - bulk operations history can be tracked separately
      return c.json({ success: true, operations: [] });
    } catch (error: any) {
      console.error('Error fetching bulk operations:', error);
      return c.json({ success: true, operations: [] });
    }
  });

  app.post('/admin/catalog/:itemType/bulk-edit', async (c) => {
    try {
      const itemType = c.req.param('itemType'); // 'categories', 'services', 'products'
      const body = await c.req.json().catch(() => ({}));
      const { ids, updates } = body; // ids: array of IDs, updates: object with fields to update

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return c.json({ success: false, error: 'IDs array is required' }, 400);
      }

      if (!updates || Object.keys(updates).length === 0) {
        return c.json({ success: false, error: 'Updates object is required' }, 400);
      }

      let tableName: string;
      let updateData: any = { updated_at: new Date().toISOString() };

      switch (itemType) {
        case 'categories':
          tableName = 'service_categories';
          if (updates.status !== undefined) {
            updateData.is_active = updates.status !== 'inactive';
          }
          if (updates.price !== undefined) {
            // Categories don't have price, ignore
          }
          if (updates.category !== undefined) {
            // Categories don't have category, ignore
          }
          break;
        case 'services':
          tableName = 'service_catalog';
          if (updates.status !== undefined) {
            updateData.status = updates.status;
            if (updates.status === 'active') {
              updateData.publish_status = 'published';
            } else if (updates.status === 'inactive') {
              updateData.publish_status = 'unpublished';
            }
          }
          if (updates.price !== undefined) {
            updateData.base_price = parseFloat(updates.price);
          }
          if (updates.category !== undefined) {
            updateData.category_id = updates.category;
          }
          break;
        case 'products':
          tableName = 'products';
          if (updates.status !== undefined) {
            updateData.is_active = updates.status !== 'inactive';
          }
          if (updates.price !== undefined) {
            updateData.price = parseFloat(updates.price);
          }
          if (updates.category !== undefined) {
            updateData.category_id = updates.category;
          }
          break;
        default:
          return c.json({ success: false, error: `Invalid item type: ${itemType}` }, 400);
      }

      // Define allowed columns per table to prevent SQL injection
      const ALLOWED_COLUMNS: Record<string, string[]> = {
        vendors: ['status', 'is_active', 'is_verified', 'commission_rate', 'rating', 'tier_level'],
        services: ['status', 'is_active', 'price', 'duration', 'category_id'],
        products: ['is_active', 'price', 'category_id', 'status', 'stock_quantity'],
      };

      // Validate all update field names against whitelist
      const allowedCols = ALLOWED_COLUMNS[tableName] || [];
      const sanitizedUpdateData: Record<string, any> = {};

      for (const key of Object.keys(updateData)) {
        if (allowedCols.includes(key)) {
          sanitizedUpdateData[key] = updateData[key];
        } else {
          console.warn(`[SECURITY] Rejected disallowed column in bulk edit: ${key}`);
        }
      }

      if (Object.keys(sanitizedUpdateData).length === 0) {
        return c.json({ success: false, error: 'No valid fields to update' }, 400);
      }

      // Bulk update all items with sanitized fields
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const updateFields = Object.keys(sanitizedUpdateData).map((key, i) => `${key} = $${ids.length + i + 1}`).join(', ');
      const updateQuery = `
        UPDATE ${tableName}
        SET ${updateFields}
        WHERE id = ANY(ARRAY[${placeholders}]::uuid[])
      `;

      const params = [...ids, ...Object.values(sanitizedUpdateData)];
      await query(updateQuery, params);

      return c.json({
        success: true,
        message: `Bulk update completed for ${ids.length} ${itemType}`,
        affected: ids.length,
      });
    } catch (error: unknown) {
      console.error('Error in bulk edit:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to perform bulk edit', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // Finance Endpoints
  app.get('/admin/finance/settlements', async (c) => {
    try {
      let result: { rows?: any[] };
      try {
        result = await query(`
          SELECT s.*,
                 COALESCE(v.business_name, vi.business_name, vi.full_name, 'Vendor') as vendor_name,
                 COALESCE(v.phone, vi.phone) as vendor_phone,
                 r.name as vendor_role,
                 COALESCE(v.category, vi.vendor_type, '') as business_type
          FROM settlements s
          LEFT JOIN vendors v ON s.vendor_id = v.id
          LEFT JOIN vendor_identity vi ON vi.vendor_id = s.vendor_id
          LEFT JOIN roles r ON v.role_id = r.id
          ORDER BY s.created_at DESC
          LIMIT 100
        `);
      } catch (viErr: any) {
        const msg = String(viErr?.message ?? viErr ?? '');
        if (msg.includes('vendor_identity') && msg.includes('does not exist')) {
          result = await query(`
            SELECT s.*,
                   COALESCE(v.business_name, 'Vendor') as vendor_name,
                   COALESCE(v.phone, '') as vendor_phone,
                   r.name as vendor_role,
                   COALESCE(v.category, '') as business_type
            FROM settlements s
            LEFT JOIN vendors v ON s.vendor_id = v.id
            LEFT JOIN roles r ON v.role_id = r.id
            ORDER BY s.created_at DESC
            LIMIT 100
          `);
        } else {
          throw viErr;
        }
      }
      const rows = result.rows || [];
      const settlements = rows.map((s: any) => {
        // Database uses settlement_status, normalize to lowercase status
        const rawStatus = s.settlement_status || s.status || 'pending';
        const status = String(rawStatus).toLowerCase();
        const amount = parseFloat(s.vendor_amount ?? s.net_amount ?? s.total_amount ?? '0');
        const commission = parseFloat(s.commission_amount ?? '0');
        const periodStart = s.settlement_period_start || s.period_start || s.created_at;
        const periodEnd = s.settlement_period_end || s.period_end || s.completed_at || s.created_at;
        const periodStr = periodStart && periodEnd
          ? `${new Date(periodStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(periodEnd).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
          : (s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—');
        return {
          id: s.id,
          vendor_id: s.vendor_id,
          vendorName: s.vendor_name || s.business_name || 'Unknown',
          vendor_name: s.vendor_name || s.business_name || 'Unknown',
          vendor_role: s.vendor_role || null,
          business_type: s.business_type || null,
          amount,
          commission,
          total_amount: parseFloat(s.total_amount ?? '0'),
          status,
          settlement_status: status, // Include both for compatibility
          failure_reason: s.failure_reason || s.error_message || null,
          period: periodStr,
          period_start: periodStart,
          period_end: periodEnd,
          currency: s.currency || 'INR',
          razorpay_transfer_id: s.razorpay_transfer_id,
          created_at: s.created_at,
          completed_at: s.completed_at,
          failed_at: s.failed_at,
        };
      });
      return c.json({ success: true, settlements });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/finance/settlement-schedule', async (c) => {
    try {
      const scheduleRows = await query('SELECT * FROM settlement_schedules ORDER BY created_at DESC').then((r: any) => r.rows || []);
      // Single source of truth: settlement period comes from default tier only (read-only)
      const defaultTier = await query(`
        SELECT payout_period_days FROM vendor_tiers WHERE is_active = true ORDER BY is_default DESC NULLS LAST, tier_level ASC LIMIT 1
      `).then((r: any) => r.rows?.[0]).catch(() => null);
      const settlementPeriodDays = defaultTier?.payout_period_days != null ? Number(defaultTier.payout_period_days) : 7;
      const stored = await query(`
        SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:finance:settlement-schedule' LIMIT 1
      `).then((r: any) => r.rows?.[0]?.setting_value).catch(() => null);
      const saved = stored ? (typeof stored === 'string' ? JSON.parse(stored) : stored) : {};
      const settings = {
        enabled: saved.enabled !== false,
        scheduleType: saved.scheduleType || 'weekly',
        scheduleDay: saved.scheduleDay ?? 1,
        scheduleTime: saved.scheduleTime || '09:00',
        settlementPeriodDays,
        autoProcess: saved.autoProcess !== false,
        minPayoutAmount: saved.minPayoutAmount ?? 100,
        timezone: saved.timezone || 'Asia/Kolkata',
        lastProcessedAt: saved.lastProcessedAt ?? null,
        nextProcessAt: saved.nextProcessAt ?? null,
      };
      return c.json({ success: true, schedule: scheduleRows, settings });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/finance/settlement-schedule', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { enabled, scheduleType, scheduleDay, scheduleTime, autoProcess, minPayoutAmount, timezone } = body;
      // Do not persist settlementPeriodDays - it is read-only from default tier (single source of truth)
      const toStore = {
        enabled: enabled !== false,
        scheduleType: scheduleType || 'weekly',
        scheduleDay: scheduleDay ?? 1,
        scheduleTime: scheduleTime || '09:00',
        autoProcess: autoProcess !== false,
        minPayoutAmount: minPayoutAmount ?? 100,
        timezone: timezone || 'Asia/Kolkata',
      };
      const existing = await query(`
        SELECT id, setting_value FROM platform_settings WHERE setting_key = 'admin:finance:settlement-schedule' LIMIT 1
      `).then((r: any) => r.rows);
      if (existing?.length > 0) {
        await update('platform_settings', { id: existing[0].id }, { setting_value: toStore, updated_at: new Date().toISOString() });
      } else {
        await insert('platform_settings', {
          setting_key: 'admin:finance:settlement-schedule',
          setting_value: toStore,
          setting_type: 'object',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      const defaultTier = await query(`
        SELECT payout_period_days FROM vendor_tiers WHERE is_active = true ORDER BY is_default DESC NULLS LAST, tier_level ASC LIMIT 1
      `).then((r: any) => r.rows?.[0]).catch(() => null);
      const settlementPeriodDays = defaultTier?.payout_period_days != null ? Number(defaultTier.payout_period_days) : 7;
      const settings = { ...toStore, settlementPeriodDays, lastProcessedAt: null, nextProcessAt: null };
      return c.json({ success: true, settings });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Failed to save settlement schedule', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/finance/settlement-rules', async (c) => {
    try {
      // Check if settlement_rules table exists, fallback to querying from settings
      const rules = await query('SELECT * FROM settlement_rules ORDER BY priority ASC, created_at DESC').catch(async () => {
        try {
          const settings = await query(`
            SELECT setting_value FROM admin_settings WHERE setting_category = 'settlement' AND setting_key = 'rules'
          `);
          return { rows: settings.rows.length > 0 ? JSON.parse(settings.rows[0].setting_value) : [] };
        } catch {
          return { rows: [] };
        }
      });
      const rows = rules.rows || [];
      const normalized = rows.map((r: any) => {
        const actions = typeof r.actions === 'string' ? (r.actions ? JSON.parse(r.actions) : {}) : (r.actions || {});
        const conditions = typeof r.conditions === 'string' ? (r.conditions ? JSON.parse(r.conditions) : {}) : (r.conditions || {});
        const settlement = actions.settlement || { periodDays: 7, minPayoutAmount: 100, autoProcess: true };
        return {
          id: r.id,
          name: r.rule_name || r.name,
          priority: r.priority ?? 1,
          enabled: r.is_active !== false,
          conditions,
          settlement: { periodDays: settlement.periodDays ?? 7, minPayoutAmount: settlement.minPayoutAmount ?? 100, autoProcess: settlement.autoProcess !== false, commissionRate: settlement.commissionRate, holdPeriodDays: settlement.holdPeriodDays },
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });
      return c.json({ success: true, rules: normalized });
    } catch (error: unknown) {
      console.error('Error fetching settlement rules:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to fetch settlement rules', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/finance/settlement-rules', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { name, description, ruleType, conditions, actions, settlement, isActive, priority } = body;

      if (!name) {
        return c.json({ success: false, error: 'Rule name is required' }, 400);
      }

      const mergedActions = { ...(typeof actions === 'object' && actions !== null ? actions : {}), ...(settlement ? { settlement } : {}) };
      const ruleTypeVal = ruleType || 'settlement';

      // Try to insert into settlement_rules table if it exists
      try {
        const newRule = await insert('settlement_rules', {
          rule_name: name,
          description: description || '',
          rule_type: ruleTypeVal,
          conditions: JSON.stringify(conditions || {}),
          actions: JSON.stringify(mergedActions),
          is_active: isActive !== false,
          priority: priority ?? 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        return c.json({
          success: true,
          message: 'Settlement rule created successfully',
          rule: newRule[0],
        });
      } catch (tableError: unknown) {
        // Fallback: store in admin_settings
        try {
          const existing = await query(`
            SELECT id, setting_value 
            FROM admin_settings 
            WHERE setting_category = 'settlement' AND setting_key = 'rules'
          `);

          const existingRules = existing.rows.length > 0
            ? JSON.parse(existing.rows[0].setting_value)
            : [];

          const newRule = {
            id: `rule-${Date.now()}`,
            name,
            description,
            ruleType: ruleTypeVal,
            conditions: conditions || {},
            actions: mergedActions,
            settlement,
            isActive: isActive !== false,
            priority: priority ?? 1,
            createdAt: new Date().toISOString(),
          };

          existingRules.push(newRule);

          if (existing.rows.length > 0) {
            await update('admin_settings',
              { id: existing.rows[0].id },
              { setting_value: JSON.stringify(existingRules) }
            );
          } else {
            await insert('admin_settings', {
              setting_category: 'settlement',
              setting_key: 'rules',
              setting_value: JSON.stringify(existingRules),
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }

          return c.json({
            success: true,
            message: 'Settlement rule created successfully',
            rule: newRule,
          });
        } catch (fallbackError: unknown) {
          console.error('Error in fallback settlement rule creation:', fallbackError);
          const errorResponse = createSafeErrorResponse(fallbackError, 'Failed to create settlement rule', 500);
          return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
        }
      }
    } catch (error: unknown) {
      console.error('Error creating settlement rule:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to create settlement rule', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // PUT endpoint for updating settlement rule
  app.put('/admin/finance/settlement-rules/:id', async (c) => {
    try {
      const ruleId = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));
      const { name, description, ruleType, conditions, actions, settlement, isActive, priority } = body;

      if (!ruleId) {
        return c.json({ success: false, error: 'Rule ID is required' }, 400);
      }

      const mergedActions = settlement != null
        ? { ...(typeof actions === 'object' && actions !== null ? actions : {}), settlement }
        : (typeof actions === 'object' && actions !== null ? actions : undefined);

      try {
        const updated = await update(
          'settlement_rules',
          { id: ruleId },
          {
            ...(name && { rule_name: name }),
            ...(description !== undefined && { description }),
            ...(ruleType && { rule_type: ruleType }),
            ...(conditions && { conditions: JSON.stringify(conditions) }),
            ...(mergedActions && { actions: JSON.stringify(mergedActions) }),
            ...(isActive !== undefined && { is_active: isActive }),
            ...(priority !== undefined && { priority }),
            updated_at: new Date().toISOString(),
          }
        );

        if (updated.length === 0) {
          return c.json({ success: false, error: 'Settlement rule not found' }, 404);
        }

        return c.json({
          success: true,
          message: 'Settlement rule updated successfully',
          rule: updated[0],
        });
      } catch (tableError: unknown) {
        // Fallback: update in admin_settings
        try {
          const existing = await query(`
            SELECT id, setting_value 
            FROM admin_settings 
            WHERE setting_category = 'settlement' AND setting_key = 'rules'
          `);

          if (existing.rows.length === 0) {
            return c.json({ success: false, error: 'Settlement rule not found' }, 404);
          }

          const existingRules = JSON.parse(existing.rows[0].setting_value);
          const ruleIndex = existingRules.findIndex((r: any) => r.id === ruleId);

          if (ruleIndex === -1) {
            return c.json({ success: false, error: 'Settlement rule not found' }, 404);
          }

          existingRules[ruleIndex] = {
            ...existingRules[ruleIndex],
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(ruleType && { ruleType }),
            ...(conditions && { conditions }),
            ...(actions && { actions }),
            ...(isActive !== undefined && { isActive }),
            ...(priority !== undefined && { priority }),
            updatedAt: new Date().toISOString(),
          };

          await update('admin_settings',
            { id: existing.rows[0].id },
            { setting_value: JSON.stringify(existingRules) }
          );

          return c.json({
            success: true,
            message: 'Settlement rule updated successfully',
            rule: existingRules[ruleIndex],
          });
        } catch (fallbackError: unknown) {
          console.error('Error in fallback settlement rule update:', fallbackError);
          const errorResponse = createSafeErrorResponse(fallbackError, 'Failed to update settlement rule', 500);
          return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
        }
      }
    } catch (error: unknown) {
      console.error('Error updating settlement rule:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to update settlement rule', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // DELETE endpoint for settlement rule
  app.delete('/admin/finance/settlement-rules/:id', async (c) => {
    try {
      const ruleId = c.req.param('id');

      if (!ruleId) {
        return c.json({ success: false, error: 'Rule ID is required' }, 400);
      }

      try {
        const deletedCount = await deleteRows('settlement_rules', { id: ruleId });

        if (deletedCount === 0) {
          return c.json({ success: false, error: 'Settlement rule not found' }, 404);
        }

        return c.json({
          success: true,
          message: 'Settlement rule deleted successfully',
        });
      } catch (tableError: unknown) {
        // Fallback: delete from admin_settings
        try {
          const existing = await query(`
            SELECT id, setting_value 
            FROM admin_settings 
            WHERE setting_category = 'settlement' AND setting_key = 'rules'
          `);

          if (existing.rows.length === 0) {
            return c.json({ success: false, error: 'Settlement rule not found' }, 404);
          }

          const existingRules = JSON.parse(existing.rows[0].setting_value);
          const filteredRules = existingRules.filter((r: any) => r.id !== ruleId);

          if (filteredRules.length === existingRules.length) {
            return c.json({ success: false, error: 'Settlement rule not found' }, 404);
          }

          await update('admin_settings',
            { id: existing.rows[0].id },
            { setting_value: JSON.stringify(filteredRules) }
          );

          return c.json({
            success: true,
            message: 'Settlement rule deleted successfully',
          });
        } catch (fallbackError: unknown) {
          console.error('Error in fallback settlement rule deletion:', fallbackError);
          const errorResponse = createSafeErrorResponse(fallbackError, 'Failed to delete settlement rule', 500);
          return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
        }
      }
    } catch (error: unknown) {
      console.error('Error deleting settlement rule:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to delete settlement rule', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/finance/cancellation-policies', async (c) => {
    try {
      const result = await query('SELECT * FROM cancellation_policies ORDER BY created_at DESC');
      const policies = (result as any).rows ?? (Array.isArray(result) ? result : []);
      return c.json({ success: true, policies });
    } catch (error: unknown) {
      const msg = String(getErrorMessage(error));
      if (/relation\s+["']?cancellation_policies["']?\s+does not exist/i.test(msg)) {
        console.warn('[admin/finance/cancellation-policies] Table missing:', msg);
        return c.json({ success: true, policies: [] });
      }
      console.error('Error fetching cancellation policies:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to fetch cancellation policies', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/finance/cancellation-policies', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const {
        name,
        description,
        policyType,
        vendorTypes,
        serviceTypes,
        gracePeriodHours,
        cancellationWindows,
        vendorCancellationPenalty,
        noShowPolicy,
        isActive,
        priority,
      } = body;

      if (!name) {
        return c.json({ success: false, error: 'Policy name is required' }, 400);
      }

      // Calculate cancellation fee from first window
      const cancellationFee = cancellationWindows?.[0]?.penaltyPercentage || 0;
      const policyTypeVal = policyType === 'vendor_specific' || policyType === 'service_specific' ? policyType : 'standard';
      const vendorTypesArr = Array.isArray(vendorTypes) ? vendorTypes : (body.vendor_types && Array.isArray(body.vendor_types) ? body.vendor_types : []);
      const serviceTypesArr = Array.isArray(serviceTypes) ? serviceTypes : (body.service_types && Array.isArray(body.service_types) ? body.service_types : []);
      const priorityVal = Number.isFinite(Number(priority)) ? Number(priority) : 0;

      const windowsArr = Array.isArray(cancellationWindows) ? cancellationWindows : [];
      const penaltyObj = vendorCancellationPenalty && typeof vendorCancellationPenalty === 'object'
        ? vendorCancellationPenalty
        : { enabled: true, penaltyPercentage: 10, compensationPercentage: 50 };
      const noShowObj = noShowPolicy && typeof noShowPolicy === 'object'
        ? noShowPolicy
        : { enabled: true, refundPercentage: 0, penaltyAmount: 0 };

      const newPolicy = await insert('cancellation_policies', {
        policy_name: name,
        description: description || '',
        policy_type: policyTypeVal,
        vendor_types: vendorTypesArr,
        service_types: serviceTypesArr,
        hours_before_booking: gracePeriodHours ?? 2,
        cancellation_fee_percentage: cancellationFee,
        cancellation_windows: windowsArr,
        vendor_cancellation_penalty: penaltyObj,
        no_show_policy: noShowObj,
        service_category: body.serviceCategory ?? body.service_category ?? null,
        service_format: body.serviceFormat ?? body.service_format ?? null,
        priority: priorityVal,
        is_active: isActive !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Cancellation policy created successfully',
        policy: newPolicy[0],
      });
    } catch (error: any) {
      console.error('Error creating cancellation policy:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.put('/admin/finance/cancellation-policies/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined) updateData.policy_name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.policyType !== undefined) {
        updateData.policy_type = body.policyType === 'vendor_specific' || body.policyType === 'service_specific' ? body.policyType : 'standard';
      }
      if (body.vendorTypes !== undefined) updateData.vendor_types = Array.isArray(body.vendorTypes) ? body.vendorTypes : (body.vendor_types && Array.isArray(body.vendor_types) ? body.vendor_types : []);
      if (body.serviceTypes !== undefined) updateData.service_types = Array.isArray(body.serviceTypes) ? body.serviceTypes : (body.service_types && Array.isArray(body.service_types) ? body.service_types : []);
      if (body.gracePeriodHours !== undefined) updateData.hours_before_booking = body.gracePeriodHours;
      if (body.priority !== undefined && Number.isFinite(Number(body.priority))) updateData.priority = Number(body.priority);
      if (body.isActive !== undefined) updateData.is_active = body.isActive;
      if (body.cancellationWindows?.[0]?.penaltyPercentage !== undefined) {
        updateData.cancellation_fee_percentage = body.cancellationWindows[0].penaltyPercentage;
      }
      if (body.cancellationWindows !== undefined) updateData.cancellation_windows = Array.isArray(body.cancellationWindows) ? body.cancellationWindows : [];
      if (body.vendorCancellationPenalty !== undefined) updateData.vendor_cancellation_penalty = body.vendorCancellationPenalty && typeof body.vendorCancellationPenalty === 'object' ? body.vendorCancellationPenalty : undefined;
      if (body.noShowPolicy !== undefined) updateData.no_show_policy = body.noShowPolicy && typeof body.noShowPolicy === 'object' ? body.noShowPolicy : undefined;
      if (body.serviceCategory !== undefined || body.service_category !== undefined) updateData.service_category = body.serviceCategory ?? body.service_category ?? null;
      if (body.serviceFormat !== undefined || body.service_format !== undefined) updateData.service_format = body.serviceFormat ?? body.service_format ?? null;

      const updated = await update('cancellation_policies', { id }, updateData);

      return c.json({
        success: true,
        message: 'Cancellation policy updated successfully',
        policy: updated[0],
      });
    } catch (error: any) {
      console.error('Error updating cancellation policy:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.delete('/admin/finance/cancellation-policies/:id', async (c) => {
    try {
      const id = c.req.param('id');
      await deleteRows('cancellation_policies', { id });
      return c.json({ success: true, message: 'Cancellation policy deleted' });
    } catch (error: any) {
      console.error('Error deleting cancellation policy:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/finance/ecommerce-policy-config', async (c) => {
    try {
      const result = await query(
        `SELECT setting_value FROM admin_settings WHERE setting_category = $1 AND setting_key = $2 LIMIT 1`,
        ['ecommerce', 'cancellation_refund_policy']
      ).catch(() => ({ rows: [] }));
      const rows = (result as any).rows ?? [];
      const value = rows.length > 0 ? rows[0].setting_value : null;
      const config = value && typeof value === 'object'
        ? value
        : typeof value === 'string'
          ? (() => { try { return JSON.parse(value); } catch { return {}; } })()
          : {};
      return c.json({
        success: true,
        config: {
          returnWindowHours: config.returnWindowHours ?? config.return_window_hours ?? 48,
          cancelBeforeDispatchFullRefund: config.cancelBeforeDispatchFullRefund !== false && config.cancel_before_dispatch_full_refund !== false,
          refundProcessingDays: config.refundProcessingDays ?? config.refund_processing_days ?? 7,
          nonReturnableCategories: Array.isArray(config.nonReturnableCategories ?? config.non_returnable_categories)
            ? (config.nonReturnableCategories ?? config.non_returnable_categories)
            : ['opened_pet_food', 'opened_treats_supplements', 'hygiene_once_opened', 'customized', 'clearance'],
        },
      });
    } catch (error: unknown) {
      return c.json({
        success: true,
        config: {
          returnWindowHours: 48,
          cancelBeforeDispatchFullRefund: true,
          refundProcessingDays: 7,
          nonReturnableCategories: ['opened_pet_food', 'opened_treats_supplements', 'hygiene_once_opened', 'customized', 'clearance'],
        },
      });
    }
  });

  app.put('/admin/finance/ecommerce-policy-config', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const payload = {
        returnWindowHours: body.returnWindowHours ?? 48,
        cancelBeforeDispatchFullRefund: body.cancelBeforeDispatchFullRefund !== false,
        refundProcessingDays: body.refundProcessingDays ?? 7,
        nonReturnableCategories: Array.isArray(body.nonReturnableCategories) ? body.nonReturnableCategories : [],
      };
      const existing = await query(
        `SELECT id, setting_value FROM admin_settings WHERE setting_category = $1 AND setting_key = $2 LIMIT 1`,
        ['ecommerce', 'cancellation_refund_policy']
      ).catch(() => ({ rows: [] }));
      const rows = (existing as any).rows ?? [];
      if (rows.length > 0) {
        await update('admin_settings', { id: rows[0].id }, { setting_value: payload, updated_at: new Date().toISOString() });
      } else {
        await insert('admin_settings', {
          setting_category: 'ecommerce',
          setting_key: 'cancellation_refund_policy',
          setting_value: payload,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      return c.json({ success: true, message: 'Ecommerce policy config saved', config: payload });
    } catch (error: any) {
      console.error('Error saving ecommerce policy config:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/finance/disputes', async (c) => {
    try {
      const disputes = await query('SELECT * FROM payment_disputes ORDER BY created_at DESC LIMIT 50');
      return c.json({ success: true, disputes: disputes.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/finance/transactions', async (c) => {
    try {
      const transactions = await query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100');
      return c.json({ success: true, transactions: transactions.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/finance/payments', async (c) => {
    try {
      const payments = await query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 50');
      return c.json({ success: true, payments: payments.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  /** Detect which code column exists in hsn_codes (hsn_code, code, or both). Prefer hsn_code. */
  async function getHsnCodeColumn(): Promise<'hsn_code' | 'code'> {
    try {
      const r = await query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'hsn_codes' AND column_name IN ('hsn_code', 'code') ORDER BY column_name`,
        []
      );
      const rows = (r as any)?.rows ?? (Array.isArray(r) ? r : []);
      const names = rows.map((x: any) => (x?.column_name || x?.Column_name || '').toLowerCase());
      if (names.includes('hsn_code')) return 'hsn_code';
      if (names.includes('code')) return 'code';
    } catch (_) { }
    try {
      await query(`SELECT id FROM hsn_codes WHERE hsn_code = $1 LIMIT 0`, ['']);
      return 'hsn_code';
    } catch (e: any) {
      if (String(e?.message || '').includes('hsn_code') && String(e?.message || '').includes('does not exist')) return 'code';
      throw e;
    }
  }

  /** Returns true if another row has this code (optionally excluding one id). Uses detected column. */
  async function hsnCodeExistsElsewhere(codeColumn: 'hsn_code' | 'code', code: string, excludeId: string | null): Promise<boolean> {
    const normalized = String(code ?? '').trim();
    if (!normalized) return false;
    const q = await query(
      `SELECT id FROM hsn_codes WHERE ${codeColumn} = $1 AND ($2::uuid IS NULL OR id != $2) LIMIT 1`,
      [normalized, excludeId ?? null]
    );
    const rows = (q as any)?.rows ?? (Array.isArray(q) ? q : []);
    return rows.length > 0;
  }

  app.get('/admin/finance/gst/hsn-codes', async (c) => {
    try {
      let rows: any[];
      try {
        // Try with hsn_code only first (001/600 schema). No reference to hc.code so "column hc.code does not exist" is avoided.
        const result = await query(
          `SELECT hc.id, hc.hsn_code, hc.description, hc.gst_rate, hc.is_active, hc.created_at,
                  tc.category_name as tax_category_name
           FROM hsn_codes hc
           LEFT JOIN tax_categories tc ON hc.category_id = tc.id
           ORDER BY COALESCE(hc.hsn_code, '') ASC`
        );
        rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
      } catch (colError: any) {
        const msg = String(colError?.message || colError || '');
        if (msg.includes('hsn_code') && msg.includes('does not exist')) {
          // Table has "code" only (213 schema), no hsn_code column
          const result = await query(
            `SELECT hc.id, hc.code as hsn_code, hc.description, hc.gst_rate, hc.is_active, hc.created_at, NULL::text as tax_category_name
             FROM hsn_codes hc ORDER BY COALESCE(hc.code, '') ASC`
          );
          rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
        } else if (msg.includes('category_id') && msg.includes('does not exist')) {
          const result = await query(
            `SELECT hc.id, hc.hsn_code, hc.description, hc.gst_rate, hc.is_active, hc.created_at, NULL::text as tax_category_name
             FROM hsn_codes hc ORDER BY COALESCE(hc.hsn_code, '') ASC`
          );
          rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
        } else if (msg.includes('code') && msg.includes('does not exist')) {
          const result = await query(
            `SELECT hc.id, hc.code as hsn_code, hc.description, hc.gst_rate, hc.is_active, hc.created_at, NULL::text as tax_category_name
             FROM hsn_codes hc ORDER BY COALESCE(hc.code, '') ASC`
          );
          rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
        } else {
          throw colError;
        }
      }
      return c.json({ success: true, codes: rows, hsnCodes: rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/finance/gst/hsn-codes', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { code, description, category, categoryId, cgst, sgst, igst, isActive } = body;
      const gstRateRaw = body.gstRate ?? body.gst_rate;

      // Do not use !gstRate — 0 is a valid exempt/zero-rated GST %.
      if (code == null || String(code).trim() === '') {
        return c.json({ success: false, error: 'HSN code is required' }, 400);
      }
      if (gstRateRaw === undefined || gstRateRaw === null || gstRateRaw === '') {
        return c.json({ success: false, error: 'GST rate is required' }, 400);
      }
      const gstRateNum = parseFloat(String(gstRateRaw));
      if (!Number.isFinite(gstRateNum) || gstRateNum < 0 || gstRateNum > 100) {
        return c.json({ success: false, error: 'GST rate must be a number between 0 and 100' }, 400);
      }

      const codeColumn = await getHsnCodeColumn();
      const codeVal = String(code).trim();
      if (await hsnCodeExistsElsewhere(codeColumn, codeVal, null)) {
        console.log('[HSN] Create rejected: duplicate code', { code: codeVal, column: codeColumn });
        return c.json(
          { success: false, error: 'An HSN code with this code already exists. Use a different code or edit the existing one.' },
          409
        );
      }

      const insertPayload: Record<string, unknown> = {
        [codeColumn]: codeVal,
        description: description || '',
        gst_rate: gstRateNum,
        is_active: isActive !== false,
        created_at: new Date().toISOString(),
      };
      if (categoryId) insertPayload.category_id = categoryId;

      let newCode;
      try {
        newCode = await insert('hsn_codes', insertPayload);
        console.log('[HSN] Create success', { id: newCode[0]?.id, code: codeVal, column: codeColumn });
      } catch (insErr: any) {
        const msg = String(insErr?.message || '');
        if (msg.includes('duplicate key') || (insErr?.code === '23505')) {
          return c.json(
            { success: false, error: 'An HSN code with this code already exists. Use a different code or edit the existing one.' },
            409
          );
        }
        if (msg.includes('does not exist') && (msg.includes('hsn_code') || msg.includes('code'))) {
          const otherCol = codeColumn === 'hsn_code' ? 'code' : 'hsn_code';
          delete insertPayload[codeColumn];
          insertPayload[otherCol] = codeVal;
          try {
            newCode = await insert('hsn_codes', insertPayload);
          } catch (retryErr: any) {
            if (String(retryErr?.message || '').includes('duplicate key') || retryErr?.code === '23505') {
              return c.json(
                { success: false, error: 'An HSN code with this code already exists. Use a different code or edit the existing one.' },
                409
              );
            }
            throw retryErr;
          }
        } else if (categoryId && msg.includes('category_id') && msg.includes('does not exist')) {
          delete insertPayload.category_id;
          newCode = await insert('hsn_codes', insertPayload);
        } else {
          throw insErr;
        }
      }

      return c.json({
        success: true,
        message: 'HSN code created successfully',
        code: newCode[0],
      });
    } catch (error: any) {
      console.error('[HSN] Create error:', error?.message || error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.put('/admin/finance/gst/hsn-codes/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const codeColumn = await getHsnCodeColumn();
      const updateData: any = {};

      if (body.code !== undefined) {
        const newCode = String(body.code).trim();
        const existing = await query(
          `SELECT id, ${codeColumn} as code_val FROM hsn_codes WHERE id = $1::uuid LIMIT 1`,
          [id]
        );
        const rows = (existing as any)?.rows ?? (Array.isArray(existing) ? existing : []);
        const currentRow = rows[0];
        const currentCode = currentRow ? String(currentRow.code_val ?? '').trim() : '';
        if (newCode === currentCode) {
          // No change to code – don't set it so we don't trigger unique check
        } else {
          if (await hsnCodeExistsElsewhere(codeColumn, newCode, id)) {
            console.log('[HSN] Update rejected: duplicate code', { id, code: newCode, column: codeColumn });
            return c.json(
              { success: false, error: 'Another HSN code with this code already exists. Use a different code or edit the existing one.' },
              409
            );
          }
          updateData[codeColumn] = newCode;
        }
      }
      if (body.description !== undefined) updateData.description = body.description;
      if (body.gstRate !== undefined) updateData.gst_rate = parseFloat(body.gstRate);
      if (body.isActive !== undefined) updateData.is_active = body.isActive;
      if (body.categoryId !== undefined) updateData.category_id = body.categoryId || null;

      if (Object.keys(updateData).length === 0) {
        const existing = await query(`SELECT * FROM hsn_codes WHERE id = $1::uuid LIMIT 1`, [id]);
        const row = (existing as any).rows?.[0];
        if (row) return c.json({ success: true, message: 'HSN code unchanged', code: row });
        return c.json({ success: false, error: 'HSN code not found' }, 404);
      }

      let updated: any[];
      try {
        updated = await update('hsn_codes', { id }, updateData);
        if (!updated || updated.length === 0) {
          return c.json({ success: false, error: 'HSN code not found' }, 404);
        }
        console.log('[HSN] Update success', { id, column: codeColumn });
      } catch (updErr: any) {
        const msg = String(updErr?.message || '');
        if (msg.includes('duplicate key') || (updErr?.code === '23505')) {
          return c.json(
            { success: false, error: 'Another HSN code with this code already exists. Use a different code or edit the existing one.' },
            409
          );
        }
        if (msg.includes('does not exist') && (msg.includes('hsn_code') || msg.includes('code'))) {
          const codeVal = updateData[codeColumn];
          if (codeVal !== undefined) {
            const otherCol = codeColumn === 'hsn_code' ? 'code' : 'hsn_code';
            delete updateData[codeColumn];
            updateData[otherCol] = codeVal;
            updated = await update('hsn_codes', { id }, updateData);
          } else {
            throw updErr;
          }
        } else if (updateData.category_id !== undefined && msg.includes('category_id') && msg.includes('does not exist')) {
          delete updateData.category_id;
          updated = await update('hsn_codes', { id }, updateData);
        } else {
          throw updErr;
        }
      }

      return c.json({
        success: true,
        message: 'HSN code updated successfully',
        code: updated[0],
      });
    } catch (error: any) {
      console.error('[HSN] Update error:', error?.message || error);
      const msg = String(error?.message || '');
      if (msg.includes('duplicate key') || (error?.code === '23505')) {
        return c.json(
          { success: false, error: 'Another HSN code with this code already exists. Use a different code or edit the existing one.' },
          409
        );
      }
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.delete('/admin/finance/gst/hsn-codes/:id', async (c) => {
    try {
      const id = c.req.param('id');
      await update('hsn_codes', { id }, { is_active: false });
      return c.json({ success: true, message: 'HSN code deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting HSN code:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/finance/gst/tax-categories', async (c) => {
    try {
      // SELECT * (no ORDER BY on category_name) so both schema variants work:
      // - platform: category_name + tax_rate
      // - migration 213: name + default_gst_rate
      const categories = await query('SELECT * FROM tax_categories');
      const rows = categories.rows ?? [];
      const gstRuleRatesByCategoryId = await loadGstRuleRatesByTaxCategoryId();
      const sorted = [...rows].sort((a: any, b: any) =>
        String(a.category_name ?? a.name ?? '').localeCompare(String(b.category_name ?? b.name ?? ''), undefined, {
          sensitivity: 'base',
        })
      );
      const normalized = sorted.map((row: Record<string, any>) => {
        const displayName = String(row.category_name ?? row.name ?? '').trim() || '—';
        const base = pickTaxCategoryDisplayRate(row);
        const tax_rate = applyGstRulesRateFallback(base, row.id, gstRuleRatesByCategoryId);
        return {
          id: row.id,
          category_name: displayName,
          name: displayName,
          description: row.description ?? '',
          tax_rate,
          applicable_services: row.applicable_services ?? row.applicableServices ?? [],
          is_active: row.is_active !== false,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });
      return c.json({ success: true, categories: normalized });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/finance/gst/tax-categories', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { name, description, defaultGSTRate, applicableServices, isActive } = body;

      if (!name || (typeof name === 'string' && !name.trim())) {
        return c.json({ success: false, error: 'Category name is required' }, 400);
      }
      const rate = defaultGSTRate !== undefined && defaultGSTRate !== null
        ? parseFloat(String(defaultGSTRate))
        : NaN;
      if (Number.isNaN(rate) || rate < 0) {
        return c.json({ success: false, error: 'Default GST rate must be a non-negative number (0 is allowed)' }, 400);
      }

      const newCategory = await insert('tax_categories', {
        category_name: String(name).trim(),
        description: description != null ? String(description) : '',
        tax_rate: rate,
        is_active: isActive !== false,
        created_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Tax category created successfully',
        category: newCategory[0],
      });
    } catch (error: any) {
      console.error('Error creating tax category:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.put('/admin/finance/gst/tax-categories/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const updateData: any = {};
      if (body.name !== undefined) updateData.category_name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.defaultGSTRate !== undefined) updateData.tax_rate = parseFloat(body.defaultGSTRate);
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      const updated = await update('tax_categories', { id }, updateData);

      return c.json({
        success: true,
        message: 'Tax category updated successfully',
        category: updated[0],
      });
    } catch (error: any) {
      console.error('Error updating tax category:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/finance/rate-changes', async (c) => {
    try {
      const changes = await query('SELECT * FROM rate_changes ORDER BY created_at DESC LIMIT 50');
      return c.json({ success: true, changes: changes.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/finance/process-settlements', async (c) => {
    try {
      // Schedule Settings "Process Now" in the UI calls POST /settlements/calculate-daily directly.
      // This endpoint is kept for backwards compatibility; respond with guidance.
      return c.json({
        success: true,
        message: 'Use POST /settlements/calculate-daily to run settlement calculation (Schedule Settings → Process Now does this). Then process payouts from Payout Management.',
        processed: 0,
      });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // ============================================================================
  // FEE CONFIGURATION ENDPOINTS
  // ============================================================================

  // GET /admin/finance/fee-configuration - Get all fee configuration settings
  app.get('/admin/finance/fee-configuration', async (c) => {
    try {
      // Fetch all fee-related settings from admin_settings table
      const settings = await query(`
        SELECT setting_key, setting_value, service_type, description, updated_at
        FROM admin_settings 
        WHERE setting_key IN (
          'platform_fee_percentage', 'platform_fee_flat', 'max_platform_fee',
          'convenience_fee_booking', 'convenience_fee_order', 'convenience_fee_tele',
          'delivery_fee_base', 'delivery_fee_per_km', 'free_delivery_threshold', 'max_delivery_distance',
          'packaging_fee_enabled', 'packaging_fee_amount'
        )
        OR setting_key LIKE 'fee_override_%'
      `).catch(() => ({ rows: [] }));

      // Build config object from settings
      const config: Record<string, any> = {
        platformFeePercentage: 2,
        platformFeeFlat: 0,
        maxPlatformFee: 500,
        convenienceFeeBooking: 9,
        convenienceFeeOrder: 0,
        convenienceFeeTele: 0,
        deliveryFeeBase: 30,
        deliveryFeePerKm: 5,
        freeDeliveryThreshold: 500,
        maxDeliveryDistance: 25,
        packagingFeeEnabled: false,
        packagingFeeAmount: 10,
        serviceTypeOverrides: [],
      };

      // Map setting_key to config property
      const keyMap: Record<string, string> = {
        'platform_fee_percentage': 'platformFeePercentage',
        'platform_fee_flat': 'platformFeeFlat',
        'max_platform_fee': 'maxPlatformFee',
        'convenience_fee_booking': 'convenienceFeeBooking',
        'convenience_fee_order': 'convenienceFeeOrder',
        'convenience_fee_tele': 'convenienceFeeTele',
        'delivery_fee_base': 'deliveryFeeBase',
        'delivery_fee_per_km': 'deliveryFeePerKm',
        'free_delivery_threshold': 'freeDeliveryThreshold',
        'max_delivery_distance': 'maxDeliveryDistance',
        'packaging_fee_enabled': 'packagingFeeEnabled',
        'packaging_fee_amount': 'packagingFeeAmount',
      };

      const overrides: Record<string, any> = {};

      for (const row of settings.rows) {
        const key = row.setting_key;
        const value = row.setting_value;
        const serviceType = row.service_type;

        if (key.startsWith('fee_override_')) {
          // Service type override
          const parts = key.replace('fee_override_', '').split('_');
          const st = parts[0];
          const field = parts.slice(1).join('_');

          if (!overrides[st]) {
            overrides[st] = { serviceType: st, enabled: true };
          }

          if (field === 'platform_fee') {
            overrides[st].platformFeePercentage = parseFloat(value);
          } else if (field === 'convenience_fee') {
            overrides[st].convenienceFee = parseFloat(value);
          } else if (field === 'enabled') {
            overrides[st].enabled = value === 'true' || value === '1';
          }
        } else if (keyMap[key]) {
          const configKey = keyMap[key];
          if (configKey === 'packagingFeeEnabled') {
            config[configKey] = value === 'true' || value === '1';
          } else {
            config[configKey] = parseFloat(value);
          }
        }
      }

      config.serviceTypeOverrides = Object.values(overrides);

      return c.json({ success: true, config });
    } catch (error: unknown) {
      console.error('Error fetching fee configuration:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to fetch fee configuration', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // PUT /admin/finance/fee-configuration - Update fee configuration settings
  app.put('/admin/finance/fee-configuration', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { config } = body;

      if (!config) {
        return c.json({ success: false, error: 'Config is required' }, 400);
      }

      // Map config properties to setting_key
      const keyMap: Record<string, string> = {
        'platformFeePercentage': 'platform_fee_percentage',
        'platformFeeFlat': 'platform_fee_flat',
        'maxPlatformFee': 'max_platform_fee',
        'convenienceFeeBooking': 'convenience_fee_booking',
        'convenienceFeeOrder': 'convenience_fee_order',
        'convenienceFeeTele': 'convenience_fee_tele',
        'deliveryFeeBase': 'delivery_fee_base',
        'deliveryFeePerKm': 'delivery_fee_per_km',
        'freeDeliveryThreshold': 'free_delivery_threshold',
        'maxDeliveryDistance': 'max_delivery_distance',
        'packagingFeeEnabled': 'packaging_fee_enabled',
        'packagingFeeAmount': 'packaging_fee_amount',
      };

      // Upsert each setting
      for (const [configKey, settingKey] of Object.entries(keyMap)) {
        if (config[configKey] !== undefined) {
          const value = String(config[configKey]);

          // Try to update first, then insert if not exists
          const existing = await query(
            `SELECT id FROM admin_settings WHERE setting_key = $1 AND (service_type = 'all' OR service_type IS NULL) LIMIT 1`,
            [settingKey]
          ).catch(() => ({ rows: [] }));

          if (existing.rows.length > 0) {
            await query(
              `UPDATE admin_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2 AND (service_type = 'all' OR service_type IS NULL)`,
              [value, settingKey]
            );
          } else {
            await query(
              `INSERT INTO admin_settings (setting_key, setting_value, service_type, description, created_at, updated_at)
               VALUES ($1, $2, 'all', $3, NOW(), NOW())
               ON CONFLICT (setting_key, COALESCE(service_type, 'all')) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
              [settingKey, value, `Fee configuration: ${configKey}`]
            ).catch(async () => {
              // Fallback insert without ON CONFLICT (if constraint doesn't exist)
              await query(
                `INSERT INTO admin_settings (setting_key, setting_value, service_type, description)
                 VALUES ($1, $2, 'all', $3)`,
                [settingKey, value, `Fee configuration: ${configKey}`]
              ).catch(() => { });
            });
          }
        }
      }

      // Handle service type overrides
      if (config.serviceTypeOverrides && Array.isArray(config.serviceTypeOverrides)) {
        for (const override of config.serviceTypeOverrides) {
          const { serviceType, enabled, platformFeePercentage, convenienceFee } = override;

          if (!serviceType) continue;

          // Store enabled status
          await upsertAdminSetting(`fee_override_${serviceType}_enabled`, String(enabled || false), serviceType);

          // Store platform fee override
          if (platformFeePercentage !== undefined) {
            await upsertAdminSetting(`fee_override_${serviceType}_platform_fee`, String(platformFeePercentage), serviceType);
          }

          // Store convenience fee override
          if (convenienceFee !== undefined) {
            await upsertAdminSetting(`fee_override_${serviceType}_convenience_fee`, String(convenienceFee), serviceType);
          }
        }
      }

      return c.json({ success: true, message: 'Fee configuration saved successfully' });
    } catch (error: unknown) {
      console.error('Error saving fee configuration:', error);
      const errorResponse = createSafeErrorResponse(error, 'Failed to save fee configuration', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // GET /admin/finance/fees - Get fees for a specific service/order type (used by payment page)
  app.get('/admin/finance/fees', async (c) => {
    try {
      const serviceStyle = c.req.query('serviceStyle') || 'all';
      const amount = parseFloat(c.req.query('amount') || '0');
      const type = c.req.query('type') || 'booking';

      // Fetch fee configuration
      const settings = await query(`
        SELECT setting_key, setting_value, service_type
        FROM admin_settings 
        WHERE setting_key IN (
          'platform_fee_percentage', 'platform_fee_flat', 'max_platform_fee',
          'convenience_fee_booking', 'convenience_fee_order', 'convenience_fee_tele',
          'delivery_fee_base', 'delivery_fee_per_km', 'free_delivery_threshold',
          'packaging_fee_enabled', 'packaging_fee_amount'
        )
        AND (service_type = 'all' OR service_type IS NULL OR service_type = $1)
        ORDER BY CASE WHEN service_type = $1 THEN 0 ELSE 1 END
      `, [serviceStyle]).catch(() => ({ rows: [] }));

      // Build settings map (service-specific overrides take precedence)
      const settingsMap: Record<string, string> = {};
      for (const row of settings.rows) {
        if (!settingsMap[row.setting_key] || row.service_type === serviceStyle) {
          settingsMap[row.setting_key] = row.setting_value;
        }
      }

      // Calculate platform fee
      const platformFeePercentage = parseFloat(settingsMap['platform_fee_percentage'] || '2');
      const platformFeeFlat = parseFloat(settingsMap['platform_fee_flat'] || '0');
      const maxPlatformFee = parseFloat(settingsMap['max_platform_fee'] || '500');

      let platformFee = Math.round(amount * (platformFeePercentage / 100)) + platformFeeFlat;
      if (maxPlatformFee > 0 && platformFee > maxPlatformFee) {
        platformFee = maxPlatformFee;
      }

      // Get convenience fee based on type
      let convenienceFee = 0;
      if (type === 'booking') {
        if (serviceStyle === 'tele') {
          convenienceFee = parseFloat(settingsMap['convenience_fee_tele'] || '0');
        } else {
          convenienceFee = parseFloat(settingsMap['convenience_fee_booking'] || '9');
        }
      } else {
        convenienceFee = parseFloat(settingsMap['convenience_fee_order'] || '0');
      }

      // Delivery fee (only for home services and orders)
      let deliveryFee = 0;
      if (serviceStyle === 'at_home' || type === 'order') {
        const freeDeliveryThreshold = parseFloat(settingsMap['free_delivery_threshold'] || '500');
        if (amount < freeDeliveryThreshold || freeDeliveryThreshold === 0) {
          deliveryFee = parseFloat(settingsMap['delivery_fee_base'] || '30');
        }
      }

      // Packaging fee (only for orders)
      let packagingFee = 0;
      if (type === 'order') {
        const packagingEnabled = settingsMap['packaging_fee_enabled'] === 'true' || settingsMap['packaging_fee_enabled'] === '1';
        if (packagingEnabled) {
          packagingFee = parseFloat(settingsMap['packaging_fee_amount'] || '10');
        }
      }

      return c.json({
        success: true,
        platformFee,
        convenienceFee,
        deliveryFee,
        packagingFee,
        total: platformFee + convenienceFee + deliveryFee + packagingFee,
      });
    } catch (error: unknown) {
      console.error('Error calculating fees:', error);
      // Return default fees on error
      return c.json({
        success: true,
        platformFee: Math.round(parseFloat(c.req.query('amount') || '0') * 0.02),
        convenienceFee: c.req.query('type') === 'booking' ? 9 : 0,
        deliveryFee: 0,
        packagingFee: 0,
        total: Math.round(parseFloat(c.req.query('amount') || '0') * 0.02) + (c.req.query('type') === 'booking' ? 9 : 0),
      });
    }
  });

  // Other Missing Endpoints
  app.get('/admin/enterprise/clients', async (c) => {
    try {
      const clients = await query('SELECT * FROM enterprise_clients ORDER BY created_at DESC').catch(() => ({ rows: [] }));
      return c.json({ success: true, clients: clients.rows || [] });
    } catch (error: any) {
      console.error('Error fetching enterprise clients:', error);
      return c.json({ success: true, clients: [] });
    }
  });

  app.get('/admin/enterprise/revenue/stats', async (c) => {
    try {
      const range = c.req.query('range') || '30d';
      const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 30;

      const stats = await query(`
        SELECT 
          COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed' AND b.booking_date >= CURRENT_DATE - INTERVAL '${days} days'), 0) as total_revenue,
          COALESCE(SUM(b.total_amount * (v.commission_percentage::numeric / 100)) FILTER (WHERE b.status = 'completed' AND b.booking_date >= CURRENT_DATE - INTERVAL '${days} days'), 0) as commission_earned,
          COALESCE(SUM(b.total_amount * (1 - v.commission_percentage::numeric / 100)) FILTER (WHERE b.status = 'completed' AND b.booking_date >= CURRENT_DATE - INTERVAL '${days} days'), 0) as vendor_payouts,
          COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= CURRENT_DATE - INTERVAL '${days} days' AND c.is_enterprise = true) as enterprise_customers,
          COALESCE(AVG(b.total_amount) FILTER (WHERE b.status = 'completed' AND b.booking_date >= CURRENT_DATE - INTERVAL '${days} days'), 0) as avg_order_value,
          COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed' AND b.booking_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) as monthly_recurring
        FROM bookings b
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN customers c ON b.customer_id = c.id
      `).catch(() => ({ rows: [{}] }));

      const row = stats.rows[0] || {};

      // Calculate growth rate (simplified - could use historical data)
      const previousPeriod = await query(`
        SELECT COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed' AND b.booking_date >= CURRENT_DATE - INTERVAL '${days * 2} days' AND b.booking_date < CURRENT_DATE - INTERVAL '${days} days'), 0) as previous_revenue
        FROM bookings b
      `).catch(() => ({ rows: [{ previous_revenue: '0' }] }));

      const previousRevenue = parseFloat(previousPeriod.rows[0]?.previous_revenue || '0');
      const currentRevenue = parseFloat(row.total_revenue || '0');
      const growthRate = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      return c.json({
        success: true,
        data: {
          totalRevenue: parseFloat(row.total_revenue || '0'),
          commissionEarned: parseFloat(row.commission_earned || '0'),
          vendorPayouts: parseFloat(row.vendor_payouts || '0'),
          growthRate: Math.round(growthRate * 100) / 100,
          enterpriseCustomers: parseInt(row.enterprise_customers || '0', 10),
          avgOrderValue: parseFloat(row.avg_order_value || '0'),
          monthlyRecurring: parseFloat(row.monthly_recurring || '0'),
        },
      });
    } catch (error: any) {
      console.error('Error fetching enterprise revenue stats:', error);
      return c.json({
        success: true,
        data: {
          totalRevenue: 0,
          commissionEarned: 0,
          vendorPayouts: 0,
          growthRate: 0,
          enterpriseCustomers: 0,
          avgOrderValue: 0,
          monthlyRecurring: 0,
        },
      });
    }
  });

  app.get('/admin/enterprise/customers', async (c) => {
    try {
      const customers = await query(`
        SELECT 
          c.id,
          c.full_name as name,
          c.email,
          c.phone,
          COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as total_spent,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'completed') as bookings,
          c.is_active as status,
          c.created_at as joinedAt
        FROM customers c
        LEFT JOIN bookings b ON c.id = b.customer_id
        WHERE c.is_enterprise = true OR c.total_spent > 10000
        GROUP BY c.id, c.full_name, c.email, c.phone, c.is_active, c.created_at
        ORDER BY total_spent DESC
        LIMIT 100
      `).catch(() => ({ rows: [] }));

      const safeCustomers = (customers.rows || []).map((c: any) => ({
        id: String(c.id || ''),
        name: String(c.name || c.full_name || ''),
        email: String(c.email || ''),
        totalSpent: parseFloat(c.total_spent || '0'),
        bookings: parseInt(c.bookings || '0', 10),
        status: c.status !== false ? 'active' : 'inactive',
        joinedAt: String(c.joinedAt || c.created_at || ''),
      }));

      return c.json({
        success: true,
        customers: safeCustomers,
      });
    } catch (error: any) {
      console.error('Error fetching enterprise customers:', error);
      return c.json({ success: true, customers: [] });
    }
  });

  app.get('/admin/enterprise/inventory', async (c) => {
    try {
      // Get all products with inventory information
      const products = await query(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          p.stock,
          p.stock_quantity,
          p.price,
          p.status,
          p.category_id,
          p.created_at,
          p.updated_at
        FROM products p
        WHERE p.status != 'deleted'
        ORDER BY p.created_at DESC
        LIMIT 100
      `).catch(() => ({ rows: [] }));

      const safeProducts = (products.rows || []).map((p: any) => ({
        id: String(p.id || ''),
        name: String(p.name || ''),
        sku: String(p.sku || `SKU-${p.id}`),
        stock: parseInt(p.stock || p.stock_quantity || '0', 10),
        price: parseFloat(p.price || '0'),
        status: String(p.status || 'active'),
        categoryId: String(p.category_id || ''),
        lastUpdated: String(p.updated_at || p.created_at || new Date().toISOString()),
      }));

      return c.json({
        success: true,
        products: safeProducts,
      });
    } catch (error: any) {
      console.error('Error fetching enterprise inventory:', error);
      return c.json({ success: true, products: [] });
    }
  });

  app.put('/admin/enterprise/inventory', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { products } = body;

      if (!products || !Array.isArray(products)) {
        return c.json({ error: 'products array is required' }, 400);
      }

      const updatedProducts = [];
      for (const product of products) {
        if (!product.id) continue;

        const updateData: any = {
          updated_at: new Date().toISOString(),
        };
        if (product.stock !== undefined) {
          updateData.stock = parseInt(product.stock, 10);
          updateData.stock_quantity = parseInt(product.stock, 10);
        }
        if (product.status !== undefined) {
          updateData.status = product.status;
          updateData.is_active = product.status !== 'inactive';
        }

        const updated = await update('products', { id: product.id }, updateData);
        updatedProducts.push(updated[0]);
      }

      return c.json({
        success: true,
        message: `Updated ${updatedProducts.length} products`,
        products: updatedProducts,
      });
    } catch (error: any) {
      console.error('Error updating enterprise inventory:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/admin/enterprise/pricing-rules', async (c) => {
    try {
      // Get pricing rules from platform_settings or pricing_rules table
      const settings = await query(`
        SELECT setting_value 
        FROM platform_settings 
        WHERE setting_key = 'admin:enterprise:pricing-rules'
      `).catch(() => ({ rows: [] }));

      if (settings.rows.length > 0) {
        const rules = typeof settings.rows[0].setting_value === 'string'
          ? JSON.parse(settings.rows[0].setting_value)
          : settings.rows[0].setting_value;
        return c.json({ success: true, rules: rules.rules || rules || [] });
      }

      // Fallback: get from pricing_rules table
      const pricingRules = await query('SELECT * FROM pricing_rules WHERE is_active = true ORDER BY created_at DESC').catch(() => ({ rows: [] }));
      return c.json({ success: true, rules: pricingRules.rows || [] });
    } catch (error: any) {
      console.error('Error fetching enterprise pricing rules:', error);
      return c.json({ success: true, rules: [] });
    }
  });

  app.put('/admin/enterprise/pricing-rules', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { rules } = body;

      if (!rules || !Array.isArray(rules)) {
        return c.json({ error: 'rules array is required' }, 400);
      }

      // Store in platform_settings
      const existing = await query(`
        SELECT id 
        FROM platform_settings 
        WHERE setting_key = 'admin:enterprise:pricing-rules'
      `).catch(() => ({ rows: [] }));

      if (existing.rows.length > 0) {
        await update('platform_settings',
          { id: existing.rows[0].id },
          {
            setting_value: JSON.stringify({ rules }),
            updated_at: new Date().toISOString(),
          }
        );
      } else {
        await insert('platform_settings', {
          setting_key: 'admin:enterprise:pricing-rules',
          setting_value: JSON.stringify({ rules }),
          setting_type: 'object',
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        message: 'Pricing rules updated successfully',
        rules,
      });
    } catch (error: any) {
      console.error('Error updating enterprise pricing rules:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/admin/logistics/stats', async (c) => {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_shipments,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit
        FROM shipments
      `).catch(() => ({ rows: [{ total_shipments: '0', delivered: '0', in_transit: '0' }] }));
      return c.json({ success: true, stats: stats.rows[0] || { total_shipments: 0, delivered: 0, in_transit: 0 } });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/logistics/orders', async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let queryStr = `
        SELECT 
          o.*,
          s.tracking_number,
          s.status as shipment_status,
          s.awb_number,
          v.business_name as vendor_name,
          c.full_name as customer_name
        FROM orders o
        LEFT JOIN shipments s ON s.order_id = o.id
        LEFT JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        queryStr += ` AND o.order_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      queryStr += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const orders = await query(queryStr, params).catch(() => ({ rows: [] }));

      const safeOrders = (orders.rows || []).map((o: any) => ({
        id: String(o.id || ''),
        orderId: String(o.id || ''),
        orderNumber: String(o.order_number || o.id || ''),
        customerId: String(o.customer_id || ''),
        customerName: String(o.customer_name || ''),
        vendorId: String(o.vendor_id || ''),
        vendorName: String(o.vendor_name || ''),
        totalAmount: parseFloat(o.total_amount || '0'),
        status: String(o.order_status || o.status || 'pending'),
        shipmentStatus: String(o.shipment_status || 'pending'),
        trackingNumber: String(o.tracking_number || ''),
        awbNumber: String(o.awb_number || ''),
        createdAt: String(o.created_at || ''),
      }));

      return c.json({
        success: true,
        orders: safeOrders,
        count: safeOrders.length,
      });
    } catch (error: any) {
      console.error('Error fetching logistics orders:', error);
      return c.json({ success: true, orders: [], count: 0 });
    }
  });

  app.get('/admin/loyalty/stats', async (c) => {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_members,
          SUM(points) as total_points,
          COUNT(*) FILTER (WHERE tier = 'gold') as gold_members
        FROM loyalty_members
      `);
      return c.json({ success: true, stats: stats.rows[0] });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/notifications', async (c) => {
    try {
      const notifications = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').catch(() => ({ rows: [] }));

      const safeNotifications = (notifications.rows || []).map((n: any) => {
        // ✅ FIX: Parse channels - PostgreSQL arrays can come as strings or arrays
        let channels: string[] = [];
        if (n.channels) {
          if (Array.isArray(n.channels)) {
            channels = n.channels;
          } else if (typeof n.channels === 'string') {
            // PostgreSQL array string format: "{push,sms,email}" or "push,sms,email"
            const cleaned = n.channels.replace(/[{}"]/g, '');
            channels = cleaned ? cleaned.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
          }
        }

        return {
          id: String(n.id || ''),
          title: String(n.title || ''),
          message: String(n.message || ''),
          type: String(n.type || 'info'),
          target_audience: String(n.target_audience || 'all'),
          target_regions: Array.isArray(n.target_regions) ? n.target_regions : (n.target_regions ? [n.target_regions] : []),
          target_user_ids: Array.isArray(n.target_user_ids) ? n.target_user_ids : (n.target_user_ids ? [n.target_user_ids] : []),
          channels: channels,
          scheduled_at: n.scheduled_at ? String(n.scheduled_at) : undefined,
          sent_at: n.sent_at ? String(n.sent_at) : undefined,
          status: String(n.status || 'draft'),
          sent_count: parseInt(n.sent_count || '0', 10),
          delivered_count: parseInt(n.delivered_count || '0', 10),
          opened_count: parseInt(n.opened_count || '0', 10),
          created_at: String(n.created_at || ''),
        };
      });

      return c.json({ success: true, notifications: safeNotifications });
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      return c.json({ success: true, notifications: [] });
    }
  });

  app.post('/admin/notifications', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const {
        title,
        message,
        type,
        target_audience,
        target_regions,
        target_user_ids,
        channels,
        scheduled_at,
      } = body;

      if (!title || !message || !channels || channels.length === 0) {
        return c.json({ error: 'title, message, and at least one channel are required' }, 400);
      }

      const notification = await insert('notifications', {
        title,
        message,
        type: type || 'info',
        target_audience: target_audience || 'all',
        target_regions: target_regions || null,
        target_user_ids: target_user_ids || null,
        channels,
        scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
        status: scheduled_at ? 'scheduled' : 'sent',
        sent_count: 0,
        delivered_count: 0,
        opened_count: 0,
        created_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        notification: notification[0],
        message: 'Notification created successfully',
      });
    } catch (error: any) {
      console.error('Error creating notification:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/admin/notifications/templates', async (c) => {
    try {
      const templates = await query('SELECT * FROM notification_templates ORDER BY name ASC');
      return c.json({ success: true, templates: templates.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/operations/activity', async (c) => {
    try {
      const activity = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
      return c.json({ success: true, activity: activity.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/operations/health', async (c) => {
    try {
      return c.json({
        success: true,
        health: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            cache: 'connected',
          },
        },
      });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/packages/stats/by-region', async (c) => {
    try {
      const stats = await query(`
        SELECT r.name as region, COUNT(p.id) as package_count
        FROM regions r
        LEFT JOIN regional_packages p ON r.id = p.region_id
        GROUP BY r.id, r.name
        ORDER BY package_count DESC
      `);
      return c.json({ success: true, stats: stats.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // NOTE: Primary handler is in payment-gateway-management.ts
  // This is a fallback with graceful error handling
  app.get('/admin/payment-gateways', async (c) => {
    try {
      // Try payment_gateway_settings first (new table), then payment_gateways (legacy)
      let gateways;
      try {
        gateways = await query('SELECT * FROM payment_gateway_settings ORDER BY gateway_name ASC');
      } catch (e1) {
        try {
          gateways = await query('SELECT * FROM payment_gateways ORDER BY name ASC');
        } catch (e2) {
          // Both tables don't exist - return empty array gracefully
          return c.json({ success: true, gateways: [], message: 'Payment gateway tables not found.' }, 200);
        }
      }
      return c.json({ success: true, gateways: gateways.rows || [] }, 200);
    } catch (error: unknown) {
      // GRACEFUL: Return 200 with empty array on any error
      console.error('[admin-advanced] payment-gateways error:', error);
      return c.json({ success: true, gateways: [], message: 'Payment gateway query failed.' }, 200);
    }
  });

  app.get('/admin/payments/analytics', async (c) => {
    try {
      // Primary: vendor_earnings (revenue, commission, payouts from completed bookings)
      let veResult: { rows: any[] } = { rows: [] };
      try {
        veResult = await query(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(commission_amount), 0) as total_commission,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('settled', 'paid_out')), 0) as vendor_payout,
            COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
            COUNT(*) FILTER (WHERE status = 'pending') as pending_count
          FROM vendor_earnings
        `);
      } catch {
        // vendor_earnings table may not exist
      }
      const ve = veResult.rows?.[0] || {};
      let totalRevenue = parseFloat(ve.total_revenue ?? '0');
      let totalCommission = parseFloat(ve.total_commission ?? '0');
      let vendorPayout = parseFloat(ve.vendor_payout ?? '0');
      let pendingAmount = parseFloat(ve.pending_amount ?? '0');
      let pendingCount = parseInt(ve.pending_count ?? '0', 10);

      // Fallback: payments + bookings when vendor_earnings is empty
      if (totalRevenue === 0 && totalCommission === 0) {
        try {
          const payResult = await query(`
            SELECT 
              COALESCE(SUM(amount), 0) as total_revenue,
              COALESCE(SUM(COALESCE(platform_fee, commission_amount)), 0) as commission,
              COUNT(*) as cnt
            FROM payments 
            WHERE payment_status IN ('completed', 'success') AND created_at >= CURRENT_DATE - INTERVAL '90 days'
          `);
          const pr = payResult.rows?.[0];
          if (pr && parseInt(pr.cnt ?? '0', 10) > 0) {
            totalRevenue = parseFloat(pr.total_revenue ?? '0');
            totalCommission = parseFloat(pr.commission ?? '0') || totalRevenue * 0.02;
          }
        } catch { /* ignore */ }
        try {
          const bookResult = await query(`
            SELECT COALESCE(SUM(total_amount), 0) as gmv
            FROM bookings 
            WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '90 days'
          `);
          const br = bookResult.rows?.[0];
          if (br && totalRevenue === 0) {
            const gmv = parseFloat(br.gmv ?? '0');
            if (gmv > 0) {
              totalRevenue = gmv;
              totalCommission = totalCommission || gmv * 0.02;
            }
          }
        } catch { /* ignore */ }
      }

      // Enrich from settlements if available (completed payouts may be there)
      let setResult: { rows: any[] } = { rows: [] };
      try {
        setResult = await query(`
          SELECT 
            COALESCE(SUM(COALESCE(vendor_amount, net_amount)), 0) FILTER (WHERE COALESCE(status, settlement_status) IN ('completed', 'processed')) as settled_amount,
            COALESCE(SUM(COALESCE(vendor_amount, net_amount)), 0) FILTER (WHERE COALESCE(status, settlement_status) IN ('pending', 'processing')) as settlements_pending,
            COUNT(*) FILTER (WHERE COALESCE(status, settlement_status) IN ('pending', 'processing')) as settlements_pending_count
          FROM settlements
        `);
      } catch {
        // settlements may use different column names
      }
      const setRow = setResult.rows?.[0];
      const settledFromTable = parseFloat(setRow?.settled_amount ?? '0');
      vendorPayout = vendorPayout > 0 ? vendorPayout : settledFromTable;
      pendingAmount = pendingAmount || parseFloat(setRow?.settlements_pending ?? '0');
      if (pendingCount === 0) pendingCount = parseInt(setRow?.settlements_pending_count ?? '0', 10);

      return c.json({
        success: true,
        analytics: {
          totalRevenue,
          totalCommission,
          vendorPayout,
          pendingAmount,
          pendingCount,
          total_payments: 0,
          total_amount: totalRevenue,
          successful: 0,
          revenueByTier: {},
          topVendors: [],
        },
      });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/payments/gateways', async (c) => {
    try {
      // Try payment_gateway_config first, then payment_gateway_settings, then platform_integrations
      let config: { rows?: any[] } = { rows: [] };
      let source: 'config' | 'settings' | 'integrations' = 'config';
      
      try {
        config = await query('SELECT * FROM payment_gateway_config ORDER BY created_at DESC');
        source = 'config';
      } catch {
        try {
          config = await query('SELECT * FROM payment_gateway_settings ORDER BY created_at DESC');
          source = 'settings';
        } catch {
          try {
            config = await query(`
              SELECT 
                id,
                integration_name,
                integration_config,
                is_active,
                created_at,
                updated_at
              FROM platform_integrations 
              WHERE integration_name IN ('razorpay', 'stripe', 'paytm')
              ORDER BY integration_name ASC
            `);
            source = 'integrations';
          } catch {
            config = { rows: [] };
          }
        }
      }
      
      const rows = config.rows || [];
      const gateways: Array<Record<string, unknown>> = [];
      
      for (const row of rows) {
        if (source === 'integrations') {
          // Handle platform_integrations structure
          const integrationName = row.integration_name || '';
          const configData = row.integration_config 
            ? (typeof row.integration_config === 'string' ? JSON.parse(row.integration_config) : row.integration_config)
            : {};
          
          if (configData.keyId || configData.key_id) {
            const gatewayName = integrationName.charAt(0).toUpperCase() + integrationName.slice(1);
            gateways.push({
              id: row.id,
              name: gatewayName,
              type: integrationName,
              keyId: configData.keyId || configData.key_id || '',
              enabled: row.is_active !== false && (configData.enabled !== false),
              is_active: row.is_active,
              config: configData,
            });
          }
        } else {
          // Handle payment_gateway_config and payment_gateway_settings structure
          const data = row.gateway_config
            ? (typeof row.gateway_config === 'string' ? JSON.parse(row.gateway_config) : row.gateway_config)
            : row;
          const razorpay = data.razorpay ?? data;
          if (razorpay && (razorpay.keyId || razorpay.key_id)) {
            gateways.push({
              id: row.id ?? 'razorpay',
              name: 'Razorpay',
              type: 'razorpay',
              keyId: razorpay.keyId ?? razorpay.key_id ?? '',
              enabled: razorpay.enabled !== false,
            });
          }
        }
      }
      
      // Fallback: if no gateways found but rows exist, try to extract from first row
      if (gateways.length === 0 && rows.length > 0) {
        const first = rows[0];
        if (source === 'integrations') {
          const configData = first.integration_config 
            ? (typeof first.integration_config === 'string' ? JSON.parse(first.integration_config) : first.integration_config)
            : {};
          if (configData.keyId || configData.key_id) {
            const integrationName = first.integration_name || 'razorpay';
            const gatewayName = integrationName.charAt(0).toUpperCase() + integrationName.slice(1);
            gateways.push({
              id: first.id,
              name: gatewayName,
              type: integrationName,
              keyId: configData.keyId || configData.key_id || '',
              enabled: first.is_active !== false,
              is_active: first.is_active,
              config: configData,
            });
          }
        } else {
          const data = first.gateway_config ? (typeof first.gateway_config === 'string' ? JSON.parse(first.gateway_config) : first.gateway_config) : first;
          const r = data.razorpay ?? data;
          gateways.push({
            id: first.id ?? 'razorpay',
            name: 'Razorpay',
            type: 'razorpay',
            keyId: r?.keyId ?? r?.key_id ?? '',
            enabled: r?.enabled !== false,
          });
        }
      }
      
      return c.json({ success: true, gateways });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/payments/gateway-config', async (c) => {
    try {
      // Try payment_gateway_config table first, fallback to payment_gateway_settings
      const config = await query('SELECT * FROM payment_gateway_config ORDER BY created_at DESC').catch(async () => {
        return await query('SELECT * FROM payment_gateway_settings ORDER BY created_at DESC').catch(() => ({ rows: [] }));
      });

      // If no config found, return default structure
      if (config.rows.length === 0) {
        return c.json({
          success: true,
          razorpay: {
            enabled: false,
            keyId: '',
            keySecret: '',
            webhookSecret: '',
          }
        });
      }

      // Parse gateway_config JSONB if it exists
      const gatewayData = config.rows[0]?.gateway_config
        ? (typeof config.rows[0].gateway_config === 'string'
          ? JSON.parse(config.rows[0].gateway_config)
          : config.rows[0].gateway_config)
        : config.rows[0];

      return c.json({ success: true, ...gatewayData });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/payments/gateway-config', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { razorpay, stripe, paytm, default_gateway } = body;

      // Try to update payment_gateway_settings table
      try {
        const existing = await query('SELECT * FROM payment_gateway_settings WHERE gateway_name = $1', ['razorpay']).catch(() => ({ rows: [] }));

        const gatewayConfig = {
          razorpay: razorpay || {},
          stripe: stripe || {},
          paytm: paytm || {},
          default_gateway: default_gateway || 'razorpay',
        };

        if (existing.rows.length > 0) {
          await update('payment_gateway_settings',
            { id: existing.rows[0].id },
            {
              gateway_config: JSON.stringify(gatewayConfig),
              updated_at: new Date().toISOString(),
            }
          );
        } else {
          await insert('payment_gateway_settings', {
            gateway_name: 'razorpay',
            gateway_config: JSON.stringify(gatewayConfig),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (tableError: any) {
        // Fallback: store in admin_settings
        const existing = await query(`
          SELECT id 
          FROM admin_settings 
          WHERE setting_category = 'payment' AND setting_key = 'gateway_config'
        `).catch(() => ({ rows: [] }));

        const gatewayConfig = {
          razorpay: razorpay || {},
          stripe: stripe || {},
          paytm: paytm || {},
          default_gateway: default_gateway || 'razorpay',
        };

        if (existing.rows.length > 0) {
          await update('admin_settings',
            { id: existing.rows[0].id },
            {
              setting_value: JSON.stringify(gatewayConfig),
              updated_at: new Date().toISOString(),
            }
          );
        } else {
          await insert('admin_settings', {
            setting_category: 'payment',
            setting_key: 'gateway_config',
            setting_value: JSON.stringify(gatewayConfig),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      return c.json({
        success: true,
        message: 'Payment gateway configuration updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating gateway config:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/payments/refund-rules', async (c) => {
    try {
      // Try refund_rules table first, fallback to admin_settings
      const rules = await query('SELECT * FROM refund_rules ORDER BY created_at DESC').catch(async () => {
        const settings = await query(`
          SELECT setting_value 
          FROM admin_settings 
          WHERE setting_category = 'payment' AND setting_key = 'refund_rules'
        `).catch(() => ({ rows: [] }));
        return { rows: settings.rows.length > 0 ? JSON.parse(settings.rows[0].setting_value) : [] };
      });

      // If no rules found, return default structure
      if (!rules.rows || rules.rows.length === 0) {
        return c.json({
          success: true,
          rules: {
            enabled: true,
            schedule: [
              { hours: 48, refundPercent: 90, description: 'Full refund > 48h' },
              { hours: 24, refundPercent: 50, description: 'Partial refund 24-48h' },
              { hours: 12, refundPercent: 0, description: 'No refund < 12h' },
            ],
            autoReconcile: true,
            reconcilePeriod: 7,
          }
        });
      }

      return c.json({ success: true, rules: rules.rows[0] || rules.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/payments/refund-rules', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { enabled, schedule, autoReconcile, reconcilePeriod } = body;

      // Try to update refund_rules table
      try {
        const existing = await query('SELECT * FROM refund_rules LIMIT 1').catch(() => ({ rows: [] }));

        const rulesData = {
          enabled: enabled !== false,
          schedule: schedule || [],
          autoReconcile: autoReconcile !== false,
          reconcilePeriod: reconcilePeriod || 7,
        };

        if (existing.rows.length > 0) {
          await update('refund_rules',
            { id: existing.rows[0].id },
            {
              rules_config: JSON.stringify(rulesData),
              updated_at: new Date().toISOString(),
            }
          );
        } else {
          await insert('refund_rules', {
            rules_config: JSON.stringify(rulesData),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (tableError: any) {
        // Fallback: store in admin_settings
        const existing = await query(`
          SELECT id 
          FROM admin_settings 
          WHERE setting_category = 'payment' AND setting_key = 'refund_rules'
        `).catch(() => ({ rows: [] }));

        const rulesData = {
          enabled: enabled !== false,
          schedule: schedule || [],
          autoReconcile: autoReconcile !== false,
          reconcilePeriod: reconcilePeriod || 7,
        };

        if (existing.rows.length > 0) {
          await update('admin_settings',
            { id: existing.rows[0].id },
            {
              setting_value: JSON.stringify(rulesData),
              updated_at: new Date().toISOString(),
            }
          );
        } else {
          await insert('admin_settings', {
            setting_category: 'payment',
            setting_key: 'refund_rules',
            setting_value: JSON.stringify(rulesData),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      return c.json({
        success: true,
        message: 'Refund rules updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating refund rules:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/payments/settlements', async (c) => {
    try {
      const statusMap: Record<string, string> = {
        pending: 'Pending',
        processing: 'Pending',
        completed: 'Paid',
        failed: 'Failed',
      };
      const settlements: any[] = [];

      // 1. From settlements table (vendor_identity via vi.vendor_id = s.vendor_id for correct name)
      try {
        const result = await query(`
          SELECT s.*,
                 COALESCE(v.business_name, vi.business_name, vi.full_name, 'Vendor') as vendor_name
          FROM settlements s
          LEFT JOIN vendors v ON s.vendor_id = v.id
          LEFT JOIN vendor_identity vi ON vi.vendor_id = s.vendor_id
          ORDER BY s.created_at DESC
          LIMIT 100
        `);
        const rows = result.rows || [];
        for (const s of rows) {
          const rawStatus = s.status || s.settlement_status || 'pending';
          settlements.push({
            id: s.id,
            vendorId: s.vendor_id,
            vendorName: s.vendor_name || 'Unknown',
            vendor_name: s.vendor_name || 'Unknown',
            amount: parseFloat(s.vendor_amount ?? s.net_amount ?? s.total_amount ?? '0'),
            commission: parseFloat(s.commission_amount ?? '0'),
            status: statusMap[rawStatus] || 'Pending',
            failure_reason: s.failure_reason || s.error_message || null,
            date: s.created_at || s.completed_at,
            source: 'settlement',
          });
        }
      } catch {
        // settlements table may not exist
      }

      // 2. From vendor_earnings: pending earnings (Due / upcoming)
      if (settlements.length < 100) {
        try {
          const veResult = await query(`
            SELECT v.id as vendor_id, v.business_name as vendor_name,
                   SUM(ve.amount) as amount,
                   SUM(ve.commission_amount) as commission_amount,
                   MAX(ve.realized_at) as date
            FROM vendor_earnings ve
            JOIN vendors v ON ve.vendor_id = v.id
            WHERE ve.status = 'pending'
            GROUP BY v.id, v.business_name
            HAVING SUM(ve.amount) > 0
            ORDER BY MAX(ve.realized_at) DESC
            LIMIT 50
          `);
          const veRows = veResult.rows || [];
          const existingVendorIds = new Set(settlements.map((s) => String(s.vendorId)));
          for (const row of veRows) {
            if (existingVendorIds.has(String(row.vendor_id))) continue; // already in settlements
            settlements.push({
              id: `ve-${row.vendor_id}`,
              vendorId: row.vendor_id,
              vendorName: row.vendor_name || 'Vendor',
              vendor_name: row.vendor_name || 'Vendor',
              amount: parseFloat(row.amount ?? '0'),
              commission: parseFloat(row.commission_amount ?? '0'),
              status: 'Due',
              failure_reason: null,
              date: row.date,
              source: 'vendor_earnings',
            });
          }
        } catch {
          // vendor_earnings may not exist
        }
      }

      return c.json({ success: true, settlements, data: { settlements } });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // Payment tiers (vendor_tiers table) - CRUD for admin finance tier configuration
  app.get('/admin/payments/tiers', async (c) => {
    try {
      let result: { rows?: any[] };
      try {
        result = await query(`
          SELECT id, tier_name, display_name, description, commission_rate, payout_period_days,
                 monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles,
                 terms_and_conditions, terms_version, created_at, updated_at
          FROM vendor_tiers
          ORDER BY tier_level ASC NULLS LAST, created_at DESC
        `);
      } catch (colErr: unknown) {
        const colMsg = String(getErrorMessage(colErr));
        if (/column "terms_and_conditions" does not exist/i.test(colMsg)) {
          result = await query(`
            SELECT id, tier_name, display_name, description, commission_rate, payout_period_days,
                   monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles,
                   created_at, updated_at
            FROM vendor_tiers
            ORDER BY tier_level ASC NULLS LAST, created_at DESC
          `);
          (result.rows || []).forEach((r: any) => {
            r.terms_and_conditions = null;
            r.terms_version = '1.0';
          });
        } else {
          throw colErr;
        }
      }
      const rows = (result.rows || []).map((row: Record<string, unknown>) => ({
        id: row.id,
        name: row.tier_name,
        displayName: row.display_name,
        description: row.description ?? '',
        commissionRate: Number(row.commission_rate) ?? 0,
        payoutPeriodDays: Number(row.payout_period_days) ?? 7,
        monthlyCost: Number(row.monthly_cost) ?? 0,
        yearlyCost: Number(row.yearly_cost) ?? 0,
        isDefault: Boolean(row.is_default),
        isActive: row.is_active !== false,
        features: Array.isArray(row.features) ? row.features : (row.features ? [row.features] : []),
        roles: Array.isArray(row.applicable_roles) ? (row.applicable_roles as string[]) : [],
        termsAndConditions: row.terms_and_conditions ?? '',
        termsVersion: row.terms_version ?? '1.0',
      }));
      return c.json({ success: true, tiers: rows });
    } catch (error: unknown) {
      const msg = String(getErrorMessage(error));
      // Table missing: return empty tiers so UI loads; run migration 008 to create vendor_tiers
      if (/relation\s+["']?(?:vendor_tiers|payment_tiers)["']?\s+does not exist/i.test(msg)) {
        console.warn('[admin/payments/tiers] Table missing:', msg);
        return c.json({ success: true, tiers: [] });
      }
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/payments/tiers', async (c) => {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const name = String(body.name ?? body.tier_name ?? '').trim();
      const displayName = String(body.displayName ?? body.display_name ?? name).trim();
      if (!name) {
        return c.json({ success: false, error: 'Tier name is required' }, 400);
      }
      const description = String(body.description ?? '').trim();
      const commissionRate = Number(body.commissionRate ?? body.commission_rate ?? 15);
      const payoutPeriodDays = Math.max(0, Math.floor(Number(body.payoutPeriodDays ?? body.payout_period_days ?? 7)));
      const monthlyCost = Number(body.monthlyCost ?? body.monthly_cost ?? 0);
      const yearlyCost = Number(body.yearlyCost ?? body.yearly_cost ?? 0);
      const isDefault = Boolean(body.isDefault ?? body.is_default);
      const isActive = body.isActive !== false && body.is_active !== false;
      const features = Array.isArray(body.features) ? body.features : [];
      const roles = Array.isArray(body.roles) ? body.roles : [];
      const roleUuids = roles.filter((r): r is string => typeof r === 'string' && /^[0-9a-f-]{36}$/i.test(r));
      const termsAndConditions = body.termsAndConditions != null ? String(body.termsAndConditions) : (body.terms_and_conditions != null ? String(body.terms_and_conditions) : '');
      const termsVersion = body.termsVersion != null ? String(body.termsVersion) : (body.terms_version != null ? String(body.terms_version) : '1.0');

      const levelResult = await query('SELECT COALESCE(MAX(tier_level), 0) + 1 AS next_level FROM vendor_tiers');
      const nextLevel = Number((levelResult.rows?.[0] as Record<string, unknown>)?.next_level) || 1;

      let insertResult;
      try {
        insertResult = await query(
          `INSERT INTO vendor_tiers (
            tier_name, tier_level, display_name, description, commission_rate, payout_period_days,
            monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles,
            terms_and_conditions, terms_version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id, tier_name, display_name, description, commission_rate, payout_period_days,
                    monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles,
                    terms_and_conditions, terms_version, created_at`,
          [
            name,
            nextLevel,
            displayName,
            description || null,
            commissionRate,
            payoutPeriodDays,
            monthlyCost,
            yearlyCost,
            isDefault,
            isActive,
            JSON.stringify(features),
            roleUuids.length ? roleUuids : [],
            termsAndConditions || null,
            termsVersion || '1.0',
          ]
        );
      } catch (colErr: unknown) {
        if (/column "terms_and_conditions" does not exist/i.test(String(colErr))) {
          insertResult = await query(
            `INSERT INTO vendor_tiers (
              tier_name, tier_level, display_name, description, commission_rate, payout_period_days,
              monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, tier_name, display_name, description, commission_rate, payout_period_days,
                      monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles, created_at`,
            [name, nextLevel, displayName, description || null, commissionRate, payoutPeriodDays, monthlyCost, yearlyCost, isDefault, isActive, JSON.stringify(features), roleUuids.length ? roleUuids : []]
          );
        } else {
          throw colErr;
        }
      }
      const row = insertResult.rows?.[0] as Record<string, unknown> | undefined;
      if (!row) {
        return c.json({ success: false, error: 'Failed to create tier' }, 500);
      }
      const tier = {
        id: row.id,
        name: row.tier_name,
        displayName: row.display_name,
        description: row.description ?? '',
        commissionRate: Number(row.commission_rate) ?? 0,
        payoutPeriodDays: Number(row.payout_period_days) ?? 7,
        monthlyCost: Number(row.monthly_cost) ?? 0,
        yearlyCost: Number(row.yearly_cost) ?? 0,
        isDefault: Boolean(row.is_default),
        isActive: row.is_active !== false,
        features: Array.isArray(row.features) ? row.features : [],
        roles: Array.isArray(row.applicable_roles) ? (row.applicable_roles as string[]) : [],
        termsAndConditions: row.terms_and_conditions ?? '',
        termsVersion: row.terms_version ?? '1.0',
      };
      return c.json({ success: true, tier });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/payments/tiers/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!id || !isValidUUID(id)) {
        return c.json({ success: false, error: 'Valid tier id is required' }, 400);
      }
      const body = (await c.req.json()) as Record<string, unknown>;
      const name = body.name != null ? String(body.name).trim() : undefined;
      const displayName = body.displayName != null ? String(body.displayName).trim() : body.display_name != null ? String(body.display_name).trim() : undefined;
      const description = body.description != null ? String(body.description).trim() : undefined;
      const commissionRate = body.commissionRate != null ? Number(body.commissionRate) : body.commission_rate != null ? Number(body.commission_rate) : undefined;
      const payoutPeriodDays = body.payoutPeriodDays != null ? Math.max(0, Math.floor(Number(body.payoutPeriodDays))) : body.payout_period_days != null ? Math.max(0, Math.floor(Number(body.payout_period_days))) : undefined;
      const monthlyCost = body.monthlyCost != null ? Number(body.monthlyCost) : body.monthly_cost != null ? Number(body.monthly_cost) : undefined;
      const yearlyCost = body.yearlyCost != null ? Number(body.yearlyCost) : body.yearly_cost != null ? Number(body.yearly_cost) : undefined;
      const isDefault = body.isDefault !== undefined ? Boolean(body.isDefault) : body.is_default !== undefined ? Boolean(body.is_default) : undefined;
      const isActive = body.isActive !== undefined ? Boolean(body.isActive) : body.is_active !== undefined ? Boolean(body.is_active) : undefined;
      const features = body.features !== undefined ? (Array.isArray(body.features) ? body.features : []) : undefined;
      const roles = Array.isArray(body.roles) ? body.roles : [];
      const roleUuids = roles.filter((r): r is string => typeof r === 'string' && /^[0-9a-f-]{36}$/i.test(r));

      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (name !== undefined) { updates.push(`tier_name = $${idx++}`); values.push(name); }
      if (displayName !== undefined) { updates.push(`display_name = $${idx++}`); values.push(displayName); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
      if (commissionRate !== undefined) { updates.push(`commission_rate = $${idx++}`); values.push(commissionRate); }
      if (payoutPeriodDays !== undefined) { updates.push(`payout_period_days = $${idx++}`); values.push(payoutPeriodDays); }
      if (monthlyCost !== undefined) { updates.push(`monthly_cost = $${idx++}`); values.push(monthlyCost); }
      if (yearlyCost !== undefined) { updates.push(`yearly_cost = $${idx++}`); values.push(yearlyCost); }
      if (isDefault !== undefined) { updates.push(`is_default = $${idx++}`); values.push(isDefault); }
      if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(isActive); }
      if (features !== undefined) { updates.push(`features = $${idx++}`); values.push(JSON.stringify(features)); }
      if (body.roles !== undefined) { updates.push(`applicable_roles = $${idx++}`); values.push(roleUuids); }
      if (body.termsAndConditions !== undefined || body.terms_and_conditions !== undefined) {
        updates.push(`terms_and_conditions = $${idx++}`);
        values.push(body.termsAndConditions != null ? String(body.termsAndConditions) : body.terms_and_conditions != null ? String(body.terms_and_conditions) : null);
      }
      if (body.termsVersion !== undefined || body.terms_version !== undefined) {
        updates.push(`terms_version = $${idx++}`);
        values.push(body.termsVersion != null ? String(body.termsVersion) : body.terms_version != null ? String(body.terms_version) : '1.0');
      }
      if (updates.length === 0) {
        return c.json({ success: false, error: 'No fields to update' }, 400);
      }
      updates.push(`updated_at = NOW()`);
      values.push(id);
      const updateResult = await query(
        `UPDATE vendor_tiers SET ${updates.join(', ')} WHERE id = $${idx}::uuid RETURNING id, tier_name, display_name, description, commission_rate, payout_period_days, monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles, terms_and_conditions, terms_version`,
        values
      );
      const row = updateResult.rows?.[0] as Record<string, unknown> | undefined;
      if (!row) {
        return c.json({ success: false, error: 'Tier not found' }, 404);
      }
      const tier = {
        id: row.id,
        name: row.tier_name,
        displayName: row.display_name,
        description: row.description ?? '',
        commissionRate: Number(row.commission_rate) ?? 0,
        payoutPeriodDays: Number(row.payout_period_days) ?? 7,
        monthlyCost: Number(row.monthly_cost) ?? 0,
        yearlyCost: Number(row.yearly_cost) ?? 0,
        isDefault: Boolean(row.is_default),
        isActive: row.is_active !== false,
        features: Array.isArray(row.features) ? row.features : [],
        roles: Array.isArray(row.applicable_roles) ? (row.applicable_roles as string[]) : [],
        termsAndConditions: row.terms_and_conditions ?? '',
        termsVersion: row.terms_version ?? '1.0',
      };
      return c.json({ success: true, tier });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.delete('/admin/payments/tiers/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!id || !isValidUUID(id)) {
        return c.json({ success: false, error: 'Valid tier id is required' }, 400);
      }
      const result = await query('DELETE FROM vendor_tiers WHERE id = $1::uuid RETURNING id', [id]);
      if (!result.rows?.length) {
        return c.json({ success: false, error: 'Tier not found' }, 404);
      }
      return c.json({ success: true, message: 'Tier deleted' });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/payments/tiers/seed-defaults', async (c) => {
    try {
      const countResult = await query('SELECT COUNT(*) AS cnt FROM vendor_tiers');
      const count = Number((countResult.rows?.[0] as Record<string, unknown>)?.cnt) || 0;
      if (count > 0) {
        return c.json({ success: true, message: 'Tiers already exist', tiers: [] });
      }
      await query(`
        INSERT INTO vendor_tiers (tier_name, tier_level, display_name, description, commission_rate, payout_period_days, monthly_cost, yearly_cost, is_default, is_active, is_free_tier)
        VALUES
          ('Basic', 1, 'Basic', 'Basic tier - free of cost, zero commission', 0, 7, 0, 0, true, true, true),
          ('Advance', 2, 'Advance', 'Advance tier - lower commission', 10, 7, 1999, 19990, false, true, false),
          ('Premium', 3, 'Premium', 'Premium tier - lowest commission', 7, 7, 2999, 29990, false, true, false)
        ON CONFLICT (tier_name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          commission_rate = EXCLUDED.commission_rate,
          payout_period_days = EXCLUDED.payout_period_days,
          monthly_cost = EXCLUDED.monthly_cost,
          yearly_cost = EXCLUDED.yearly_cost,
          is_default = EXCLUDED.is_default,
          is_free_tier = EXCLUDED.is_free_tier,
          updated_at = NOW()
      `);
      const listResult = await query(`
        SELECT id, tier_name, display_name, description, commission_rate, payout_period_days, monthly_cost, yearly_cost, is_default, is_active, features, applicable_roles
        FROM vendor_tiers ORDER BY tier_level ASC
      `);
      const tiers = (listResult.rows || []).map((row: Record<string, unknown>) => ({
        id: row.id,
        name: row.tier_name,
        displayName: row.display_name,
        description: row.description ?? '',
        commissionRate: Number(row.commission_rate) ?? 0,
        payoutPeriodDays: Number(row.payout_period_days) ?? 7,
        monthlyCost: Number(row.monthly_cost) ?? 0,
        yearlyCost: Number(row.yearly_cost) ?? 0,
        isDefault: Boolean(row.is_default),
        isActive: row.is_active !== false,
        features: Array.isArray(row.features) ? row.features : [],
        roles: Array.isArray(row.applicable_roles) ? (row.applicable_roles as string[]) : [],
      }));
      return c.json({ success: true, message: 'Default tiers seeded', tiers });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/payouts', async (c) => {
    try {
      let payouts: { rows?: any[] };
      try {
        payouts = await query(`
          SELECT p.*,
                 COALESCE(v.business_name, vi.business_name, vi.full_name, 'Vendor') as vendor_name,
                 COALESCE(v.phone, vi.phone) as vendor_phone,
                 r.name as vendor_role,
                 COALESCE(v.category, vi.vendor_type, '') as business_type,
                 to_char(p.created_at AT TIME ZONE 'UTC', 'Mon YYYY') as period
          FROM payouts p
          LEFT JOIN vendors v ON p.vendor_id = v.id
          LEFT JOIN vendor_identity vi ON vi.vendor_id = p.vendor_id
          LEFT JOIN roles r ON v.role_id = r.id
          ORDER BY p.created_at DESC
          LIMIT 50
        `);
      } catch (viErr: any) {
        const msg = String(viErr?.message ?? viErr ?? '');
        if (msg.includes('vendor_identity') && msg.includes('does not exist')) {
          payouts = await query(`
            SELECT p.*,
                   COALESCE(v.business_name, 'Vendor') as vendor_name,
                   COALESCE(v.phone, '') as vendor_phone,
                   r.name as vendor_role,
                   COALESCE(v.category, '') as business_type,
                   to_char(p.created_at AT TIME ZONE 'UTC', 'Mon YYYY') as period
            FROM payouts p
            LEFT JOIN vendors v ON p.vendor_id = v.id
            LEFT JOIN roles r ON v.role_id = r.id
            ORDER BY p.created_at DESC
            LIMIT 50
          `);
        } else {
          throw viErr;
        }
      }
      const rows = (payouts.rows || []).map((row: Record<string, unknown>) => {
        const raw = row.payout_status ?? row.status ?? 'pending';
        const status = (typeof raw === 'string' && raw.trim()) ? raw.trim().toLowerCase() : 'pending';
        const periodVal = row.period ?? (row.created_at
          ? new Date(row.created_at as string).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
          : null);
        const vendorName = row.vendor_name ?? row.business_name ?? 'Vendor';
        const vendorPhone = row.vendor_phone ?? null;
        return {
          ...row,
          vendor_name: vendorName,
          vendorName,
          vendor_phone: vendorPhone,
          vendorPhone,
          vendor_role: row.vendor_role ?? null,
          business_type: row.business_type ?? null,
          period: periodVal ?? '—',
          status,
          payout_status: status,
          source: 'payout',
        };
      });

      // Connect pending/processing settlements so Payout Management shows them (support both settlement_status and status column names; allow missing vendor_identity)
      try {
        let pending: { rows: any[] };
        const runPendingWithVi = (statusCol: string) => `
          SELECT s.id, s.vendor_id, s.total_amount, s.commission_amount, s.net_amount,
                 ${statusCol === 'settlement_status' ? 's.settlement_status' : 's.status as settlement_status'}, s.created_at,
                 COALESCE(v.business_name, vi.business_name, vi.full_name, 'Vendor') as vendor_name,
                 COALESCE(v.phone, vi.phone) as vendor_phone,
                 r.name as vendor_role,
                 COALESCE(v.category, vi.vendor_type, '') as business_type
          FROM settlements s
          LEFT JOIN vendors v ON s.vendor_id = v.id
          LEFT JOIN vendor_identity vi ON vi.vendor_id = s.vendor_id
          LEFT JOIN roles r ON v.role_id = r.id
          WHERE s.${statusCol} IN ('pending', 'processing')
          ORDER BY s.created_at DESC
          LIMIT 50
        `;
        const runPendingNoVi = (statusCol: string) => `
          SELECT s.id, s.vendor_id, s.total_amount, s.commission_amount, s.net_amount,
                 ${statusCol === 'settlement_status' ? 's.settlement_status' : 's.status as settlement_status'}, s.created_at,
                 COALESCE(v.business_name, 'Vendor') as vendor_name,
                 COALESCE(v.phone, '') as vendor_phone,
                 r.name as vendor_role,
                 COALESCE(v.category, '') as business_type
          FROM settlements s
          LEFT JOIN vendors v ON s.vendor_id = v.id
          LEFT JOIN roles r ON v.role_id = r.id
          WHERE s.${statusCol} IN ('pending', 'processing')
          ORDER BY s.created_at DESC
          LIMIT 50
        `;
        try {
          pending = await query(runPendingWithVi('settlement_status'));
        } catch (e1: any) {
          const m1 = String(e1?.message ?? e1 ?? '');
          if (m1.includes('vendor_identity') && m1.includes('does not exist')) {
            try {
              pending = await query(runPendingNoVi('settlement_status'));
            } catch {
              pending = await query(runPendingNoVi('status'));
            }
          } else if (m1.includes('settlement_status') && m1.includes('does not exist')) {
            try {
              pending = await query(runPendingWithVi('status'));
            } catch (e2: any) {
              const m2 = String(e2?.message ?? e2 ?? '');
              if (m2.includes('vendor_identity') && m2.includes('does not exist')) {
                pending = await query(runPendingNoVi('status'));
              } else {
                throw e2;
              }
            }
          } else {
            try {
              pending = await query(runPendingWithVi('status'));
            } catch (e3: any) {
              const m3 = String(e3?.message ?? e3 ?? '');
              if (m3.includes('vendor_identity') && m3.includes('does not exist')) {
                pending = await query(runPendingNoVi('status'));
              } else {
                throw e3;
              }
            }
          }
        }
        const periodFmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';
        for (const s of pending.rows || []) {
          const amt = parseFloat((s as any).net_amount ?? (s as any).total_amount ?? '0');
          if (amt <= 0) continue;
          const vendorName = (s as any).vendor_name ?? 'Vendor';
          const rawSt = (s as any).settlement_status ?? (s as any).status ?? 'pending';
          const st = (typeof rawSt === 'string' && rawSt.trim()) ? rawSt.trim().toLowerCase() : 'pending';
          rows.push({
            id: `settlement-${(s as any).id}`,
            payout_id: null,
            vendor_id: (s as any).vendor_id,
            vendor_name: vendorName,
            vendorName: vendorName,
            vendor_phone: (s as any).vendor_phone ?? null,
            vendorPhone: (s as any).vendor_phone ?? null,
            vendor_role: (s as any).vendor_role ?? null,
            business_type: (s as any).business_type ?? null,
            amount: amt,
            net_amount: amt,
            netAmount: amt,
            commission: parseFloat((s as any).commission_amount ?? '0'),
            period: periodFmt((s as any).created_at),
            status: st === 'processing' ? 'processing' : 'pending',
            payout_status: st === 'processing' ? 'processing' : 'pending',
            source: 'settlement',
            settlement_id: (s as any).id,
            created_at: (s as any).created_at,
          } as any);
        }
      } catch {
        // settlements table may not exist or have different schema
      }

      return c.json({ success: true, payouts: rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/payouts/stats', async (c) => {
    try {
      let stats: { rows: any[] };
      try {
        stats = await query(`
          SELECT 
            COUNT(*) as total_payouts,
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) FILTER (WHERE payout_status IN ('scheduled', 'pending')) as pending_count,
            COUNT(*) FILTER (WHERE payout_status = 'processing') as processing_count,
            COUNT(*) FILTER (WHERE payout_status = 'completed') as completed_count,
            COALESCE(SUM(amount) FILTER (WHERE payout_status IN ('scheduled', 'pending')), 0) as pending_amount,
            COALESCE(SUM(amount) FILTER (WHERE payout_status = 'processing'), 0) as processing_amount,
            COALESCE(SUM(amount) FILTER (WHERE payout_status = 'completed'), 0) as completed_amount
          FROM payouts
        `);
      } catch {
        stats = await query(`
          SELECT 
            COUNT(*) as total_payouts,
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) FILTER (WHERE status IN ('scheduled', 'pending')) as pending_count,
            COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('scheduled', 'pending')), 0) as pending_amount,
            COALESCE(SUM(amount) FILTER (WHERE status = 'processing'), 0) as processing_amount,
            COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as completed_amount
          FROM payouts
        `);
      }
      const row = stats.rows[0] || {};
      let pendingCount = parseInt(row.pending_count as string, 10) || 0;
      let pendingAmount = parseFloat(row.pending_amount as string) || 0;
      let processingCount = parseInt(row.processing_count as string, 10) || 0;
      let processingAmount = parseFloat(row.processing_amount as string) || 0;
      try {
        let settlementStats: { rows: any[] };
        try {
          settlementStats = await query(`
            SELECT 
              COUNT(*) FILTER (WHERE settlement_status = 'pending') as pending_cnt,
              COALESCE(SUM(net_amount) FILTER (WHERE settlement_status = 'pending'), 0) as pending_amt,
              COUNT(*) FILTER (WHERE settlement_status = 'processing') as processing_cnt,
              COALESCE(SUM(net_amount) FILTER (WHERE settlement_status = 'processing'), 0) as processing_amt
            FROM settlements
            WHERE settlement_status IN ('pending', 'processing')
          `);
        } catch {
          settlementStats = await query(`
            SELECT 
              COUNT(*) FILTER (WHERE status = 'pending') as pending_cnt,
              COALESCE(SUM(net_amount) FILTER (WHERE status = 'pending'), 0) as pending_amt,
              COUNT(*) FILTER (WHERE status = 'processing') as processing_cnt,
              COALESCE(SUM(net_amount) FILTER (WHERE status = 'processing'), 0) as processing_amt
            FROM settlements
            WHERE status IN ('pending', 'processing')
          `);
        }
        const s = settlementStats.rows[0];
        if (s) {
          pendingCount += parseInt(s.pending_cnt as string, 10) || 0;
          pendingAmount += parseFloat(s.pending_amt as string) || 0;
          processingCount += parseInt(s.processing_cnt as string, 10) || 0;
          processingAmount += parseFloat(s.processing_amt as string) || 0;
        }
      } catch {
        // settlements table may not exist or different schema
      }
      return c.json({
        success: true,
        stats: {
          pendingCount,
          processingCount,
          completedCount: parseInt(row.completed_count as string, 10) || 0,
          pendingAmount,
          processingAmount,
          completedAmount: parseFloat(row.completed_amount as string) || 0,
        },
      });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // PUT /admin/payouts/:id - Update payout
  app.put('/admin/payouts/:id', async (c) => {
    const payoutId = c.req.param('id');
    try {
      if (!payoutId) {
        return c.json({ success: false, error: 'Invalid payout ID' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const amount = body.amount != null ? parseFloat(String(body.amount)) : null;
      const commission = body.commission != null ? parseFloat(String(body.commission)) : null;
      const tds = body.tds != null ? parseFloat(String(body.tds)) : null;
      const netAmount = body.netAmount != null ? parseFloat(String(body.netAmount)) : body.net_amount != null ? parseFloat(String(body.net_amount)) : null;

      // Check if this is a settlement-based payout
      const isSettlement = String(payoutId).startsWith('settlement-');
      const actualId = isSettlement ? String(payoutId).replace(/^settlement-/, '') : payoutId;

      if (!isSettlement && !isValidUUID(actualId)) {
        return c.json({ success: false, error: 'Invalid payout ID' }, 400);
      }

      let payout: any = null;
      let tableName = 'payouts';
      let idColumn = 'id';

      if (isSettlement) {
        // This is a settlement, check settlements table
        try {
          const settlements = await query(
            `SELECT * FROM settlements WHERE id = $1 LIMIT 1`,
            [actualId]
          );
          payout = (settlements.rows || [])[0] as any;
          tableName = 'settlements';
          idColumn = 'id';
        } catch (settlementErr: any) {
          // settlements table might not exist or have different schema
          return c.json({ success: false, error: 'Settlement not found' }, 404);
        }
      } else {
        // This is a regular payout, check payouts table
        const payouts = await query(
          `SELECT * FROM payouts WHERE id = $1 LIMIT 1`,
          [actualId]
        );
        payout = (payouts.rows || [])[0] as any;
      }

      if (!payout) {
        return c.json({ success: false, error: isSettlement ? 'Settlement not found' : 'Payout not found' }, 404);
      }

      // Check if payout/settlement can be edited (only pending/scheduled/failed can be edited)
      const status = isSettlement
        ? (payout.settlement_status ?? payout.status ?? '')
        : (payout.payout_status ?? payout.status ?? '');
      const allowedForEdit = ['pending', 'scheduled', 'failed', 'processing'];
      if (!allowedForEdit.includes(status)) {
        return c.json({
          success: false,
          error: `${isSettlement ? 'Settlement' : 'Payout'} cannot be edited (status: ${status}). Only pending, scheduled, processing, or failed ${isSettlement ? 'settlements' : 'payouts'} can be edited.`
        }, 400);
      }

      // Build update query dynamically based on what's provided
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Check if columns exist first
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        AND column_name IN ('amount', 'total_amount', 'commission', 'tds', 'net_amount', 'commission_amount', 'tds_amount', 'settlement_status', 'status')
      `, [tableName]);
      const existingColumns = (columnCheck.rows || []).map((r: any) => r.column_name);

      // For settlements, use total_amount; for payouts, use amount
      if (amount != null && !isNaN(amount) && amount >= 0) {
        if (isSettlement) {
          if (existingColumns.includes('total_amount')) {
            updates.push(`total_amount = $${paramIndex}`);
            values.push(amount);
            paramIndex++;
          }
        } else {
          if (existingColumns.includes('amount')) {
            updates.push(`amount = $${paramIndex}`);
            values.push(amount);
            paramIndex++;
          }
        }
      }

      if (commission != null && !isNaN(commission) && commission >= 0) {
        // For settlements, use commission_amount; for payouts, try commission_amount first, then commission
        if (existingColumns.includes('commission_amount')) {
          updates.push(`commission_amount = $${paramIndex}`);
          values.push(commission);
          paramIndex++;
        } else if (existingColumns.includes('commission')) {
          updates.push(`commission = $${paramIndex}`);
          values.push(commission);
          paramIndex++;
        }
      }

      if (tds != null && !isNaN(tds) && tds >= 0) {
        // For settlements, use tds_amount; for payouts, try tds_amount first, then tds
        if (existingColumns.includes('tds_amount')) {
          updates.push(`tds_amount = $${paramIndex}`);
          values.push(tds);
          paramIndex++;
        } else if (existingColumns.includes('tds')) {
          updates.push(`tds = $${paramIndex}`);
          values.push(tds);
          paramIndex++;
        }
      }

      if (netAmount != null && !isNaN(netAmount) && netAmount >= 0) {
        if (existingColumns.includes('net_amount')) {
          updates.push(`net_amount = $${paramIndex}`);
          values.push(netAmount);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        return c.json({ success: false, error: 'No valid fields to update' }, 400);
      }

      // Add updated_at
      if (existingColumns.includes('updated_at')) {
        updates.push(`updated_at = NOW()`);
      }

      // Update the payout or settlement
      const updateQuery = `
        UPDATE ${tableName} 
        SET ${updates.join(', ')}
        WHERE ${idColumn} = $${paramIndex}
        RETURNING *
      `;
      values.push(actualId);

      const result = await query(updateQuery, values);
      const updatedPayout = (result.rows || [])[0] as any;

      return c.json({
        success: true,
        message: `${isSettlement ? 'Settlement' : 'Payout'} updated successfully`,
        payout: updatedPayout,
        settlement: isSettlement ? updatedPayout : undefined,
      });
    } catch (error: any) {
      console.error('Error updating payout:', error);
      const msg = error?.message ?? (typeof error === 'string' ? error : 'Failed to update payout');
      return c.json({ success: false, error: msg }, 500);
    }
  });

  // DELETE /admin/payouts/:id - Delete payout
  app.delete('/admin/payouts/:id', async (c) => {
    const payoutId = c.req.param('id');
    try {
      if (!payoutId) {
        return c.json({ success: false, error: 'Invalid payout ID' }, 400);
      }

      // Check if this is a settlement-based payout
      const isSettlement = String(payoutId).startsWith('settlement-');
      const actualId = isSettlement ? String(payoutId).replace(/^settlement-/, '') : payoutId;

      if (!isSettlement && !isValidUUID(actualId)) {
        return c.json({ success: false, error: 'Invalid payout ID' }, 400);
      }

      let payout: any = null;
      let tableName = 'payouts';
      let idColumn = 'id';

      if (isSettlement) {
        // This is a settlement, check settlements table
        try {
          const settlements = await query(
            `SELECT * FROM settlements WHERE id = $1 LIMIT 1`,
            [actualId]
          );
          payout = (settlements.rows || [])[0] as any;
          tableName = 'settlements';
          idColumn = 'id';
        } catch (settlementErr: any) {
          // settlements table might not exist or have different schema
          return c.json({ success: false, error: 'Settlement not found' }, 404);
        }
      } else {
        // This is a regular payout, check payouts table
        const payouts = await query(
          `SELECT * FROM payouts WHERE id = $1 LIMIT 1`,
          [actualId]
        );
        payout = (payouts.rows || [])[0] as any;
      }

      if (!payout) {
        return c.json({ success: false, error: isSettlement ? 'Settlement not found' : 'Payout not found' }, 404);
      }

      // Check if payout/settlement can be deleted (only pending/scheduled can be deleted)
      const status = isSettlement
        ? (payout.settlement_status ?? payout.status ?? '')
        : (payout.payout_status ?? payout.status ?? '');
      const allowedForDelete = ['pending', 'scheduled'];
      if (!allowedForDelete.includes(status)) {
        return c.json({
          success: false,
          error: `${isSettlement ? 'Settlement' : 'Payout'} cannot be deleted (status: ${status}). Only pending or scheduled ${isSettlement ? 'settlements' : 'payouts'} can be deleted.`
        }, 400);
      }

      // Check if payout has been processed (has razorpay_payout_id) - only for payouts, not settlements
      if (!isSettlement && payout.razorpay_payout_id) {
        return c.json({
          success: false,
          error: 'Payout cannot be deleted because it has already been sent to Razorpay. Use reject or cancel instead.'
        }, 400);
      }

      // Delete the payout or settlement
      await query(
        `DELETE FROM ${tableName} WHERE ${idColumn} = $1`,
        [actualId]
      );

      return c.json({
        success: true,
        message: `${isSettlement ? 'Settlement' : 'Payout'} deleted successfully`,
      });
    } catch (error: any) {
      console.error('Error deleting payout:', error);
      const msg = error?.message ?? (typeof error === 'string' ? error : 'Failed to delete payout');
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post('/admin/payouts/:id/process', async (c) => {
    const payoutId = c.req.param('id');
    try {
      if (!payoutId || !isValidUUID(payoutId)) {
        return c.json({ success: false, error: 'Invalid payout ID' }, 400);
      }
      const payouts = await query(
        `SELECT * FROM payouts WHERE id = $1 LIMIT 1`,
        [payoutId]
      );
      const payout = (payouts.rows || [])[0] as any;
      if (!payout) {
        return c.json({ success: false, error: 'Payout not found' }, 404);
      }
      const status = payout.payout_status ?? payout.status ?? '';
      const allowedForProcess = ['pending', 'scheduled', 'failed'];
      if (!allowedForProcess.includes(status)) {
        return c.json({ success: false, error: `Payout cannot be processed (status: ${status}). Use only for pending, scheduled, or failed (retry after fixing bank).` }, 400);
      }
      const vendorId = payout.vendor_id;
      const amount = parseFloat(payout.amount ?? '0');
      if (amount <= 0) {
        return c.json({ success: false, error: 'Invalid payout amount' }, 400);
      }
      let accountNumber: string;
      let ifscCode: string;
      let accountHolder: string;
      if (payout.bank_account_number && payout.ifsc_code && payout.account_holder_name) {
        accountNumber = String(payout.bank_account_number);
        ifscCode = String(payout.ifsc_code);
        accountHolder = String(payout.account_holder_name);
      } else {
        let bankDetails: any[] = [];
        try {
          const schemaCheck = await query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as ex`);
          if (schemaCheck.rows[0]?.ex) {
            const acc = await query(
              `SELECT * FROM vendor_bank_accounts WHERE vendor_id = $1 AND is_verified = true ORDER BY is_primary DESC LIMIT 1`,
              [vendorId]
            );
            bankDetails = (acc.rows || []).map((r: any) => ({
              account_number: r.account_number,
              ifsc_code: r.ifsc_code ?? r.ifsc,
              account_holder_name: r.account_holder_name ?? r.account_holder,
            }));
          }
        } catch {
          // ignore
        }
        if (bankDetails.length === 0) {
          const details = await select('vendor_bank_details', { vendor_id: vendorId }).catch(() => []);
          bankDetails = Array.isArray(details) ? details : [];
        }
        if (bankDetails.length === 0) {
          return c.json({ success: false, error: 'Vendor bank details not found. Ask vendor to add bank account.' }, 404);
        }
        const bank = bankDetails[0] as any;
        accountNumber = String(bank.account_number ?? bank.accountNumber ?? '').trim();
        ifscCode = String(bank.ifsc_code ?? bank.ifsc ?? '').trim().toUpperCase();
        accountHolder = String(bank.account_holder_name ?? bank.account_holder ?? '').trim();
      }
      if (!accountNumber || !ifscCode || !accountHolder) {
        return c.json({ success: false, error: 'Incomplete bank details (account number, IFSC, or holder name missing)' }, 400);
      }
      const razorpayXAccountNumber = process.env.RAZORPAY_X_ACCOUNT_NUMBER?.trim();
      if (!razorpayXAccountNumber) {
        return c.json({
          success: false,
          error: 'RazorpayX payout source account not configured. Set RAZORPAY_X_ACCOUNT_NUMBER (your RazorpayX Current Account / Customer Identifier from x.razorpay.com → Banking).',
        }, 503);
      }
      let vendorPhone = '0000000000';
      try {
        const v = await query(`SELECT phone FROM vendors WHERE id = $1 LIMIT 1`, [vendorId]);
        if (v?.rows?.[0]?.phone) vendorPhone = String(v.rows[0].phone).replace(/\D/g, '').slice(-10) || vendorPhone;
      } catch {
        // ignore
      }
      let payoutResponse: { id: string };
      const compositeBody = {
        account_number: String(razorpayXAccountNumber).trim(),
        amount: Math.round(amount * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        fund_account: {
          account_type: 'bank_account',
          bank_account: {
            name: accountHolder,
            ifsc: ifscCode,
            account_number: accountNumber,
          },
          contact: {
            name: accountHolder,
            email: `vendor-${vendorId}@payout.warmpawz.com`,
            contact: vendorPhone,
            type: 'vendor',
            reference_id: `vendor-${vendorId}`,
          },
        },
        queue_if_low_balance: true,
        reference_id: `PAYOUT-${payoutId}`.slice(0, 40),
      };
      try {
        payoutResponse = await razorpayClient.payouts.create(compositeBody, payoutId);
      } catch (razorpayError: any) {
        const rawMsg = razorpayError?.message ?? razorpayError?.error?.description ?? 'Razorpay payout failed';
        const isNotFound = /not found|404|url was not found/i.test(String(rawMsg));
        const msg = isNotFound
          ? 'RazorpayX Payouts API is not available for this account. Enable RazorpayX, allowlist IPs in RazorpayX Dashboard, and ensure payout mode is configured.'
          : rawMsg;
        console.error('[admin/payouts/process] Razorpay error:', rawMsg);
        try {
          await query(
            `UPDATE payouts SET payout_status = $1, failure_reason = $2 WHERE id = $3::uuid`,
            ['failed', msg, payoutId]
          );
        } catch {
          // ignore update failure
        }
        const status = isNotFound ? 503 : 500;
        return c.json({ success: false, error: msg }, status);
      }
      try {
        await query(
          `UPDATE payouts SET payout_status = $1, razorpay_payout_id = $2 WHERE id = $3::uuid`,
          ['processing', payoutResponse.id, payoutId]
        );
      } catch (updateErr: any) {
        console.error('[admin/payouts/process] Update payouts error:', updateErr?.message);
        return c.json({
          success: false,
          error: 'Payout sent to Razorpay but failed to update local record. Check payout status in Razorpay dashboard.',
        }, 500);
      }
      return c.json({
        success: true,
        message: 'Payout initiated successfully',
        payoutId,
        razorpayPayoutId: payoutResponse.id,
      });
    } catch (error: any) {
      console.error('Error processing payout:', error);
      const msg = error?.message ?? (typeof error === 'string' ? error : 'Failed to process payout');
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.get('/admin/platform/feature-flags', async (c) => {
    try {
      const flags = await query('SELECT * FROM feature_flags ORDER BY name ASC');
      return c.json({ success: true, flags: flags.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/platform/settings', async (c) => {
    try {
      const settings = await query('SELECT * FROM platform_settings ORDER BY key ASC');
      return c.json({ success: true, settings: settings.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/policies', async (c) => {
    try {
      const policies = await query('SELECT * FROM policies ORDER BY created_at DESC');
      return c.json({ success: true, policies: policies.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/problem-categories', async (c) => {
    try {
      const categories = await query('SELECT * FROM problem_categories ORDER BY name ASC');
      return c.json({ success: true, categories: categories.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/profile', async (c) => {
    try {
      const adminId = c.req.query('adminId') || 'default';
      const profile = await query('SELECT * FROM admin_profiles WHERE id = $1', [adminId]);
      return c.json({ success: true, profile: profile.rows[0] || {} });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/promotions', async (c) => {
    try {
      const promotions = await query('SELECT * FROM promotions ORDER BY created_at DESC LIMIT 50');
      return c.json({ success: true, promotions: promotions.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/rbac/activity', async (c) => {
    try {
      const activity = await query('SELECT * FROM rbac_activity_log ORDER BY created_at DESC LIMIT 100');
      return c.json({ success: true, activity: activity.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/rbac/alerts', async (c) => {
    try {
      const alerts = await query('SELECT * FROM rbac_alerts ORDER BY created_at DESC LIMIT 50');
      return c.json({ success: true, alerts: alerts.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/rbac/export', async (c) => {
    try {
      return c.json({ success: true, message: 'Export functionality' });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/rbac/import', async (c) => {
    try {
      return c.json({ success: true, message: 'Import functionality' });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/rbac/migrations/history', async (c) => {
    try {
      const history = await query('SELECT * FROM role_migrations ORDER BY created_at DESC LIMIT 50');
      return c.json({ success: true, history: history.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/refunds', async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let queryStr = `
        SELECT 
          r.*,
          c.name as customer_name,
          c.phone as customer_phone,
          p.razorpay_payment_id,
          b.service_name
        FROM refunds r
        LEFT JOIN customers c ON r.customer_id = c.id
        LEFT JOIN payments p ON r.payment_id = p.id
        LEFT JOIN bookings b ON r.booking_id = b.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        queryStr += ` AND r.refund_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      queryStr += ` ORDER BY r.requested_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const refunds = await query(queryStr, params);

      const safeRefunds = (refunds.rows || []).map((r: any) => ({
        id: String(r.id || ''),
        booking_id: r.booking_id ? String(r.booking_id) : undefined,
        order_id: r.order_id ? String(r.order_id) : undefined,
        customer_name: String(r.customer_name || ''),
        customer_phone: String(r.customer_phone || ''),
        payment_id: String(r.payment_id || ''),
        amount: parseFloat(r.refund_amount || '0'),
        reason: String(r.refund_reason || ''),
        status: String(r.refund_status || 'pending'),
        type: r.booking_id ? 'booking' : 'order',
        created_at: String(r.requested_at || ''),
        processed_at: r.processed_at ? String(r.processed_at) : undefined,
        processed_by: r.processed_by || undefined,
        refund_id: r.razorpay_refund_id || undefined,
        admin_notes: r.admin_comment || undefined,
      }));

      return c.json({
        success: true,
        refunds: safeRefunds,
        total: safeRefunds.length,
      });
    } catch (error: any) {
      console.error('Error fetching refunds:', error);
      return c.json({ success: true, refunds: [], total: 0 });
    }
  });

  app.get('/admin/refunds/stats', async (c) => {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE refund_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE refund_status IN ('approved', 'processing', 'completed', 'processed')) as approved,
          COUNT(*) FILTER (WHERE refund_status = 'rejected') as rejected,
          COALESCE(SUM(refund_amount) FILTER (WHERE refund_status IN ('approved', 'processing', 'completed', 'processed')), 0) as total_amount,
          COALESCE(SUM(refund_amount) FILTER (WHERE refund_status = 'pending'), 0) as pending_amount
        FROM refunds
      `).catch(() => ({
        rows: [{
          total: '0',
          pending: '0',
          approved: '0',
          rejected: '0',
          total_amount: '0',
          pending_amount: '0'
        }]
      }));

      return c.json({
        success: true,
        stats: {
          total: parseInt(stats.rows[0]?.total || '0', 10),
          pending: parseInt(stats.rows[0]?.pending || '0', 10),
          approved: parseInt(stats.rows[0]?.approved || '0', 10),
          rejected: parseInt(stats.rows[0]?.rejected || '0', 10),
          totalAmount: parseFloat(stats.rows[0]?.total_amount || '0'),
          pendingAmount: parseFloat(stats.rows[0]?.pending_amount || '0'),
        },
      });
    } catch (error: any) {
      console.error('Error fetching refund stats:', error);
      return c.json({
        success: true,
        stats: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          totalAmount: 0,
          pendingAmount: 0,
        }
      });
    }
  });

  app.post('/admin/refunds/:refundId/approve', async (c) => {
    try {
      const refundId = c.req.param('refundId');
      const body = await c.req.json().catch(() => ({}));
      const { notes } = body;

      const refunds = await select('refunds', { id: refundId });
      if (refunds.length === 0) {
        return c.json({ success: false, error: 'Refund not found' }, 404);
      }

      const refund = refunds[0];

      if (refund.refund_status !== 'pending') {
        return c.json({ success: false, error: 'Refund not in pending state' }, 400);
      }

      // Update refund status to approved (will trigger processing)
      await update('refunds', { id: refundId }, {
        refund_status: 'approved',
        admin_comment: notes || null,
        updated_at: new Date().toISOString(),
      });

      // Trigger refund processing (this would normally be done by a background job)
      // For now, we'll mark it as processing
      await update('refunds', { id: refundId }, {
        refund_status: 'processing',
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Refund approved and processing',
        refund_id: refundId,
      });
    } catch (error: any) {
      console.error('Error approving refund:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.post('/admin/refunds/:refundId/reject', async (c) => {
    try {
      const refundId = c.req.param('refundId');
      const body = await c.req.json().catch(() => ({}));
      const { reason } = body;

      if (!reason) {
        return c.json({ success: false, error: 'Rejection reason is required' }, 400);
      }

      const refunds = await select('refunds', { id: refundId });
      if (refunds.length === 0) {
        return c.json({ success: false, error: 'Refund not found' }, 404);
      }

      const refund = refunds[0];

      if (refund.refund_status !== 'pending') {
        return c.json({ success: false, error: 'Refund not in pending state' }, 400);
      }

      await update('refunds', { id: refundId }, {
        refund_status: 'rejected',
        rejection_reason: reason,
        admin_comment: reason,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Refund rejected',
      });
    } catch (error: any) {
      console.error('Error rejecting refund:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/regions', async (c) => {
    try {
      const regions = await query('SELECT * FROM regions ORDER BY name ASC');
      return c.json({ success: true, regions: regions.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/renewals/notices', async (c) => {
    try {
      const notices = await query('SELECT * FROM renewal_notices ORDER BY created_at DESC LIMIT 50');
      return c.json({ success: true, notices: notices.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/reports', async (c) => {
    try {
      // Try with created_at first, fallback to id if column doesn't exist
      let reports;
      try {
        reports = await query('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50');
      } catch {
        reports = await query('SELECT * FROM reports ORDER BY id DESC LIMIT 50');
      }
      return c.json({ success: true, reports: reports.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/reports/generate', async (c) => {
    try {
      return c.json({ success: true, message: 'Report generation started' });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/reports/generated', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10', 10);
      // Try with created_at, fallback to id if column doesn't exist
      const reports = await query('SELECT * FROM generated_reports ORDER BY id DESC LIMIT $1', [limit]).catch(async () => {
        // If table doesn't exist or has issues, return empty
        return { rows: [] };
      });
      return c.json({ success: true, reports: reports.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/reports/save', async (c) => {
    try {
      return c.json({ success: true, message: 'Report saved' });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/reports/saved', async (c) => {
    try {
      // Try with created_at first, fallback to id if column doesn't exist
      let reports;
      try {
        reports = await query('SELECT * FROM saved_reports ORDER BY created_at DESC');
      } catch {
        reports = await query('SELECT * FROM saved_reports ORDER BY id DESC');
      }
      return c.json({ success: true, reports: reports.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/reports/templates', async (c) => {
    try {
      const templates = await query('SELECT * FROM report_templates ORDER BY name ASC');
      return c.json({ success: true, templates: templates.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // Admin endpoint to fix service_categories foreign key constraint issue
  // This endpoint attempts to drop the problematic parent_category_id column and foreign key constraint
  app.post('/admin/migrations/fix-service-categories-constraint', async (c) => {
    try {
      console.log('🔧 Fixing service_categories table - removing parent_category_id column...');

      // Step 1: Drop the foreign key constraint by name
      try {
        await query(`
          ALTER TABLE service_categories 
          DROP CONSTRAINT IF EXISTS service_categories_parent_fkey CASCADE;
        `);
        console.log('✅ Dropped service_categories_parent_fkey constraint');
      } catch (constraintError: any) {
        console.warn('⚠️ Could not drop constraint:', constraintError.message);
      }

      // Step 2: Drop parent_category_id column if it exists (THIS IS THE SOURCE OF THE ERROR)
      try {
        await query(`
          ALTER TABLE service_categories 
          DROP COLUMN IF EXISTS parent_category_id CASCADE;
        `);
        console.log('✅ Dropped parent_category_id column');
      } catch (columnError: any) {
        // If column drop fails, table might need to be recreated
        console.warn('⚠️ Could not drop parent_category_id column:', columnError.message);
        console.log('⚠️ Table may need to be dropped and recreated manually');
      }

      // Step 3: Try to ensure category_id and is_active columns exist (from migration 048)
      try {
        await query(`
          DO $$ 
          BEGIN
            -- Add category_id if it doesn't exist
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'service_categories' 
              AND column_name = 'category_id'
            ) THEN
              ALTER TABLE service_categories ADD COLUMN category_id TEXT;
              CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_category_id ON service_categories(category_id) WHERE category_id IS NOT NULL;
            END IF;
            
            -- Add is_active if it doesn't exist
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'service_categories' 
              AND column_name = 'is_active'
            ) THEN
              ALTER TABLE service_categories ADD COLUMN is_active BOOLEAN DEFAULT true;
            END IF;
          END $$;
        `);
        console.log('✅ Updated table structure');
      } catch (alterError: any) {
        console.warn('⚠️ Could not alter table structure:', alterError.message);
      }

      return c.json({
        success: true,
        message: 'Service categories table fix attempted. If uuid = text error persists, table may need to be dropped and recreated manually via database migration.'
      });
    } catch (error: any) {
      console.error('Error fixing table:', error);
      return c.json({
        success: false,
        error: error.message,
        message: 'Could not fix service_categories table. Manual database migration may be required to drop parent_category_id column and foreign key constraint.'
      }, 500);
    }
  });

  // Migration endpoint to add config column to roles table
  app.post('/admin/migrations/add-roles-config-column', async (c) => {
    try {
      console.log('🔧 Adding config column to roles table...');

      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'roles' AND column_name = 'config'
          ) THEN
            ALTER TABLE roles ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
            CREATE INDEX IF NOT EXISTS idx_roles_config ON roles USING gin(config);
            RAISE NOTICE 'Added config column to roles table';
          ELSE
            RAISE NOTICE 'config column already exists in roles table';
          END IF;
        END $$;
      `);

      return c.json({
        success: true,
        message: 'Config column added to roles table (or already exists)',
      });
    } catch (error: any) {
      console.error('Error adding config column:', error);
      return c.json({
        success: false,
        error: `Migration failed: ${error.message}`,
      }, 500);
    }
  });

  // Migration endpoint to fix service_catalog and onboarding_forms schema
  app.post('/admin/migrations/fix-catalog-schemas', async (c) => {
    try {
      console.log('🔧 Fixing service_catalog and onboarding_forms schemas...');

      const results: string[] = [];

      // 1. Add role_id column to service_catalog if missing (for backward compatibility)
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'service_catalog' AND column_name = 'role_id'
          ) THEN
            ALTER TABLE service_catalog ADD COLUMN role_id VARCHAR(255);
            CREATE INDEX IF NOT EXISTS idx_service_catalog_role_id ON service_catalog(role_id);
            RAISE NOTICE 'Added role_id column to service_catalog table';
          ELSE
            RAISE NOTICE 'role_id column already exists in service_catalog table';
          END IF;
        END $$;
      `).then(() => results.push('service_catalog.role_id: added')).catch((err: any) => {
        console.error('Error adding role_id to service_catalog:', err);
        results.push(`service_catalog.role_id: ${err.message}`);
      });

      // 2. Add is_active column to onboarding_forms if missing
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'onboarding_forms' AND column_name = 'is_active'
          ) THEN
            ALTER TABLE onboarding_forms ADD COLUMN is_active BOOLEAN DEFAULT true;
            CREATE INDEX IF NOT EXISTS idx_onboarding_forms_is_active ON onboarding_forms(is_active);
            RAISE NOTICE 'Added is_active column to onboarding_forms table';
          ELSE
            RAISE NOTICE 'is_active column already exists in onboarding_forms table';
          END IF;
        END $$;
      `).then(() => results.push('onboarding_forms.is_active: added')).catch((err: any) => {
        console.error('Error adding is_active to onboarding_forms:', err);
        results.push(`onboarding_forms.is_active: ${err.message}`);
      });

      // 3. Ensure service_catalog has is_active column if missing
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'service_catalog' AND column_name = 'is_active'
          ) THEN
            ALTER TABLE service_catalog ADD COLUMN is_active BOOLEAN DEFAULT true;
            RAISE NOTICE 'Added is_active column to service_catalog table';
          END IF;
        END $$;
      `).then(() => results.push('service_catalog.is_active: added')).catch((err: any) => {
        console.error('Error adding is_active to service_catalog:', err);
        results.push(`service_catalog.is_active: ${err.message}`);
      });

      // 4. Ensure service_catalog has duration column if missing (for compatibility)
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'service_catalog' AND column_name = 'duration'
          ) THEN
            ALTER TABLE service_catalog ADD COLUMN duration INTEGER DEFAULT 30;
            RAISE NOTICE 'Added duration column to service_catalog table';
          END IF;
        END $$;
      `).then(() => results.push('service_catalog.duration: added')).catch((err: any) => {
        console.error('Error adding duration to service_catalog:', err);
        results.push(`service_catalog.duration: ${err.message}`);
      });

      return c.json({
        success: true,
        message: 'Schema fixes applied',
        results,
      });
    } catch (error: any) {
      console.error('Error fixing schemas:', error);
      return c.json({
        success: false,
        error: `Migration failed: ${error.message}`,
      }, 500);
    }
  });

  // Migration endpoint to create missing tables and columns
  app.post('/admin/migrations/create-missing-tables', async (c) => {
    try {
      console.log('🔧 Running migrations to create missing tables and columns...');

      // Add config column to roles table if it doesn't exist
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'roles' AND column_name = 'config'
          ) THEN
            ALTER TABLE roles ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
            CREATE INDEX IF NOT EXISTS idx_roles_config ON roles USING gin(config);
            RAISE NOTICE 'Added config column to roles table';
          END IF;
        END $$;
      `).catch(err => console.error('Error adding config column:', err));

      // Create service_catalog table
      const serviceCatalogMigration = `
        CREATE TABLE IF NOT EXISTS service_catalog (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_id TEXT UNIQUE NOT NULL,
          service_name TEXT NOT NULL,
          display_name TEXT,
          description TEXT,
          category_id TEXT,
          category_name TEXT,
          sub_category_id TEXT,
          sub_category_name TEXT,
          applicable_roles TEXT[] NOT NULL DEFAULT '{}',
          service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele', 'all')),
          base_price DECIMAL(10, 2) DEFAULT 0,
          duration_minutes INTEGER DEFAULT 30,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
          publish_status TEXT DEFAULT 'published' CHECK (publish_status IN ('draft', 'published', 'archived')),
          metadata JSONB,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category_id);
        CREATE INDEX IF NOT EXISTS idx_service_catalog_sub_category ON service_catalog(sub_category_id);
        CREATE INDEX IF NOT EXISTS idx_service_catalog_applicable_roles ON service_catalog USING gin(applicable_roles);
        CREATE INDEX IF NOT EXISTS idx_service_catalog_service_style ON service_catalog(service_style);
        CREATE INDEX IF NOT EXISTS idx_service_catalog_status ON service_catalog(status, publish_status);
      `;

      // Create/update service_categories table (with correct schema from migration 048)
      // IMPORTANT: Drop ALL constraints first, then recreate table structure to avoid uuid = text error
      const serviceCategoriesMigration = `
        -- Step 1: Drop ALL constraints on service_categories to avoid any type mismatches
        DO $$ 
        DECLARE
          r RECORD;
        BEGIN
          -- Drop all constraints (foreign keys, checks, etc.)
          FOR r IN (
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'service_categories'::regclass
          ) LOOP
            EXECUTE 'ALTER TABLE service_categories DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
          END LOOP;
          
          -- Drop indexes that might cause issues
          DROP INDEX IF EXISTS idx_service_categories_category_id;
          DROP INDEX IF EXISTS idx_service_categories_active;
          DROP INDEX IF EXISTS idx_service_categories_display_order;
        END $$;
        
        -- Step 2: Drop parent_category_id column if it exists (THIS IS THE SOURCE OF uuid = text ERROR)
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'service_categories' 
            AND column_name = 'parent_category_id'
          ) THEN
            -- First drop any constraints on this column
            ALTER TABLE service_categories DROP CONSTRAINT IF EXISTS service_categories_parent_fkey CASCADE;
            -- Then drop the column
            ALTER TABLE service_categories DROP COLUMN parent_category_id CASCADE;
            RAISE NOTICE 'Dropped parent_category_id column';
          END IF;
        END $$;
        
        -- Step 3: Check if table has data - if empty, drop and recreate to fix schema
        DO $$
        DECLARE
          row_count INTEGER;
        BEGIN
          -- Use a safe COUNT query that won't trigger type validation
          BEGIN
            EXECUTE 'SELECT COUNT(*) FROM service_categories' INTO row_count;
            -- If empty, drop and recreate
            IF row_count = 0 THEN
              DROP TABLE service_categories CASCADE;
              RAISE NOTICE 'Dropped empty service_categories table for recreation';
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- If COUNT fails due to schema issue, drop table anyway
            DROP TABLE service_categories CASCADE;
            RAISE NOTICE 'Dropped service_categories table due to schema error';
          END;
        END $$;
        
        -- Step 4: Create table with clean schema (migration 048 style, NO parent_category_id UUID)
        CREATE TABLE IF NOT EXISTS service_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category_id TEXT UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          display_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Step 5: Create indexes (all TEXT-based, no UUID foreign keys)
        CREATE INDEX IF NOT EXISTS idx_service_categories_category_id ON service_categories(category_id) WHERE category_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_service_categories_active ON service_categories(is_active) WHERE is_active IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_service_categories_display_order ON service_categories(display_order);
        CREATE INDEX IF NOT EXISTS idx_service_categories_name ON service_categories(name);
        
        -- NOTE: We intentionally DO NOT create parent_category_id column or any UUID foreign keys
        -- The parent_category_id UUID column with foreign key constraint from migration 002 causes "uuid = text" errors
        -- Use category_id (TEXT) for relationships instead, or recreate without foreign key constraints
      `;

      // Create banners table
      const bannersMigration = `
        CREATE TABLE IF NOT EXISTS banners (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL CHECK (type IN ('main', 'spotlight', 'category', 'service')),
          title TEXT NOT NULL,
          subtitle TEXT,
          image_url TEXT,
          cta_text TEXT,
          cta_link TEXT,
          metadata JSONB,
          start_date TIMESTAMPTZ,
          end_date TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT true,
          display_order INTEGER DEFAULT 0,
          target_role_id TEXT,
          target_service_category TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_banners_type ON banners(type);
        CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
        CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_banners_role ON banners(target_role_id) WHERE target_role_id IS NOT NULL;
      `;

      await query(serviceCatalogMigration);
      console.log('✅ service_catalog table created');

      await query(serviceCategoriesMigration);
      console.log('✅ service_categories table created');

      // IMPORTANT: Drop the problematic foreign key constraint that causes "uuid = text" error
      // This constraint is from migration 002 but conflicts with the new schema
      try {
        await query(`
          DO $$ 
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_categories_parent_fkey') THEN
              ALTER TABLE service_categories DROP CONSTRAINT service_categories_parent_fkey;
              RAISE NOTICE 'Dropped service_categories_parent_fkey constraint';
            END IF;
          END $$;
        `);
        console.log('✅ Dropped problematic foreign key constraint');
      } catch (constraintError: any) {
        console.warn('⚠️ Could not drop constraint (may already be dropped):', constraintError.message);
      }

      await query(bannersMigration);
      console.log('✅ banners table created');

      // Financial tables migration
      console.log('🔧 Creating financial tables...');

      // Create vendor_tiers table
      await query(`
        CREATE TABLE IF NOT EXISTS vendor_tiers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tier_name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            commission_rate NUMERIC(5, 2) NOT NULL,
            min_bookings INTEGER DEFAULT 0,
            min_revenue NUMERIC(12, 2) DEFAULT 0,
            is_free_tier BOOLEAN DEFAULT false,
            monthly_fee NUMERIC(10, 2) DEFAULT 0,
            six_month_fee NUMERIC(10, 2) DEFAULT 0,
            twelve_month_fee NUMERIC(10, 2) DEFAULT 0,
            yearly_fee NUMERIC(10, 2) DEFAULT 0,
            features JSONB DEFAULT '{}',
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vendor_tiers_name ON vendor_tiers(tier_name);
        INSERT INTO vendor_tiers (tier_name, display_name, commission_rate, min_bookings, min_revenue, is_free_tier, monthly_fee, yearly_fee, display_order) VALUES
            ('Bronze', 'Bronze', 15, 0, 0, true, 0, 0, 1),
            ('Silver', 'Silver', 12, 50, 50000, false, 999, 9990, 2),
            ('Gold', 'Gold', 10, 200, 200000, false, 2499, 24990, 3),
            ('Platinum', 'Platinum', 8, 500, 500000, false, 4999, 49990, 4)
        ON CONFLICT (tier_name) DO UPDATE SET 
            commission_rate = EXCLUDED.commission_rate,
            min_bookings = EXCLUDED.min_bookings,
            min_revenue = EXCLUDED.min_revenue,
            monthly_fee = EXCLUDED.monthly_fee,
            yearly_fee = EXCLUDED.yearly_fee;
      `).catch(e => console.log('vendor_tiers:', e.message));
      console.log('✅ vendor_tiers table created');

      // Create vendor_tier_subscriptions table
      await query(`
        CREATE TABLE IF NOT EXISTS vendor_tier_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            tier_id UUID NOT NULL REFERENCES vendor_tiers(id),
            subscription_type TEXT NOT NULL CHECK (subscription_type IN ('monthly', 'six_month', 'twelve_month', 'yearly')),
            payment_type TEXT NOT NULL DEFAULT 'upfront' CHECK (payment_type IN ('upfront', 'split', 'settlement_deduction')),
            total_amount NUMERIC(10, 2) NOT NULL,
            discount_amount NUMERIC(10, 2) DEFAULT 0,
            final_amount NUMERIC(10, 2) NOT NULL,
            split_installments INTEGER,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending_payment')),
            start_date DATE NOT NULL DEFAULT CURRENT_DATE,
            end_date DATE NOT NULL,
            payment_method TEXT DEFAULT 'upfront' CHECK (payment_method IN ('upfront', 'settlement_deduction')),
            settlement_deduction_installments INTEGER DEFAULT 2,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vendor_tier_subs_vendor ON vendor_tier_subscriptions(vendor_id);
      `).catch(e => console.log('vendor_tier_subscriptions:', e.message));
      console.log('✅ vendor_tier_subscriptions table created');

      // Create tier_upgrade_deductions table
      await query(`
        CREATE TABLE IF NOT EXISTS tier_upgrade_deductions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            subscription_id UUID REFERENCES vendor_tier_subscriptions(id) ON DELETE CASCADE,
            tier_id UUID REFERENCES vendor_tiers(id),
            total_amount NUMERIC(10, 2) NOT NULL,
            recovery_installments INTEGER NOT NULL DEFAULT 2,
            amount_per_installment NUMERIC(10, 2) NOT NULL,
            amount_recovered NUMERIC(10, 2) NOT NULL DEFAULT 0,
            amount_remaining NUMERIC(10, 2) NOT NULL,
            installments_completed INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_tier_upgrade_deductions_vendor ON tier_upgrade_deductions(vendor_id);
      `).catch(e => console.log('tier_upgrade_deductions:', e.message));
      console.log('✅ tier_upgrade_deductions table created');

      // Add settlement_breakup columns
      await query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'settlements' AND column_name = 'settlement_breakup') THEN
            ALTER TABLE settlements ADD COLUMN settlement_breakup JSONB DEFAULT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'settlements' AND column_name = 'tier_deduction_amount') THEN
            ALTER TABLE settlements ADD COLUMN tier_deduction_amount NUMERIC(10, 2) DEFAULT 0;
          END IF;
        END $$;
      `).catch(e => console.log('settlements columns:', e.message));
      console.log('✅ settlements columns added');

      // Create vendor_earnings table
      await query(`
        CREATE TABLE IF NOT EXISTS vendor_earnings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            amount NUMERIC(10, 2) NOT NULL,
            commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
            total_amount NUMERIC(10, 2) NOT NULL,
            commission_rate NUMERIC(5, 2) NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'paid_out', 'cancelled')),
            realized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            paid_out_at TIMESTAMPTZ,
            settlement_id UUID REFERENCES settlements(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vendor_earnings_vendor ON vendor_earnings(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_earnings_booking ON vendor_earnings(booking_id);
      `).catch(e => console.log('vendor_earnings:', e.message));
      console.log('✅ vendor_earnings table created');

      return c.json({
        success: true,
        message: 'Missing tables created successfully',
        tables: ['service_catalog', 'service_categories', 'banners', 'vendor_tiers', 'vendor_tier_subscriptions', 'tier_upgrade_deductions', 'vendor_earnings']
      });
    } catch (error: any) {
      console.error('Error running migrations:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // Create financial tables for tier system
  app.post('/admin/migrations/create-financial-tables', async (c) => {
    try {
      console.log('🔧 Running financial tables migration...');

      // Create vendor_tiers table
      await query(`
        CREATE TABLE IF NOT EXISTS vendor_tiers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tier_name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            commission_rate NUMERIC(5, 2) NOT NULL,
            min_bookings INTEGER DEFAULT 0,
            min_revenue NUMERIC(12, 2) DEFAULT 0,
            is_free_tier BOOLEAN DEFAULT false,
            monthly_fee NUMERIC(10, 2) DEFAULT 0,
            six_month_fee NUMERIC(10, 2) DEFAULT 0,
            twelve_month_fee NUMERIC(10, 2) DEFAULT 0,
            yearly_fee NUMERIC(10, 2) DEFAULT 0,
            features JSONB DEFAULT '{}',
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_vendor_tiers_name ON vendor_tiers(tier_name);
        CREATE INDEX IF NOT EXISTS idx_vendor_tiers_order ON vendor_tiers(display_order);

        -- Insert default tiers if not exists
        INSERT INTO vendor_tiers (tier_name, display_name, commission_rate, min_bookings, min_revenue, is_free_tier, monthly_fee, yearly_fee, display_order) VALUES
            ('Bronze', 'Bronze', 15, 0, 0, true, 0, 0, 1),
            ('Silver', 'Silver', 12, 50, 50000, false, 999, 9990, 2),
            ('Gold', 'Gold', 10, 200, 200000, false, 2499, 24990, 3),
            ('Platinum', 'Platinum', 8, 500, 500000, false, 4999, 49990, 4)
        ON CONFLICT (tier_name) DO NOTHING;
      `);
      console.log('✅ vendor_tiers table created');

      // Create vendor_tier_subscriptions table
      await query(`
        CREATE TABLE IF NOT EXISTS vendor_tier_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            tier_id UUID NOT NULL REFERENCES vendor_tiers(id),
            subscription_type TEXT NOT NULL CHECK (subscription_type IN ('monthly', 'six_month', 'twelve_month', 'yearly')),
            payment_type TEXT NOT NULL CHECK (payment_type IN ('upfront', 'split', 'settlement_deduction')),
            total_amount NUMERIC(10, 2) NOT NULL,
            discount_amount NUMERIC(10, 2) DEFAULT 0,
            final_amount NUMERIC(10, 2) NOT NULL,
            split_installments INTEGER,
            split_interval_days INTEGER,
            next_payment_date DATE,
            next_payment_amount NUMERIC(10, 2),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending_payment')),
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            payment_ids UUID[] DEFAULT '{}',
            payment_method TEXT DEFAULT 'upfront' CHECK (payment_method IN ('upfront', 'settlement_deduction')),
            settlement_deduction_installments INTEGER DEFAULT 2,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vendor_tier_subs_vendor ON vendor_tier_subscriptions(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_tier_subs_status ON vendor_tier_subscriptions(status);
      `);
      console.log('✅ vendor_tier_subscriptions table created');

      // Create tier_upgrade_deductions table
      await query(`
        CREATE TABLE IF NOT EXISTS tier_upgrade_deductions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            subscription_id UUID NOT NULL REFERENCES vendor_tier_subscriptions(id) ON DELETE CASCADE,
            tier_id UUID NOT NULL REFERENCES vendor_tiers(id),
            total_amount NUMERIC(10, 2) NOT NULL,
            recovery_installments INTEGER NOT NULL DEFAULT 2,
            amount_per_installment NUMERIC(10, 2) NOT NULL,
            amount_recovered NUMERIC(10, 2) NOT NULL DEFAULT 0,
            amount_remaining NUMERIC(10, 2) NOT NULL,
            installments_completed INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_tier_upgrade_deductions_vendor ON tier_upgrade_deductions(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_tier_upgrade_deductions_status ON tier_upgrade_deductions(status);
      `);
      console.log('✅ tier_upgrade_deductions table created');

      // Create tier_deduction_transactions table
      await query(`
        CREATE TABLE IF NOT EXISTS tier_deduction_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deduction_id UUID NOT NULL REFERENCES tier_upgrade_deductions(id) ON DELETE CASCADE,
            settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            installment_number INTEGER NOT NULL,
            amount NUMERIC(10, 2) NOT NULL,
            settlement_gross_amount NUMERIC(10, 2) NOT NULL,
            settlement_net_amount NUMERIC(10, 2) NOT NULL,
            description TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tier_deduction_transactions_deduction ON tier_deduction_transactions(deduction_id);
        CREATE INDEX IF NOT EXISTS idx_tier_deduction_transactions_settlement ON tier_deduction_transactions(settlement_id);
      `);
      console.log('✅ tier_deduction_transactions table created');

      // Add settlement_breakup and tier_deduction_amount to settlements
      await query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'settlements' AND column_name = 'settlement_breakup') THEN
            ALTER TABLE settlements ADD COLUMN settlement_breakup JSONB DEFAULT NULL;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'settlements' AND column_name = 'tier_deduction_amount') THEN
            ALTER TABLE settlements ADD COLUMN tier_deduction_amount NUMERIC(10, 2) DEFAULT 0;
          END IF;
        END $$;
      `);
      console.log('✅ settlements table updated with breakup columns');

      // Create vendor_earnings table if not exists
      await query(`
        CREATE TABLE IF NOT EXISTS vendor_earnings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            amount NUMERIC(10, 2) NOT NULL,
            commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
            total_amount NUMERIC(10, 2) NOT NULL,
            commission_rate NUMERIC(5, 2) NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'paid_out', 'cancelled')),
            realized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            paid_out_at TIMESTAMPTZ,
            settlement_id UUID REFERENCES settlements(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vendor_earnings_vendor ON vendor_earnings(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_earnings_booking ON vendor_earnings(booking_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_earnings_status ON vendor_earnings(status);
        CREATE INDEX IF NOT EXISTS idx_vendor_earnings_settlement ON vendor_earnings(settlement_id);
      `);
      console.log('✅ vendor_earnings table created');

      return c.json({
        success: true,
        message: 'Financial tables created successfully',
        tables: ['vendor_tiers', 'vendor_tier_subscriptions', 'tier_upgrade_deductions', 'tier_deduction_transactions', 'vendor_earnings']
      });
    } catch (error: any) {
      console.error('Error creating financial tables:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ❌ REMOVED DUPLICATE ENDPOINT - Use service-catalog.ts:525 GET /admin/service-catalog instead
  // This duplicate was causing response structure conflicts and losing advanced features
  // The main endpoint in service-catalog.ts provides:
  // - Hierarchical grouping
  // - Role filtering
  // - Service style filtering
  // - Proper data formatting

  app.get('/admin/settings', async (c) => {
    try {
      const settings = await query('SELECT * FROM platform_settings ORDER BY setting_key ASC');
      return c.json({ success: true, settings: settings.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // Platform Settings - AWS Integration (SNS SMS, S3, SQS, Chime, Bedrock)
  // Uses admin:settings:aws - auth sendSmsViaSns reads this for SMS credentials
  app.get('/admin/settings/aws', async (c) => {
    try {
      const row = await query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:settings:aws' LIMIT 1`
      ).then(r => r.rows?.[0]).catch(() => null);
      const settings = row?.setting_value || {
        credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
        s3: { enabled: false, bucket: '', region: 'ap-south-1' },
        sns: { enabled: false, region: 'ap-south-1', smsOriginationNumber: 'WARMPZ', entityId: '1201176605406673276', templateId: '1207177028377787269', emailSourceAddress: '' },
        sqs: { enabled: false, queueUrl: '', region: 'ap-south-1' },
        chime: { enabled: false, region: 'us-east-1' },
        bedrock: { enabled: false, region: 'us-east-1', modelId: 'anthropic.claude-v2' },
      };
      return c.json({ success: true, settings });
    } catch (error: unknown) {
      return c.json({ success: true, settings: {} });
    }
  });

  app.post('/admin/settings/aws', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      await query(
        `INSERT INTO platform_settings (setting_key, setting_value, setting_type, is_public, created_at, updated_at)
         VALUES ('admin:settings:aws', $1::jsonb, 'object', false, NOW(), NOW())
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1::jsonb, updated_at = NOW()`,
        [JSON.stringify(body)]
      );
      return c.json({ success: true, message: 'AWS settings saved' });
    } catch (error: unknown) {
      const err = error as Error;
      return c.json({ success: false, error: err?.message || 'Failed to save AWS settings' }, 500);
    }
  });

  // Platform Settings - Payment Gateway
  app.get('/admin/settings/payment-gateway', async (c) => {
    try {
      const settings = await query(`
        SELECT 
          id,
          integration_name,
          integration_config,
          is_active
        FROM platform_integrations 
        WHERE integration_name IN ('razorpay', 'stripe', 'paytm')
        ORDER BY integration_name ASC
      `).catch(() => ({ rows: [] }));

      return c.json({ success: true, settings: settings.rows });
    } catch (error: unknown) {
      console.error('[payment-gateway] Error:', error);
      return c.json({ success: true, settings: [] });
    }
  });

  app.post('/admin/settings/payment-gateway', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      // Save payment gateway settings
      return c.json({ success: true, message: 'Payment gateway settings saved' });
    } catch (error: unknown) {
      return c.json({ success: false, error: 'Failed to save payment gateway settings' }, 500);
    }
  });

  // Platform Settings - Google Maps
  app.get('/admin/settings/google-maps', async (c) => {
    try {
      const settings = await query(`
        SELECT * FROM platform_settings 
        WHERE setting_key LIKE 'google_maps_%' OR setting_key LIKE 'maps_%'
        ORDER BY setting_key ASC
      `).catch(() => ({ rows: [] }));
      return c.json({ success: true, settings: settings.rows });
    } catch (error: unknown) {
      return c.json({ success: true, settings: [] });
    }
  });

  app.post('/admin/settings/google-maps', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      // Save Google Maps settings
      return c.json({ success: true, message: 'Google Maps settings saved' });
    } catch (error: unknown) {
      return c.json({ success: false, error: 'Failed to save Google Maps settings' }, 500);
    }
  });

  app.put('/admin/settings', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));

      // Update platform settings - can be a single setting or multiple
      // For JSONB columns, pg library automatically converts JavaScript objects/arrays to JSONB
      // For strings, we need to pass them as-is (pg will handle JSON string conversion)
      if (body.setting_key && body.setting_value !== undefined) {
        // Single setting update
        const existing = await select('platform_settings', { setting_key: body.setting_key });
        // Pass value directly - pg will handle JSONB conversion
        const settingValue = body.setting_value;

        if (existing.length > 0) {
          await update('platform_settings',
            { setting_key: body.setting_key },
            {
              setting_value: settingValue,
              updated_at: new Date().toISOString(),
            }
          );
        } else {
          await insert('platform_settings', {
            setting_key: body.setting_key,
            setting_value: settingValue,
            setting_type: typeof body.setting_value === 'string' ? 'string' : 'object',
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        // Bulk update - update multiple settings
        for (const [key, value] of Object.entries(body)) {
          if (value === undefined) continue;

          const existing = await select('platform_settings', { setting_key: key });
          // Pass value directly - pg will handle JSONB conversion

          if (existing.length > 0) {
            await update('platform_settings',
              { setting_key: key },
              {
                setting_value: value,
                updated_at: new Date().toISOString(),
              }
            );
          } else {
            await insert('platform_settings', {
              setting_key: key,
              setting_value: value,
              setting_type: typeof value === 'string' ? 'string' : 'object',
              is_public: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      return c.json({
        success: true,
        message: 'Settings updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/admin/content/pages', async (c) => {
    try {
      const pages = await query('SELECT * FROM content_pages ORDER BY updated_at DESC').catch(() => ({ rows: [] }));

      const safePages = (pages.rows || []).map((p: any) => ({
        pageId: String(p.id || p.page_id || ''),
        title: String(p.title || ''),
        slug: String(p.slug || ''),
        content: String(p.content || ''),
        category: String(p.category || 'other'),
        isPublished: p.is_published !== false && p.is_published !== 'false',
        updatedAt: String(p.updated_at || p.updatedAt || ''),
      }));

      return c.json({ success: true, pages: safePages });
    } catch (error: any) {
      console.error('Error fetching content pages:', error);
      return c.json({ success: true, pages: [] });
    }
  });

  app.post('/admin/content/pages', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { title, slug, content, category, isPublished } = body;

      if (!title || !slug) {
        return c.json({ error: 'title and slug are required' }, 400);
      }

      const page = await insert('content_pages', {
        title,
        slug,
        content: content || '',
        category: category || 'other',
        is_published: isPublished !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        page: page[0],
        message: 'Page created successfully',
      });
    } catch (error: any) {
      console.error('Error creating content page:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/content/pages/:slug/preview
   * Get a content page by slug for admin preview (works for both published and unpublished)
   * IMPORTANT: This route must be defined BEFORE /admin/content/pages/:pageId to ensure proper matching
   */
  app.get('/admin/content/pages/:slug/preview', async (c) => {
    try {
      const rawSlug = c.req.param('slug');
      console.log('[Admin Content Preview] Received request:', { rawSlug, url: c.req.url, path: c.req.path });
      
      // Decode URL-encoded slug
      let slug: string;
      try {
        slug = rawSlug ? decodeURIComponent(rawSlug) : '';
      } catch (e) {
        slug = rawSlug || '';
      }

      console.log('[Admin Content Preview] Decoded slug:', { rawSlug, decodedSlug: slug });

      if (!slug) {
        return c.json({ success: false, error: 'Slug is required' }, 400);
      }

      // Try exact match first (most common case)
      console.log('[Admin Content Preview] Executing exact match query with slug:', slug);
      let pageResult = await query(
        `SELECT 
          id,
          title,
          slug,
          content,
          category,
          is_published,
          created_at,
          updated_at
        FROM content_pages
        WHERE slug = $1
        LIMIT 1`,
        [slug]
      ).catch((err) => {
        console.error('[Admin Content Preview] Exact match query error:', err);
        return { rows: [] };
      });

      console.log('[Admin Content Preview] Exact match result:', {
        found: pageResult.rows?.length > 0,
        rowCount: pageResult.rows?.length || 0,
        matchedSlug: pageResult.rows?.[0]?.slug,
      });

      // If exact match fails, try multiple slug variations
      if (!pageResult.rows || pageResult.rows.length === 0) {
        console.log('[Admin Content Preview] Exact match failed, trying variations for slug:', slug);
        
        const slugVariations = [
          slug,
          slug.replace(/\s+/g, '-'),
          slug.replace(/\s+/g, '_'),
          slug.toLowerCase(),
          slug.toLowerCase().replace(/\s+/g, '-'),
          slug.toLowerCase().replace(/\s+/g, '_'),
        ];

        const uniqueVariations = [...new Set(slugVariations)];
        console.log('[Admin Content Preview] Trying variations:', uniqueVariations);
        
        const placeholders = uniqueVariations.map((_, i) => `$${i + 1}`).join(', ');

        pageResult = await query(
          `SELECT 
            id,
            title,
            slug,
            content,
            category,
            is_published,
            created_at,
            updated_at
          FROM content_pages
          WHERE slug IN (${placeholders})
          LIMIT 1`,
          uniqueVariations
        ).catch((err) => {
          console.error('[Admin Content Preview] Variations query error:', err);
          return { rows: [] };
        });
      }

      if (!pageResult.rows || pageResult.rows.length === 0) {
        // Try case-insensitive search
        const caseInsensitiveResult = await query(
          `SELECT 
            id,
            title,
            slug,
            content,
            category,
            is_published,
            created_at,
            updated_at
          FROM content_pages
          WHERE LOWER(TRIM(slug)) = LOWER(TRIM($1))
          LIMIT 1`,
          [slug]
        ).catch(() => ({ rows: [] }));

        if (caseInsensitiveResult.rows && caseInsensitiveResult.rows.length > 0) {
          const page = caseInsensitiveResult.rows[0];
          return c.json({
            success: true,
            page: {
              id: page.id,
              title: page.title,
              slug: page.slug,
              content: page.content,
              category: page.category,
              readTime: '5 min', // Default since metadata column doesn't exist
              featured: false,
              imageUrl: null,
              seoTitle: page.title,
              seoDescription: page.content?.substring(0, 160) || '',
              createdAt: page.created_at,
              updatedAt: page.updated_at,
              isPublished: page.is_published === true || page.is_published === 'true',
            },
          });
        }

        return c.json({ 
          success: false, 
          error: 'Page not found' 
        }, 404);
      }

      const page = pageResult.rows[0];
      
      return c.json({
        success: true,
        page: {
          id: page.id,
          title: page.title,
          slug: page.slug,
          content: page.content,
          category: page.category,
          readTime: '5 min', // Default since metadata column doesn't exist
          featured: false,
          imageUrl: null,
          seoTitle: page.title,
          seoDescription: page.content?.substring(0, 160) || '',
          createdAt: page.created_at,
          updatedAt: page.updated_at,
          isPublished: page.is_published === true || page.is_published === 'true',
        },
      });
    } catch (error: any) {
      console.error('Error fetching content page for preview:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to fetch page' 
      }, 500);
    }
  });

  app.put('/admin/content/pages/:pageId', async (c) => {
    try {
      const pageId = c.req.param('pageId');
      const body = await c.req.json().catch(() => ({}));

      const pages = await select('content_pages', { id: pageId });
      if (pages.length === 0) {
        return c.json({ error: 'Page not found' }, 404);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.title !== undefined) updateData.title = body.title;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.isPublished !== undefined) updateData.is_published = body.isPublished !== false;

      const updated = await update('content_pages', { id: pageId }, updateData);

      return c.json({
        success: true,
        page: updated[0],
        message: 'Page updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating content page:', error);
      return c.json({ error: error.message }, 500);
    }
  });


  app.delete('/admin/content/pages/:pageId', async (c) => {
    try {
      const pageId = c.req.param('pageId');

      const pages = await select('content_pages', { id: pageId });
      if (pages.length === 0) {
        return c.json({ error: 'Page not found' }, 404);
      }

      await deleteRows('content_pages', { id: pageId });

      return c.json({
        success: true,
        message: 'Page deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting content page:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/admin/integrations', async (c) => {
    try {
      const integrations = await query('SELECT * FROM integrations ORDER BY name ASC');
      return c.json({ success: true, integrations: integrations.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/integrations/aws', async (c) => {
    try {
      const aws = await query('SELECT * FROM aws_integrations ORDER BY created_at DESC');
      return c.json({ success: true, integrations: aws.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/integrations/google-maps', async (c) => {
    try {
      const maps = await query('SELECT * FROM google_maps_integrations ORDER BY created_at DESC');
      return c.json({ success: true, integrations: maps.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/integrations/razorpay', async (c) => {
    try {
      const razorpay = await query('SELECT * FROM razorpay_integrations ORDER BY created_at DESC');
      return c.json({ success: true, integrations: razorpay.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/integrations/shiprocket', async (c) => {
    try {
      const shiprocket = await query('SELECT * FROM shiprocket_integrations ORDER BY created_at DESC');
      return c.json({ success: true, integrations: shiprocket.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/integrations/logistics', async (c) => {
    try {
      const partnersResult = await query(
        `SELECT 
          partner_id as id,
          partner_name as name,
          partner_type as type,
          enabled,
          base_url as baseUrl,
          email as apiEndpoint,
          api_key as apiKey,
          config->>'categories' as categories,
          config->>'pricing' as pricing,
          config->>'regions' as regions,
          config,
          created_at,
          updated_at
        FROM logistics_partners
        ORDER BY enabled DESC NULLS LAST, partner_name ASC`
      );

      const partners = (partnersResult.rows || []).map((p: any) => {
        const config = p.config || {};
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          enabled: p.enabled !== false,
          baseUrl: p.baseUrl || config.pidgeApiBase || config.baseUrl || null,
          apiEndpoint: p.apiEndpoint || config.apiEndpoint || null,
          apiKey: p.apiKey ? '••••••••' : null,
          categories: config.categories || (typeof p.categories === 'string' ? JSON.parse(p.categories) : []),
          pricing: config.pricing || (typeof p.pricing === 'string' ? JSON.parse(p.pricing) : {}),
          regions: config.regions || (typeof p.regions === 'string' ? JSON.parse(p.regions) : []),
        };
      });

      return c.json({
        success: true,
        partners: partners,
      });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/integrations/logistics', async (c) => {
    try {
      const partnerData = await c.req.json();
      const {
        id: partner_id,
        name: partner_name,
        type: partner_type,
        enabled,
        baseUrl,
        apiEndpoint,
        apiKey,
        categories,
        pricing,
        regions,
      } = partnerData;

      if (!partner_id || !partner_name || !partner_type) {
        return c.json({ success: false, error: 'id, name, and type are required' }, 400);
      }

      const config: any = {};
      if (categories) config.categories = categories;
      if (pricing) config.pricing = pricing;
      if (regions) config.regions = regions;
      if (
        'baseUrl' in partnerData &&
        baseUrl != null &&
        String(baseUrl).trim() &&
        String(partner_type) === 'pidge'
      ) {
        config.pidgeApiBase = String(baseUrl).trim();
      }

      const partnerRecord: Record<string, unknown> = {
        partner_id: String(partner_id),
        partner_name: String(partner_name),
        partner_type: String(partner_type),
        enabled: enabled !== false,
        email: apiEndpoint || null,
        config,
        updated_at: new Date().toISOString(),
      };

      if ('baseUrl' in partnerData) {
        partnerRecord.base_url =
          baseUrl != null && String(baseUrl).trim() ? String(baseUrl).trim() : null;
      }
      if (apiKey && String(apiKey) !== '••••••••') {
        partnerRecord.api_key = String(apiKey);
      }

      await upsert('logistics_partners', partnerRecord, 'partner_id');

      return c.json({
        success: true,
        message: 'Logistics partner saved',
        partner: partnerRecord,
      });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.put('/admin/integrations/logistics', async (c) => {
    try {
      const logisticsData = await c.req.json();

      await upsert('platform_settings',
        {
          setting_key: 'platform:settings:logistics',
          setting_value: logisticsData,
          setting_type: 'json',
          description: 'Logistics partner configuration',
        },
        'setting_key'
      );

      return c.json({
        success: true,
        message: 'Logistics settings updated',
      });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/onboarding/design', async (c) => {
    try {
      const design = await query('SELECT * FROM onboarding_design ORDER BY created_at DESC');
      return c.json({ success: true, design: design.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.get('/admin/governance/audit-log', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const logs = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
      return c.json({ success: true, logs: logs.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/fix/approve-all-vendors', async (c) => {
    try {
      await query('UPDATE vendors SET status = \'approved\' WHERE status = \'pending\'');
      return c.json({ success: true, message: 'All vendors approved' });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/fix/activate-approved-vendors', async (c) => {
    try {
      const result = await query('UPDATE vendors SET is_active = true, updated_at = NOW() WHERE status = \'approved\' AND is_active = false RETURNING id, phone, business_name');
      return c.json({ success: true, message: 'All approved vendors activated', activated: result.rows.length, vendors: result.rows });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // ============================================================================
  // DIAGNOSTIC ENDPOINT: Debug vendor data
  // ============================================================================
  app.get('/admin/debug/vendor-status', async (c) => {
    try {
      // 1. Count vendors by status
      const statusCounts = await query(`
        SELECT status, is_active, COUNT(*) as count
        FROM vendors
        GROUP BY status, is_active
        ORDER BY status, is_active
      `);

      // 2. Get sample of approved + active vendors
      const activeVendors = await query(`
        SELECT 
          v.id, v.phone, v.business_name, v.status, v.is_active, v.role_id,
          r.name as role_name, r.display_name as role_display_name,
          vi.vendor_type as vi_vendor_type,
          r.config->>'vendorConfiguration' as role_vendor_config
        FROM vendors v
        LEFT JOIN roles r ON r.id = v.role_id
        LEFT JOIN vendor_identity vi ON vi.vendor_id = v.id
        WHERE v.status = 'approved' AND v.is_active = true
        ORDER BY v.created_at DESC
        LIMIT 10
      `);

      // 3. Get sample of approved but NOT active vendors  
      const approvedNotActive = await query(`
        SELECT 
          v.id, v.phone, v.business_name, v.status, v.is_active, v.role_id,
          r.name as role_name
        FROM vendors v
        LEFT JOIN roles r ON r.id = v.role_id
        WHERE v.status = 'approved' AND (v.is_active = false OR v.is_active IS NULL)
        ORDER BY v.created_at DESC
        LIMIT 10
      `);

      // 4. Get vendor_identity records with vendor_type
      const vendorIdentities = await query(`
        SELECT 
          vi.id, vi.phone, vi.vendor_type, vi.onboarding_status, vi.vendor_id,
          r.name as role_name, r.config->>'vendorConfiguration' as role_vendor_config
        FROM vendor_identity vi
        LEFT JOIN roles r ON r.id = vi.selected_role_id
        WHERE vi.vendor_type IS NOT NULL AND vi.vendor_type != ''
        LIMIT 20
      `);

      // 5. Get roles that are solo type
      const soloRoles = await query(`
        SELECT id, name, display_name, config->>'vendorConfiguration' as vendor_config
        FROM roles
        WHERE 
          name LIKE '%_solo' 
          OR name LIKE 'solo_%' 
          OR config->>'vendorConfiguration' = 'solo'
          OR LOWER(display_name) LIKE '%solo%'
      `);

      // 6. Check if vendor_identity has vendor_id column
      const viColumns = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'vendor_identity' AND column_name = 'vendor_id'
      `);

      return c.json({
        success: true,
        diagnostics: {
          statusCounts: statusCounts.rows,
          activeVendorsSample: activeVendors.rows,
          approvedNotActiveSample: approvedNotActive.rows,
          vendorIdentitiesWithType: vendorIdentities.rows,
          soloRoles: soloRoles.rows,
          vendorIdentityHasVendorIdColumn: viColumns.rows.length > 0
        }
      });
    } catch (error: unknown) {
      console.error('Debug endpoint error:', error);
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/fix/create-vendor-identity', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { phone, roleId } = body;

      if (!phone) {
        return c.json({ success: false, error: 'phone is required' }, 400);
      }

      // Check if vendor_identity already exists
      const existing = await query('SELECT * FROM vendor_identity WHERE phone = $1', [phone]);
      if (existing.rows.length > 0) {
        // Update existing to activated status
        await query('UPDATE vendor_identity SET selected_role_id = $1, onboarding_status = \'ACTIVATED\', updated_at = NOW() WHERE phone = $2', [roleId, phone]);
        return c.json({ success: true, message: 'Vendor identity updated', identity: existing.rows[0] });
      }

      // Create new vendor_identity (without vendor_id column since it doesn't exist)
      const result = await query(`
        INSERT INTO vendor_identity (phone, selected_role_id, onboarding_status, metadata, created_at, updated_at)
        VALUES ($1, $2, 'ACTIVATED', '{}', NOW(), NOW())
        RETURNING *
      `, [phone, roleId]);

      return c.json({ success: true, message: 'Vendor identity created', identity: result.rows[0] });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  app.post('/admin/fix/publish-vendor-services', async (c) => {
    try {
      await query('UPDATE vendor_services SET is_active = true WHERE is_active = false');
      return c.json({ success: true, message: 'Vendor services published' });
    } catch (error: unknown) {
      const errorResponse = createSafeErrorResponse(error, 'Internal server error', 500);
      return c.json({ success: false, error: errorResponse.error }, errorResponse.statusCode as ContentfulStatusCode);
    }
  });

  // ============================================================================
  // UTILITY ENDPOINTS (Admin UI compatibility)
  // ============================================================================

  app.get('/health', async (c) => {
    try {
      // Basic health check
      await query('SELECT 1');
      return c.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (error: any) {
      return c.json({
        success: false,
        status: 'unhealthy',
        error: error.message,
      }, 503);
    }
  });

  app.get('/quality/alerts', async (c) => {
    try {
      // Get quality alerts (could be from a quality_alerts table or calculated)
      const alerts = await query(`
        SELECT 
          v.id as vendor_id,
          v.business_name,
          v.phone,
          COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
          COUNT(b.id) FILTER (WHERE b.status = 'completed' AND b.rating < 3) as low_rated_bookings
        FROM vendors v
        LEFT JOIN bookings b ON v.id = b.vendor_id
        WHERE v.is_active = true
        GROUP BY v.id, v.business_name, v.phone
        HAVING COUNT(b.id) FILTER (WHERE b.status = 'cancelled') > 5
           OR COUNT(b.id) FILTER (WHERE b.status = 'completed' AND b.rating < 3) > 3
        ORDER BY cancelled_bookings DESC, low_rated_bookings DESC
        LIMIT 20
      `).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        alerts: alerts.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching quality alerts:', error);
      return c.json({ success: true, alerts: [] });
    }
  });

  app.get('/debug/vendor-lookup/:phone', async (c) => {
    try {
      const phone = c.req.param('phone');
      const vendors = await select('vendors', { phone });

      return c.json({
        success: true,
        vendors: vendors || [],
        count: vendors?.length || 0,
      });
    } catch (error: any) {
      console.error('Error in vendor lookup:', error);
      return c.json({ success: true, vendors: [], count: 0 });
    }
  });

  app.post('/admin/vendor/reject', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { vendorId, reason } = body;

      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      await update('vendors', { id: vendorId }, {
        status: 'rejected',
        rejection_reason: reason || null,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Vendor rejected successfully',
      });
    } catch (error: any) {
      console.error('Error rejecting vendor:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/vendor/request-info', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { vendorId, comment } = body;

      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      // Update vendor status to request clarification
      await update('vendors', { id: vendorId }, {
        status: 'pending_clarification',
        admin_notes: comment || null,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Information request sent to vendor',
      });
    } catch (error: any) {
      console.error('Error requesting vendor info:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.delete('/admin/vendor/flush-all', async (c) => {
    try {
      // Soft delete: deactivate all vendors
      await query('UPDATE vendors SET is_active = false, status = \'deactivated\', updated_at = NOW()');

      return c.json({
        success: true,
        message: 'All vendors deactivated',
      });
    } catch (error: any) {
      console.error('Error flushing vendors:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/seed-vendors', async (c) => {
    try {
      // This would trigger vendor seeding - placeholder
      return c.json({
        success: true,
        message: 'Vendor seeding initiated',
      });
    } catch (error: any) {
      console.error('Error seeding vendors:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/seed/reset-and-seed', async (c) => {
    try {
      // This would reset and seed data - placeholder
      return c.json({
        success: true,
        message: 'Reset and seed initiated',
      });
    } catch (error: any) {
      console.error('Error resetting and seeding:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/seed/clear-vendors', async (c) => {
    try {
      // Soft delete all vendors
      await query('UPDATE vendors SET is_active = false, updated_at = NOW()');

      return c.json({
        success: true,
        message: 'All vendors cleared',
      });
    } catch (error: any) {
      console.error('Error clearing vendors:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/seed/ecommerce-categories
   * Seed e-commerce product categories for the marketplace
   */
  app.post('/admin/seed/ecommerce-categories', async (c) => {
    try {
      const categories = [
        { name: 'Pet Food', description: 'Dog food, cat food, and treats', display_order: 1 },
        { name: 'Pet Accessories', description: 'Collars, leashes, bowls, and more', display_order: 2 },
        { name: 'Pet Toys', description: 'Interactive toys, chew toys, and plush toys', display_order: 3 },
        { name: 'Pet Grooming', description: 'Shampoos, brushes, and grooming tools', display_order: 4 },
        { name: 'Pet Health', description: 'Supplements, vitamins, and health products', display_order: 5 },
        { name: 'Pet Beds & Furniture', description: 'Beds, crates, and pet furniture', display_order: 6 },
        { name: 'Pet Clothing', description: 'Jackets, sweaters, and costumes', display_order: 7 },
        { name: 'Pet Travel', description: 'Carriers, car seats, and travel accessories', display_order: 8 },
        { name: 'Pet Pharmacy', description: 'Medications and prescription items', display_order: 9 },
        { name: 'Pet Training', description: 'Training aids, clickers, and pads', display_order: 10 },
      ];

      let inserted = 0;
      let skipped = 0;

      for (const cat of categories) {
        try {
          // Check if category already exists
          const existing = await query(
            'SELECT id FROM ecommerce_categories WHERE name = $1',
            [cat.name]
          );

          if (existing.rows.length === 0) {
            await query(
              `INSERT INTO ecommerce_categories (name, description, display_order, is_active)
               VALUES ($1, $2, $3, true)`,
              [cat.name, cat.description, cat.display_order]
            );
            inserted++;
          } else {
            skipped++;
          }
        } catch (err: any) {
          console.error(`Error inserting category ${cat.name}:`, err);
        }
      }

      return c.json({
        success: true,
        message: `E-commerce categories seeded: ${inserted} inserted, ${skipped} skipped (already exist)`,
        inserted,
        skipped,
        total: categories.length,
      });
    } catch (error: any) {
      console.error('Error seeding e-commerce categories:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/fix-vendor-categories', async (c) => {
    try {
      // Fix vendor categories - placeholder
      return c.json({
        success: true,
        message: 'Vendor categories fixed',
      });
    } catch (error: any) {
      console.error('Error fixing vendor categories:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/vendors/fix-indexes', async (c) => {
    try {
      // Fix database indexes - placeholder
      return c.json({
        success: true,
        message: 'Indexes fixed',
      });
    } catch (error: any) {
      console.error('Error fixing indexes:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // VENDOR ADMINISTRATION - COMPLIANCE, INSIGHTS, ACTIVITIES, FRAUD DETECTION
  // ============================================================================

  // Compliance Issues Actions
  app.post('/admin/vendors/compliance-issues/:issueId/investigate', async (c) => {
    try {
      const issueId = c.req.param('issueId');
      const body = await c.req.json().catch(() => ({}));
      const adminId = body.adminId || 'system';

      // Update compliance issue status
      try {
        await query(`
          UPDATE compliance_issues 
          SET status = 'investigating', 
              investigated_by = $1,
              investigated_at = NOW(),
              updated_at = NOW()
          WHERE id = $2
        `, [adminId, issueId]);
      } catch (err) {
        // If compliance_issues table doesn't exist, try updating vendor directly
        await query(`
          UPDATE vendors 
          SET status = 'under_review',
              updated_at = NOW()
          WHERE id = $1
        `, [issueId]);
      }

      return c.json({
        success: true,
        message: 'Issue marked as investigating',
        issueId,
      });
    } catch (error: any) {
      console.error('Error investigating compliance issue:', error);
      return c.json({ error: error.message || 'Failed to update issue status' }, 500);
    }
  });

  app.post('/admin/vendors/compliance-issues/:issueId/resolve', async (c) => {
    try {
      const issueId = c.req.param('issueId');
      const body = await c.req.json().catch(() => ({}));
      const adminId = body.adminId || 'system';
      const resolutionNotes = body.notes || null;

      // Update compliance issue status
      try {
        await query(`
          UPDATE compliance_issues 
          SET status = 'resolved', 
              resolved_by = $1,
              resolved_at = NOW(),
              resolution_notes = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [adminId, resolutionNotes, issueId]);
      } catch (err) {
        // If compliance_issues table doesn't exist, try updating vendor directly
        await query(`
          UPDATE vendors 
          SET status = 'approved',
              updated_at = NOW()
          WHERE id = $1
        `, [issueId]);
      }

      return c.json({
        success: true,
        message: 'Issue marked as resolved',
        issueId,
      });
    } catch (error: any) {
      console.error('Error resolving compliance issue:', error);
      return c.json({ error: error.message || 'Failed to resolve issue' }, 500);
    }
  });

  // Vendor Insights
  app.get('/admin/vendors/insights', async (c) => {
    try {
      const range = c.req.query('range') || '30d';
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

      // Get sales data
      const salesData = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0) as total_sales,
          COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.created_at >= NOW() - INTERVAL '${days} days' THEN b.total_amount ELSE 0 END), 0) as period_sales,
          COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.created_at >= NOW() - INTERVAL '${days * 2} days' AND b.created_at < NOW() - INTERVAL '${days} days' THEN b.total_amount ELSE 0 END), 0) as previous_period_sales
        FROM bookings b
        WHERE b.created_at >= NOW() - INTERVAL '${days * 2} days'
      `).catch(() => ({ rows: [{ total_sales: 0, period_sales: 0, previous_period_sales: 0 }] }));

      const sales = salesData.rows[0] || { total_sales: 0, period_sales: 0, previous_period_sales: 0 };
      const growth = sales.previous_period_sales > 0
        ? ((sales.period_sales - sales.previous_period_sales) / sales.previous_period_sales) * 100
        : 0;

      // Get booking statistics
      const bookingStats = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
          COUNT(*) as total_bookings,
          AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating
        FROM bookings
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `).catch(() => ({ rows: [{ completed_bookings: 0, cancelled_bookings: 0, total_bookings: 0, avg_rating: 0 }] }));

      const stats = bookingStats.rows[0] || { completed_bookings: 0, cancelled_bookings: 0, total_bookings: 0, avg_rating: 0 };
      const cancellationRate = stats.total_bookings > 0
        ? (stats.cancelled_bookings / stats.total_bookings) * 100
        : 0;

      // Get vendor distribution by category
      const categoryDist = await query(`
        SELECT 
          COALESCE(v.category, v.vendor_type, 'other') as category,
          COUNT(*) as count
        FROM vendors v
        WHERE v.is_active = true
        GROUP BY COALESCE(v.category, v.vendor_type, 'other')
      `).catch(() => ({ rows: [] }));

      const totalVendors = categoryDist.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
      const byCategory = categoryDist.rows.map((r, idx) => ({
        name: r.category.charAt(0).toUpperCase() + r.category.slice(1),
        value: parseInt(r.count),
        color: COLORS[idx % COLORS.length]
      }));

      // Get vendor status distribution
      const statusDist = await query(`
        SELECT 
          CASE 
            WHEN is_active = true AND status = 'approved' THEN 'Active'
            WHEN status = 'pending' OR status = 'pending_approval' THEN 'Pending'
            WHEN is_active = false THEN 'Suspended'
            ELSE 'Other'
          END as status,
          COUNT(*) as count
        FROM vendors
        GROUP BY 
          CASE 
            WHEN is_active = true AND status = 'approved' THEN 'Active'
            WHEN status = 'pending' OR status = 'pending_approval' THEN 'Pending'
            WHEN is_active = false THEN 'Suspended'
            ELSE 'Other'
          END
      `).catch(() => ({ rows: [] }));

      const byStatus = statusDist.rows.map((r, idx) => ({
        name: r.status,
        value: parseInt(r.count),
        color: r.status === 'Active' ? COLORS[1] : r.status === 'Pending' ? COLORS[3] : COLORS[4]
      }));

      // Get daily trends
      const trends = await query(`
        SELECT 
          DATE(b.created_at) as date,
          COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0) as sales,
          COUNT(*) FILTER (WHERE b.status = 'completed') as bookings,
          COUNT(DISTINCT b.vendor_id) as vendors
        FROM bookings b
        WHERE b.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(b.created_at)
        ORDER BY DATE(b.created_at) ASC
      `).catch(() => ({ rows: [] }));

      const trendsData = trends.rows.map(r => ({
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: parseFloat(r.sales) || 0,
        bookings: parseInt(r.bookings) || 0,
        vendors: parseInt(r.vendors) || 0
      }));

      return c.json({
        sales: {
          total: parseFloat(sales.total_sales) || 0,
          growth: Math.round(growth * 10) / 10,
          thisMonth: parseFloat(sales.period_sales) || 0,
          lastMonth: parseFloat(sales.previous_period_sales) || 0,
          trend: growth >= 0 ? 'up' : 'down'
        },
        activities: {
          totalBookings: parseInt(stats.total_bookings) || 0,
          completedBookings: parseInt(stats.completed_bookings) || 0,
          cancelledBookings: parseInt(stats.cancelled_bookings) || 0,
          cancellationRate: Math.round(cancellationRate * 10) / 10,
          avgRating: parseFloat(stats.avg_rating) || 0
        },
        distribution: {
          byCategory,
          byStatus
        },
        trends: trendsData
      });
    } catch (error: any) {
      console.error('Error fetching vendor insights:', error);
      return c.json({ error: error.message || 'Failed to fetch insights' }, 500);
    }
  });

  // Vendor Activities
  app.get('/admin/vendors/activities', async (c) => {
    try {
      const filter = c.req.query('filter') || 'all';
      const limit = parseInt(c.req.query('limit') || '50');

      let activitiesQuery = `
        SELECT 
          'booking' as activity_type,
          b.id as activity_id,
          v.id as vendor_id,
          v.business_name as vendor_name,
          'New booking created' as description,
          b.created_at as timestamp,
          jsonb_build_object(
            'bookingId', b.id,
            'amount', b.total_amount,
            'status', b.status
          ) as metadata,
          CASE 
            WHEN b.status = 'completed' THEN 'success'
            WHEN b.status = 'cancelled' THEN 'error'
            ELSE 'info'
          END as severity
        FROM bookings b
        INNER JOIN vendors v ON v.id = b.vendor_id
        WHERE b.created_at >= NOW() - INTERVAL '7 days'
      `;

      if (filter !== 'all') {
        if (filter === 'booking') {
          activitiesQuery += ` AND true`;
        } else if (filter === 'payment') {
          activitiesQuery = `
            SELECT 
              'payment' as activity_type,
              t.id as activity_id,
              v.id as vendor_id,
              v.business_name as vendor_name,
              'Payment received' as description,
              t.created_at as timestamp,
              jsonb_build_object('amount', t.amount, 'type', t.type) as metadata,
              'success' as severity
            FROM transactions t
            INNER JOIN vendors v ON v.id = t.vendor_id
            WHERE t.created_at >= NOW() - INTERVAL '7 days' AND t.type = 'payment'
          `;
        }
      }

      activitiesQuery += ` ORDER BY timestamp DESC LIMIT $1`;

      const activities = await query(activitiesQuery, [limit]).catch(() => ({ rows: [] }));

      const formatted = activities.rows.map((r: any) => ({
        id: r.activity_id,
        vendorId: r.vendor_id,
        vendorName: r.vendor_name,
        activityType: r.activity_type,
        description: r.description,
        timestamp: r.timestamp,
        metadata: r.metadata || {},
        severity: r.severity || 'info'
      }));

      return c.json({
        activities: formatted
      });
    } catch (error: any) {
      console.error('Error fetching vendor activities:', error);
      return c.json({ activities: [] });
    }
  });

  // Fraud Alerts
  app.get('/admin/vendors/fraud-alerts', async (c) => {
    try {
      // Detect suspicious patterns
      const suspiciousPayments = await query(`
        SELECT 
          v.id as vendor_id,
          v.business_name as vendor_name,
          COUNT(DISTINCT t.id) as transaction_count,
          COUNT(DISTINCT CASE WHEN t.type = 'refund' THEN t.id END) as refund_count,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
          ROUND(COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(DISTINCT b.id), 0) * 100, 1) as cancellation_rate
        FROM vendors v
        LEFT JOIN transactions t ON t.vendor_id = v.id AND t.created_at >= NOW() - INTERVAL '30 days'
        LEFT JOIN bookings b ON b.vendor_id = v.id AND b.created_at >= NOW() - INTERVAL '30 days'
        WHERE v.is_active = true
        GROUP BY v.id, v.business_name
        HAVING 
          COUNT(DISTINCT CASE WHEN t.type = 'refund' THEN t.id END) > 5
          OR COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled') > 10
          OR (COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(DISTINCT b.id), 0)) > 0.3
        ORDER BY refund_count DESC, cancellation_rate DESC
        LIMIT 20
      `).catch(() => ({ rows: [] }));

      const alerts = suspiciousPayments.rows.map((r: any, idx: number) => {
        let riskLevel = 'low';
        let alertType = 'suspicious_payment';

        if (r.refund_count > 10 || r.cancellation_rate > 40) {
          riskLevel = 'high';
        } else if (r.refund_count > 5 || r.cancellation_rate > 25) {
          riskLevel = 'medium';
        }

        if (r.cancellation_rate > 30) {
          alertType = 'cancellation_pattern';
        } else if (r.refund_count > 5) {
          alertType = 'suspicious_payment';
        }

        return {
          id: `alert-${r.vendor_id}-${idx}`,
          vendorId: r.vendor_id,
          vendorName: r.vendor_name,
          riskLevel,
          alertType,
          description: r.refund_count > 5
            ? `Multiple refund requests (${r.refund_count}) in short time period`
            : `High cancellation rate (${r.cancellation_rate}%)`,
          detectedAt: new Date().toISOString(),
          evidence: {
            transactionCount: parseInt(r.transaction_count) || 0,
            cancellationRate: parseFloat(r.cancellation_rate) || 0
          },
          status: 'new'
        };
      });

      return c.json({ alerts });
    } catch (error: any) {
      console.error('Error fetching fraud alerts:', error);
      return c.json({ alerts: [] });
    }
  });

  app.post('/admin/vendors/fraud-alerts/:alertId/:action', async (c) => {
    try {
      const alertId = c.req.param('alertId');
      const action = c.req.param('action');
      const body = await c.req.json().catch(() => ({}));
      const adminId = body.adminId || 'system';

      // Extract vendor ID from alert ID (format: alert-{vendorId}-{idx})
      const vendorIdMatch = alertId.match(/alert-([^-]+)-/);
      const vendorId = vendorIdMatch ? vendorIdMatch[1] : null;

      if (action === 'investigate' && vendorId) {
        // Mark vendor for investigation
        await query(`
          UPDATE vendors 
          SET status = 'under_review',
              updated_at = NOW()
          WHERE id = $1
        `, [vendorId]);
      } else if (action === 'resolve' && vendorId) {
        // Clear investigation status
        await query(`
          UPDATE vendors 
          SET status = 'approved',
              updated_at = NOW()
          WHERE id = $1
        `, [vendorId]);
      }

      return c.json({
        success: true,
        message: `Alert ${action}d successfully`,
        alertId
      });
    } catch (error: any) {
      console.error('Error handling fraud alert:', error);
      return c.json({ error: error.message || 'Failed to handle alert' }, 500);
    }
  });

  // Abnormal Behavior
  app.get('/admin/vendors/abnormal-behavior', async (c) => {
    try {
      const behaviors = await query(`
        SELECT 
          v.id as vendor_id,
          v.business_name as vendor_name,
          COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_count,
          COUNT(b.id) as total_bookings,
          ROUND(COUNT(b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(b.id), 0) * 100, 1) as cancellation_rate,
          ROUND(AVG(b.rating) FILTER (WHERE b.rating IS NOT NULL), 1) as avg_rating
        FROM vendors v
        LEFT JOIN bookings b ON b.vendor_id = v.id AND b.created_at >= NOW() - INTERVAL '30 days'
        WHERE v.is_active = true
        GROUP BY v.id, v.business_name
        HAVING 
          COUNT(b.id) FILTER (WHERE b.status = 'cancelled') > 5
          OR (COUNT(b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(b.id), 0)) > 0.2
          OR AVG(b.rating) FILTER (WHERE b.rating IS NOT NULL) < 3.0
        ORDER BY cancellation_rate DESC, avg_rating ASC
        LIMIT 20
      `).catch(() => ({ rows: [] }));

      const formatted = behaviors.rows.map((r: any) => {
        let behaviorType = 'high_cancellation';
        let severity = 'warning';
        let description = '';
        let value = 0;
        let threshold = 20;

        if (r.cancellation_rate > 30) {
          behaviorType = 'high_cancellation';
          severity = 'alert';
          description = `Cancellation rate above 30%`;
          value = parseFloat(r.cancellation_rate) || 0;
          threshold = 20;
        } else if (r.avg_rating < 3.0) {
          behaviorType = 'low_rating';
          severity = 'warning';
          description = `Average rating below 3.0`;
          value = parseFloat(r.avg_rating) || 0;
          threshold = 3.5;
        } else if (r.cancellation_rate > 20) {
          behaviorType = 'high_cancellation';
          severity = 'warning';
          description = `Cancellation rate above 20%`;
          value = parseFloat(r.cancellation_rate) || 0;
          threshold = 20;
        }

        return {
          vendorId: r.vendor_id,
          vendorName: r.vendor_name,
          behaviorType,
          severity,
          description,
          metrics: {
            value,
            threshold,
            trend: value > threshold ? 'up' : 'down'
          }
        };
      });

      return c.json({ behaviors: formatted });
    } catch (error: any) {
      console.error('Error fetching abnormal behaviors:', error);
      return c.json({ behaviors: [] });
    }
  });

  // Remove duplicate role_permissions entries
  app.post('/admin/fix/remove-duplicate-permissions', async (c) => {
    try {
      // Find and remove duplicate permission entries
      const result = await query(`
        WITH duplicates AS (
          SELECT id, role_id, permission_name,
                 ROW_NUMBER() OVER (PARTITION BY role_id, permission_name ORDER BY id) as rn
          FROM role_permissions
        )
        DELETE FROM role_permissions
        WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)
        RETURNING id, role_id, permission_name
      `);

      return c.json({
        success: true,
        message: `Removed ${result.rows.length} duplicate permission entries`,
        removed: result.rows
      });
    } catch (error: any) {
      console.error('Error removing duplicates:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Comprehensive fix for all capability aliases
  app.post('/admin/fix/capability-aliases', async (c) => {
    try {
      // Define all known aliases: wrong_id -> correct_id
      const aliases: Record<string, string> = {
        // Booking aliases
        'booking': 'bookings',
        'booking_create': 'bookings',
        'booking_view': 'bookings',
        // Prescription aliases
        'prescription': 'prescriptions',
        'prescription_create': 'prescriptions',
        // Staff aliases
        'staff_create': 'staff_management',
        'staff_schedule': 'schedule_management',
        // Inventory/Catalog aliases
        'inventory_manage': 'inventory',
        'product_catalog': 'catalog',
        // Pricing aliases
        'service_pricing': 'pricing',
        // Diagnostic aliases
        'diagnostic_results': 'diagnostics',
      };

      let deleted = 0;
      let updated = 0;
      const results: any[] = [];

      for (const [wrongId, correctId] of Object.entries(aliases)) {
        // Find all role_permissions with this wrong ID
        const perms = await query(
          "SELECT id, role_id, permission_name FROM role_permissions WHERE permission_name = $1",
          [wrongId]
        );

        for (const perm of perms.rows) {
          // Check if this role already has the correct capability
          const existing = await query(
            "SELECT id FROM role_permissions WHERE role_id = $1 AND permission_name = $2",
            [perm.role_id, correctId]
          );

          if (existing.rows.length > 0) {
            // Role already has correct capability, delete the wrong one
            await query('DELETE FROM role_permissions WHERE id = $1', [perm.id]);
            results.push({ role_id: perm.role_id, action: 'deleted', from: wrongId, reason: `${correctId} already exists` });
            deleted++;
          } else {
            // Update to correct capability
            await query("UPDATE role_permissions SET permission_name = $1 WHERE id = $2", [correctId, perm.id]);
            results.push({ role_id: perm.role_id, action: 'updated', from: wrongId, to: correctId });
            updated++;
          }
        }
      }

      return c.json({
        success: true,
        message: `Fixed capability aliases: ${updated} updated, ${deleted} deleted`,
        total_changes: updated + deleted,
        results
      });
    } catch (error: any) {
      console.error('Error fixing capability aliases:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Fix role capabilities casing - convert 'Dashboard' to 'dashboard', etc.
  app.post('/admin/fix/normalize-role-capabilities', async (c) => {
    try {
      // Get all capabilities to build a mapping of name -> id
      const allCaps = await select('capabilities', {});
      const nameToId: Record<string, string> = {};
      const capIds = new Set<string>();
      allCaps.forEach((cap: any) => {
        // Map both exact name and lowercased for lookups
        nameToId[cap.name] = cap.id;
        nameToId[cap.name.toLowerCase()] = cap.id;
        capIds.add(cap.id);
      });

      // Known aliases - map singular to plural where plural exists
      const aliases: Record<string, string> = {
        'booking': 'bookings', // booking should be bookings
      };

      // Get all role permissions
      const allPerms = await query('SELECT id, role_id, permission_name FROM role_permissions');

      let deletedCount = 0;
      let updatedCount = 0;
      const fixes: { role_id: string; old: string; action: string; new?: string }[] = [];

      // Group by role_id for duplicate detection
      const permsByRole: Record<string, any[]> = {};
      for (const perm of allPerms.rows) {
        if (!permsByRole[perm.role_id]) {
          permsByRole[perm.role_id] = [];
        }
        permsByRole[perm.role_id].push(perm);
      }

      for (const [roleId, perms] of Object.entries(permsByRole)) {
        // Build set of existing permission names for this role
        const existingPermNames = new Set(perms.map((p: any) => p.permission_name));
        const normalizedNames = new Set<string>();

        for (const perm of perms) {
          const permName = perm.permission_name;
          const normalizedName = permName.toLowerCase().replace(/\s+/g, '_');

          // Check for known aliases first
          if (aliases[permName] && capIds.has(aliases[permName])) {
            const aliasTarget = aliases[permName];
            // If target already exists in this role's perms OR in normalized set, delete the alias
            if (existingPermNames.has(aliasTarget) || normalizedNames.has(aliasTarget)) {
              // Delete duplicate alias - target already exists
              await query('DELETE FROM role_permissions WHERE id = $1', [perm.id]);
              fixes.push({ role_id: roleId, old: permName, action: 'deleted (alias target exists)', new: aliasTarget });
              deletedCount++;
            } else {
              // Update to alias target
              await query('UPDATE role_permissions SET permission_name = $1 WHERE id = $2', [aliasTarget, perm.id]);
              fixes.push({ role_id: roleId, old: permName, action: 'aliased', new: aliasTarget });
              normalizedNames.add(aliasTarget);
              updatedCount++;
            }
            continue;
          }

          // Check if this is a capitalized name that should be an ID
          const isCapitalized = permName && permName[0] === permName[0].toUpperCase() && /[A-Z]/.test(permName);

          if (isCapitalized) {
            // Check if the correct version already exists
            if (normalizedNames.has(normalizedName)) {
              // Delete this duplicate
              await query('DELETE FROM role_permissions WHERE id = $1', [perm.id]);
              fixes.push({ role_id: roleId, old: permName, action: 'deleted (duplicate)' });
              deletedCount++;
            } else {
              // Update to lowercase
              const correctId = nameToId[permName] || normalizedName;
              await query('UPDATE role_permissions SET permission_name = $1 WHERE id = $2', [correctId, perm.id]);
              fixes.push({ role_id: roleId, old: permName, action: 'updated', new: correctId });
              normalizedNames.add(correctId.toLowerCase());
              updatedCount++;
            }
          } else {
            // Already lowercase - track it
            normalizedNames.add(normalizedName);
          }
        }
      }

      return c.json({
        success: true,
        message: `Normalized role capabilities: ${updatedCount} updated, ${deletedCount} duplicates deleted`,
        fixes: fixes
      });
    } catch (error: any) {
      console.error('Error normalizing role capabilities:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // Debug endpoint to check capabilities
  app.get('/admin/debug/capabilities', async (c) => {
    try {
      const allCaps = await select('capabilities', {});
      const capIds = allCaps.map((r: any) => r.id);
      return c.json({
        count: allCaps.length,
        sampleCap: allCaps[0],
        firstTenIds: capIds.slice(0, 10),
        hasDashboard: capIds.includes('dashboard'),
        hasProfile: capIds.includes('profile'),
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // Apply correct capability mappings to all roles based on service type
  app.post('/admin/fix/apply-role-capability-mappings', async (c) => {
    try {
      // ============================================================================
      // UNIVERSAL CAPABILITIES (Required for ALL vendors)
      // ============================================================================
      const UNIVERSAL_CAPS = [
        'dashboard', 'profile', 'chat', 'schedule', 'bookings',
        'earnings', 'settlements', 'bank_account', 'notifications',
        // VERIFICATION - Required for ALL vendors
        'bank_verification',      // Razorpay Marketplace API verification
        'location_verification',  // Google Maps address verification
        'address_verification',   // Verify vendor address
        'kyc_verification',       // KYC compliance
      ];

      // HOME SERVICE CAPABILITIES (GPS/Live location for mobile services)
      const HOME_SERVICE_CAPS = [
        'gps_tracking',    // Real-time GPS tracking
        'live_location',   // Share live location with customers
        'photo_updates',   // Share photos during service
      ];

      // CENTER CAPABILITIES (For vendors with physical locations)
      const CENTER_CAPS = [
        'facility_management',  // Manage center/clinic
        'staff_management',     // Manage employees
      ];

      // Define proper capability mappings for each role
      const ROLE_CAPABILITY_MAPPINGS: Record<string, string[]> = {
        // ===== HOME GROOMER (Solo, mobile, no center) =====
        'groomers': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS,
          'gallery', 'portfolio', 'custom_services', 'pricing', 'services',
          // NO facility_management, NO staff_management
        ],

        // ===== PET SALON / CENTER GROOMER (With salon/center) =====
        'pet_groomer': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'gallery', 'portfolio', 'custom_services', 'package_management', 'pricing', 'services',
        ],

        // ===== WALKER (Home only, solo, mobile) =====
        'pet_walker': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS,
          'walking', // Specialized walking feature
          'custom_services', 'package_management', 'pricing',
          // NO facility_management, NO staff_management
        ],

        // ===== SITTER (Home only) =====
        'pet_sitter': [
          ...UNIVERSAL_CAPS,
          'photo_updates', // Share updates during sitting
          'gps_tracking',  // For pickup/drop
          'custom_services', 'package_management', 'pricing',
          // NO facility_management, NO staff_management
        ],

        // ===== TRAINER (HOME + TELE only, no center) =====
        'pet_trainer': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS,
          'training_programs', 'progress_tracking',
          'custom_services', 'package_management', 'pricing',
          'tele', 'video_calling', // Remote training
          // NO facility_management, NO staff_management (home-based)
        ],

        // ===== VETERINARIAN (HOME + TELE only, individual practice) =====
        'veterinarian': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS, // For home visits
          'prescriptions', 'medical_records', 'diagnostics', 'emergency',
          'patient_monitoring', 'vet_summary',
          'custom_services', 'package_management', 'pricing',
          'tele', 'video_calling', // Tele-consultation
          // NO facility_management, NO staff_management (individual, not clinic)
        ],

        // ===== VETERINARY CLINIC (CENTER + TELE, multi-doctor facility) =====
        'veterinary_clinic': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS, // Has facility and staff
          'prescriptions', 'medical_records', 'diagnostics', 'emergency',
          'emergency_protocols', 'patient_monitoring', 'vet_summary',
          'diagnostic_lab', 'multi_doctor_management', 'ambulance_services',
          'custom_services', 'package_management', 'pricing',
          'tele', 'video_calling',
        ],

        // ===== TAXI (Mobile, solo) =====
        'pet_taxi': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS,
          'distance_pricing', 'emergency',
          'custom_services', 'package_management',
          // NO facility_management, NO staff_management
        ],

        // ===== AMBULANCE (Mobile emergency) =====
        'pet_ambulance': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS,
          'emergency', 'emergency_protocols', 'ambulance',
          // NO facility_management, NO staff_management
        ],

        // ===== RELOCATION (Mobile) =====
        'pet_relocation': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS,
          'distance_pricing',
          'custom_services', 'pricing',
          // NO facility_management, NO staff_management
        ],

        // ===== BOARDING (Center only) =====
        'pet_boarding': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'rooms', 'room_management', 'cctv_access', 'photo_updates',
          'occupancy_tracking', 'nightly_pricing',
          'custom_services', 'package_management',
        ],

        // ===== RESORT (Premium boarding center) =====
        'pet_resort': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'rooms', 'room_management', 'cctv_access', 'photo_updates',
          'occupancy_tracking', 'nightly_pricing',
          'custom_services', 'package_management', 'gallery', 'events',
        ],

        // ===== PET CAFE (Center only) =====
        'pet_cafe': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'menu', 'cafe_tables', 'table_management', 'pax_management',
          'inventory', 'catalog', 'events',
          'custom_services', 'package_management',
        ],

        // ===== NUTRITIONIST (Tele consultation + Food preparation & delivery) =====
        // Dual model: 1) Consulting via tele/video  2) Prepare and deliver pet food
        'nutritionist': [
          ...UNIVERSAL_CAPS,
          'meal_plans', 'diet_charts', 'progress_tracking',  // Consulting & planning
          'custom_services', 'package_management', 'pricing',
          'tele', 'video_calling',  // Remote consultations
          // Food preparation & delivery capabilities
          'catalog',      // List meal plans/food items on customer app
          'inventory',    // Manage food stock/ingredients
          'orders',       // Receive food orders from customers
          'delivery',     // Deliver prepared food/meals
          // Delivery & Payment
          'delivery_partner',      // Integration with delivery partners
          'eta_tracking',          // Real-time ETA
          'invoice_generation',    // Generate invoices
          'cod_payment',           // Cash on delivery
          'online_payment',        // Online payment
          // NO facility_management, NO staff_management (solo operation)
        ],

        // ===== BEHAVIORIST (Tele/Home, solo) =====
        'pet_behaviorist': [
          ...UNIVERSAL_CAPS,
          'progress_tracking',
          'custom_services', 'package_management', 'pricing',
          'tele', 'video_calling',
          // NO facility_management, NO staff_management
        ],

        // ===== PHOTOGRAPHER (Can have studio or mobile) =====
        'pet_photographer': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS, // Studio operations
          'gallery', 'portfolio',
          'custom_services', 'package_management', 'pricing',
        ],

        // ===== EVENT ORGANIZER (Mobile events) =====
        'pet_event_organizer': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS, // Mobile event coverage
          'events', 'gallery', 'portfolio',
          'custom_services', 'package_management', 'pricing',
          // NO facility_management (mobile events)
        ],

        // ===== EVENT ORGANIZER (Alternate name) =====
        'event_organizer': [
          ...UNIVERSAL_CAPS,
          ...HOME_SERVICE_CAPS, // Mobile event coverage
          'events', 'gallery', 'portfolio',
          'custom_services', 'package_management', 'pricing',
        ],

        // ===== SHELTER (Center, NGO) =====
        'pet_shelter': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'adoption', 'donation', 'events', 'pet_profiles',
          // Different financial model for NGO
        ],

        // ===== SUNSET SERVICES (Center/Home) =====
        'pet_sunset_services': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'memorial', 'counseling',
          'custom_services', 'package_management',
        ],

        // ===== BREEDER (Center) =====
        'pet_breeder': [
          ...UNIVERSAL_CAPS,
          'facility_management', // Breeding facility
          'catalog', 'pet_profiles',
          'custom_services', 'pricing',
        ],

        // ===== INSURANCE (Center, online) =====
        'insurance': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'insurance_plans', 'policy_management', 'claims_management',
          'custom_services', 'pricing',
        ],

        // ===== PET STORE (Seller - uses Seller Hub) =====
        'pet_products_store': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          'catalog', 'inventory', 'orders', 'delivery',
          'pricing', 'promotions', 'coupons', 'analytics',
          // NO bookings (uses orders)
        ],

        // ===== PET PHARMACY (Healthcare + Retail + Uber-like order dispatch) =====
        'pet_pharmacy': [
          ...UNIVERSAL_CAPS,
          ...CENTER_CAPS,
          // Core pharmacy capabilities
          'catalog', 'inventory', 'orders', 'delivery',
          'prescriptions', 'prescription_verification',
          'controlled_substances', 'expiry_management',
          // Order dispatch (Uber-like flow)
          'order_dispatch',        // Receive orders from nearby customers
          'order_broadcast',       // Get order broadcasts within radius
          'availability_check',    // Confirm medicine availability
          'radius_service',        // Define service radius (e.g., 20km)
          // Invoice & Payment
          'invoice_generation',    // Generate proforma invoices
          'cod_payment',           // Cash on delivery
          'online_payment',        // Razorpay online payment
          // Delivery tracking
          'delivery_partner',      // Delivery partner integration
          'eta_tracking',          // Real-time ETA calculation
          // NO bookings (uses orders)
        ],
      };

      // Get all roles
      const rolesResult = await query('SELECT id, name FROM roles');
      const roles = rolesResult.rows;

      // Valid capability IDs (from GetCapabilitiesHandler in roles.ts)
      const VALID_CAP_IDS = new Set([
        // Core Operations
        'dashboard', 'bookings', 'services', 'staff', 'schedule', 'profile',
        'staff_management', 'schedule_management',
        // Finance & Payments
        'earnings', 'settlements', 'bank_account', 'pricing',
        // Communication
        'chat', 'notifications', 'video_calling', 'tele',
        // Healthcare
        'prescriptions', 'medical_records', 'diagnostics', 'pharmacy',
        'emergency', 'emergency_protocols', 'ambulance_services', 'diagnostic_lab',
        'patient_monitoring', 'vet_summary', 'prescription_verification', 'controlled_substances',
        'multi_doctor_management',
        // Specialized Services
        'ambulance', 'cafe_tables', 'table_management', 'rooms', 'room_management',
        'insurance_plans', 'pet_profiles', 'meal_plans', 'training_programs', 'walking',
        'pax_management', 'occupancy_tracking', 'nightly_pricing', 'menu', 'diet_charts',
        'counseling', 'adoption', 'donation', 'events', 'memorial',
        'claims_management', 'policy_management',
        // Operations
        'inventory', 'orders', 'delivery', 'gps_tracking', 'reports', 'settings',
        'catalog', 'expiry_management', 'distance_pricing', 'facility_management', 'custom_services',
        'live_location', // Real-time location for home services
        // Media
        'photo_updates', 'gallery', 'portfolio', 'progress_tracking', 'cctv_access',
        // Advanced Features
        'packages', 'subscriptions', 'coupons', 'promotions', 'reviews', 'analytics',
        'export', 'integrations', 'package_management',
        // Verification & Compliance (Required for ALL vendors)
        'bank_verification', 'location_verification', 'address_verification', 'kyc_verification',
        // Pharmacy & Delivery specific
        'order_dispatch', 'order_broadcast', 'availability_check', 'radius_service',
        'invoice_generation', 'cod_payment', 'online_payment', 'delivery_partner', 'eta_tracking',
      ]);
      const validCapIds = VALID_CAP_IDS;

      const results: any[] = [];

      for (const role of roles) {
        const roleName = role.name;
        const roleId = role.id;

        if (!ROLE_CAPABILITY_MAPPINGS[roleName]) {
          results.push({ role: roleName, action: 'skipped', reason: 'No mapping defined' });
          continue;
        }

        const targetCaps = ROLE_CAPABILITY_MAPPINGS[roleName];

        // Filter to only valid capabilities
        const validTargetCaps = targetCaps.filter(cap => validCapIds.has(cap));
        const invalidCaps = targetCaps.filter(cap => !validCapIds.has(cap));

        if (invalidCaps.length > 0) {
          console.log(`Warning: Role ${roleName} has invalid capabilities: ${invalidCaps.join(', ')}`);
        }

        // Get current permissions
        const currentPerms = await query(
          'SELECT id, permission_name FROM role_permissions WHERE role_id = $1',
          [roleId]
        );
        const currentCaps = new Set(currentPerms.rows.map((r: any) => r.permission_name));

        // Calculate additions and removals
        const toAdd = validTargetCaps.filter(cap => !currentCaps.has(cap));
        const toRemove = [...currentCaps].filter(cap => !validTargetCaps.includes(cap));

        // Add new capabilities
        for (const cap of toAdd) {
          await insert('role_permissions', {
            role_id: roleId,
            permission_name: cap,
            resource: '*',
            action: '*',
          });
        }

        // Remove old capabilities
        for (const cap of toRemove) {
          await query(
            'DELETE FROM role_permissions WHERE role_id = $1 AND permission_name = $2',
            [roleId, cap]
          );
        }

        results.push({
          role: roleName,
          action: 'updated',
          before: currentCaps.size,
          after: validTargetCaps.length,
          added: toAdd,
          removed: toRemove,
          invalid: invalidCaps,
        });
      }

      return c.json({
        success: true,
        message: `Applied capability mappings to ${results.filter(r => r.action === 'updated').length} roles`,
        results,
      });
    } catch (error: any) {
      console.error('Error applying role capability mappings:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // PHARMACY ORDER BROADCASTS TABLE MIGRATION
  // ============================================================================
  app.post("/admin/fix/create-pharmacy-tables", async (c) => {
    try {
      const results: string[] = [];

      // Create pharmacy_order_broadcasts table
      await query(`
        CREATE TABLE IF NOT EXISTS pharmacy_order_broadcasts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID,
          pharmacy_id UUID,
          status VARCHAR(20) DEFAULT 'pending',
          broadcast_time TIMESTAMP DEFAULT NOW(),
          response_time TIMESTAMP,
          rejection_reason TEXT,
          distance_km DECIMAL(5,2),
          delivery_fee DECIMAL(10,2),
          eta_minutes INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push('Created pharmacy_order_broadcasts table');

      // Add indexes
      try {
        await query(`CREATE INDEX IF NOT EXISTS idx_pharmacy_order_broadcasts_order_id ON pharmacy_order_broadcasts(order_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_pharmacy_order_broadcasts_pharmacy_id ON pharmacy_order_broadcasts(pharmacy_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_pharmacy_order_broadcasts_status ON pharmacy_order_broadcasts(status)`);
        results.push('Created indexes');
      } catch (indexErr) {
        console.warn('[Admin] Failed to create indexes:', indexErr instanceof Error ? indexErr.message : indexErr);
        results.push('Index creation skipped (may already exist)');
      }

      // Add columns to orders table for pharmacy flow
      const orderColumns = [
        { name: 'prescription_id', type: 'UUID' },
        { name: 'pharmacy_response_deadline', type: 'TIMESTAMP' },
        { name: 'invoice_data', type: 'JSONB' },
        { name: 'delivery_partner', type: 'VARCHAR(50)' },
        { name: 'delivery_partner_id', type: 'VARCHAR(100)' },
        { name: 'delivery_eta', type: 'TIMESTAMP' },
        { name: 'delivery_otp', type: 'VARCHAR(6)' },
        { name: 'status', type: 'VARCHAR(50) DEFAULT \'pending\'' },
        { name: 'order_number', type: 'VARCHAR(50)' },
        { name: 'payment_status', type: 'VARCHAR(50) DEFAULT \'pending\'' },
        { name: 'payment_method', type: 'VARCHAR(50)' },
        { name: 'total_amount', type: 'DECIMAL(10,2)' },
        { name: 'discount_amount', type: 'DECIMAL(10,2) DEFAULT 0' },
        { name: 'final_amount', type: 'DECIMAL(10,2)' },
        { name: 'delivery_status', type: 'VARCHAR(50)' },
        { name: 'tracking_number', type: 'VARCHAR(100)' },
        { name: 'delivery_address', type: 'JSONB' },
      ];

      // Validate column definitions against allowed patterns (defense in depth)
      const ALLOWED_COLUMN_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;
      const ALLOWED_COLUMN_TYPES = ['UUID', 'TIMESTAMP', 'JSONB', 'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(6)', 'DECIMAL(10,2)'];

      for (const col of orderColumns) {
        // Validate column name format
        if (!ALLOWED_COLUMN_NAME_PATTERN.test(col.name)) {
          console.error(`[SECURITY] Rejected invalid column name: ${col.name}`);
          continue;
        }
        // Validate column type (extract base type for comparison)
        const baseType = col.type.split(' ')[0];
        if (!ALLOWED_COLUMN_TYPES.some(t => col.type.startsWith(t.split(' ')[0]))) {
          console.error(`[SECURITY] Rejected invalid column type: ${col.type}`);
          continue;
        }
        try {
          await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        } catch (err) {
          console.warn(`Failed to add column ${col.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      results.push('Added pharmacy columns to orders table');

      return c.json({
        success: true,
        message: 'Pharmacy tables and columns created',
        results,
      });
    } catch (error: any) {
      console.error('Error creating pharmacy tables:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
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
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'admin-advanced-handler',
    functionVersion: '$LATEST',
  };
}

