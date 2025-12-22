/**
 * Roles Repository
 * SQL-only data access for roles
 */

import { getDbClient } from '../db.ts';

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Additional fields from KV store
  category?: string;
  vendorType?: string;
  serviceCategory?: string;
  onboardingFields?: any;
  documentRequirements?: any[];
  serviceStyles?: string[];
  staffManagement?: any;
  multiService?: boolean;
  vendorTypes?: string[];
}

export function getRolesRepository() {
  const client = getDbClient();

  return {
    /**
     * Find role by ID (UUID or name)
     */
    async findById(roleId: string): Promise<Role | null> {
      // Try UUID first
      const { data: byUuid, error: uuidError } = await client
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .maybeSingle();

      if (!uuidError && byUuid) return byUuid;

      // Try by name
      const { data: byName, error: nameError } = await client
        .from('roles')
        .select('*')
        .eq('name', roleId)
        .maybeSingle();

      if (nameError) throw nameError;
      return byName;
    },

    /**
     * Find all roles
     */
    async findAll(): Promise<Role[]> {
      const { data, error } = await client
        .from('roles')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    /**
     * Find active roles only
     */
    async findActive(): Promise<Role[]> {
      const { data, error } = await client
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('display_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    /**
     * Create a new role
     */
    async create(roleData: Partial<Role>): Promise<Role> {
      const { data, error } = await client
        .from('roles')
        .insert({
          name: roleData.name!,
          display_name: roleData.display_name || roleData.name!,
          description: roleData.description,
          is_system_role: roleData.is_system_role ?? false,
          is_active: roleData.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    /**
     * Update a role
     */
    async update(roleId: string, updates: Partial<Role>): Promise<Role> {
      // Try UUID first
      let query = client
        .from('roles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        });

      // Check if roleId is UUID or name
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId);
      
      if (isUuid) {
        query = query.eq('id', roleId);
      } else {
        query = query.eq('name', roleId);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;
      return data;
    },
  };
}

