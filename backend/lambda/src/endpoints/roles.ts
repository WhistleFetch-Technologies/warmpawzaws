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
    // ✅ SQL: Get all roles (both active and inactive for admin view)
    const queryParams = context.event.queryStringParameters || {};
    const onlyActive = queryParams.active === 'true' || !queryParams.active;
    
    const roles = await select('roles', onlyActive ? { is_active: true } : {}, {
      orderBy: 'display_name',
      orderDirection: 'ASC',
    });

    // OPTIMIZATION: Batch load all permissions in a single query instead of N+1 queries
    // This reduces database round trips from N+1 to just 2 queries (roles + permissions)
    let permissionsByRole: Map<string, string[]> = new Map();
    
    if (roles.length > 0) {
      const roleIds = roles.map(r => r.id);
      let allPermissions;
      
      try {
        // Try PostgreSQL array syntax (preferred, more efficient)
        allPermissions = await query(
          `SELECT role_id, permission_name 
           FROM role_permissions 
           WHERE role_id = ANY($1::text[])`,
          [roleIds]
        );
      } catch (error: any) {
        // Fallback to IN clause if array syntax not supported
        console.warn('[Roles] Array syntax failed, using IN clause fallback:', error.message);
        const placeholders = roleIds.map((_, i) => `$${i + 1}`).join(',');
        allPermissions = await query(
          `SELECT role_id, permission_name 
           FROM role_permissions 
           WHERE role_id IN (${placeholders})`,
          roleIds
        );
      }
      
      // Group permissions by role_id
      allPermissions.rows.forEach((p: any) => {
        const roleId = p.role_id;
        if (!permissionsByRole.has(roleId)) {
          permissionsByRole.set(roleId, []);
        }
        permissionsByRole.get(roleId)!.push(p.permission_name);
      });
    }

    // Map roles with their permissions (no async operations needed now)
    const rolesWithFullData = roles.map((role) => {
      const capabilities = permissionsByRole.get(role.id) || [];
        
        // Extract config fields from JSONB config column
        const config = role.config || {};
        const vendorTypes = config.vendorTypes || config.vendor_types || [];
        const serviceStyles = config.serviceStyles || config.service_styles || [];
        const pricingControl = config.pricingControl || config.pricing_control || {
          canControlPrice: false,
          canControlDuration: false,
        };
        const category = config.category || 'general';
        const icon = config.icon || role.icon || null;
        
        // Parse vendorTypes to match reference (organization, Service Provider, Seller, Healthcare Provider)
        // Backend stores: healthcare_provider, service_provider, seller, ngo, organization, business
        // Frontend displays: Healthcare Provider, Service Provider, Seller, NGO, organization, Business
        const normalizedVendorTypes = Array.isArray(vendorTypes) 
          ? vendorTypes.map((vt: string) => {
              const mapping: Record<string, string> = {
                'healthcare_provider': 'Healthcare Provider',
                'service_provider': 'Service Provider',
                'solo_provider': 'Service Provider',
                'center': 'Healthcare Provider',
                'organization': 'organization',
                'seller': 'Seller',
                'business': 'Business',
                'ngo': 'NGO',
              };
              return mapping[vt] || vt;
            })
          : [];
        
        // Parse serviceStyles to match reference (At Center, At Home, Tele Consultation)
        // Backend stores: at_clinic, at_center, at_home, video_consultation, tele, online, delivery, pickup
        // Frontend displays: At Center, At Home, Tele Consultation, Video Consultation, Online, Delivery, Pickup
        const normalizedServiceStyles = Array.isArray(serviceStyles)
          ? serviceStyles.map((ss: string) => {
              const mapping: Record<string, string> = {
                'at_center': 'At Center',
                'at_clinic': 'At Center',
                'at_home': 'At Home',
                'home_visit': 'At Home',
                'tele': 'Tele Consultation',
                'video_consultation': 'Video Consultation',
                'online': 'Online',
                'delivery': 'Delivery',
                'pickup': 'Pickup',
                'outdoor': 'Outdoor',
              };
              return mapping[ss] || ss;
            })
          : [];
        
        return {
          ...role,
          id: role.id,
          roleId: role.id,
          roleName: role.display_name || role.name,
          roleCode: role.name,
          display_name: role.display_name || role.name,
          name: role.name,
          description: role.description || '',
          category,
          icon,
          vendorTypes: normalizedVendorTypes,
          serviceStyles: normalizedServiceStyles,
          pricingControl: {
            canControlPrice: pricingControl.canControlPrice || pricingControl.can_control_price || false,
            canControlDuration: pricingControl.canControlDuration || pricingControl.can_control_duration || false,
          },
          capabilities,
          isActive: role.is_active !== false,
          isSystem: role.is_system_role || false,
          userCount: 0, // TODO: Count users with this role
          createdAt: role.created_at || new Date().toISOString(),
        };
    });

    return this.success({ 
      success: true,
      roles: rolesWithFullData,
      total: rolesWithFullData.length 
    });
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
    
    // Extract config fields from JSONB config column (same as GetRolesHandler)
    const config = role.config || {};
    const vendorTypes = config.vendorTypes || config.vendor_types || [];
    const serviceStyles = config.serviceStyles || config.service_styles || [];
    const pricingControl = config.pricingControl || config.pricing_control || {
      canControlPrice: false,
      canControlDuration: false,
    };
    const category = config.category || 'general';
    const icon = config.icon || role.icon || null;
    
    // Normalize vendorTypes and serviceStyles to match reference screens
    const normalizedVendorTypes = Array.isArray(vendorTypes) 
      ? vendorTypes.map((vt: string) => {
          const mapping: Record<string, string> = {
            'healthcare_provider': 'Healthcare Provider',
            'service_provider': 'Service Provider',
            'solo_provider': 'Service Provider',
            'center': 'Healthcare Provider',
            'organization': 'organization',
            'seller': 'Seller',
            'business': 'Business',
            'ngo': 'NGO',
          };
          return mapping[vt] || vt;
        })
      : [];
    
    const normalizedServiceStyles = Array.isArray(serviceStyles)
      ? serviceStyles.map((ss: string) => {
          const mapping: Record<string, string> = {
            'at_center': 'At Center',
            'at_clinic': 'At Center',
            'at_home': 'At Home',
            'home_visit': 'At Home',
            'tele': 'Tele Consultation',
            'video_consultation': 'Video Consultation',
            'online': 'Online',
            'delivery': 'Delivery',
            'pickup': 'Pickup',
            'outdoor': 'Outdoor',
          };
          return mapping[ss] || ss;
        })
      : [];

    return this.success({
      success: true,
      ...role,
      roleId: role.id,
      roleName: role.display_name || role.name,
      roleCode: role.name,
      category,
      icon,
      vendorTypes: normalizedVendorTypes,
      serviceStyles: normalizedServiceStyles,
      pricingControl: {
        canControlPrice: pricingControl.canControlPrice || pricingControl.can_control_price || false,
        canControlDuration: pricingControl.canControlDuration || pricingControl.can_control_duration || false,
      },
      capabilities,
      isActive: role.is_active !== false,
      isSystem: role.is_system_role || false,
    });
  }
}

class CreateRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { 
      name, 
      display_name, 
      roleName,
      roleCode,
      description, 
      category, 
      capabilities, 
      config,
      vendorTypes,
      serviceStyles,
      pricingControl,
      icon,
      isActive,
      is_active
    } = body;

    // Validation - support both naming conventions
    const roleNameFinal = name || roleCode || '';
    const displayNameFinal = display_name || roleName || '';
    
    if (!roleNameFinal || !displayNameFinal) {
      return this.error('Name (or roleCode) and display_name (or roleName) are required', 400);
    }

    // Check if role already exists
    const existing = await select('roles', { name: roleNameFinal });
    if (existing.length > 0) {
      return this.error('Role with this name already exists', 409);
    }

    try {
      // Build config object
      const roleConfig: any = config || {
        category: category || 'general',
        icon: icon || null,
        vendorTypes: vendorTypes || [],
        serviceStyles: serviceStyles || [],
        pricingControl: pricingControl || {
          canControlPrice: false,
          canControlDuration: false,
        },
      };

      // Insert role
      const roleData: any = {
        name: roleNameFinal,
        display_name: displayNameFinal,
        description: description || '',
        is_system_role: false,
        is_active: is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true),
        config: roleConfig,
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
        success: true,
        message: 'Role created successfully',
        role: {
          ...newRole[0],
          roleId: newRole[0].id,
          roleName: newRole[0].display_name || newRole[0].name,
          roleCode: newRole[0].name,
          vendorTypes: roleConfig.vendorTypes || [],
          serviceStyles: roleConfig.serviceStyles || [],
          pricingControl: roleConfig.pricingControl || {
            canControlPrice: false,
            canControlDuration: false,
          },
          capabilities: capabilities || [],
          isActive: newRole[0].is_active !== false,
        },
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
    const { 
      display_name, 
      roleName,
      description, 
      is_active, 
      isActive,
      capabilities, 
      config,
      vendorTypes,
      serviceStyles,
      pricingControl,
      category,
      icon
    } = body;

    if (!roleId) {
      return this.error('Role ID is required', 400);
    }

    // Check if role exists
    const roles = await select('roles', { id: roleId });
    if (roles.length === 0) {
      return this.error('Role not found', 404);
    }

    const existingRole = roles[0];
    const existingConfig = existingRole.config || {};

    try {
      // Build config object from request body (merge with existing)
      const updatedConfig: any = {
        ...existingConfig,
        category: category !== undefined ? category : existingConfig.category,
        icon: icon !== undefined ? icon : existingConfig.icon,
        vendorTypes: vendorTypes !== undefined ? vendorTypes : existingConfig.vendorTypes || [],
        serviceStyles: serviceStyles !== undefined ? serviceStyles : existingConfig.serviceStyles || [],
        pricingControl: pricingControl !== undefined ? pricingControl : (existingConfig.pricingControl || {
          canControlPrice: false,
          canControlDuration: false,
        }),
      };

      // If config object provided directly, merge it
      if (config && typeof config === 'object') {
        Object.assign(updatedConfig, config);
      }

      // Update role
      const updateData: any = {};
      if (display_name !== undefined || roleName !== undefined) {
        updateData.display_name = display_name || roleName;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
      if (is_active !== undefined || isActive !== undefined) {
        updateData.is_active = is_active !== undefined ? is_active : isActive;
      }
      updateData.config = updatedConfig;

      if (Object.keys(updateData).length > 0) {
        await update('roles', { id: roleId }, updateData);
      }

      // Update capabilities if provided
      if (capabilities && Array.isArray(capabilities)) {
        // Delete existing permissions
        await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]).catch(() => {});

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

      // Fetch updated role with full data
      const updatedRole = await select('roles', { id: roleId });
      const permissions = await select('role_permissions', { role_id: roleId });
      const caps = permissions.map(p => p.permission_name);
      const roleConfig = updatedRole[0].config || {};

      // Normalize vendor types and service styles for response
      const normalizedVendorTypes = Array.isArray(roleConfig.vendorTypes) 
        ? roleConfig.vendorTypes.map((vt: string) => {
            const mapping: Record<string, string> = {
              'healthcare_provider': 'Healthcare Provider',
              'service_provider': 'Service Provider',
              'solo_provider': 'Service Provider',
              'center': 'Healthcare Provider',
              'organization': 'organization',
              'seller': 'Seller',
              'business': 'Business',
              'ngo': 'NGO',
            };
            return mapping[vt] || vt;
          })
        : [];

      const normalizedServiceStyles = Array.isArray(roleConfig.serviceStyles)
        ? roleConfig.serviceStyles.map((ss: string) => {
            const mapping: Record<string, string> = {
              'at_center': 'At Center',
              'at_clinic': 'At Center',
              'at_home': 'At Home',
              'home_visit': 'At Home',
              'tele': 'Tele Consultation',
              'video_consultation': 'Video Consultation',
              'online': 'Online',
              'delivery': 'Delivery',
              'pickup': 'Pickup',
              'outdoor': 'Outdoor',
            };
            return mapping[ss] || ss;
          })
        : [];

      return this.success({
        success: true,
        message: 'Role updated successfully',
        role: {
          ...updatedRole[0],
          roleId: updatedRole[0].id,
          roleName: updatedRole[0].display_name || updatedRole[0].name,
          roleCode: updatedRole[0].name,
          vendorTypes: normalizedVendorTypes,
          serviceStyles: normalizedServiceStyles,
          pricingControl: roleConfig.pricingControl || {
            canControlPrice: false,
            canControlDuration: false,
          },
          capabilities: caps,
          isActive: updatedRole[0].is_active !== false,
        },
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

