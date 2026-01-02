import { Hono } from 'hono';
// ✅ SQL MIGRATION: Replace KV with SQL repositories
import { getRolesRepository } from "../../../supabase/lib/repositories/roles";
import { getDbClient } from "../../../supabase/lib/db";
import { getAdminProfilesRepository } from "../../../supabase/lib/repositories/admin-profiles";

export function rbacEndpoints(app: Hono) {
  const db = getDbClient();
  const rolesRepo = getRolesRepository();
  
  /**
   * GET /admin/rbac/roles
   * Get all roles with hierarchy
   */
  app.get("/make-server-3dd53475/admin/rbac/roles", async (c) => {
    try {
      // ✅ SQL: Get all roles from repository
      const roles = await rolesRepo.findAll();
      
      return c.json({ success: true, roles });
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
      
      // ✅ SQL: Create role using repository
      const role = await rolesRepo.create({
        name,
        display_name: name,
        description: description || '',
        is_system_role: false,
        is_active: true,
        // Store permissions, parentRole, level in config JSONB field
        config: {
          permissions: permissions || [],
          parentRole: parentRole || null,
          level: level || 1,
        },
      });
      
      // ✅ SQL: Store permissions in role_permissions table if provided
      if (permissions && permissions.length > 0) {
        // Insert permissions into role_permissions table
        for (const perm of permissions) {
          const permData = typeof perm === 'string' 
            ? { permission_name: perm, resource: '*', action: '*' }
            : { permission_name: perm.key || perm.name, resource: perm.resource || '*', action: perm.action || '*' };
          
          await db.from('role_permissions').insert({
            role_id: role.id,
            permission_name: permData.permission_name,
            resource: permData.resource,
            action: permData.action,
          });
        }
      }
      
      console.log(`✅ Role created: ${role.id} - ${name}`);
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
      
      // ✅ SQL: Get role from repository
      const role = await rolesRepo.findById(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      if (role.is_system_role) {
        return c.json({ error: 'Cannot modify system role' }, 403);
      }
      
      // ✅ SQL: Update role using repository
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.display_name) updateData.display_name = updates.display_name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      
      // Handle permissions, parentRole, level in config
      if (updates.permissions || updates.parentRole || updates.level) {
        const currentConfig = role.config || {};
        updateData.config = {
          ...currentConfig,
          permissions: updates.permissions !== undefined ? updates.permissions : currentConfig.permissions,
          parentRole: updates.parentRole !== undefined ? updates.parentRole : currentConfig.parentRole,
          level: updates.level !== undefined ? updates.level : currentConfig.level,
        };
      }
      
      const updatedRole = await rolesRepo.update(roleId, updateData);
      
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
      
      // ✅ SQL: Get role from repository
      const role = await rolesRepo.findById(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      if (role.is_system_role) {
        return c.json({ error: 'Cannot delete system role' }, 403);
      }
      
      // ✅ SQL: Check if role is assigned to any users
      const { data: userRoles } = await db
        .from('user_roles')
        .select('id')
        .eq('role_id', role.id)
        .eq('is_active', true)
        .limit(1);
      
      if (userRoles && userRoles.length > 0) {
        return c.json({ error: 'Cannot delete role that is assigned to users' }, 400);
      }
      
      // ✅ SQL: Soft delete role (set is_active = false)
      await rolesRepo.delete(roleId);
      
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
      // ✅ SQL: Get permissions from platform_settings or return defaults
      const { data: setting } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'rbac_permissions_list')
        .single();
      
      if (setting?.setting_value) {
        return c.json({ success: true, permissions: setting.setting_value });
      }
      
      // Initialize default permissions if not exists
      const defaultPermissions = getDefaultPermissions();
      
      // ✅ SQL: Store default permissions in platform_settings
      await db.from('platform_settings').upsert({
        setting_key: 'rbac_permissions_list',
        setting_value: defaultPermissions,
        setting_type: 'array',
        description: 'RBAC permissions list',
      });
      
      return c.json({ success: true, permissions: defaultPermissions });
    } catch (error) {
      console.error('Get Permissions Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /admin/rbac/users
   * Get all admin users
   */
  app.get("/make-server-3dd53475/admin/rbac/users", async (c) => {
    try {
      // ✅ SQL: Get admin users from admin_profiles table
      const adminProfilesRepo = getAdminProfilesRepository();
      const adminUsers = await adminProfilesRepo.findAll();
      
      // ✅ SQL: Get role assignments for each user
      const formattedUsers = await Promise.all(adminUsers.map(async (u: any) => {
        const { data: userRoles } = await db
          .from('user_roles')
          .select('role_id')
          .eq('user_id', u.id)
          .eq('is_active', true);
        
        const roleIds = userRoles?.map((ur: any) => ur.role_id) || [];
        
        return {
          id: u.id,
          name: u.name || u.email?.split('@')[0],
          email: u.email,
          role: roleIds[0] || 'admin', // Primary role
          roles: roleIds,
          status: u.status || 'active',
          lastLogin: u.last_login || u.created_at,
          createdAt: u.created_at
        };
      }));
      
      return c.json({ success: true, users: formattedUsers });
    } catch (error) {
      console.error('Get Admin Users Error:', error);
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
      
      // ✅ SQL: Get user roles from user_roles table
      const { data: userRolesData } = await db
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (!userRolesData || userRolesData.length === 0) {
        // Check if user exists (could be admin or vendor)
        const adminRepo = getAdminProfilesRepository();
        const admin = await adminRepo.findById(userId);
        if (!admin) {
          return c.json({ error: 'User not found' }, 404);
        }
      }
      
      const userRoles = userRolesData?.map((ur: any) => ur.role_id) || [];
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
      const { roles, assignedBy } = await c.req.json();
      
      if (!Array.isArray(roles)) {
        return c.json({ error: 'Roles must be an array' }, 400);
      }
      
      // ✅ SQL: Validate all roles exist
      for (const roleId of roles) {
        const role = await rolesRepo.findById(roleId);
        if (!role) {
          return c.json({ error: `Role not found: ${roleId}` }, 404);
        }
      }
      
      // ✅ SQL: Check if user exists (could be admin or vendor)
      const adminRepo = getAdminProfilesRepository();
      let user = await adminRepo.findById(userId);
      // If not admin, could be vendor - just verify user exists in system
      if (!user) {
        // Could check vendors table too, but for now assume user exists
        const { data: checkUser } = await db
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();
        if (!checkUser) {
          return c.json({ error: 'User not found' }, 404);
        }
      }
      
      // ✅ SQL: Remove existing role assignments (soft delete)
      await db
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', userId);
      
      // ✅ SQL: Create new role assignments
      for (const roleId of roles) {
        const role = await rolesRepo.findById(roleId);
        if (role) {
          await db.from('user_roles').upsert({
            user_id: userId,
            role_id: role.id,
            assigned_by: assignedBy || null,
            is_active: true,
          });
        }
      }
      
      // ✅ SQL: Log audit event
      await logAuditEvent('role_assigned', assignedBy || userId, {
        target_user_id: userId,
        roles,
      });
      
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
      
      // ✅ SQL: Get role (resolve UUID if needed)
      const role = await rolesRepo.findById(roleId);
      if (!role) {
        return c.json({ error: 'Role not found' }, 404);
      }
      
      // ✅ SQL: Soft delete role assignment
      await db
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('role_id', role.id);
      
      // ✅ SQL: Get remaining active roles for user
      const { data: remainingRoles } = await db
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      const updatedRoles = remainingRoles?.map((ur: any) => ur.role_id) || [];
      
      // ✅ SQL: Log audit event
      await logAuditEvent('role_removed', userId, {
        target_user_id: userId,
        role_id: role.id,
      });
      
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
      
      // ✅ SQL: Get user roles
      const { data: userRolesData } = await db
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (!userRolesData || userRolesData.length === 0) {
        // Check if user exists
        const adminRepo = getAdminProfilesRepository();
        const admin = await adminRepo.findById(userId);
        if (!admin) {
          return c.json({ hasPermission: false, reason: 'User not found' });
        }
      }
      
      const userRoles = userRolesData?.map((ur: any) => ur.role_id) || [];
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
      
      // ✅ SQL: Get audit logs from rbac_audit_logs table
      const { data: logs } = await db
        .from('rbac_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      return c.json({ success: true, logs: logs || [] });
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
      // ✅ SQL: Policies may be stored in platform_settings or a dedicated policies table
      // For now, return empty array or check platform_settings
      const { data: policiesSetting } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'rbac_policies')
        .single();
      
      const policies = policiesSetting?.setting_value || [];
      
      return c.json({ success: true, policies });
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
      
      // ✅ SQL: Store policy in platform_settings (or dedicated policies table if exists)
      const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const policy = {
        id: policyId,
        name,
        description: description || '',
        rules,
        effect: effect || 'allow',
        priority: priority || 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Get existing policies
      const { data: existing } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'rbac_policies')
        .single();
      
      const existingPolicies = existing?.setting_value || [];
      existingPolicies.push(policy);
      
      // Update policies list
      await db.from('platform_settings').upsert({
        setting_key: 'rbac_policies',
        setting_value: existingPolicies,
        setting_type: 'array',
        description: 'RBAC access policies',
      });
      
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
    // ✅ SQL: Get role from repository
    const role = await rolesRepo.findById(roleId);
    if (!role || !role.is_active) return;
    
    // ✅ SQL: Get permissions from role_permissions table
    const { data: rolePermissions } = await db
      .from('role_permissions')
      .select('permission_name')
      .eq('role_id', role.id);
    
    if (rolePermissions) {
      rolePermissions.forEach((rp: any) => permissionsSet.add(rp.permission_name));
    }
    
    // Also check config for legacy permissions format
    if (role.config?.permissions && Array.isArray(role.config.permissions)) {
      role.config.permissions.forEach((p: string | any) => {
        const permKey = typeof p === 'string' ? p : (p.key || p.name);
        if (permKey) permissionsSet.add(permKey);
      });
    }
    
    // Recursively add parent role permissions (inheritance)
    if (role.config?.parentRole) {
      await collectRolePermissions(role.config.parentRole, permissionsSet);
    }
  }

  async function logAuditEvent(action: string, userId: string, details: any): Promise<void> {
    // ✅ SQL: Store audit log in rbac_audit_logs table
    await db.from('rbac_audit_logs').insert({
      action,
      user_id: userId,
      target_user_id: details.target_user_id || null,
      role_id: details.role_id || null,
      permission_name: details.permission || null,
      details: details,
    });
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