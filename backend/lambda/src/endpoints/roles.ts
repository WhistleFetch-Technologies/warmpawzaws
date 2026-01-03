/**
 * ============================================================================
 * ROLE CONFIG ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Migrated from: supabase/functions/make-server-vendor/vendor-role-config.tsx
 * 
 * Endpoints:
 * - GET /config/roles - Get all roles
 * - GET /config/roles/:id - Get role by ID
 * - POST /config/roles - Create role (admin only)
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

// ============================================================================
// ROLE HANDLERS
// ============================================================================

class GetRolesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    // ✅ SQL: Get all active roles
    const roles = await select('roles', { is_active: true }, {
      orderBy: 'display_name',
      orderDirection: 'ASC',
    });

    // Get capabilities for each role
    const rolesWithCapabilities = await Promise.all(
      roles.map(async (role) => {
        const permissions = await select('role_permissions', { role_id: role.id });
        const capabilities = permissions.map(p => p.permission_name);
        
        return {
          ...role,
          capabilities,
        };
      })
    );

    return this.success({ roles: rolesWithCapabilities });
  }
}

class GetRoleByIdHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roleId = context.event.pathParameters?.roleId;

    if (!roleId) {
      return this.error('Role ID is required', 400);
    }

    const roles = await select('roles', { id: roleId });
    
    if (roles.length === 0) {
      return this.error('Role not found', 404);
    }

    const role = roles[0];
    const permissions = await select('role_permissions', { role_id: roleId });
    const capabilities = permissions.map(p => p.permission_name);

    return this.success({
      ...role,
      capabilities,
    });
  }
}

class CreateRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { name, display_name, description, category, capabilities, config } = body;

    // Validation
    if (!name || !display_name) {
      return this.error('Name and display_name are required', 400);
    }

    // Check if role already exists
    const existing = await select('roles', { name });
    if (existing.length > 0) {
      return this.error('Role with this name already exists', 409);
    }

    try {
      // Insert role
      const roleData: any = {
        name,
        display_name,
        description: description || '',
        is_system_role: false,
        is_active: true,
        config: config || {},
      };

      const newRole = await insert('roles', roleData);
      const roleId = newRole[0].id;

      // Insert capabilities/permissions if provided
      if (capabilities && Array.isArray(capabilities) && capabilities.length > 0) {
        for (const capName of capabilities) {
          await insert('role_permissions', {
            role_id: roleId,
            permission_name: capName,
            resource: '*', // Default resource
            action: '*', // Default action
          }).catch(err => console.error('Error adding permission:', err));
        }
      }

      return this.success({
        message: 'Role created successfully',
        role: { ...newRole[0], capabilities: capabilities || [] },
      });
    } catch (error: any) {
      console.error('Error creating role:', error);
      return this.error(error.message || 'Failed to create role', 500);
    }
  }
}

class UpdateRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roleId = context.event.pathParameters?.roleId;
    const body = this.parseBody(context.event);
    const { display_name, description, is_active, capabilities, config } = body;

    if (!roleId) {
      return this.error('Role ID is required', 400);
    }

    // Check if role exists
    const roles = await select('roles', { id: roleId });
    if (roles.length === 0) {
      return this.error('Role not found', 404);
    }

    try {
      // Update role
      const updateData: any = {};
      if (display_name !== undefined) updateData.display_name = display_name;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (config !== undefined) updateData.config = config;

      if (Object.keys(updateData).length > 0) {
        await update('roles', { id: roleId }, updateData);
      }

      // Update capabilities if provided
      if (capabilities && Array.isArray(capabilities)) {
        // Delete existing permissions
        await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

        // Insert new permissions
        for (const capName of capabilities) {
          await insert('role_permissions', {
            role_id: roleId,
            permission_name: capName,
            resource: '*',
            action: '*',
          }).catch(err => console.error('Error adding permission:', err));
        }
      }

      // Fetch updated role
      const updatedRole = await select('roles', { id: roleId });
      const permissions = await select('role_permissions', { role_id: roleId });
      const caps = permissions.map(p => p.permission_name);

      return this.success({
        message: 'Role updated successfully',
        role: { ...updatedRole[0], capabilities: caps },
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      return this.error(error.message || 'Failed to update role', 500);
    }
  }
}

class DeleteRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roleId = context.event.pathParameters?.roleId;

    if (!roleId) {
      return this.error('Role ID is required', 400);
    }

    // Check if role exists
    const roles = await select('roles', { id: roleId });
    if (roles.length === 0) {
      return this.error('Role not found', 404);
    }

    const role = roles[0];

    // Prevent deletion of system roles
    if (role.is_system_role) {
      return this.error('Cannot delete system roles', 403);
    }

    try {
      // Soft delete: deactivate instead of deleting
      await update('roles', { id: roleId }, { is_active: false });

      return this.success({
        message: 'Role deactivated successfully',
      });
    } catch (error: any) {
      console.error('Error deleting role:', error);
      return this.error(error.message || 'Failed to delete role', 500);
    }
  }
}

class GetCapabilitiesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    // Return predefined capabilities list
    const capabilities = [
      // Booking Management
      { id: 'booking_create', name: 'Create Bookings', category: 'Booking Management', description: 'Can create new bookings' },
      { id: 'booking_view', name: 'View Bookings', category: 'Booking Management', description: 'Can view booking details' },
      { id: 'booking_update', name: 'Update Bookings', category: 'Booking Management', description: 'Can update booking status' },
      { id: 'booking_cancel', name: 'Cancel Bookings', category: 'Booking Management', description: 'Can cancel bookings' },
      
      // Service Management
      { id: 'service_create', name: 'Create Services', category: 'Service Management', description: 'Can create custom services' },
      { id: 'service_view', name: 'View Services', category: 'Service Management', description: 'Can view service catalog' },
      { id: 'service_update', name: 'Update Services', category: 'Service Management', description: 'Can modify service details' },
      { id: 'service_pricing', name: 'Manage Pricing', category: 'Service Management', description: 'Can set service prices' },
      
      // Staff Management
      { id: 'staff_create', name: 'Add Staff', category: 'Staff Management', description: 'Can add new staff members' },
      { id: 'staff_view', name: 'View Staff', category: 'Staff Management', description: 'Can view staff details' },
      { id: 'staff_update', name: 'Update Staff', category: 'Staff Management', description: 'Can update staff information' },
      { id: 'staff_schedule', name: 'Manage Schedules', category: 'Staff Management', description: 'Can manage staff schedules' },
      
      // Customer Management
      { id: 'customer_view', name: 'View Customers', category: 'Customer Management', description: 'Can view customer details' },
      { id: 'customer_update', name: 'Update Customers', category: 'Customer Management', description: 'Can update customer information' },
      
      // Financial
      { id: 'payment_view', name: 'View Payments', category: 'Financial', description: 'Can view payment history' },
      { id: 'payment_process', name: 'Process Payments', category: 'Financial', description: 'Can process payments' },
      { id: 'settlement_view', name: 'View Settlements', category: 'Financial', description: 'Can view settlement reports' },
      { id: 'refund_process', name: 'Process Refunds', category: 'Financial', description: 'Can initiate refunds' },
      
      // Healthcare Specific
      { id: 'medical_records', name: 'Medical Records', category: 'Healthcare', description: 'Can access medical records' },
      { id: 'prescription_create', name: 'Create Prescriptions', category: 'Healthcare', description: 'Can create prescriptions' },
      { id: 'diagnostic_results', name: 'Diagnostic Results', category: 'Healthcare', description: 'Can view/upload diagnostic results' },
      { id: 'vaccination_records', name: 'Vaccination Records', category: 'Healthcare', description: 'Can manage vaccination records' },
      
      // Location Services
      { id: 'gps_tracking', name: 'GPS Tracking', category: 'Location Services', description: 'Can use GPS tracking' },
      { id: 'service_area', name: 'Service Area', category: 'Location Services', description: 'Can define service areas' },
      
      // Communication
      { id: 'chat_customer', name: 'Customer Chat', category: 'Communication', description: 'Can chat with customers' },
      { id: 'notifications', name: 'Send Notifications', category: 'Communication', description: 'Can send notifications' },
      
      // Inventory (for retail/pharmacy)
      { id: 'inventory_manage', name: 'Manage Inventory', category: 'Inventory', description: 'Can manage product inventory' },
      { id: 'product_catalog', name: 'Product Catalog', category: 'Inventory', description: 'Can manage product catalog' },
      
      // Reports & Analytics
      { id: 'analytics_view', name: 'View Analytics', category: 'Reports', description: 'Can view analytics dashboard' },
      { id: 'reports_generate', name: 'Generate Reports', category: 'Reports', description: 'Can generate reports' },
    ];

    return this.success({
      success: true,
      capabilities,
      total: capabilities.length,
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerRoleEndpoints(app: Hono) {
  const getRolesHandler = new GetRolesHandler();
  const getRoleByIdHandler = new GetRoleByIdHandler();
  const createRoleHandler = new CreateRoleHandler();
  const updateRoleHandler = new UpdateRoleHandler();
  const deleteRoleHandler = new DeleteRoleHandler();
  const getCapabilitiesHandler = new GetCapabilitiesHandler();

  // GET endpoints
  app.get('/config/roles', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getRolesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/config/roles/:roleId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { roleId: c.req.param('roleId') };
    const context = createLambdaContext();
    const result = await getRoleByIdHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Admin endpoints for role management
  app.get('/roles', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getRolesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/roles', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getRolesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/capabilities', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getCapabilitiesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/roles', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result = await createRoleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/roles/:roleId', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    event.pathParameters = { roleId: c.req.param('roleId') };
    const context = createLambdaContext();
    const result = await updateRoleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/roles/:roleId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { roleId: c.req.param('roleId') };
    const context = createLambdaContext();
    const result = await deleteRoleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
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
  const body = await c.req.json();
  return {
    httpMethod: c.req.method,
    path: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    body: JSON.stringify(body),
    pathParameters: {},
    queryStringParameters: {},
    requestContext: {
      requestId: crypto.randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'role-handler',
    functionVersion: '$LATEST',
  };
}

