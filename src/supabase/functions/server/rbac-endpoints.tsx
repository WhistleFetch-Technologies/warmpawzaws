import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function rbacEndpoints(app: Hono) {
  
  /**
   * GET /admin/rbac/roles
   * Get all roles with hierarchy
   */
  app.get("/make-server-3dd53475/admin/rbac/roles", async (c) => {
    try {
      const roles = await kv.getByPrefix('role:');
      const validRoles = roles.filter((r: any) => r.id && !r.id.includes(':roles'));
      
      return c.json({ success: true, roles: validRoles });
    } catch (error) {
      console.error('Get Roles Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /admin/rbac/roles
   * Create a new role
   */
  app.post("/make-server-3dd53475/admin/rbac/roles", async (c) => {
    try {
      const { name, description, permissions, parentRole, level } = await c.req.json();
      
      if (!name) {
        return c.json({ error: 'Role name is required' }, 400);
      }
      
      const roleId = `role_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const role = {
        id: roleId,
        name,
        description: description || '',
        permissions: permissions || [],
        parentRole: parentRole || null,
        level: level || 1,
        isActive: true,
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`role:${roleId}`, role);
      
      console.log(`✅ Role created: ${roleId} - ${name}`);
      return c.json({ success: true, role });
    } catch (error) {
      console.error('Create Role Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /admin/rbac/roles/:roleId
   * Update a role
   */
  app.put("/make-server-3dd53475/admin/rbac/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const updates = await c.req.json();
      
      const role = await kv.get(`role:${roleId}`);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      if (role.isSystem) {
        return c.json({ error: 'Cannot modify system role' }, 403);
      }
      
      const updatedRole = {
        ...role,
        ...updates,
        id: roleId,
        isSystem: role.isSystem,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`role:${roleId}`, updatedRole);
      
      console.log(`✅ Role updated: ${roleId}`);
      return c.json({ success: true, role: updatedRole });
    } catch (error) {
      console.error('Update Role Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /admin/rbac/roles/:roleId
   * Delete a role
   */
  app.delete("/make-server-3dd53475/admin/rbac/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      const role = await kv.get(`role:${roleId}`);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      if (role.isSystem) {
        return c.json({ error: 'Cannot delete system role' }, 403);
      }
      
      // Check if role is assigned to any users
      const allUsers = await kv.getByPrefix('user:');
      const hasAssignments = allUsers.some((u: any) => {
        const userRoles = u.roles || [];
        return userRoles.includes(roleId);
      });
      
      if (hasAssignments) {
        return c.json({ error: 'Cannot delete role that is assigned to users' }, 400);
      }
      
      await kv.del(`role:${roleId}`);
      
      console.log(`✅ Role deleted: ${roleId}`);
      return c.json({ success: true });
    } catch (error) {
      console.error('Delete Role Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/rbac/permissions
   * Get all available permissions
   */
  app.get("/make-server-3dd53475/admin/rbac/permissions", async (c) => {
    try {
      const permissions = await kv.get('rbac:permissions:list');
      
      if (!permissions) {
        // Initialize default permissions
        const defaultPermissions = getDefaultPermissions();
        await kv.set('rbac:permissions:list', defaultPermissions);
        return c.json({ success: true, permissions: defaultPermissions });
      }
      
      return c.json({ success: true, permissions });
    } catch (error) {
      console.error('Get Permissions Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/rbac/permissions
   * Add a new permission
   */
  app.post("/make-server-3dd53475/admin/rbac/permissions", async (c) => {
    try {
      const { key, name, description, category } = await c.req.json();
      
      if (!key || !name) {
        return c.json({ error: 'Permission key and name are required' }, 400);
      }
      
      const permissions = await kv.get('rbac:permissions:list') || getDefaultPermissions();
      
      const newPermission = {
        key,
        name,
        description: description || '',
        category: category || 'custom'
      };
      
      permissions.push(newPermission);
      await kv.set('rbac:permissions:list', permissions);
      
      console.log(`✅ Permission created: ${key}`);
      return c.json({ success: true, permission: newPermission });
    } catch (error) {
      console.error('Create Permission Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /admin/rbac/users/:userId/permissions
   * Get effective permissions for a user (with role inheritance)
   */
  app.get("/make-server-3dd53475/admin/rbac/users/:userId/permissions", async (c) => {
    try {
      const { userId } = c.req.param();
      
      const user = await kv.get(`user:${userId}`) || await kv.get(`admin:${userId}`);
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }
      
      const userRoles = user.roles || [];
      const allPermissions = new Set<string>();
      
      // Collect permissions from all assigned roles (including inheritance)
      for (const roleId of userRoles) {
        await collectRolePermissions(roleId, allPermissions);
      }
      
      return c.json({ 
        success: true, 
        permissions: Array.from(allPermissions),
        roles: userRoles
      });
    } catch (error) {
      console.error('Get User Permissions Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * POST /admin/rbac/users/:userId/roles
   * Assign roles to a user
   */
  app.post("/make-server-3dd53475/admin/rbac/users/:userId/roles", async (c) => {
    try {
      const { userId } = c.req.param();
      const { roles } = await c.req.json();
      
      if (!Array.isArray(roles)) {
        return c.json({ error: 'Roles must be an array' }, 400);
      }
      
      // Validate all roles exist
      for (const roleId of roles) {
        const role = await kv.get(`role:${roleId}`);
        if (!role) {
          return c.json({ error: `Role not found: ${roleId}` }, 404);
        }
      }
      
      // Get user
      let user = await kv.get(`user:${userId}`);
      let userKey = `user:${userId}`;
      
      if (!user) {
        user = await kv.get(`admin:${userId}`);
        userKey = `admin:${userId}`;
      }
      
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }
      
      // Update user roles
      user.roles = roles;
      user.updatedAt = new Date().toISOString();
      await kv.set(userKey, user);
      
      // Also maintain separate mapping
      await kv.set(`user:${userId}:roles`, roles);
      
      console.log(`✅ Roles assigned to user ${userId}: ${roles.join(', ')}`);
      return c.json({ success: true, roles });
    } catch (error) {
      console.error('Assign Roles Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /admin/rbac/users/:userId/roles/:roleId
   * Remove a role from a user
   */
  app.delete("/make-server-3dd53475/admin/rbac/users/:userId/roles/:roleId", async (c) => {
    try {
      const { userId, roleId } = c.req.param();
      
      let user = await kv.get(`user:${userId}`);
      let userKey = `user:${userId}`;
      
      if (!user) {
        user = await kv.get(`admin:${userId}`);
        userKey = `admin:${userId}`;
      }
      
      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }
      
      const userRoles = user.roles || [];
      const updatedRoles = userRoles.filter((r: string) => r !== roleId);
      
      user.roles = updatedRoles;
      user.updatedAt = new Date().toISOString();
      await kv.set(userKey, user);
      await kv.set(`user:${userId}:roles`, updatedRoles);
      
      console.log(`✅ Role ${roleId} removed from user ${userId}`);
      return c.json({ success: true, roles: updatedRoles });
    } catch (error) {
      console.error('Remove Role Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/rbac/check-permission
   * Check if user has specific permission
   */
  app.post("/make-server-3dd53475/admin/rbac/check-permission", async (c) => {
    try {
      const { userId, permission } = await c.req.json();
      
      if (!userId || !permission) {
        return c.json({ error: 'userId and permission are required' }, 400);
      }
      
      const user = await kv.get(`user:${userId}`) || await kv.get(`admin:${userId}`);
      if (!user) {
        return c.json({ hasPermission: false, reason: 'User not found' });
      }
      
      const userRoles = user.roles || [];
      const allPermissions = new Set<string>();
      
      for (const roleId of userRoles) {
        await collectRolePermissions(roleId, allPermissions);
      }
      
      const hasPermission = allPermissions.has(permission);
      
      return c.json({ 
        success: true,
        hasPermission,
        permission,
        userId
      });
    } catch (error) {
      console.error('Check Permission Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/rbac/audit-log
   * Get RBAC audit log
   */
  app.get("/make-server-3dd53475/admin/rbac/audit-log", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '50');
      const logs = await kv.getByPrefix('rbac:audit:');
      
      const sortedLogs = logs
        .filter((l: any) => l.timestamp)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
      
      return c.json({ success: true, logs: sortedLogs });
    } catch (error) {
      console.error('Get Audit Log Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/rbac/policies
   * Get all access policies
   */
  app.get("/make-server-3dd53475/admin/rbac/policies", async (c) => {
    try {
      const policies = await kv.getByPrefix('policy:');
      const validPolicies = policies.filter((p: any) => p.id && !p.id.includes(':policies'));
      
      return c.json({ success: true, policies: validPolicies });
    } catch (error) {
      console.error('Get Policies Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/rbac/policies
   * Create a new access policy
   */
  app.post("/make-server-3dd53475/admin/rbac/policies", async (c) => {
    try {
      const { name, description, rules, effect, priority } = await c.req.json();
      
      if (!name || !rules) {
        return c.json({ error: 'Policy name and rules are required' }, 400);
      }
      
      const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const policy = {
        id: policyId,
        name,
        description: description || '',
        rules,
        effect: effect || 'allow', // allow or deny
        priority: priority || 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`policy:${policyId}`, policy);
      
      console.log(`✅ Policy created: ${policyId} - ${name}`);
      return c.json({ success: true, policy });
    } catch (error) {
      console.error('Create Policy Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  async function collectRolePermissions(roleId: string, permissionsSet: Set<string>): Promise<void> {
    const role = await kv.get(`role:${roleId}`);
    if (!role || !role.isActive) return;
    
    // Add this role's permissions
    if (role.permissions && Array.isArray(role.permissions)) {
      role.permissions.forEach((p: string) => permissionsSet.add(p));
    }
    
    // Recursively add parent role permissions (inheritance)
    if (role.parentRole) {
      await collectRolePermissions(role.parentRole, permissionsSet);
    }
  }

  async function logAuditEvent(action: string, userId: string, details: any): Promise<void> {
    const logId = `rbac:audit:${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const log = {
      id: logId,
      action,
      userId,
      details,
      timestamp: new Date().toISOString()
    };
    
    await kv.set(logId, log);
  }
  
  function getDefaultPermissions() {
    return [
      // Vendor Management
      { key: 'vendor:read', name: 'View Vendors', description: 'View vendor information', category: 'vendor' },
      { key: 'vendor:write', name: 'Edit Vendors', description: 'Edit vendor information', category: 'vendor' },
      { key: 'vendor:delete', name: 'Delete Vendors', description: 'Delete vendors', category: 'vendor' },
      { key: 'vendor:approve', name: 'Approve Vendors', description: 'Approve vendor applications', category: 'vendor' },
      
      // Analytics
      { key: 'analytics:read', name: 'View Analytics', description: 'View analytics dashboards', category: 'analytics' },
      { key: 'analytics:export', name: 'Export Analytics', description: 'Export analytics data', category: 'analytics' },
      { key: 'analytics:advanced', name: 'Advanced Analytics', description: 'Access advanced analytics features', category: 'analytics' },
      
      // Reports
      { key: 'reports:read', name: 'View Reports', description: 'View reports', category: 'reports' },
      { key: 'reports:write', name: 'Create Reports', description: 'Create and edit reports', category: 'reports' },
      { key: 'reports:delete', name: 'Delete Reports', description: 'Delete reports', category: 'reports' },
      { key: 'reports:share', name: 'Share Reports', description: 'Share reports with others', category: 'reports' },
      { key: 'reports:schedule', name: 'Schedule Reports', description: 'Schedule automated reports', category: 'reports' },
      
      // Finance
      { key: 'finance:read', name: 'View Finance', description: 'View financial data', category: 'finance' },
      { key: 'finance:payout', name: 'Process Payouts', description: 'Process vendor payouts', category: 'finance' },
      { key: 'finance:settlement', name: 'Manage Settlements', description: 'Manage payment settlements', category: 'finance' },
      { key: 'finance:refund', name: 'Process Refunds', description: 'Process customer refunds', category: 'finance' },
      
      // Marketing
      { key: 'marketing:read', name: 'View Marketing', description: 'View marketing campaigns', category: 'marketing' },
      { key: 'marketing:write', name: 'Edit Marketing', description: 'Create and edit campaigns', category: 'marketing' },
      { key: 'marketing:campaign', name: 'Manage Campaigns', description: 'Manage marketing campaigns', category: 'marketing' },
      { key: 'marketing:spend', name: 'Manage Budget', description: 'Manage marketing budget', category: 'marketing' },
      
      // Settings
      { key: 'settings:read', name: 'View Settings', description: 'View system settings', category: 'settings' },
      { key: 'settings:write', name: 'Edit Settings', description: 'Modify system settings', category: 'settings' },
      { key: 'settings:integrations', name: 'Manage Integrations', description: 'Manage third-party integrations', category: 'settings' },
      
      // User Management
      { key: 'users:read', name: 'View Users', description: 'View user information', category: 'users' },
      { key: 'users:write', name: 'Edit Users', description: 'Edit user information', category: 'users' },
      { key: 'users:delete', name: 'Delete Users', description: 'Delete users', category: 'users' },
      
      // RBAC Management
      { key: 'rbac:read', name: 'View Roles', description: 'View roles and permissions', category: 'rbac' },
      { key: 'rbac:write', name: 'Edit Roles', description: 'Create and edit roles', category: 'rbac' },
      { key: 'rbac:assign', name: 'Assign Roles', description: 'Assign roles to users', category: 'rbac' },
      
      // Content Management
      { key: 'content:read', name: 'View Content', description: 'View content', category: 'content' },
      { key: 'content:write', name: 'Edit Content', description: 'Create and edit content', category: 'content' },
      { key: 'content:publish', name: 'Publish Content', description: 'Publish content', category: 'content' },
      
      // Pet Information
      { key: 'pets:read', name: 'View Pet Data', description: 'View pet information', category: 'pets' },
      { key: 'pets:write', name: 'Edit Pet Data', description: 'Edit pet information', category: 'pets' },
      { key: 'pets:analytics', name: 'Pet Analytics', description: 'View pet analytics', category: 'pets' },
      
      // Support
      { key: 'support:read', name: 'View Support', description: 'View support tickets', category: 'support' },
      { key: 'support:write', name: 'Handle Support', description: 'Handle support tickets', category: 'support' },
      
      // E-Commerce
      { key: 'ecommerce:read', name: 'View E-Commerce', description: 'View e-commerce data', category: 'ecommerce' },
      { key: 'ecommerce:write', name: 'Manage E-Commerce', description: 'Manage e-commerce operations', category: 'ecommerce' },
      { key: 'ecommerce:orders', name: 'Manage Orders', description: 'Manage orders', category: 'ecommerce' },
      
      // System Admin
      { key: 'system:admin', name: 'System Admin', description: 'Full system administration access', category: 'system' },
      { key: 'system:logs', name: 'View Logs', description: 'View system logs', category: 'system' },
      { key: 'system:backup', name: 'Manage Backups', description: 'Manage system backups', category: 'system' }
    ];
  }
}
