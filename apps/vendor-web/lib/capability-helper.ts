/**
 * Capability Helper
 * Utility functions for checking vendor capabilities
 * Updated: 2026-01-13
 */

/**
 * Check if vendor has a specific capability
 */
function hasCapability(capabilities: Record<string, boolean> | undefined | null, capability: string): boolean {
  if (!capabilities) return false;
  
  // Normalize capability name (handle both snake_case and camelCase)
  const normalized = capability.toLowerCase().replace(/-/g, '_');
  const camelCase = normalized.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  
  return capabilities[capability] === true || 
         capabilities[normalized] === true || 
         capabilities[camelCase] === true;
}

/**
 * Get capabilities from vendor object
 */
function getCapabilities(vendor: any): Record<string, boolean> {
  if (!vendor) return {};
  
  // If vendor has capabilities as an array, convert to map
  if (Array.isArray(vendor.capabilities)) {
    const map: Record<string, boolean> = {};
    vendor.capabilities.forEach((cap: string) => {
      map[cap] = true;
    });
    return map;
  }
  
  // If vendor has capabilities as an object
  if (typeof vendor.capabilities === 'object') {
    return vendor.capabilities;
  }
  
  return {};
}

/**
 * Check if vendor has booking capability
 */
function hasBooking(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'booking') || 
         hasCapability(capabilities, 'bookings') ||
         hasCapability(capabilities, 'canBook');
}

/**
 * Check if vendor has medical records capability
 */
function hasMedicalRecords(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'medical_records') || 
         hasCapability(capabilities, 'medicalRecords') ||
         hasCapability(capabilities, 'canViewMedicalRecords');
}

/**
 * Check if vendor has catalog capability
 */
function hasCatalog(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'catalog') || 
         hasCapability(capabilities, 'canManageCatalog') ||
         hasCapability(capabilities, 'products');
}

/**
 * Check if vendor has chat capability
 */
function hasChat(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'chat') || 
         hasCapability(capabilities, 'messaging');
}

/**
 * Check if vendor has tele/video consultation capability
 */
function hasTeleConsultation(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'tele') || 
         hasCapability(capabilities, 'tele_consultation') ||
         hasCapability(capabilities, 'video_calling') ||
         hasCapability(capabilities, 'teleConsultation');
}

/**
 * Check if vendor has prescription capability
 */
function hasPrescription(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'prescriptions') || 
         hasCapability(capabilities, 'prescription');
}

/**
 * Check if vendor has staff management capability
 */
function hasStaffManagement(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'staff') || 
         hasCapability(capabilities, 'staff_management') ||
         hasCapability(capabilities, 'staffManagement');
}

/**
 * Check if vendor has facility management capability
 */
function hasFacilityManagement(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'facility_management') || 
         hasCapability(capabilities, 'facilityManagement');
}

/**
 * Check if vendor has inventory capability
 */
function hasInventory(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'inventory') || 
         hasCapability(capabilities, 'stock_management');
}

/**
 * Check if vendor has GPS tracking capability
 */
function hasGpsTracking(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'gps_tracking') || 
         hasCapability(capabilities, 'gpsTracking') ||
         hasCapability(capabilities, 'live_tracking');
}

/**
 * Check if vendor has table management capability (cafes, restaurants)
 */
function hasTableManagement(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'table_management') || 
         hasCapability(capabilities, 'tableManagement') ||
         hasCapability(capabilities, 'cafe_tables');
}

/**
 * Check if vendor has room management capability (hotels, boarding)
 */
function hasRoomManagement(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'room_management') || 
         hasCapability(capabilities, 'roomManagement') ||
         hasCapability(capabilities, 'rooms');
}

const CapabilityHelper = {
  hasCapability,
  getCapabilities,
  hasBooking,
  hasMedicalRecords,
  hasCatalog,
  hasChat,
  hasTeleConsultation,
  hasPrescription,
  hasStaffManagement,
  hasFacilityManagement,
  hasInventory,
  hasGpsTracking,
  hasTableManagement,
  hasRoomManagement,
};

export default CapabilityHelper;
