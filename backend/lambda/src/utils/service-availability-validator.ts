/**
 * ============================================================================
 * SERVICE AVAILABILITY VALIDATOR
 * ============================================================================
 * 
 * Validates if a service is available for booking based on:
 * 1. Dashboard UI config (button enabled/disabled, launch phase)
 * 2. Role config (service types/styles allowed)
 * 3. Service enabled status
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { select, query } from '../database/rds-connection';

export interface ServiceAvailabilityResult {
  available: boolean;
  reason?: string;
  code?: 'UI_DISABLED' | 'PHASE_RESTRICTED' | 'ROLE_RESTRICTED' | 'SERVICE_DISABLED' | 'NOT_FOUND';
}

export interface DashboardButton {
  id: string;
  label?: string;
  icon?: string;
  enabled: boolean;
  serviceId?: string;
  serviceType?: string;
  launchPhase?: 'coming_soon' | 'beta' | 'full';
  requiredRoleTypes?: string[];
  allowedServiceStyles?: string[];
  rolloutPercentage?: number;
}

export interface DashboardConfig {
  buttons?: DashboardButton[];
  widgets?: DashboardButton[];
  layout?: string;
  theme?: string;
}

/**
 * Get Dashboard UI config for a role
 */
async function getDashboardConfig(roleId: string): Promise<DashboardConfig | null> {
  try {
    const settings = await select('platform_settings', {
      setting_key: `platform:ui:dashboard:${roleId}`
    });

    if (settings.length === 0) {
      return null;
    }

    const config = settings[0].setting_value as any;
    
    // Handle both array and object responses
    if (Array.isArray(config)) {
      return { buttons: config };
    }
    
    if (config && typeof config === 'object') {
      // If config has buttons, use it
      if (Array.isArray(config.buttons)) {
        return config;
      }
      // If config has widgets, convert to buttons
      if (Array.isArray(config.widgets)) {
        return { buttons: config.widgets, ...config };
      }
      // Otherwise return as-is
      return config;
    }

    return null;
  } catch (error) {
    console.error('[ServiceAvailability] Error fetching dashboard config:', error);
    return null;
  }
}

/**
 * Get role config to check service type/style restrictions
 */
async function getRoleConfig(roleId: string): Promise<any | null> {
  try {
    const roles = await select('roles', { id: roleId });
    
    if (roles.length === 0) {
      // Try to find by role code/name
      const allRoles = await select('roles', {});
      const normalizedRoleId = roleId.toLowerCase().replace(/\s+/g, '_');
      const matchedRole = allRoles.find((r: any) => 
        r.name?.toLowerCase() === normalizedRoleId ||
        r.roleCode?.toLowerCase() === normalizedRoleId ||
        r.display_name?.toLowerCase() === normalizedRoleId.replace(/_/g, ' ') ||
        r.id === roleId
      );
      
      if (matchedRole) {
        return matchedRole;
      }
      
      return null;
    }

    return roles[0];
  } catch (error) {
    console.error('[ServiceAvailability] Error fetching role config:', error);
    return null;
  }
}

/**
 * Get service details
 */
async function getService(serviceId: string): Promise<any | null> {
  try {
    // Try services table first
    const services = await select('services', { id: serviceId });
    if (services.length > 0) {
      return services[0];
    }

    // Try vendor_services table
    const vendorServices = await select('vendor_services', { id: serviceId });
    if (vendorServices.length > 0) {
      return vendorServices[0];
    }

    return null;
  } catch (error) {
    console.error('[ServiceAvailability] Error fetching service:', error);
    return null;
  }
}

/**
 * Check if service is available for booking
 * 
 * @param serviceId - The service ID to check
 * @param roleId - The role ID (veterinarian, groomer, etc.)
 * @param customerId - Optional customer ID for beta/rollout checks
 * @returns ServiceAvailabilityResult
 */
export async function validateServiceAvailability(
  serviceId: string,
  roleId: string,
  customerId?: string
): Promise<ServiceAvailabilityResult> {
  try {
    // 1. Check if service exists
    const service = await getService(serviceId);
    if (!service) {
      return {
        available: false,
        reason: 'Service not found',
        code: 'NOT_FOUND'
      };
    }

    // 2. Check service enabled status
    if (service.is_enabled === false) {
      return {
        available: false,
        reason: 'Service is currently disabled',
        code: 'SERVICE_DISABLED'
      };
    }

    // 3. Get Dashboard UI config
    const dashboardConfig = await getDashboardConfig(roleId);
    
    if (dashboardConfig) {
      // Find button/service config for this service
      const buttons = dashboardConfig.buttons || dashboardConfig.widgets || [];
      const serviceButton = buttons.find((btn: DashboardButton) => 
        btn.serviceId === serviceId || 
        btn.id === serviceId ||
        btn.serviceType === service.service_type ||
        btn.serviceType === service.category
      );

      if (serviceButton) {
        // Check if button is enabled
        if (!serviceButton.enabled) {
          return {
            available: false,
            reason: 'Service is not available for this role',
            code: 'UI_DISABLED'
          };
        }

        // Check launch phase
        const launchPhase = serviceButton.launchPhase || 'full';
        
        if (launchPhase === 'coming_soon') {
          return {
            available: false,
            reason: 'Service is coming soon',
            code: 'PHASE_RESTRICTED'
          };
        }

        if (launchPhase === 'beta') {
          // For beta, you could add customer whitelist check here
          // For now, we allow beta services
          // TODO: Add beta user whitelist check if needed
        }

        // Check rollout percentage (for gradual rollout)
        if (serviceButton.rolloutPercentage !== undefined && serviceButton.rolloutPercentage < 100) {
          // Simple hash-based rollout (deterministic per customer)
          if (customerId) {
            const hash = customerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const customerRollout = (hash % 100) + 1;
            
            if (customerRollout > serviceButton.rolloutPercentage) {
              return {
                available: false,
                reason: 'Service is in gradual rollout phase',
                code: 'PHASE_RESTRICTED'
              };
            }
          }
        }

        // Check required role types
        if (serviceButton.requiredRoleTypes && serviceButton.requiredRoleTypes.length > 0) {
          const roleConfig = await getRoleConfig(roleId);
          if (roleConfig) {
            const roleVendorTypes = roleConfig.config?.vendorTypes || roleConfig.config?.vendor_types || [];
            const normalizedRoleTypes = roleVendorTypes.map((vt: string) => 
              vt.toLowerCase().replace(/_/g, '_')
            );
            
            const hasRequiredType = serviceButton.requiredRoleTypes.some((requiredType: string) => {
              const normalized = requiredType.toLowerCase().replace(/_/g, '_');
              return normalizedRoleTypes.includes(normalized);
            });

            if (!hasRequiredType) {
              return {
                available: false,
                reason: 'Service is not available for this role type',
                code: 'ROLE_RESTRICTED'
              };
            }
          }
        }

        // Check allowed service styles
        if (serviceButton.allowedServiceStyles && serviceButton.allowedServiceStyles.length > 0) {
          const serviceStyle = service.service_style || service.serviceStyle || 'at_clinic';
          const normalizedServiceStyle = serviceStyle.toLowerCase().replace(/_/g, '_');
          
          const isStyleAllowed = serviceButton.allowedServiceStyles.some((allowedStyle: string) => {
            const normalized = allowedStyle.toLowerCase().replace(/_/g, '_');
            return normalizedServiceStyle === normalized;
          });

          if (!isStyleAllowed) {
            return {
              available: false,
              reason: 'Service style not allowed for this role',
              code: 'ROLE_RESTRICTED'
            };
          }
        }
      } else {
        // No button config found - check if we should allow by default
        // For now, we allow if no config exists (backward compatibility)
        // You can change this to return false if you want strict enforcement
      }
    }

    // 4. Check role config for service type/style restrictions
    const roleConfig = await getRoleConfig(roleId);
    if (roleConfig) {
      const config = roleConfig.config || {};
      const allowedServiceTypes = config.serviceTypes || config.service_types || [];
      const allowedServiceStyles = config.serviceStyles || config.service_styles || [];

      // Check service type
      if (allowedServiceTypes.length > 0) {
        const serviceType = service.service_type || service.category || service.type;
        const normalizedServiceType = serviceType?.toLowerCase().replace(/_/g, '_');
        
        const isTypeAllowed = allowedServiceTypes.some((allowedType: string) => {
          const normalized = allowedType.toLowerCase().replace(/_/g, '_');
          return normalizedServiceType === normalized;
        });

        if (!isTypeAllowed) {
          return {
            available: false,
            reason: 'Service type not allowed for this role',
            code: 'ROLE_RESTRICTED'
          };
        }
      }

      // Check service style
      if (allowedServiceStyles.length > 0) {
        const serviceStyle = service.service_style || service.serviceStyle || 'at_clinic';
        const normalizedServiceStyle = serviceStyle.toLowerCase().replace(/_/g, '_');
        
        const isStyleAllowed = allowedServiceStyles.some((allowedStyle: string) => {
          const normalized = allowedStyle.toLowerCase().replace(/_/g, '_');
          return normalizedServiceStyle === normalized;
        });

        if (!isStyleAllowed) {
          return {
            available: false,
            reason: 'Service style not allowed for this role',
            code: 'ROLE_RESTRICTED'
          };
        }
      }
    }

    // All checks passed
    return {
      available: true
    };

  } catch (error: any) {
    console.error('[ServiceAvailability] Error validating service availability:', error);
    // On error, allow booking (fail open for backward compatibility)
    // Change to fail closed if you want strict enforcement
    return {
      available: true,
      reason: 'Validation error, allowing booking for backward compatibility'
    };
  }
}
