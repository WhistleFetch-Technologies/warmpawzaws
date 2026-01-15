'use client';

/**
 * CapabilityGate Component
 * Conditionally renders children based on vendor capabilities
 * Ensures consistent capability checking across the app
 */

import { useVendorCapabilities } from './hooks/useVendorCapabilities';
import { ModuleDisabledMessage } from './ModuleDisabledMessage';

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
export function CapabilityGate({
  capability,
  requireAll,
  requireAny,
  children,
  fallback = null,
  showDisabledMessage = false,
  disabledMessage,
}: CapabilityGateProps) {
  const { capabilities, loading, roleName } = useVendorCapabilities();
  
  // Show nothing while loading (prevents flickering)
  if (loading) {
    return null;
  }
  
  // Check single capability
  if (capability) {
    const hasCapability = capabilities[capability] === true;
    
    if (!hasCapability) {
      if (showDisabledMessage) {
        return (
          <ModuleDisabledMessage
            moduleName={capability}
            customMessage={disabledMessage}
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
            customMessage={disabledMessage || `This feature requires: ${missingCaps.join(', ')}`}
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
            customMessage={disabledMessage || `This feature requires one of: ${requireAny.join(', ')}`}
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
 */
export function useHasCapability(capability: string): boolean {
  const { capabilities, loading } = useVendorCapabilities();
  
  if (loading) return false;
  
  return capabilities[capability] === true;
}

/**
 * Hook to check if vendor has all specified capabilities
 */
export function useHasAllCapabilities(requiredCapabilities: string[]): boolean {
  const { capabilities, loading } = useVendorCapabilities();
  
  if (loading || !requiredCapabilities.length) return false;
  
  return requiredCapabilities.every(cap => capabilities[cap] === true);
}

/**
 * Hook to check if vendor has any of the specified capabilities
 */
export function useHasAnyCapability(requiredCapabilities: string[]): boolean {
  const { capabilities, loading } = useVendorCapabilities();
  
  if (loading || !requiredCapabilities.length) return false;
  
  return requiredCapabilities.some(cap => capabilities[cap] === true);
}
