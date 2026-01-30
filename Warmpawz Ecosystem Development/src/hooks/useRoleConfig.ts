/**
 * useRoleConfig Hook
 * Cached role configuration fetching with React Query
 * Role configs rarely change, so we cache them for 1 hour
 */

import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl, getAuthHeaders } from '../utils/api-config';
import { cacheManager } from '../utils/cache-manager';

const API_BASE = getApiBaseUrl();

export interface RoleConfig {
  roleId: string;
  roleName: string;
  roleDescription: string;
  capabilities: {
    booking?: boolean;
    chat?: boolean;
    tele?: boolean;
    prescription?: boolean;
    medical_records?: boolean;
    emergency?: boolean;
    catalog?: boolean;
    orders?: boolean;
    inventory?: boolean;
    delivery?: boolean;
    photo_updates?: boolean;
    gallery?: boolean;
    portfolio?: boolean;
    progress_tracking?: boolean;
    cctv_access?: boolean;
    gps_tracking?: boolean;
    staff_management?: boolean;
  };
  serviceStyles: string[];
  requiredFields: string[];
  optionalFields: string[];
  documents?: string[];
}

/**
 * Fetch all role configurations
 */
export function useRoleConfigs() {
  return useQuery({
    queryKey: ['roles', 'config'],
    queryFn: async (): Promise<Record<string, RoleConfig>> => {
      // Try cache first (long TTL since roles rarely change)
      const cached = cacheManager.get<Record<string, RoleConfig>>('role_configs');
      if (cached) {
        console.log('💾 Using cached role configs');
        return cached;
      }

      // Fetch from API
      const response = await fetch(`${API_BASE}/config/roles`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch role configs: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch role configs');
      }

      const roleConfigs = data.roles || {};

      // Cache for 1 hour (roles rarely change)
      cacheManager.save('role_configs', roleConfigs, 60 * 60 * 1000);

      console.log('✅ Role configs loaded and cached');

      return roleConfigs;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: false, // Don't refetch on mount (very stable data)
    refetchOnWindowFocus: false, // Don't refetch on focus
  });
}

/**
 * Fetch single role configuration
 */
export function useRoleConfig(roleId?: string) {
  const { data: allRoles, ...rest } = useRoleConfigs();

  return {
    ...rest,
    data: roleId && allRoles ? allRoles[roleId] : undefined,
  };
}

/**
 * Get capabilities for a specific role
 */
export function useRoleCapabilities(roleId?: string) {
  const { data: roleConfig, isLoading } = useRoleConfig(roleId);

  return {
    capabilities: roleConfig?.capabilities || {},
    roleName: roleConfig?.roleName || roleId || 'Unknown',
    loading: isLoading,
  };
}

/**
 * Check if role allows service style
 */
export function useServiceStyleAllowed(roleId?: string, serviceStyle?: string) {
  const { data: roleConfig } = useRoleConfig(roleId);

  if (!roleConfig || !serviceStyle) return false;

  return roleConfig.serviceStyles?.includes(serviceStyle) || false;
}

/**
 * Get allowed service styles for role
 */
export function useAllowedServiceStyles(roleId?: string) {
  const { data: roleConfig } = useRoleConfig(roleId);

  return roleConfig?.serviceStyles || [];
}

/**
 * Get required fields for role
 */
export function useRequiredFields(roleId?: string) {
  const { data: roleConfig } = useRoleConfig(roleId);

  return {
    required: roleConfig?.requiredFields || [],
    optional: roleConfig?.optionalFields || [],
    documents: roleConfig?.documents || [],
  };
}
