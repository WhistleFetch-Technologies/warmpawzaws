/**
 * useVendorCapabilities Hook
 * Loads vendor capabilities from the API based on their assigned role.
 * This ensures vendors only see features configured for their role.
 * 
 * Updated: 2026-01-13
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// Default capabilities for fallback (only used when API fails)
// ⚠️ Keep this minimal - actual capabilities MUST come from database
const DEFAULT_CAPABILITIES: Record<string, boolean> = {
  dashboard: true,
  profile: true,
};

// Full default capabilities - only used as absolute last resort after API failure
const FULL_DEFAULT_CAPABILITIES: Record<string, boolean> = {
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
  initialLoadComplete: boolean; // ✅ NEW: Indicates first DB load completed (prevents flickering)
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
  
  // ✅ FIX: Map common plural/singular capability aliases
  const aliases: Record<string, string[]> = {
    'bookings': ['booking', 'bookings'],
    'services': ['service', 'services', 'catalog'], // Also treat services as catalog capability
    'prescriptions': ['prescription', 'prescriptions', 'rx', 'prescription_create'],
    'notifications': ['notification', 'notifications'],
    'medical_records': ['medical_record', 'medical_records', 'medicalRecords', 'medicalRecord'],
    'custom_services': ['custom_service', 'custom_services', 'customServices', 'customService'],
    'staff_management': ['staff', 'staff_management', 'staffManagement', 'manage_staff', 'staff_create'],
    'package_management': ['packages', 'package_management', 'packageManagement'],
    'schedule_management': ['schedule', 'schedule_management', 'scheduleManagement'],
    'facility_management': ['facility', 'facility_management', 'facilityManagement'],
    'inventory': ['inventory', 'inventory_manage', 'inventoryManagement', 'stock_management'],
    'orders': ['orders', 'order_management', 'order_dispatch', 'order_broadcast'],
    'delivery': ['delivery', 'delivery_management', 'order_dispatch'],
    'prescription_verification': ['prescription_verification', 'rx_verification', 'verify_prescription'],
    'expiry_management': ['expiry_management', 'expiry_tracking', 'expiry_monitoring'],
    'product_catalog': ['product_catalog', 'catalog', 'products', 'product_management'],
  };
  
  // ✅ FIX: Filter out null/undefined capabilities before processing
  capabilities.filter(Boolean).forEach(cap => {
    if (!cap) return; // Extra safety check
    // Normalize capability names (handle both snake_case and camelCase)
    const normalized = (cap || '').toLowerCase().replace(/-/g, '_');
    map[normalized] = true;
    
    // Also add camelCase version
    const camelCase = normalized.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    map[camelCase] = true;
    
    // ✅ FIX: Add all aliases for this capability
    if (aliases[normalized]) {
      aliases[normalized].forEach(alias => {
        map[alias] = true;
      });
    }
    
    // ✅ PHARMACY FIX: Map backend capability names to frontend capability names
    // e.g., inventory_manage -> inventory, product_catalog -> catalog
    if (normalized === 'inventory_manage') {
      map['inventory'] = true;
      map['catalog'] = true; // Inventory implies catalog management
    }
    if (normalized === 'product_catalog') {
      map['catalog'] = true;
      map['products'] = true;
    }
    if (normalized === 'prescription_create') {
      map['prescriptions'] = true;
      map['prescription'] = true;
    }
    if (normalized === 'order_dispatch' || normalized === 'order_broadcast') {
      map['orders'] = true;
      map['delivery'] = true;
    }
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
  // ✅ FIX: Start with empty capabilities - wait for DB response
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [resolvedRoleId, setResolvedRoleId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

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
      setInitialLoadComplete(true);
      console.log('[useVendorCapabilities] Using pre-loaded capabilities:', preloadedCapabilities.length);
      return;
    }
    
    // ✅ FIX: Try to get roleId from localStorage as last resort if not provided
    let effectiveRoleId: string | null = roleId || null;
    if (!effectiveRoleId && typeof window !== 'undefined') {
      effectiveRoleId = localStorage.getItem('vendorRole') || null;
      if (!effectiveRoleId) {
        try {
          const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
          effectiveRoleId = vendorData.roleId || vendorData.role_id || null;
        } catch { 
          effectiveRoleId = null;
        }
      }
      if (effectiveRoleId) {
        console.log('[useVendorCapabilities] No roleId in props, using localStorage:', effectiveRoleId);
      }
    }
    
    if (!effectiveRoleId) {
      console.warn('[useVendorCapabilities] No roleId provided and none in localStorage, using minimal fallback');
      // ✅ FIX: Only use minimal defaults, actual capabilities MUST come from DB
      setCapabilities(DEFAULT_CAPABILITIES);
      setLoading(false);
      setInitialLoadComplete(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('[useVendorCapabilities] Loading capabilities for role:', effectiveRoleId);

      // Try to get role details from the API
      // First try as a UUID (role ID), then as a role code (e.g., 'veterinarian')
      let response: RoleResponse | null = null;
      
      // Check if effectiveRoleId looks like a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveRoleId);
      
      if (isUuid) {
        // Load by role UUID
        response = await apiClient.get<RoleResponse>(`/config/roles/${effectiveRoleId}`);
      } else {
        // Try to find role by code/name - load all roles and filter
        const rolesResponse = await apiClient.get<{ success: boolean; roles: any[] }>('/config/roles');
        if (rolesResponse.success && rolesResponse.roles) {
          const normalizedRoleId = effectiveRoleId.toLowerCase().replace(/\s+/g, '_');
          const matchedRole = rolesResponse.roles.find((r: any) => 
            r.name?.toLowerCase() === normalizedRoleId ||
            r.roleCode?.toLowerCase() === normalizedRoleId ||
            r.display_name?.toLowerCase() === normalizedRoleId.replace(/_/g, ' ') ||
            r.id === effectiveRoleId
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
        
        // ✅ FIX: Merge with minimal defaults, DB is source of truth
        const mergedCapabilities = {
          ...DEFAULT_CAPABILITIES,
          ...capsMap,
        };
        
        setCapabilities(mergedCapabilities);
        setRoleName(response.roleName || null);
        setResolvedRoleId(response.roleId || effectiveRoleId);
        
        console.log('[useVendorCapabilities] ✅ Loaded capabilities from DATABASE:', {
          roleId: response.roleId,
          roleName: response.roleName,
          capabilitiesCount: response.capabilities.length,
          capabilities: response.capabilities,
        });
      } else {
        // Fallback to full default capabilities only after API failure
        console.warn('[useVendorCapabilities] ⚠️ Could not load role from DB, using full defaults for:', effectiveRoleId);
        setCapabilities(FULL_DEFAULT_CAPABILITIES);
      }
    } catch (err: any) {
      console.error('[useVendorCapabilities] ❌ Error loading capabilities from DB:', err);
      setError(err.message || 'Failed to load capabilities');
      // Use full default capabilities on API error
      setCapabilities(FULL_DEFAULT_CAPABILITIES);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [roleId, preloadedCapabilities]);

  // Load capabilities on mount and when roleId changes
  useEffect(() => {
    loadCapabilities();
  }, [loadCapabilities]);

  // ✅ REMOVED: Secondary cache loading was causing flickering
  // The API call is the single source of truth now

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
    initialLoadComplete, // ✅ NEW: Indicates first DB load completed
  };
}
