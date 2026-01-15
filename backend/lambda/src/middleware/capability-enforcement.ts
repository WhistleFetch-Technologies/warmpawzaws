/**
 * ============================================================================
 * CAPABILITY ENFORCEMENT MIDDLEWARE
 * ============================================================================
 * 
 * Enforces role-based capabilities for vendor endpoints
 * Checks if vendor has required capability before allowing action
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { HandlerContext } from '../handler/base-handler';
import { select } from '../database/rds-connection';

export interface CapabilityCheck {
  resource: string;
  action: string;
}

/**
 * Check if vendor has a required capability
 */
export async function checkVendorCapability(
  vendorId: string,
  capability: CapabilityCheck | string
): Promise<boolean> {
  try {
    // Get vendor from vendors table
    let vendor = null;
    let roleId = null;
    
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length > 0) {
      vendor = vendors[0];
      roleId = vendor.role_id;
    } else {
      // Vendor not in vendors table, check vendor_identity for approved vendors
      const identities = await select('vendor_identity', { id: vendorId });
      if (identities.length > 0) {
        const identity = identities[0];
        // For approved vendors, allow service-related capabilities
        if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
          roleId = identity.selected_role_id;
          console.log(`[Capability] Vendor ${vendorId} is ${identity.onboarding_status}, using roleId: ${roleId}`);
        }
      }
    }

    if (!roleId) {
      console.log(`[Capability] No roleId found for vendor ${vendorId}`);
      return false;
    }

    // If capability is a string, check permission_name
    if (typeof capability === 'string') {
      const permissions = await select('role_permissions', {
        role_id: roleId,
        permission_name: capability,
      });
      
      // If no specific permission found, check if role has the basic capability enabled
      if (permissions.length === 0) {
        // Allow basic service capabilities for approved vendors
        const basicCapabilities = [
          'services', 'custom_services', 'bookings', 'schedule', 
          'prescriptions', 'medical_records', 'staff', 'packages',
          'tele_consultation', 'home_services', 'at_center_services',
          'rx', 'monitor', 'patient_monitoring'
        ];
        if (basicCapabilities.includes(capability)) {
          console.log(`[Capability] Allowing basic capability '${capability}' for approved vendor ${vendorId}`);
          return true;
        }
      }
      
      return permissions.length > 0;
    }

    // If capability is an object, check resource/action
    const permissions = await select('role_permissions', {
      role_id: roleId,
      resource: capability.resource,
      action: capability.action,
    });

    return permissions.length > 0;
  } catch (error) {
    console.error('Error checking vendor capability:', error);
    return false;
  }
}

/**
 * Middleware to enforce capability check
 */
export function requireCapability(capability: CapabilityCheck | string) {
  return async (context: HandlerContext): Promise<boolean> => {
    const vendorId = context.userId || 
                     context.event.pathParameters?.vendorId ||
                     context.event.queryStringParameters?.vendorId;

    if (!vendorId) {
      return false;
    }

    return await checkVendorCapability(vendorId, capability);
  };
}

/**
 * Get all capabilities for a vendor
 */
export async function getVendorCapabilities(vendorId: string): Promise<string[]> {
  try {
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0 || !vendors[0].role_id) {
      return [];
    }

    const permissions = await select('role_permissions', {
      role_id: vendors[0].role_id,
    });

    return permissions.map(p => p.permission_name);
  } catch (error) {
    console.error('Error getting vendor capabilities:', error);
    return [];
  }
}

