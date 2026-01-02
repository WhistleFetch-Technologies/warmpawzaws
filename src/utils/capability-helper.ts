/**
 * Capability Helper Functions
 * Centralized capability checking to eliminate duplication
 */

export interface VendorCapabilities {
  // Core
  booking?: boolean;
  chat?: boolean;
  tele?: boolean;
  
  // Medical/Clinical
  prescription?: boolean;
  medical_records?: boolean;
  emergency?: boolean;
  
  // Commerce
  catalog?: boolean;
  orders?: boolean;
  inventory?: boolean;
  delivery?: boolean;
  
  // Media/Content
  photo_updates?: boolean;
  gallery?: boolean;
  portfolio?: boolean;
  progress_tracking?: boolean;
  cctv_access?: boolean;
  
  // Location
  gps_tracking?: boolean;

  // Admin
  staff_management?: boolean;
}

export const CapabilityHelper = {
  // ============================================
  // CORE CAPABILITIES
  // ============================================

  hasBooking: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.booking === true;
  },

  hasChat: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.chat === true;
  },

  hasTele: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.tele === true;
  },

  // ============================================
  // MEDICAL/CLINICAL CAPABILITIES
  // ============================================

  hasPrescription: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.prescription === true;
  },

  hasMedicalRecords: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.medical_records === true;
  },

  hasEmergency: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.emergency === true;
  },

  canWritePrescription: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasPrescription(capabilities) && 
           CapabilityHelper.hasMedicalRecords(capabilities);
  },

  isHealthcareProvider: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasPrescription(capabilities) ||
           CapabilityHelper.hasMedicalRecords(capabilities);
  },

  // ============================================
  // COMMERCE CAPABILITIES
  // ============================================

  hasCatalog: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.catalog === true;
  },

  hasOrders: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.orders === true;
  },

  hasInventory: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.inventory === true;
  },

  hasDelivery: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.delivery === true;
  },

  canSellProducts: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasCatalog(capabilities) &&
           CapabilityHelper.hasOrders(capabilities);
  },

  needsInventoryManagement: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasInventory(capabilities);
  },

  needsDeliveryIntegration: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasDelivery(capabilities);
  },

  // ============================================
  // MEDIA/CONTENT CAPABILITIES
  // ============================================

  hasPhotoUpdates: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.photo_updates === true;
  },

  hasGallery: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.gallery === true;
  },

  hasPortfolio: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.portfolio === true;
  },

  hasProgressTracking: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.progress_tracking === true;
  },

  hasCCTVAccess: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.cctv_access === true;
  },

  canSharePhotos: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasPhotoUpdates(capabilities) ||
           CapabilityHelper.hasGallery(capabilities);
  },

  needsMediaStorage: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasPhotoUpdates(capabilities) ||
           CapabilityHelper.hasGallery(capabilities) ||
           CapabilityHelper.hasPortfolio(capabilities) ||
           CapabilityHelper.hasCCTVAccess(capabilities);
  },

  // ============================================
  // LOCATION CAPABILITIES
  // ============================================

  hasGPSTracking: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.gps_tracking === true;
  },

  needsLocationPermission: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasGPSTracking(capabilities);
  },

  // ============================================
  // ADMIN CAPABILITIES
  // ============================================

  hasStaffManagement: (capabilities?: VendorCapabilities | null): boolean => {
    return capabilities?.staff_management === true;
  },

  canManageStaff: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasStaffManagement(capabilities);
  },

  canManageCentres: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasStaffManagement(capabilities);
  },

  // ============================================
  // FEATURE GATES
  // ============================================

  shouldShowBookingSection: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasBooking(capabilities);
  },

  shouldShowSchedule: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasBooking(capabilities);
  },

  shouldShowChatSection: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasChat(capabilities);
  },

  shouldShowVideoSection: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasTele(capabilities);
  },

  shouldShowMedicalRecords: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasMedicalRecords(capabilities);
  },

  shouldShowPrescriptionPad: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.canWritePrescription(capabilities);
  },

  shouldShowProductCatalog: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasCatalog(capabilities);
  },

  shouldShowOrderManagement: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasOrders(capabilities);
  },

  shouldShowInventory: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasInventory(capabilities);
  },

  shouldShowDeliveryPanel: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasDelivery(capabilities);
  },

  shouldShowPhotoUpload: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasPhotoUpdates(capabilities);
  },

  shouldShowGallery: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasGallery(capabilities);
  },

  shouldShowPortfolio: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasPortfolio(capabilities);
  },

  shouldShowProgressTracker: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasProgressTracking(capabilities);
  },

  shouldShowCCTVPanel: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasCCTVAccess(capabilities);
  },

  shouldShowGPSTracker: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasGPSTracking(capabilities);
  },

  shouldShowStaffManagement: (capabilities?: VendorCapabilities | null): boolean => {
    return CapabilityHelper.hasStaffManagement(capabilities);
  },

  // ============================================
  // DASHBOARD SECTIONS
  // ============================================

  getDashboardSections: (capabilities?: VendorCapabilities | null): string[] => {
    const sections: string[] = ['overview']; // Always show overview

    if (CapabilityHelper.hasBooking(capabilities)) {
      sections.push('schedule', 'bookings');
    }

    if (CapabilityHelper.hasMedicalRecords(capabilities)) {
      sections.push('medical_records', 'watchlist');
    }

    if (CapabilityHelper.hasCatalog(capabilities)) {
      sections.push('catalog');
    }

    if (CapabilityHelper.hasOrders(capabilities)) {
      sections.push('orders');
    }

    if (CapabilityHelper.hasInventory(capabilities)) {
      sections.push('inventory');
    }

    if (CapabilityHelper.hasPhotoUpdates(capabilities) || CapabilityHelper.hasGallery(capabilities)) {
      sections.push('gallery');
    }

    if (CapabilityHelper.hasProgressTracking(capabilities)) {
      sections.push('progress');
    }

    if (CapabilityHelper.hasCCTVAccess(capabilities)) {
      sections.push('cctv');
    }

    if (CapabilityHelper.hasGPSTracking(capabilities)) {
      sections.push('tracking');
    }

    if (CapabilityHelper.hasStaffManagement(capabilities)) {
      sections.push('staff', 'centres');
    }

    sections.push('settings'); // Always show settings

    return sections;
  },

  getQuickActions: (capabilities?: VendorCapabilities | null): Array<{id: string, label: string, icon: string}> => {
    const actions: Array<{id: string, label: string, icon: string}> = [];

    if (CapabilityHelper.hasBooking(capabilities)) {
      actions.push({ id: 'view_bookings', label: 'View Bookings', icon: '📅' });
    }

    if (CapabilityHelper.hasPrescription(capabilities)) {
      actions.push({ id: 'write_prescription', label: 'Write Prescription', icon: '💊' });
    }

    if (CapabilityHelper.hasCatalog(capabilities)) {
      actions.push({ id: 'manage_catalog', label: 'Manage Catalog', icon: '🛒' });
    }

    if (CapabilityHelper.hasStaffManagement(capabilities)) {
      actions.push({ id: 'manage_staff', label: 'Manage Staff', icon: '👥' });
    }

    if (CapabilityHelper.hasPhotoUpdates(capabilities)) {
      actions.push({ id: 'upload_photos', label: 'Upload Photos', icon: '📸' });
    }

    if (CapabilityHelper.hasGPSTracking(capabilities)) {
      actions.push({ id: 'start_tracking', label: 'Start Tracking', icon: '📍' });
    }

    if (CapabilityHelper.hasProgressTracking(capabilities)) {
      actions.push({ id: 'update_progress', label: 'Update Progress', icon: '📊' });
    }

    return actions;
  },

  // ============================================
  // VALIDATION
  // ============================================

  validateCapabilities: (capabilities?: VendorCapabilities | null): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!capabilities) {
      errors.push('No capabilities defined');
      return { valid: false, errors };
    }

    // At least one core capability should be enabled
    const hasCoreCapability = 
      capabilities.booking ||
      capabilities.chat ||
      capabilities.catalog ||
      capabilities.medical_records;

    if (!hasCoreCapability) {
      errors.push('At least one core capability (booking, chat, catalog, or medical_records) must be enabled');
    }

    // Medical records requires prescription to be useful
    if (capabilities.prescription && !capabilities.medical_records) {
      errors.push('Prescription capability requires medical_records to be enabled');
    }

    // Orders requires catalog
    if (capabilities.orders && !capabilities.catalog) {
      errors.push('Orders capability requires catalog to be enabled');
    }

    // Delivery requires orders
    if (capabilities.delivery && !capabilities.orders) {
      errors.push('Delivery capability requires orders to be enabled');
    }

    // Inventory should go with catalog/orders
    if (capabilities.inventory && !capabilities.catalog && !capabilities.orders) {
      errors.push('Inventory capability should be used with catalog or orders');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  countEnabledCapabilities: (capabilities?: VendorCapabilities | null): number => {
    if (!capabilities) return 0;
    
    return Object.values(capabilities).filter(v => v === true).length;
  },

  getEnabledCapabilities: (capabilities?: VendorCapabilities | null): string[] => {
    if (!capabilities) return [];
    
    return Object.entries(capabilities)
      .filter(([_, enabled]) => enabled === true)
      .map(([capability, _]) => capability);
  },

  getDisabledCapabilities: (capabilities?: VendorCapabilities | null): string[] => {
    if (!capabilities) return [];
    
    return Object.entries(capabilities)
      .filter(([_, enabled]) => enabled === false)
      .map(([capability, _]) => capability);
  },

  hasAnyCapability: (capabilityList: string[], capabilities?: VendorCapabilities | null): boolean => {
    if (!capabilities) return false;
    
    return capabilityList.some(cap => (capabilities as any)[cap] === true);
  },

  hasAllCapabilities: (capabilityList: string[], capabilities?: VendorCapabilities | null): boolean => {
    if (!capabilities) return false;
    
    return capabilityList.every(cap => (capabilities as any)[cap] === true);
  },

  // ============================================
  // DESCRIPTION HELPERS
  // ============================================

  getCapabilityDescription: (capability: string): string => {
    const descriptions: Record<string, string> = {
      'booking': 'Accept and manage customer bookings',
      'chat': 'Chat with customers in real-time',
      'tele': 'Conduct video consultations',
      'prescription': 'Write and manage prescriptions',
      'medical_records': 'Maintain patient medical records',
      'emergency': 'Provide emergency services',
      'catalog': 'Manage product/service catalog',
      'orders': 'Process customer orders',
      'inventory': 'Track inventory levels',
      'delivery': 'Integrate with delivery services',
      'photo_updates': 'Send photo updates to customers',
      'gallery': 'Maintain photo gallery',
      'portfolio': 'Showcase portfolio of work',
      'progress_tracking': 'Track and report progress',
      'cctv_access': 'Share CCTV access with customers',
      'gps_tracking': 'Share live GPS location',
      'staff_management': 'Manage staff and centres'
    };

    return descriptions[capability] || capability;
  }
};

// Export for convenience
export default CapabilityHelper;
