/**
 * Region Roles Repository
 * SQL-only data access for region-role relationships
 * 
 * RULES:
 * - Roles are master data (loaded independently)
 * - Regions enable/disable roles dynamically
 * - Default region is India
 */

import { getDbClient } from '../db.ts';

export interface RegionRole {
  id: string;
  region_id: string;
  role_id: string;
  role_name: string;
  is_enabled: boolean;
  enabled_at?: string | null;
  disabled_at?: string | null;
  enabled_by?: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export function getRegionRolesRepository() {
  const client = getDbClient();

  return {
    /**
     * Get all enabled roles for a region
     */
    async getEnabledRoles(regionId: string): Promise<RegionRole[]> {
      const { data, error } = await client
        .from('region_roles')
        .select('*')
        .eq('region_id', regionId)
        .eq('is_enabled', true)
        .order('role_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    /**
     * Get all roles (enabled and disabled) for a region
     */
    async getRegionRoles(regionId: string): Promise<RegionRole[]> {
      const { data, error } = await client
        .from('region_roles')
        .select('*')
        .eq('region_id', regionId)
        .order('role_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    /**
     * Enable a role for a region
     */
    async enableRole(regionId: string, roleId: string, enabledBy?: string): Promise<RegionRole> {
      // Get role name for denormalization
      const { data: role, error: roleError } = await client
        .from('roles')
        .select('id, name')
        .eq('id', roleId)
        .single();
      
      if (roleError) throw roleError;
      
      const { data, error } = await client
        .from('region_roles')
        .upsert({
          region_id: regionId,
          role_id: roleId,
          role_name: role.name,
          is_enabled: true,
          enabled_at: new Date().toISOString(),
          enabled_by: enabledBy || null,
          disabled_at: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'region_id,role_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Disable a role for a region
     */
    async disableRole(regionId: string, roleId: string): Promise<RegionRole> {
      const { data, error } = await client
        .from('region_roles')
        .upsert({
          region_id: regionId,
          role_id: roleId,
          is_enabled: false,
          disabled_at: new Date().toISOString(),
          enabled_at: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'region_id,role_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Enable multiple roles for a region
     */
    async enableRoles(regionId: string, roleIds: string[], enabledBy?: string): Promise<void> {
      // Get role names for denormalization
      const { data: roles, error: rolesError } = await client
        .from('roles')
        .select('id, name')
        .in('id', roleIds);
      
      if (rolesError) throw rolesError;
      
      const roleMap = new Map(roles.map((r: any) => [r.id, r.name]));
      const now = new Date().toISOString();
      
      const records = roleIds.map(roleId => ({
        region_id: regionId,
        role_id: roleId,
        role_name: roleMap.get(roleId) || roleId,
        is_enabled: true,
        enabled_at: now,
        enabled_by: enabledBy || null,
        disabled_at: null,
        updated_at: now,
      }));

      const { error } = await client
        .from('region_roles')
        .upsert(records, {
          onConflict: 'region_id,role_id',
        });

      if (error) throw error;
    },

    /**
     * Disable multiple roles for a region
     */
    async disableRoles(regionId: string, roleIds: string[]): Promise<void> {
      const now = new Date().toISOString();
      
      for (const roleId of roleIds) {
        const { error } = await client
          .from('region_roles')
          .update({
            is_enabled: false,
            disabled_at: now,
            enabled_at: null,
            updated_at: now,
          })
          .eq('region_id', regionId)
          .eq('role_id', roleId);

        if (error) throw error;
      }
    },

    /**
     * Check if a role is enabled for a region
     */
    async isRoleEnabled(regionId: string, roleId: string): Promise<boolean> {
      const { data, error } = await client
        .from('region_roles')
        .select('is_enabled')
        .eq('region_id', regionId)
        .eq('role_id', roleId)
        .maybeSingle();

      if (error) throw error;
      // If no record exists, default to enabled (backward compatibility)
      return data?.is_enabled ?? true;
    },

    /**
     * Get all roles with their enabled status for a region
     * Returns roles from the roles table with their enabled status from region_roles
     */
    async getRolesWithStatus(regionId: string): Promise<Array<{ role_id: string; role_name: string; is_enabled: boolean }>> {
      // Get all roles
      const { data: allRoles, error: rolesError } = await client
        .from('roles')
        .select('id, name, display_name')
        .eq('is_active', true);

      if (rolesError) throw rolesError;

      // Get region roles for this region
      const { data: regionRoles, error: regionRolesError } = await client
        .from('region_roles')
        .select('role_id, role_name, is_enabled')
        .eq('region_id', regionId);

      if (regionRolesError) throw regionRolesError;

      // Create a map of role_id -> enabled status
      const statusMap = new Map<string, boolean>();
      regionRoles?.forEach(rr => {
        statusMap.set(rr.role_id, rr.is_enabled);
      });

      // Return all roles with their enabled status
      return (allRoles || []).map(role => ({
        role_id: role.id,
        role_name: role.display_name || role.name,
        is_enabled: statusMap.get(role.id) ?? true, // Default to enabled if not configured
      }));
    },
  };
}

