'use client';

/**
 * CapabilityGate Component
 * Conditionally renders children based on vendor capabilities
 * Ensures consistent capability checking across the app
 */

import { useVendorCapabilities } from './hooks/useVendorCapabilities';
import { ModuleDisabledMessage } from './ModuleDisabledMessage';
import { getVendorAllowedServiceStyles } from '@/lib/vendor-utils';

interface CapabilityGateProps {
  /**
   * Single capability to check
   */
  capability?: string;
  
  /**
   * Require ALL of these capabilities
   */
  requireAll?: string[];
  
  /**
   * Require ANY of these capabilities
   */
  requireAny?: string[];
  
  /**
   * ✅ NEW: Require specific service styles
   */
  allowedServiceStyles?: ('at_center' | 'at_home' | 'tele')[];
  
  /**
   * ✅ NEW: Require specific vendor type
   */
  vendorType?: 'solo' | 'business' | 'any';
  
  /**
   * ✅ NEW: Vendor data for type/style checks
   */
  vendorData?: any;
  
  /**
   * Children to render if capability check passes
   */
  children: React.ReactNode;
  
  /**
   * Fallback content if capability check fails
   */
  fallback?: React.ReactNode;
  
  /**
   * Show disabled message instead of hiding
   */
  showDisabledMessage?: boolean;
  
  /**
   * Custom message for disabled state
   */
  disabledMessage?: string;
  
  /**
   * Optional roleId to use for capability checking
   * If not provided, uses localStorage fallback
   */
  roleId?: string;

  /**
   * ✅ Allow access if role name contains this string (case-insensitive)
   * Bypasses capability check for role-based features (e.g. diagnostics_center)
   */
  allowIfRoleContains?: string;
}

/**
 * CapabilityGate - Conditionally render based on vendor capabilities
 * 
 * @example
 * // Single capability
 * <CapabilityGate capability="prescriptions">
 *   <PrescriptionButton />
 * </CapabilityGate>
 * 
 * @example
 * // Require all capabilities
 * <CapabilityGate requireAll={['prescriptions', 'medical_records']}>
 *   <AdvancedFeatures />
 * </CapabilityGate>
 * 
 * @example
 * // Require any capability
 * <CapabilityGate requireAny={['gps_tracking', 'live_tracking']}>
 *   <TrackingFeature />
 * </CapabilityGate>
 * 
 * @example
 * // With disabled message
 * <CapabilityGate 
 *   capability="prescriptions" 
 *   showDisabledMessage
 *   disabledMessage="Prescription feature is not available for your account"
 * >
 *   <PrescriptionButton />
 * </CapabilityGate>
 */
// ✅ NEW: Helper to check if vendor is solo provider
function checkIsSoloProvider(vendorData: any): boolean {
  if (!vendorData) return false;
  return (
    vendorData.vendorConfiguration === 'solo' ||
    vendorData.isSoloProvider === true ||
    vendorData.is_solo_provider === true ||
    vendorData.vendor_type === 'solo' ||
    vendorData.vendorType === 'solo'
  );
}

// ✅ Admin role / profile — same canonical list as getVendorAllowedServiceStyles (no invented tele/at_home)
function getVendorServiceStyles(vendorData: any): string[] {
  if (!vendorData) return [];
  return getVendorAllowedServiceStyles(vendorData);
}

export function CapabilityGate({
  capability,
  requireAll,
  requireAny,
  allowedServiceStyles,
  vendorType,
  vendorData,
  children,
  fallback = null,
  showDisabledMessage = false,
  disabledMessage,
  roleId,
  allowIfRoleContains,
}: CapabilityGateProps) {
  // Use provided roleId or fall back to localStorage lookup in the hook
  const { capabilities, loading, roleName } = useVendorCapabilities(roleId || undefined);
  
  // Show nothing while loading (prevents flickering)
  if (loading) {
    return null;
  }

  // ✅ Role-name bypass: if allowIfRoleContains and role matches, show children (e.g. diagnostics_center)
  if (allowIfRoleContains && roleName) {
    const r = (roleName || '').toLowerCase().replace(/\s+/g, '_');
    const patterns = (allowIfRoleContains || '').split(',').map((p: string) => p.trim().toLowerCase().replace(/\s+/g, '_'));
    if (patterns.some((p: string) => p && r.includes(p))) {
      return <>{children}</>;
    }
  }
  
  // ✅ NEW: Check vendor type
  if (vendorType && vendorType !== 'any' && vendorData) {
    const isSolo = checkIsSoloProvider(vendorData);
    const typeMatch = vendorType === 'solo' ? isSolo : !isSolo;
    
    if (!typeMatch) {
      if (showDisabledMessage) {
        return (
          <ModuleDisabledMessage
            moduleName="Vendor Type"
            reason={disabledMessage || `This feature is only available for ${vendorType} vendors`}
          />
        );
      }
      return <>{fallback}</>;
    }
  }
  
  // ✅ NEW: Check service styles
  if (allowedServiceStyles && allowedServiceStyles.length > 0 && vendorData) {
    const vendorStyles = getVendorServiceStyles(vendorData);
    const hasMatchingStyle = allowedServiceStyles.some(style => vendorStyles.includes(style));
    
    if (!hasMatchingStyle) {
      if (showDisabledMessage) {
        return (
          <ModuleDisabledMessage
            moduleName="Service Style"
            reason={disabledMessage || `This feature requires one of: ${allowedServiceStyles.join(', ')}`}
          />
        );
      }
      return <>{fallback}</>;
    }
  }
  
  // Check single capability
  if (capability) {
    const hasCapability = capabilities[capability] === true;
    
    if (!hasCapability) {
      if (showDisabledMessage) {
        return (
          <ModuleDisabledMessage
            moduleName={capability}
            reason={disabledMessage || `The ${capability} feature is not available for your account`}
          />
        );
      }
      return <>{fallback}</>;
    }
  }
  
  // Check require all
  if (requireAll && requireAll.length > 0) {
    const hasAll = requireAll.every(cap => capabilities[cap] === true);
    
    if (!hasAll) {
      if (showDisabledMessage) {
        const missingCaps = requireAll.filter(cap => !capabilities[cap]);
        return (
          <ModuleDisabledMessage
            moduleName={missingCaps.join(', ')}
            reason={disabledMessage || `This feature requires: ${missingCaps.join(', ')}`}
          />
        );
      }
      return <>{fallback}</>;
    }
  }
  
  // Check require any
  if (requireAny && requireAny.length > 0) {
    const hasAny = requireAny.some(cap => capabilities[cap] === true);
    
    if (!hasAny) {
      if (showDisabledMessage) {
        return (
          <ModuleDisabledMessage
            moduleName={requireAny.join(' or ')}
            reason={disabledMessage || `This feature requires one of: ${requireAny.join(', ')}`}
          />
        );
      }
      return <>{fallback}</>;
    }
  }
  
  // If no capability checks specified, show children (backward compatibility)
  if (!capability && !requireAll && !requireAny) {
    return <>{children}</>;
  }
  
  // All checks passed, show children
  return <>{children}</>;
}

/**
 * Hook to check if vendor has specific capabilities
 * Useful for conditional logic outside of JSX
 * @param capability - The capability to check
 * @param roleId - Optional roleId (uses localStorage fallback if not provided)
 */
export function useHasCapability(capability: string, roleId?: string): boolean {
  const { capabilities, loading } = useVendorCapabilities(roleId || undefined);
  
  if (loading) return false;
  
  return capabilities[capability] === true;
}

/**
 * Hook to check if vendor has all specified capabilities
 * @param requiredCapabilities - Array of capabilities to check
 * @param roleId - Optional roleId (uses localStorage fallback if not provided)
 */
export function useHasAllCapabilities(requiredCapabilities: string[], roleId?: string): boolean {
  const { capabilities, loading } = useVendorCapabilities(roleId || undefined);
  
  if (loading || !requiredCapabilities.length) return false;
  
  return requiredCapabilities.every(cap => capabilities[cap] === true);
}

/**
 * Hook to check if vendor has any of the specified capabilities
 * @param requiredCapabilities - Array of capabilities to check
 * @param roleId - Optional roleId (uses localStorage fallback if not provided)
 */
export function useHasAnyCapability(requiredCapabilities: string[], roleId?: string): boolean {
  const { capabilities, loading } = useVendorCapabilities(roleId || undefined);
  
  if (loading || !requiredCapabilities.length) return false;
  
  return requiredCapabilities.some(cap => capabilities[cap] === true);
}

/**
 * ✅ NEW: Hook to check if vendor is a solo provider
 * Provides a single source of truth for solo detection
 * @param vendorData - Vendor data object
 */
export function useIsSoloProvider(vendorData: any): boolean {
  return checkIsSoloProvider(vendorData);
}

/**
 * ✅ NEW: Hook to get vendor's allowed service styles
 * @param vendorData - Vendor data object
 */
export function useVendorServiceStyles(vendorData: any): string[] {
  return getVendorServiceStyles(vendorData);
}

// Export helpers for use outside of hooks
export { checkIsSoloProvider, getVendorServiceStyles };
