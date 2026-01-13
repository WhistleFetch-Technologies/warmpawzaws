/**
 * useVendorCapabilities Hook
 * Loads vendor capabilities from the API based on their assigned role.
 * This ensures vendors only see features configured for their role.
 * 
 * Updated: 2026-01-13
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// Default capabilities for fallback
const DEFAULT_CAPABILITIES: Record<string, boolean> = {
  dashboard: true,
  profile: true,
  bookings: true,
  services: true,
  schedule: true,
  chat: true,
  notifications: true,
};

export interface VendorCapabilities {
  capabilities: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  roleId: string | null;
  roleName: string | null;
  refresh: () => void;
}

interface RoleResponse {
  success: boolean;
  roleId?: string;
  roleName?: string;
  roleCode?: string;
  capabilities?: string[];
  vendorTypes?: string[];
  serviceStyles?: string[];
  pricingControl?: {
    canControlPrice: boolean;
    canControlDuration: boolean;
  };
  error?: string;
}

/**
 * Converts an array of capability strings to a boolean map
 */
function capabilitiesToMap(capabilities: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  capabilities.forEach(cap => {
    // Normalize capability names (handle both snake_case and camelCase)
    const normalized = cap.toLowerCase().replace(/-/g, '_');
    map[normalized] = true;
    // Also add camelCase version
    const camelCase = normalized.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    map[camelCase] = true;
  });
  return map;
}

/**
 * Hook to load vendor capabilities from their assigned role
 * @param roleIdOrVendorData - The role ID, role code, or vendor data object containing roleId and capabilities
 */
export function useVendorCapabilities(roleIdOrVendorData: string | undefined | null | { roleId?: string; role_id?: string; capabilities?: string[] }): VendorCapabilities {
  // Extract roleId and pre-loaded capabilities from input
  let roleId: string | undefined | null;
  let preloadedCapabilities: string[] | undefined;
  
  if (typeof roleIdOrVendorData === 'object' && roleIdOrVendorData !== null) {
    roleId = roleIdOrVendorData.roleId || roleIdOrVendorData.role_id;
    preloadedCapabilities = roleIdOrVendorData.capabilities;
  } else {
    roleId = roleIdOrVendorData;
  }
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>(DEFAULT_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [resolvedRoleId, setResolvedRoleId] = useState<string | null>(null);

  const loadCapabilities = useCallback(async () => {
    // If capabilities were pre-loaded (e.g., from vendor dashboard response), use them
    if (preloadedCapabilities && preloadedCapabilities.length > 0) {
      const capsMap = capabilitiesToMap(preloadedCapabilities);
      const mergedCapabilities = {
        ...DEFAULT_CAPABILITIES,
        ...capsMap,
      };
      setCapabilities(mergedCapabilities);
      setResolvedRoleId(roleId || null);
      setLoading(false);
      console.log('[useVendorCapabilities] Using pre-loaded capabilities:', preloadedCapabilities.length);
      return;
    }
    
    if (!roleId) {
      console.warn('[useVendorCapabilities] No roleId provided, using default capabilities');
      setCapabilities(DEFAULT_CAPABILITIES);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('[useVendorCapabilities] Loading capabilities for role:', roleId);

      // Try to get role details from the API
      // First try as a UUID (role ID), then as a role code (e.g., 'veterinarian')
      let response: RoleResponse | null = null;
      
      // Check if roleId looks like a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId);
      
      if (isUuid) {
        // Load by role UUID
        response = await apiClient.get<RoleResponse>(`/config/roles/${roleId}`);
      } else {
        // Try to find role by code/name - load all roles and filter
        const rolesResponse = await apiClient.get<{ success: boolean; roles: any[] }>('/config/roles');
        if (rolesResponse.success && rolesResponse.roles) {
          const normalizedRoleId = roleId.toLowerCase().replace(/\s+/g, '_');
          const matchedRole = rolesResponse.roles.find((r: any) => 
            r.name?.toLowerCase() === normalizedRoleId ||
            r.roleCode?.toLowerCase() === normalizedRoleId ||
            r.display_name?.toLowerCase() === normalizedRoleId.replace(/_/g, ' ') ||
            r.id === roleId
          );
          
          if (matchedRole) {
            response = {
              success: true,
              roleId: matchedRole.id,
              roleName: matchedRole.display_name || matchedRole.name,
              roleCode: matchedRole.name,
              capabilities: matchedRole.capabilities || [],
              vendorTypes: matchedRole.vendorTypes || [],
              serviceStyles: matchedRole.serviceStyles || [],
              pricingControl: matchedRole.pricingControl,
            };
          }
        }
      }

      if (response?.success && response.capabilities) {
        const capsMap = capabilitiesToMap(response.capabilities);
        
        // Merge with defaults to ensure basic capabilities are available
        const mergedCapabilities = {
          ...DEFAULT_CAPABILITIES,
          ...capsMap,
        };
        
        setCapabilities(mergedCapabilities);
        setRoleName(response.roleName || null);
        setResolvedRoleId(response.roleId || roleId);
        
        console.log('[useVendorCapabilities] Loaded capabilities:', {
          roleId: response.roleId,
          roleName: response.roleName,
          capabilitiesCount: response.capabilities.length,
          capabilities: response.capabilities,
        });
      } else {
        // Fallback to default capabilities
        console.warn('[useVendorCapabilities] Could not load role, using defaults for:', roleId);
        setCapabilities(DEFAULT_CAPABILITIES);
      }
    } catch (err: any) {
      console.error('[useVendorCapabilities] Error loading capabilities:', err);
      setError(err.message || 'Failed to load capabilities');
      // Use default capabilities on error
      setCapabilities(DEFAULT_CAPABILITIES);
    } finally {
      setLoading(false);
    }
  }, [roleId, preloadedCapabilities]);

  // Load capabilities on mount and when roleId changes
  useEffect(() => {
    loadCapabilities();
  }, [loadCapabilities]);

  // Also try to load from vendor session/storage for offline support
  useEffect(() => {
    if (typeof window !== 'undefined' && !loading) {
      const cached = sessionStorage.getItem(`vendor_capabilities_${roleId}`);
      if (cached && Object.keys(capabilities).length <= Object.keys(DEFAULT_CAPABILITIES).length) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.timestamp && Date.now() - parsed.timestamp < 300000) { // 5 min cache
            setCapabilities(prev => ({ ...prev, ...parsed.capabilities }));
          }
        } catch (e) {
          // Ignore cache errors
        }
      }
    }
  }, [roleId, loading, capabilities]);

  // Cache capabilities for offline use
  useEffect(() => {
    if (typeof window !== 'undefined' && !loading && roleId && Object.keys(capabilities).length > 0) {
      try {
        sessionStorage.setItem(`vendor_capabilities_${roleId}`, JSON.stringify({
          capabilities,
          timestamp: Date.now(),
        }));
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [capabilities, loading, roleId]);

  return {
    capabilities,
    loading,
    error,
    roleId: resolvedRoleId,
    roleName,
    refresh: loadCapabilities,
  };
}
