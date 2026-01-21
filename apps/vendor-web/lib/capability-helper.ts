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

/**
 * Check if vendor has gallery capability
 */
function hasGallery(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'gallery');
}

/**
 * Check if vendor has portfolio capability
 */
function hasPortfolio(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'portfolio');
}

/**
 * Check if vendor has CCTV access capability
 */
function hasCctvAccess(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'cctv_access') || 
         hasCapability(capabilities, 'cctvAccess');
}

/**
 * Check if vendor has controlled substances capability
 */
function hasControlledSubstances(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'controlled_substances') || 
         hasCapability(capabilities, 'controlledSubstances');
}

/**
 * Check if vendor has progress tracking capability
 */
function hasProgressTracking(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'progress_tracking') || 
         hasCapability(capabilities, 'progressTracking');
}

/**
 * Check if vendor has package management capability
 */
function hasPackageManagement(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'package_management') || 
         hasCapability(capabilities, 'packageManagement') ||
         hasCapability(capabilities, 'packages');
}

/**
 * Check if vendor has custom services capability
 */
function hasCustomServices(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'custom_services') || 
         hasCapability(capabilities, 'customServices');
}

/**
 * Check if vendor has adoption capability
 */
function hasAdoption(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'adoption');
}

/**
 * Check if vendor has memorial services capability
 */
function hasMemorial(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'memorial') || 
         hasCapability(capabilities, 'memorial_services');
}

/**
 * Check if vendor has expiry management capability
 */
function hasExpiryManagement(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'expiry_management') || 
         hasCapability(capabilities, 'expiryManagement');
}

/**
 * Check if vendor has donation capability
 */
function hasDonation(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'donation');
}

/**
 * Check if vendor has events capability
 */
function hasEvents(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'events') || 
         hasCapability(capabilities, 'event_management');
}

/**
 * Check if vendor has patient monitoring capability
 */
function hasPatientMonitoring(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'patient_monitoring') || 
         hasCapability(capabilities, 'patientMonitoring');
}

/**
 * Check if vendor has prescription verification capability
 */
function hasPrescriptionVerification(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'prescription_verification') || 
         hasCapability(capabilities, 'prescriptionVerification') ||
         hasCapability(capabilities, 'rx_verification');
}

/**
 * Check if vendor has delivery capability
 */
function hasDelivery(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'delivery') || 
         hasCapability(capabilities, 'delivery_management') ||
         hasCapability(capabilities, 'order_dispatch');
}

/**
 * Check if vendor has diet charts capability
 */
function hasDietCharts(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'diet_charts') || 
         hasCapability(capabilities, 'dietCharts');
}

/**
 * Check if vendor has counseling capability
 */
function hasCounseling(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'counseling');
}

/**
 * Check if vendor has policy management capability
 */
function hasPolicyManagement(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'policy_management') || 
         hasCapability(capabilities, 'policyManagement');
}

/**
 * Check if vendor has distance pricing capability
 */
function hasDistancePricing(capabilities: Record<string, boolean> | undefined | null): boolean {
  return hasCapability(capabilities, 'distance_pricing') || 
         hasCapability(capabilities, 'distancePricing');
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
  // Additional capability helpers
  hasGallery,
  hasPortfolio,
  hasCctvAccess,
  hasControlledSubstances,
  hasProgressTracking,
  hasPackageManagement,
  hasCustomServices,
  hasAdoption,
  hasMemorial,
  hasExpiryManagement,
  hasDonation,
  hasEvents,
  hasPatientMonitoring,
  hasPrescriptionVerification,
  hasDelivery,
  hasDietCharts,
  hasCounseling,
  hasPolicyManagement,
  hasDistancePricing,
};

export default CapabilityHelper;
