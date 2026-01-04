/**
 * ============================================================================
 * CAPABILITY GUARD COMPONENT (for use in handlers)
 * ============================================================================
 * 
 * Utility functions to check capabilities before executing actions
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { checkVendorCapability, getVendorCapabilities } from '../middleware/capability-enforcement';

/**
 * Guard a handler function with capability check
 */
export async function withCapabilityGuard<T>(
  vendorId: string,
  capability: string | { resource: string; action: string },
  handler: () => Promise<T>
): Promise<T> {
  const hasCapability = await checkVendorCapability(vendorId, capability);
  
  if (!hasCapability) {
    throw new Error(`Vendor ${vendorId} does not have required capability: ${typeof capability === 'string' ? capability : `${capability.resource}:${capability.action}`}`);
  }

  return handler();
}

/**
 * Check multiple capabilities (AND logic)
 */
export async function requireAllCapabilities(
  vendorId: string,
  capabilities: (string | { resource: string; action: string })[]
): Promise<boolean> {
  for (const capability of capabilities) {
    const hasCapability = await checkVendorCapability(vendorId, capability);
    if (!hasCapability) {
      return false;
    }
  }
  return true;
}

/**
 * Check multiple capabilities (OR logic)
 */
export async function requireAnyCapability(
  vendorId: string,
  capabilities: (string | { resource: string; action: string })[]
): Promise<boolean> {
  for (const capability of capabilities) {
    const hasCapability = await checkVendorCapability(vendorId, capability);
    if (hasCapability) {
      return true;
    }
  }
  return false;
}

/**
 * Get capability status for UI rendering
 */
export async function getCapabilityStatus(
  vendorId: string
): Promise<Record<string, boolean>> {
  const capabilities = await getVendorCapabilities(vendorId);
  const status: Record<string, boolean> = {};

  // All possible capabilities
  const allCapabilities = [
    'booking', 'chat', 'tele',
    'prescription', 'medical_records', 'emergency', 'diagnostic_lab',
    'patient_monitoring', 'emergency_protocols', 'ambulance_services',
    'controlled_substances', 'prescription_verification', 'vet_summary',
    'catalog', 'orders', 'inventory', 'delivery', 'expiry_management',
    'photo_updates', 'gallery', 'portfolio', 'progress_tracking', 'cctv_access',
    'gps_tracking', 'distance_pricing',
    'staff_management', 'schedule_management', 'facility_management',
    'multi_doctor_management',
    'custom_services', 'package_management',
    'room_management', 'table_management', 'pax_management',
    'occupancy_tracking', 'nightly_pricing', 'menu',
    'meal_plans', 'diet_charts', 'counseling',
    'adoption', 'donation', 'events', 'memorial',
    'claims_management', 'policy_management',
  ];

  allCapabilities.forEach(cap => {
    status[cap] = capabilities.includes(cap);
  });

  return status;
}

