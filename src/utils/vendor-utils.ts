/**
 * Vendor Utility Functions
 * Centralized vendor-related helper functions to eliminate code duplication
 */

export interface Vendor {
  id?: string;
  phone?: string;
  roleId?: string;
  status?: string;
  fullName?: string;
  email?: string;
  businessName?: string;
  isSoloProvider?: boolean;
  centres?: any[];
  [key: string]: any;
}

export const VendorUtils = {
  // ============================================
  // ROLE CHECKING
  // ============================================
  
  isVet: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_clinic' || roleId === 'veterinarian' || roleId === 'veterinary_clinic';
  },

  isGroomer: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_groomer' || roleId === 'groomer' || roleId === 'grooming_salon';
  },

  isTrainer: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_trainer' || roleId === 'trainer' || roleId === 'training_center';
  },

  isWalker: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'dog_walker' || roleId === 'walker' || roleId === 'pet_walker';
  },

  isBoarding: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_boarding' || roleId === 'boarding' || roleId === 'pet_daycare';
  },

  isStore: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_store' || roleId === 'pet_shop';
  },

  isTransport: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_transport' || roleId === 'transport';
  },

  isPhotographer: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_photographer' || roleId === 'photographer';
  },

  isNutritionist: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_nutritionist' || roleId === 'nutritionist';
  },

  isBehaviorist: (roleId?: string): boolean => {
    if (!roleId) return false;
    return roleId === 'pet_behaviorist' || roleId === 'behaviorist';
  },

  // ============================================
  // SERVICE STYLE VALIDATION
  // ============================================

  canOfferHome: (roleId?: string): boolean => {
    if (!roleId) return false;
    const homeRoles = [
      'pet_groomer', 'groomer',
      'pet_trainer', 'trainer',
      'dog_walker', 'walker',
      'pet_clinic', 'veterinarian',
      'pet_nutritionist', 'nutritionist',
      'pet_behaviorist', 'behaviorist',
      'pet_photographer', 'photographer'
    ];
    return homeRoles.includes(roleId);
  },

  canOfferCenter: (roleId?: string): boolean => {
    if (!roleId) return false;
    const centerRoles = [
      'pet_clinic', 'veterinarian',
      'pet_groomer', 'groomer',
      'pet_trainer', 'trainer',
      'pet_boarding', 'boarding',
      'pet_store', 'pet_shop',
      'pet_nutritionist', 'nutritionist',
      'pet_behaviorist', 'behaviorist'
    ];
    return centerRoles.includes(roleId);
  },

  canOfferTele: (roleId?: string): boolean => {
    if (!roleId) return false;
    const teleRoles = [
      'pet_clinic', 'veterinarian',
      'pet_trainer', 'trainer',
      'pet_nutritionist', 'nutritionist',
      'pet_behaviorist', 'behaviorist'
    ];
    return teleRoles.includes(roleId);
  },

  // Get allowed service styles for a role
  getAllowedServiceStyles: (roleId?: string): string[] => {
    const styles: string[] = [];
    if (VendorUtils.canOfferHome(roleId)) styles.push('at_home');
    if (VendorUtils.canOfferCenter(roleId)) styles.push('at_center');
    if (VendorUtils.canOfferTele(roleId)) styles.push('tele');
    return styles;
  },

  // Validate if a service style is allowed for a role
  isServiceStyleAllowed: (roleId?: string, serviceStyle?: string): boolean => {
    if (!roleId || !serviceStyle) return false;
    const allowed = VendorUtils.getAllowedServiceStyles(roleId);
    return allowed.includes(serviceStyle);
  },

  // ============================================
  // STATUS HELPERS
  // ============================================

  isApproved: (vendor?: Vendor | null): boolean => {
    return vendor?.status === 'approved';
  },

  isPending: (vendor?: Vendor | null): boolean => {
    return vendor?.status === 'pending_approval';
  },

  isRejected: (vendor?: Vendor | null): boolean => {
    return vendor?.status === 'rejected';
  },

  needsInfo: (vendor?: Vendor | null): boolean => {
    return vendor?.status === 'info_requested';
  },

  canAccessDashboard: (vendor?: Vendor | null): boolean => {
    return VendorUtils.isApproved(vendor);
  },

  canEditApplication: (vendor?: Vendor | null): boolean => {
    return VendorUtils.isPending(vendor) || VendorUtils.needsInfo(vendor);
  },

  // ============================================
  // DISPLAY HELPERS
  // ============================================

  getStatusColor: (status?: string): string => {
    const colors: Record<string, string> = {
      'approved': 'text-green-600 bg-green-50 border-green-200',
      'pending_approval': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'rejected': 'text-red-600 bg-red-50 border-red-200',
      'info_requested': 'text-blue-600 bg-blue-50 border-blue-200'
    };
    return colors[status || ''] || 'text-gray-600 bg-gray-50 border-gray-200';
  },

  getStatusLabel: (status?: string): string => {
    const labels: Record<string, string> = {
      'approved': 'Approved',
      'pending_approval': 'Under Review',
      'rejected': 'Rejected',
      'info_requested': 'Info Required'
    };
    return labels[status || ''] || status || 'Unknown';
  },

  getStatusIcon: (status?: string): string => {
    const icons: Record<string, string> = {
      'approved': '✅',
      'pending_approval': '⏳',
      'rejected': '❌',
      'info_requested': 'ℹ️'
    };
    return icons[status || ''] || '•';
  },

  getRoleName: (roleId?: string): string => {
    const roleNames: Record<string, string> = {
      'pet_clinic': 'Pet Clinic',
      'veterinarian': 'Veterinarian',
      'pet_groomer': 'Pet Groomer',
      'groomer': 'Pet Groomer',
      'pet_trainer': 'Pet Trainer',
      'trainer': 'Pet Trainer',
      'dog_walker': 'Dog Walker',
      'walker': 'Dog Walker',
      'pet_boarding': 'Pet Boarding',
      'boarding': 'Pet Boarding',
      'pet_store': 'Pet Store',
      'pet_shop': 'Pet Store',
      'pet_transport': 'Pet Transport',
      'pet_photographer': 'Pet Photographer',
      'pet_nutritionist': 'Pet Nutritionist',
      'pet_behaviorist': 'Pet Behaviorist'
    };
    return roleNames[roleId || ''] || roleId || 'Unknown';
  },

  getRoleIcon: (roleId?: string): string => {
    const icons: Record<string, string> = {
      'pet_clinic': '🏥',
      'veterinarian': '🏥',
      'pet_groomer': '✂️',
      'groomer': '✂️',
      'pet_trainer': '🎓',
      'trainer': '🎓',
      'dog_walker': '🐕',
      'walker': '🐕',
      'pet_boarding': '🏠',
      'boarding': '🏠',
      'pet_store': '🛒',
      'pet_shop': '🛒',
      'pet_transport': '🚗',
      'pet_photographer': '📸',
      'pet_nutritionist': '🥗',
      'pet_behaviorist': '🧠'
    };
    return icons[roleId || ''] || '🐾';
  },

  // ============================================
  // PHONE NUMBER HELPERS
  // ============================================

  normalizePhone: (phone?: string): string => {
    if (!phone) return '';
    
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with country code (91), ensure it has +
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    
    // If 10 digits, add +91
    if (cleaned.length === 10) {
      return '+91' + cleaned;
    }
    
    // If already has +, return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    return phone;
  },

  formatPhoneDisplay: (phone?: string): string => {
    if (!phone) return '';
    
    const normalized = VendorUtils.normalizePhone(phone);
    
    // Format: +91 98765 43210
    if (normalized.startsWith('+91') && normalized.length === 13) {
      return `${normalized.slice(0, 3)} ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
    }
    
    return normalized;
  },

  // Generate vendor lookup keys
  getVendorLookupKeys: (phone?: string): string[] => {
    if (!phone) return [];
    
    const normalized = VendorUtils.normalizePhone(phone);
    const keys: string[] = [];
    
    // Add normalized format
    keys.push(`vendor_${normalized.replace(/\+/g, '')}`);
    
    // Add with + prefix
    if (normalized.startsWith('+')) {
      keys.push(`vendor_${normalized}`);
    }
    
    // Add without country code
    if (normalized.startsWith('+91')) {
      keys.push(`vendor_${normalized.slice(3)}`);
    }
    
    return keys;
  },

  // ============================================
  // VENDOR TYPE HELPERS
  // ============================================

  isSoloProvider: (vendor?: Vendor | null): boolean => {
    return vendor?.isSoloProvider === true;
  },

  hasCentres: (vendor?: Vendor | null): boolean => {
    return Array.isArray(vendor?.centres) && vendor.centres.length > 0;
  },

  isServiceProvider: (roleId?: string): boolean => {
    return VendorUtils.isGroomer(roleId) || 
           VendorUtils.isTrainer(roleId) || 
           VendorUtils.isWalker(roleId) ||
           VendorUtils.isPhotographer(roleId);
  },

  isHealthcareProvider: (roleId?: string): boolean => {
    return VendorUtils.isVet(roleId) ||
           VendorUtils.isNutritionist(roleId) ||
           VendorUtils.isBehaviorist(roleId);
  },

  isFacilityBased: (roleId?: string): boolean => {
    return VendorUtils.isBoarding(roleId) ||
           VendorUtils.isStore(roleId);
  },

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  validateVendorData: (vendor: Partial<Vendor>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!vendor.fullName || vendor.fullName.trim().length < 2) {
      errors.push('Full name is required (min 2 characters)');
    }

    if (!vendor.phone || !VendorUtils.normalizePhone(vendor.phone)) {
      errors.push('Valid phone number is required');
    }

    if (!vendor.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.email)) {
      errors.push('Valid email is required');
    }

    if (!vendor.roleId) {
      errors.push('Role selection is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // ============================================
  // SEARCH & FILTER HELPERS
  // ============================================

  matchesSearch: (vendor: Vendor, searchTerm: string): boolean => {
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    const searchableFields = [
      vendor.fullName,
      vendor.email,
      vendor.phone,
      vendor.businessName,
      VendorUtils.getRoleName(vendor.roleId),
      vendor.id
    ];

    return searchableFields.some(field => 
      field && field.toLowerCase().includes(term)
    );
  },

  filterByStatus: (vendors: Vendor[], status: string): Vendor[] => {
    if (!status) return vendors;
    return vendors.filter(v => v.status === status);
  },

  filterByRole: (vendors: Vendor[], roleId: string): Vendor[] => {
    if (!roleId) return vendors;
    return vendors.filter(v => v.roleId === roleId);
  },

  // ============================================
  // SORTING HELPERS
  // ============================================

  sortByName: (vendors: Vendor[], ascending = true): Vendor[] => {
    return [...vendors].sort((a, b) => {
      const nameA = (a.fullName || '').toLowerCase();
      const nameB = (b.fullName || '').toLowerCase();
      return ascending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  },

  sortByDate: (vendors: Vendor[], ascending = false): Vendor[] => {
    return [...vendors].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  },

  sortByStatus: (vendors: Vendor[]): Vendor[] => {
    const statusOrder: Record<string, number> = {
      'info_requested': 1,
      'pending_approval': 2,
      'approved': 3,
      'rejected': 4
    };

    return [...vendors].sort((a, b) => {
      const orderA = statusOrder[a.status || ''] || 999;
      const orderB = statusOrder[b.status || ''] || 999;
      return orderA - orderB;
    });
  }
};

// Export for convenience
export default VendorUtils;
