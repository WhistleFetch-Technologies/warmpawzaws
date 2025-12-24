import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { sendSuccess, sendError } from './response-utils.ts';

export function rbacEndpoints(app: Hono) {
  const client = getDbClient();
  
  /**
   * GET /admin/rbac/roles (✅ SQL-only)
   * Get all roles with hierarchy
   */
  app.get("/make-server-3dd53475/admin/rbac/roles", async (c) => {
    try {
      // ✅ SQL: Get all roles from database
      const { data: roles, error } = await client
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Get Roles Error:', error);
        return sendError(c, error, 500);
      }
      
      // Transform SQL rows to expected format
      const formattedRoles = (roles || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        displayName: r.display_name,
        description: r.description,
        isActive: r.is_active,
        isSystem: r.is_system_role,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      
      return sendSuccess(c, { roles: formattedRoles });
    } catch (error) {
      console.error('Get Roles Error:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /admin/rbac/roles (✅ SQL-only)
   * Create a new role
   */
  app.post("/make-server-3dd53475/admin/rbac/roles", async (c) => {
    try {
      const { name, description, permissions } = await c.req.json();
      
      if (!name) {
        return sendError(c, 'Role name is required', 400);
      }
      
      // ✅ SQL: Create role
      const { data: role, error: roleError } = await client
        .from('roles')
        .insert({
          name,
          display_name: name,
          description: description || '',
          is_active: true,
          is_system_role: false
        })
        .select()
        .single();
      
      if (roleError || !role) {
        console.error('Create Role Error:', roleError);
        return sendError(c, roleError || 'Failed to create role', 500);
      }
      
      // ✅ SQL: Add permissions if provided
      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        const permissionRecords = permissions.map((perm: string) => ({
          role_id: role.id,
          permission_name: perm,
          resource: perm.split(':')[0] || 'all',
          action: perm.split(':')[1] || 'all'
        }));
        
        await client
          .from('role_permissions')
          .insert(permissionRecords);
      }
      
      // Transform to expected format
      const formattedRole = {
        id: role.id,
        name: role.name,
        displayName: role.display_name,
        description: role.description,
        permissions: permissions || [],
        isActive: role.is_active,
        isSystem: role.is_system_role,
        createdAt: role.created_at,
        updatedAt: role.updated_at
      };
      
      console.log(`✅ Role created: ${role.id} - ${name}`);
      return sendSuccess(c, { role: formattedRole });
    } catch (error) {
      console.error('Create Role Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/rbac/roles/:roleId (✅ SQL-only)
   * Update a role
   */
  app.put("/make-server-3dd53475/admin/rbac/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const updates = await c.req.json();
      
      // ✅ SQL: Get role
      const { data: role, error: fetchError } = await client
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single();
      
      if (fetchError || !role) {
        return sendError(c, 'Role not found', 404);
      }
      
      if (role.is_system_role) {
        return sendError(c, 'Cannot modify system role', 403);
      }
      
      // ✅ SQL: Update role
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (updates.name) updateData.name = updates.name;
      if (updates.display_name) updateData.display_name = updates.display_name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      
      const { data: updatedRole, error: updateError } = await client
        .from('roles')
        .update(updateData)
        .eq('id', roleId)
        .select()
        .single();
      
      if (updateError || !updatedRole) {
        console.error('Update Role Error:', updateError);
        return sendError(c, updateError || 'Failed to update role', 500);
      }
      
      // Transform to expected format
      const formattedRole = {
        id: updatedRole.id,
        name: updatedRole.name,
        displayName: updatedRole.display_name,
        description: updatedRole.description,
        isActive: updatedRole.is_active,
        isSystem: updatedRole.is_system_role,
        createdAt: updatedRole.created_at,
        updatedAt: updatedRole.updated_at
      };
      
      console.log(`✅ Role updated: ${roleId}`);
      return sendSuccess(c, { role: formattedRole });
    } catch (error) {
      console.error('Update Role Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/rbac/roles/:roleId (✅ SQL-only)
   * Delete a role
   */
  app.delete("/make-server-3dd53475/admin/rbac/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      // ✅ SQL: Get role
      const { data: role, error: fetchError } = await client
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single();
      
      if (fetchError || !role) {
        return sendError(c, 'Role not found', 404);
      }
      
      if (role.is_system_role) {
        return sendError(c, 'Cannot delete system role', 403);
      }
      
      // ✅ SQL: Check if role is assigned to any users
      const { data: userRoles, error: checkError } = await client
        .from('user_roles')
        .select('id')
        .eq('role_id', roleId)
        .eq('is_active', true)
        .limit(1);
      
      if (checkError) {
        console.error('Check assignments error:', checkError);
        return sendError(c, checkError, 500);
      }
      
      if (userRoles && userRoles.length > 0) {
        return sendError(c, 'Cannot delete role that is assigned to users', 400);
      }
      
      // ✅ SQL: Delete role (cascade will delete role_permissions)
      const { error: deleteError } = await client
        .from('roles')
        .delete()
        .eq('id', roleId);
      
      if (deleteError) {
        console.error('Delete Role Error:', deleteError);
        return sendError(c, deleteError, 500);
      }
      
      console.log(`✅ Role deleted: ${roleId}`);
      return sendSuccess(c, { message: 'Role deleted successfully' });
    } catch (error) {
      console.error('Delete Role Error:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /admin/rbac/permissions (✅ SQL-only)
   * Get all available permissions
   */
  app.get("/make-server-3dd53475/admin/rbac/permissions", async (c) => {
    try {
      // ✅ SQL: Get permissions from catalog
      const { data: permissions, error } = await client
        .from('rbac_permissions_catalog')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) {
        console.error('Get Permissions Error:', error);
        // If table doesn't exist, return default permissions
        const defaultPermissions = getDefaultPermissions();
        return sendSuccess(c, { permissions: defaultPermissions });
      }
      
      if (!permissions || permissions.length === 0) {
        // Initialize default permissions
        const defaultPermissions = getDefaultPermissions();
        
        // Insert default permissions
        const permissionRecords = defaultPermissions.map((perm: any) => ({
          permission_key: perm.key,
          permission_name: perm.name,
          description: perm.description,
          category: perm.category,
          resource: perm.key.split(':')[0] || 'all',
          action: perm.key.split(':')[1] || 'all'
        }));
        
        await client
          .from('rbac_permissions_catalog')
          .insert(permissionRecords);
        
        return sendSuccess(c, { permissions: defaultPermissions });
      }
      
      // Transform SQL rows to expected format
      const formattedPermissions = permissions.map((p: any) => ({
        key: p.permission_key,
        name: p.permission_name,
        description: p.description,
        category: p.category
      }));
      
      return sendSuccess(c, { permissions: formattedPermissions });
    } catch (error) {
      console.error('Get Permissions Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/rbac/users (✅ SQL-only)
   * Get all admin users with their roles
   */
  app.get("/make-server-3dd53475/admin/rbac/users", async (c) => {
    try {
      // ✅ SQL: Get all users with role assignments
      const { data: userRoles, error } = await client
        .from('user_roles')
        .select(`
          *,
          roles:role_id (
            id,
            name,
            display_name
          ),
          users:user_id (
            id,
            email,
            phone
          )
        `)
        .eq('is_active', true);
      
      if (error) {
        console.error('Get Admin Users Error:', error);
        return sendError(c, error, 500);
      }
      
      // Group by user
      const userMap = new Map();
      
      (userRoles || []).forEach((ur: any) => {
        const userId = ur.user_id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: userId,
            email: ur.users?.email || '',
            phone: ur.users?.phone || '',
            roles: []
          });
        }
        userMap.get(userId).roles.push({
          id: ur.roles?.id,
          name: ur.roles?.name,
          displayName: ur.roles?.display_name
        });
      });
      
      const formattedUsers = Array.from(userMap.values()).map((u: any) => ({
        id: u.id,
        name: u.email?.split('@')[0] || 'User',
        email: u.email,
        roles: u.roles.map((r: any) => r.id),
        roleNames: u.roles.map((r: any) => r.name),
        status: 'active'
      }));
      
      return sendSuccess(c, { users: formattedUsers });
    } catch (error) {
      console.error('Get Admin Users Error:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /admin/rbac/users/:userId/permissions (✅ SQL-only)
   * Get effective permissions for a user (with role inheritance)
   */
  app.get("/make-server-3dd53475/admin/rbac/users/:userId/permissions", async (c) => {
    try {
      const { userId } = c.req.param();
      
      // ✅ SQL: Get user's roles
      const { data: userRoles, error: rolesError } = await client
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (rolesError) {
        console.error('Get User Roles Error:', rolesError);
        return sendError(c, rolesError, 500);
      }
      
      if (!userRoles || userRoles.length === 0) {
        return sendSuccess(c, { 
          permissions: [],
          roles: []
        });
      }
      
      const roleIds = userRoles.map((ur: any) => ur.role_id);
      
      // ✅ SQL: Get permissions for all roles
      const { data: rolePermissions, error: permsError } = await client
        .from('role_permissions')
        .select('permission_name')
        .in('role_id', roleIds);
      
      if (permsError) {
        console.error('Get Role Permissions Error:', permsError);
        return sendError(c, permsError, 500);
      }
      
      const allPermissions = new Set<string>();
      (rolePermissions || []).forEach((rp: any) => {
        allPermissions.add(rp.permission_name);
      });
      
      return sendSuccess(c, { 
        permissions: Array.from(allPermissions),
        roles: roleIds
      });
    } catch (error) {
      console.error('Get User Permissions Error:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * POST /admin/rbac/users/:userId/roles (✅ SQL-only)
   * Assign roles to a user
   */
  app.post("/make-server-3dd53475/admin/rbac/users/:userId/roles", async (c) => {
    try {
      const { userId } = c.req.param();
      const { roles, assignedBy } = await c.req.json();
      
      if (!Array.isArray(roles)) {
        return sendError(c, 'Roles must be an array', 400);
      }
      
      // ✅ SQL: Validate all roles exist
      const { data: existingRoles, error: validateError } = await client
        .from('roles')
        .select('id')
        .in('id', roles)
        .eq('is_active', true);
      
      if (validateError) {
        console.error('Validate roles error:', validateError);
        return sendError(c, validateError, 500);
      }
      
      if (!existingRoles || existingRoles.length !== roles.length) {
        return sendError(c, 'One or more roles not found', 404);
      }
      
      // ✅ SQL: Remove existing role assignments
      await client
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', userId);
      
      // ✅ SQL: Insert new role assignments
      const roleAssignments = roles.map((roleId: string) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy || null,
        is_active: true
      }));
      
      const { error: insertError } = await client
        .from('user_roles')
        .insert(roleAssignments);
      
      if (insertError) {
        console.error('Assign Roles Error:', insertError);
        return sendError(c, insertError, 500);
      }
      
      // ✅ SQL: Log audit event
      await client
        .from('rbac_audit_logs')
        .insert({
          action: 'role_assigned',
          user_id: assignedBy || userId,
          target_user_id: userId,
          details: { roles }
        });
      
      console.log(`✅ Roles assigned to user ${userId}: ${roles.join(', ')}`);
      return sendSuccess(c, { roles });
    } catch (error) {
      console.error('Assign Roles Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/rbac/users/:userId/roles/:roleId (✅ SQL-only)
   * Remove a role from a user
   */
  app.delete("/make-server-3dd53475/admin/rbac/users/:userId/roles/:roleId", async (c) => {
    try {
      const { userId, roleId } = c.req.param();
      const adminId = c.req.query('adminId') || userId;
      
      // ✅ SQL: Deactivate role assignment
      const { error: updateError } = await client
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('role_id', roleId);
      
      if (updateError) {
        console.error('Remove Role Error:', updateError);
        return sendError(c, updateError, 500);
      }
      
      // ✅ SQL: Log audit event
      await client
        .from('rbac_audit_logs')
        .insert({
          action: 'role_removed',
          user_id: adminId,
          target_user_id: userId,
          role_id: roleId
        });
      
      // Get updated roles
      const { data: userRoles } = await client
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      const updatedRoles = (userRoles || []).map((ur: any) => ur.role_id);
      
      console.log(`✅ Role ${roleId} removed from user ${userId}`);
      return sendSuccess(c, { roles: updatedRoles });
    } catch (error) {
      console.error('Remove Role Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/rbac/check-permission (✅ SQL-only)
   * Check if user has specific permission
   */
  app.post("/make-server-3dd53475/admin/rbac/check-permission", async (c) => {
    try {
      const { userId, permission } = await c.req.json();
      
      if (!userId || !permission) {
        return sendError(c, 'userId and permission are required', 400);
      }
      
      // ✅ SQL: Get user's roles
      const { data: userRoles } = await client
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (!userRoles || userRoles.length === 0) {
        return sendSuccess(c, { 
          hasPermission: false,
          reason: 'User has no roles assigned',
          permission,
          userId
        });
      }
      
      const roleIds = userRoles.map((ur: any) => ur.role_id);
      
      // ✅ SQL: Check if any role has this permission
      const { data: rolePermissions } = await client
        .from('role_permissions')
        .select('id')
        .in('role_id', roleIds)
        .eq('permission_name', permission)
        .limit(1);
      
      const hasPermission = (rolePermissions && rolePermissions.length > 0);
      
      return sendSuccess(c, { 
        hasPermission,
        permission,
        userId
      });
    } catch (error) {
      console.error('Check Permission Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/rbac/audit-log (✅ SQL-only)
   * Get RBAC audit log
   */
  app.get("/make-server-3dd53475/admin/rbac/audit-log", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '50');
      
      // ✅ SQL: Get audit logs
      const { data: logs, error } = await client
        .from('rbac_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Get Audit Log Error:', error);
        return sendError(c, error, 500);
      }
      
      // Transform SQL rows to expected format
      const formattedLogs = (logs || []).map((log: any) => ({
        id: log.id,
        action: log.action,
        userId: log.user_id,
        targetUserId: log.target_user_id,
        roleId: log.role_id,
        permissionName: log.permission_name,
        details: log.details,
        timestamp: log.created_at
      }));
      
      return sendSuccess(c, { logs: formattedLogs });
    } catch (error) {
      console.error('Get Audit Log Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/rbac/policies
   * Get all access policies (✅ SQL-only)
   */
  app.get("/make-server-3dd53475/admin/rbac/policies", async (c) => {
    try {
      const { data: policies, error } = await client
        .from('rbac_policies')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });
      
      if (error) {
        console.error('Get Policies Error:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      // Transform SQL rows to expected format
      const validPolicies = (policies || []).map((p: any) => ({
        id: p.policy_id,
        name: p.name,
        description: p.description,
        rules: p.rules,
        effect: p.effect,
        priority: p.priority,
        isActive: p.is_active,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
      
      return c.json({ success: true, policies: validPolicies });
    } catch (error) {
      console.error('Get Policies Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /admin/rbac/policies
   * Create a new access policy (✅ SQL-only)
   */
  app.post("/make-server-3dd53475/admin/rbac/policies", async (c) => {
    try {
      const { name, description, rules, effect, priority } = await c.req.json();
      
      if (!name || !rules) {
        return c.json({ error: 'Policy name and rules are required' }, 400);
      }
      
      const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const { data: policy, error } = await client
        .from('rbac_policies')
        .insert({
          policy_id: policyId,
          name,
          description: description || '',
          rules: rules,
          effect: effect || 'allow',
          priority: priority || 0,
          is_active: true
        })
        .select()
        .single();
      
      if (error) {
        console.error('Create Policy Error:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      // Transform to expected format
      const formattedPolicy = {
        id: policy.policy_id,
        name: policy.name,
        description: policy.description,
        rules: policy.rules,
        effect: policy.effect,
        priority: policy.priority,
        isActive: policy.is_active,
        createdAt: policy.created_at,
        updatedAt: policy.updated_at
      };
      
      console.log(`✅ Policy created: ${policyId} - ${name}`);
      return c.json({ success: true, policy: formattedPolicy });
    } catch (error) {
      console.error('Create Policy Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  // Helper functions removed - now using SQL directly
  
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