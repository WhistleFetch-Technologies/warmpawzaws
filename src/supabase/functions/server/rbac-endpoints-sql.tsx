/**
 * ============================================================================
 * SQL-BASED RBAC ENDPOINTS
 * ============================================================================
 * 
 * Migrated from: rbac-endpoints.tsx (KV-based)
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Capability enforcement
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from 'hono';
import { sendSuccess, sendError } from "./response-utils";
import { getDbClient, withTransaction } from "../../lib/db";

export function rbacEndpointsSQL(app: Hono) {
  const client = getDbClient();

  /**
   * GET /make-server-3dd53475/admin/rbac/roles
   * Get all roles - SQL-BASED
   */
  app.get("/make-server-3dd53475/admin/rbac/roles", async (c) => {
    try {
      const { data: roles, error } = await client
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Get permissions for each role
      const rolesWithPermissions = await Promise.all(
        (roles || []).map(async (role) => {
          const { data: permissions } = await client
            .from('role_permissions')
            .select('*')
            .eq('role_id', role.id);

          return {
            ...role,
            permissions: permissions || []
          };
        })
      );

      return sendSuccess(c, { roles: rolesWithPermissions });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get roles', 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/rbac/roles
   * Create a new role - SQL-BASED
   */
  app.post("/make-server-3dd53475/admin/rbac/roles", async (c) => {
    try {
      const { name, display_name, description, permissions } = await c.req.json();

      if (!name || !display_name) {
        return sendError(c, 'Role name and display name are required', 400);
      }

      // ✅ SQL-BASED: Create role in transaction
      return await withTransaction(async (txClient) => {
        const { data: role, error: roleError } = await txClient
          .from('roles')
          .insert({
            name,
            display_name,
            description: description || '',
            is_system_role: false,
            is_active: true,
          })
          .select()
          .single();

        if (roleError) throw roleError;

        // Add permissions if provided
        if (permissions && permissions.length > 0) {
          const permissionRecords = permissions.map((perm: any) => ({
            role_id: role.id,
            permission_name: perm.name || perm,
            resource: perm.resource || '*',
            action: perm.action || '*',
          }));

          const { error: permError } = await txClient
            .from('role_permissions')
            .insert(permissionRecords);

          if (permError) throw permError;
        }

        return sendSuccess(c, { role });
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to create role', 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/admin/rbac/roles/:roleId
   * Update a role - SQL-BASED
   */
  app.put("/make-server-3dd53475/admin/rbac/roles/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const updates = await c.req.json();

      const { data: role, error } = await client
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single();

      if (error || !role) {
        return sendError(c, 'Role not found', 404);
      }

      if (role.is_system_role) {
        return sendError(c, 'Cannot modify system role', 403);
      }

      const { data: updated, error: updateError } = await client
        .from('roles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId)
        .select()
        .single();

      if (updateError) throw updateError;

      return sendSuccess(c, { role: updated });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to update role', 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/rbac/roles/:roleId/permissions
   * Get role permissions - SQL-BASED
   */
  app.get("/make-server-3dd53475/admin/rbac/roles/:roleId/permissions", async (c) => {
    try {
      const { roleId } = c.req.param();

      const { data: permissions, error } = await client
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId);

      if (error) throw error;

      return sendSuccess(c, { permissions: permissions || [] });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to get permissions', 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/rbac/roles/:roleId/permissions
   * Add permission to role - SQL-BASED
   */
  app.post("/make-server-3dd53475/admin/rbac/roles/:roleId/permissions", async (c) => {
    try {
      const { roleId } = c.req.param();
      const { permission_name, resource, action } = await c.req.json();

      if (!permission_name) {
        return sendError(c, 'Permission name is required', 400);
      }

      const { data: permission, error } = await client
        .from('role_permissions')
        .insert({
          role_id: roleId,
          permission_name,
          resource: resource || '*',
          action: action || '*',
        })
        .select()
        .single();

      if (error) throw error;

      return sendSuccess(c, { permission });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to add permission', 500);
    }
  });
}

