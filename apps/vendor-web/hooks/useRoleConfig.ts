'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { normalizeRoleConfig, NormalizedRoleConfig } from '@/lib/api-normalizers';
import { 
  getRoleConfig, 
  getDashboardSections, 
  getAllowedServiceStyles,
  normalizeRoleName,
  SERVICE_STYLES,
  DashboardSection,
  ServiceStyleConfig,
} from '@/lib/role-config';

/**
 * ============================================================================
 * ENHANCED ROLE CONFIG HOOK
 * ============================================================================
 * 
 * Provides a unified interface for accessing role-based configuration.
 * Features:
 * - Caches config in memory and localStorage
 * - Falls back to static config if API fails
 * - Merges API config with static UI config
 * - Provides helper methods for common checks
 */

// In-memory cache
const configCache: Record<string, { config: NormalizedRoleConfig; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface UseRoleConfigResult {
  // Data
  config: NormalizedRoleConfig | null;
  dashboardSections: DashboardSection[];
  allowedStyles: ServiceStyleConfig[];
  capabilities: string[];
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Helpers
  hasCapability: (capability: string) => boolean;
  isStyleAllowed: (style: string) => boolean;
  getStyleConfig: (style: string) => ServiceStyleConfig | null;
  refresh: () => Promise<void>;
}

export function useRoleConfig(roleId?: string): UseRoleConfigResult {
  const [config, setConfig] = useState<NormalizedRoleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Try to get roleId from localStorage if not provided
  const effectiveRoleId = useMemo(() => {
    if (roleId) {
      // Normalize role name (handle both DB and UI names)
      return normalizeRoleName(roleId, false);
    }
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vendorData');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          const storedRoleId = data.roleId || data.role_id;
          if (storedRoleId) {
            // Normalize role name
            return normalizeRoleName(storedRoleId, false);
          }
        } catch (e) {
          console.warn('[useRoleConfig] Failed to parse vendorData from localStorage');
        }
      }
    }
    
    return null;
  }, [roleId]);

  const fetchConfig = useCallback(async () => {
    if (!effectiveRoleId) {
      setIsLoading(false);
      return;
    }

    // Check memory cache first
    const cached = configCache[effectiveRoleId];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[useRoleConfig] Using cached config for:', effectiveRoleId);
      setConfig(cached.config);
      setIsLoading(false);
      return;
    }

    // Check localStorage cache
    if (typeof window !== 'undefined') {
      try {
        const localCached = localStorage.getItem(`roleConfig_${effectiveRoleId}`);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            console.log('[useRoleConfig] Using localStorage cached config');
            setConfig(parsed.config);
            setIsLoading(false);
            // Still fetch in background to update cache
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    try {
      console.log('[useRoleConfig] Fetching config from DATABASE API for:', effectiveRoleId);
      const response = await apiClient.get(`/config/roles/${effectiveRoleId}`) as any;
      
      // The API returns the full role object directly for single role fetch
      if (response?.success !== false && (response.roleId || response.id || response.name)) {
        // Direct role object response
        const rawConfig = response;
        const normalized = normalizeRoleConfig(rawConfig);
        
        console.log('[useRoleConfig] ✅ Loaded from DATABASE:', normalized.roleName, 'with', normalized.capabilities?.length || 0, 'capabilities');
        
        // Update caches
        configCache[effectiveRoleId] = { config: normalized, timestamp: Date.now() };
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(`roleConfig_${effectiveRoleId}`, JSON.stringify({
            config: normalized,
            timestamp: Date.now(),
          }));
        }
        
        setConfig(normalized);
        setError(null);
      } else if (response?.success && (response.config || response.data)) {
        // Wrapped response format
        const rawConfig = response.config || response.data;
        const normalized = normalizeRoleConfig(rawConfig);
        
        console.log('[useRoleConfig] ✅ Loaded from DATABASE (wrapped):', normalized.roleName);
        
        // Update caches
        configCache[effectiveRoleId] = { config: normalized, timestamp: Date.now() };
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(`roleConfig_${effectiveRoleId}`, JSON.stringify({
            config: normalized,
            timestamp: Date.now(),
          }));
        }
        
        setConfig(normalized);
        setError(null);
      } else {
        throw new Error('Invalid config response from database');
      }
    } catch (err: any) {
      console.warn('[useRoleConfig] ⚠️ Database fetch failed, using static fallback:', err.message);
      
      // Fall back to static config ONLY as a last resort
      // The static config is just for UI structure, not capabilities
      const staticConfig = getRoleConfig(effectiveRoleId);
      if (staticConfig) {
        console.log('[useRoleConfig] Using static fallback config for:', effectiveRoleId);
        setConfig({
          roleId: effectiveRoleId,
          roleName: staticConfig.roleName,
          displayName: staticConfig.displayName,
          icon: staticConfig.icon,
          category: staticConfig.category,
          serviceStyles: staticConfig.allowedServiceStyles.map(s => s.id),
          capabilities: [], // No capabilities from static - must come from DB
          pricingControl: { canControlPrice: true, canControlDuration: true },
        });
      }
      
      setError(`Database config not available: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveRoleId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Compute dashboard sections
  const dashboardSections = useMemo(() => {
    if (!config?.roleName) return [];
    return getDashboardSections(config.roleName, config.capabilities);
  }, [config?.roleName, config?.capabilities]);

  // Compute allowed styles
  const allowedStyles = useMemo(() => {
    if (!config?.serviceStyles?.length) {
      return Object.values(SERVICE_STYLES);
    }
    return getAllowedServiceStyles(config.serviceStyles);
  }, [config?.serviceStyles]);

  // Helper functions
  const hasCapability = useCallback((capability: string): boolean => {
    if (!config?.capabilities?.length) return true; // Default to allowed if no config
    return config.capabilities.includes(capability);
  }, [config?.capabilities]);

  const isStyleAllowed = useCallback((style: string): boolean => {
    if (!config?.serviceStyles?.length) return true; // Default to allowed if no config
    const normalizedStyle = style.toLowerCase().replace(/-/g, '_');
    return config.serviceStyles.some(s => 
      s.toLowerCase() === normalizedStyle ||
      s.toLowerCase().replace(/_/g, '') === normalizedStyle.replace(/_/g, '')
    );
  }, [config?.serviceStyles]);

  const getStyleConfig = useCallback((style: string): ServiceStyleConfig | null => {
    const normalizedStyle = style.toLowerCase().replace(/-/g, '_');
    return SERVICE_STYLES[normalizedStyle] || null;
  }, []);

  const refresh = useCallback(async () => {
    // Clear caches
    if (effectiveRoleId) {
      delete configCache[effectiveRoleId];
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`roleConfig_${effectiveRoleId}`);
      }
    }
    setIsLoading(true);
    await fetchConfig();
  }, [effectiveRoleId, fetchConfig]);

  return {
    config,
    dashboardSections,
    allowedStyles,
    capabilities: config?.capabilities || [],
    isLoading,
    error,
    hasCapability,
    isStyleAllowed,
    getStyleConfig,
    refresh,
  };
}

// ============================================================================
// ADDITIONAL UTILITY HOOKS
// ============================================================================

/**
 * Hook to check if current vendor has specific capabilities
 */
export function useVendorPermissions(requiredCapabilities: string[]) {
  const { hasCapability, isLoading } = useRoleConfig();
  
  const hasAllPermissions = useMemo(() => {
    if (isLoading) return false;
    return requiredCapabilities.every(hasCapability);
  }, [requiredCapabilities, hasCapability, isLoading]);

  const hasAnyPermission = useMemo(() => {
    if (isLoading) return false;
    return requiredCapabilities.some(hasCapability);
  }, [requiredCapabilities, hasCapability, isLoading]);

  return { hasAllPermissions, hasAnyPermission, isLoading };
}

/**
 * Hook to get filtered services based on role config
 */
export function useRoleFilteredServices<T extends { serviceStyle?: string }>(
  services: T[]
): T[] {
  const { isStyleAllowed, isLoading } = useRoleConfig();

  return useMemo(() => {
    if (isLoading || !services?.length) return services;
    return services.filter(s => isStyleAllowed(s.serviceStyle || 'at_center'));
  }, [services, isStyleAllowed, isLoading]);
}
