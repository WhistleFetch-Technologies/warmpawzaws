/**
 * ============================================================================
 * CAPABILITY ENFORCEMENT MIDDLEWARE
 * ============================================================================
 * 
 * Middleware to enforce vendor capabilities for API endpoints
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Context, Next } from "npm:hono";
import { getDbClient } from "../db.ts";
import { getVendorsRepository } from "../repositories/vendors.ts";

export interface CapabilityCheck {
  resource: string;
  action: string;
}

/**
 * Check if vendor has required capability
 */
export async function checkVendorCapability(
  vendorId: string,
  capability: CapabilityCheck
): Promise<boolean> {
  const vendorsRepo = getVendorsRepository();
  const client = getDbClient();

  const vendor = await vendorsRepo.findById(vendorId);
  if (!vendor || !vendor.role_id) {
    return false;
  }

  // Check role permissions - try both permission_name and resource/action
  let { data: permission, error } = await client
    .from('role_permissions')
    .select('*')
    .eq('role_id', vendor.role_id)
    .eq('resource', capability.resource)
    .eq('action', capability.action)
    .maybeSingle();

  // If not found, try permission_name
  if (error || !permission) {
    const { data: permByName, error: nameError } = await client
      .from('role_permissions')
      .select('*')
      .eq('role_id', vendor.role_id)
      .eq('permission_name', capability.resource)
      .maybeSingle();
    
    if (nameError || !permByName) {
      return false;
    }
    permission = permByName;
  }

  return true;
}

/**
 * Middleware to enforce capability
 */
export function requireCapability(capability: CapabilityCheck) {
  return async (c: Context, next: Next) => {
    try {
      // Try to get vendorId from multiple sources
      const vendorId = c.req.param('vendorId') || 
                       c.req.header('x-vendor-id') || 
                       c.req.query('vendorId') ||
                       (await c.req.json().catch(() => ({}))).vendorId;
      
      if (!vendorId) {
        return c.json({ error: 'Vendor ID required' }, 401);
      }

      const hasCapability = await checkVendorCapability(vendorId, capability);
      
      if (!hasCapability) {
        // Log violation
        const client = getDbClient();
        await client.from('audit_logs').insert({
          action: 'capability_violation',
          entity_type: 'vendor',
          entity_id: vendorId,
          actor_id: vendorId,
          actor_role: 'vendor',
          details: { 
            capability: `${capability.resource}:${capability.action}`,
            endpoint: c.req.path 
          }
        }).catch(() => {}); // Don't fail if audit log fails
        
        return c.json({ 
          error: `Vendor does not have required capability: ${capability.resource}:${capability.action}` 
        }, 403);
      }

      // Add vendor to context for downstream handlers
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (vendor) {
        c.set('vendor', vendor);
      }

      await next();
    } catch (error) {
      console.error('❌ [CAPABILITY] Error checking capability:', error);
      return c.json({ error: 'Failed to verify capability' }, 500);
    }
  };
}

/**
 * Require capability by simple name (backward compatibility)
 */
export function requireCapabilityByName(capabilityName: string) {
  return requireCapability({
    resource: capabilityName,
    action: 'access'
  });
}
