/**
 * ============================================================================
 * ROLE UI CONFIGURATION (STATIC FALLBACK ONLY)
 * ============================================================================
 * 
 * ⚠️ IMPORTANT: This file is for UI FALLBACK ONLY!
 * 
 * The ACTUAL role configuration (capabilities, permissions, service styles)
 * is stored in the DATABASE in the `roles` and `role_permissions` tables.
 * 
 * This static config provides:
 * - UI structure (dashboard sections, layouts)
 * - Default styling (icons, colors)
 * - Fallback when database is unavailable
 * 
 * All authoritative role data comes from:
 * - API: GET /config/roles/:roleId
 * - Database: `roles` table + `role_permissions` table
 * 
 * To modify role capabilities, use the Admin Dashboard:
 * - Admin → Roles & Capabilities
 * - All changes are persisted to the database
 * 
 * This is NOT the source of truth for capabilities or permissions!
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardSection {
  id: string;
  label: string;
  icon: string;
  description?: string;
  priority: number;
  requiresCapability?: string;
  comingSoon?: boolean;
  beta?: boolean;
}

export interface ServiceStyleConfig {
  id: 'at_center' | 'at_home' | 'tele';
  label: string;
  icon: string;
  color: string;
  description: string;
}

export interface RoleConfig {
  roleId: string;
  roleName: string;
  displayName: string;
  icon: string;
  color: string;
  category: string;
  dashboardSections: DashboardSection[];
  allowedServiceStyles: ServiceStyleConfig[];
  primaryActions: string[];
  quickStats: string[];
}

// ============================================================================
// SERVICE STYLE CONFIGURATIONS
// ============================================================================

export const SERVICE_STYLES: Record<string, ServiceStyleConfig> = {
  at_center: {
    id: 'at_center',
    label: 'At Clinic',
    icon: 'building2', // lucide icon name
    color: 'blue',
    description: 'Services provided at your facility',
  },
  at_home: {
    id: 'at_home',
    label: 'Home Visit',
    icon: 'home', // lucide icon name
    color: 'green',
    description: 'Services provided at customer location',
  },
  tele: {
    id: 'tele',
    label: 'Video Consultation',
    icon: 'video', // lucide icon name
    color: 'purple',
    description: 'Online video consultations',
  },
};

// Map various style names to standard format
export const STYLE_ALIASES: Record<string, string> = {
  'at_clinic': 'at_center',
  'at_vendor': 'at_center',
  'clinic': 'at_center',
  'center': 'at_center',
  'in_clinic': 'at_center',
  'video_consultation': 'tele',
  'online': 'tele',
  'video': 'tele',
  'teleconsultation': 'tele',
  'home_visit': 'at_home',
  'home': 'at_home',
  'doorstep': 'at_home',
};

export function normalizeServiceStyle(style: string): 'at_center' | 'at_home' | 'tele' {
  const normalized = style?.toLowerCase()?.replace(/[-\s]/g, '_') || 'at_center';
  return (STYLE_ALIASES[normalized] || normalized) as 'at_center' | 'at_home' | 'tele';
}

// ============================================================================
// DASHBOARD SECTIONS
// ============================================================================

const COMMON_SECTIONS: DashboardSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', priority: 0 },
  { id: 'bookings', label: 'Bookings', icon: 'calendar', priority: 1 },
  { id: 'services', label: 'Services', icon: 'briefcase', priority: 2 },
  { id: 'schedule', label: 'Schedule', icon: 'calendar-clock', priority: 3 },
  { id: 'earnings', label: 'Earnings', icon: 'trending-up', priority: 10 },
  { id: 'settings', label: 'Settings', icon: 'settings', priority: 20 },
];

const HEALTHCARE_SECTIONS: DashboardSection[] = [
  { id: 'prescriptions', label: 'Prescriptions', icon: 'pill', priority: 4, requiresCapability: 'prescriptions' },
  { id: 'medical_records', label: 'Medical Records', icon: 'file-text', priority: 5, requiresCapability: 'medical_records' },
  { id: 'patient_monitoring', label: 'Patient Monitoring', icon: 'heart', priority: 6, requiresCapability: 'patient_monitoring' },
];

const STAFF_SECTIONS: DashboardSection[] = [
  { id: 'staff', label: 'Staff Management', icon: 'users', priority: 7, requiresCapability: 'staff_management' },
];

const FACILITY_SECTIONS: DashboardSection[] = [
  { id: 'facility', label: 'Facility', icon: 'building', priority: 8, requiresCapability: 'facility_management' },
];

// ============================================================================
// ROLE NAME MAPPING (Database to UI)
// ============================================================================
// Maps database role names (pet_*) to UI role names and vice versa

export const ROLE_NAME_MAPPING: Record<string, string> = {
  // UI name -> DB name
  'groomer': 'pet_groomer',
  'trainer': 'pet_trainer',
  'nutritionist': 'pet_nutritionist',
  'walker': 'pet_walker',
  'shelter': 'pet_adoption_center',
  'seller': 'pet_seller', // Check if exists in DB
  // DB name -> UI name (reverse mapping)
  'pet_groomer': 'groomer',
  'pet_trainer': 'trainer',
  'pet_nutritionist': 'nutritionist',
  'pet_walker': 'walker',
  'pet_adoption_center': 'shelter',
  'pet_seller': 'seller',
};

/**
 * Normalize role name (DB -> UI or UI -> DB)
 */
export function normalizeRoleName(roleName: string, toDb: boolean = false): string {
  if (!roleName) return roleName;
  
  const normalized = roleName.toLowerCase().trim();
  
  if (toDb) {
    // Convert UI name to DB name
    return ROLE_NAME_MAPPING[normalized] || normalized;
  } else {
    // Convert DB name to UI name (or keep as is)
    return ROLE_NAME_MAPPING[normalized] || normalized;
  }
}

// ============================================================================
// ROLE-SPECIFIC CONFIGURATIONS
// ============================================================================

export const ROLE_CONFIGS: Record<string, Partial<RoleConfig>> = {
  veterinarian: {
    displayName: 'Veterinarian',
    icon: '🩺',
    color: 'emerald',
    category: 'healthcare',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ ...s, requiresCapability: s.id === 'bookings' ? 'booking_view' : undefined })),
      ...HEALTHCARE_SECTIONS.map(s => ({ ...s })),
      ...STAFF_SECTIONS.map(s => ({ ...s, requiresCapability: 'staff_create' })),
      { id: 'specialized', label: 'Specialized Services', icon: '🔬', priority: 4.5, requiresCapability: 'diagnostic_results' },
    ],
    primaryActions: ['view_appointments', 'create_prescription', 'start_consultation'],
    quickStats: ['today_appointments', 'pending_consultations', 'monthly_revenue', 'patient_count'],
  },
  
  groomer: {
    displayName: 'Pet Groomer',
    icon: '✂️',
    color: 'pink',
    category: 'grooming',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_view' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'gallery', label: 'Portfolio', icon: '📸', priority: 4 },
      { id: 'packages', label: 'Packages', icon: '📦', priority: 5 },
      { id: 'schedule', label: 'Schedule', icon: '🗓️', priority: 3, requiresCapability: 'staff_schedule' },
    ],
    primaryActions: ['view_appointments', 'upload_gallery', 'create_package'],
    quickStats: ['today_appointments', 'monthly_revenue', 'completed_grooms', 'rating'],
  },
  // Alias for database role name
  pet_groomer: {
    displayName: 'Pet Groomer',
    icon: '✂️',
    color: 'pink',
    category: 'grooming',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_view' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'gallery', label: 'Portfolio', icon: '📸', priority: 4 },
      { id: 'packages', label: 'Packages', icon: '📦', priority: 5 },
      { id: 'schedule', label: 'Schedule', icon: '🗓️', priority: 3, requiresCapability: 'staff_schedule' },
    ],
    primaryActions: ['view_appointments', 'upload_gallery', 'create_package'],
    quickStats: ['today_appointments', 'monthly_revenue', 'completed_grooms', 'rating'],
  },
  
  pet_boarder: {
    displayName: 'Pet Boarding',
    icon: '🏠',
    color: 'amber',
    category: 'boarding',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      ...FACILITY_SECTIONS.map(s => ({ ...s, requiresCapability: 'facility_management' })),
      { id: 'cctv', label: 'CCTV Access', icon: '📹', priority: 4 },
      { id: 'daily_updates', label: 'Daily Updates', icon: '📝', priority: 5 },
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 7, requiresCapability: 'staff_create' },
      { id: 'inventory', label: 'Inventory', icon: '📦', priority: 8, requiresCapability: 'inventory_manage' },
    ],
    primaryActions: ['view_bookings', 'send_update', 'check_occupancy'],
    quickStats: ['current_occupancy', 'check_ins_today', 'check_outs_today', 'monthly_revenue'],
  },
  
  trainer: {
    displayName: 'Pet Trainer',
    icon: '🎯',
    color: 'orange',
    category: 'training',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'training_programs', label: 'Programs', icon: '📚', priority: 4 },
      { id: 'progress_tracking', label: 'Progress', icon: '📈', priority: 5 },
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 7, requiresCapability: 'staff_create' },
    ],
    primaryActions: ['view_sessions', 'log_progress', 'create_program'],
    quickStats: ['active_programs', 'sessions_today', 'graduation_rate', 'monthly_revenue'],
  },
  // Alias for database role name
  pet_trainer: {
    displayName: 'Pet Trainer',
    icon: '🎯',
    color: 'orange',
    category: 'training',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'training_programs', label: 'Programs', icon: '📚', priority: 4 },
      { id: 'progress_tracking', label: 'Progress', icon: '📈', priority: 5 },
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 7, requiresCapability: 'staff_create' },
    ],
    primaryActions: ['view_sessions', 'log_progress', 'create_program'],
    quickStats: ['active_programs', 'sessions_today', 'graduation_rate', 'monthly_revenue'],
  },
  
  nutritionist: {
    displayName: 'Pet Nutritionist',
    icon: '🥗',
    color: 'lime',
    category: 'nutrition',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'diet_plans', label: 'Diet Plans', icon: '📋', priority: 4 },
      { id: 'meal_management', label: 'Meal Plans', icon: '🍽️', priority: 5 },
      { id: 'medical_records', label: 'Medical Records', icon: '📋', priority: 5, requiresCapability: 'medical_records' },
    ],
    primaryActions: ['create_diet_plan', 'view_consultations', 'track_progress'],
    quickStats: ['active_plans', 'consultations_today', 'monthly_revenue', 'rating'],
  },
  // Alias for database role name
  pet_nutritionist: {
    displayName: 'Pet Nutritionist',
    icon: '🥗',
    color: 'lime',
    category: 'nutrition',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'diet_plans', label: 'Diet Plans', icon: '📋', priority: 4 },
      { id: 'meal_management', label: 'Meal Plans', icon: '🍽️', priority: 5 },
      { id: 'medical_records', label: 'Medical Records', icon: '📋', priority: 5, requiresCapability: 'medical_records' },
    ],
    primaryActions: ['create_diet_plan', 'view_consultations', 'track_progress'],
    quickStats: ['active_plans', 'consultations_today', 'monthly_revenue', 'rating'],
  },
  
  pet_cafe: {
    displayName: 'Pet Café',
    icon: '☕',
    color: 'rose',
    category: 'hospitality',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? undefined : undefined 
      })),
      { id: 'table_management', label: 'Tables', icon: '🪑', priority: 4, requiresCapability: 'cafe_tables' },
      { id: 'events', label: 'Events', icon: '🎉', priority: 5 },
      { id: 'inventory', label: 'Inventory', icon: '📦', priority: 6, requiresCapability: 'inventory_manage' },
      { id: 'menu', label: 'Menu', icon: '🍽️', priority: 7, requiresCapability: 'product_catalog' },
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 8, requiresCapability: 'staff_create' },
    ],
    primaryActions: ['view_reservations', 'manage_tables', 'create_event'],
    quickStats: ['reservations_today', 'table_occupancy', 'monthly_revenue', 'rating'],
  },
  
  shelter: {
    displayName: 'Pet Shelter',
    icon: '🏡',
    color: 'cyan',
    category: 'shelter',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : undefined 
      })),
      { id: 'adoptions', label: 'Adoptions', icon: '❤️', priority: 4 },
      { id: 'donations', label: 'Donations', icon: '💝', priority: 5 },
      { id: 'memorial', label: 'Memorial', icon: '🕯️', priority: 6 },
      { id: 'medical_records', label: 'Medical Records', icon: '📋', priority: 7, requiresCapability: 'medical_records' },
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 8, requiresCapability: 'staff_create' },
    ],
    primaryActions: ['view_applications', 'add_pet', 'manage_donations'],
    quickStats: ['pets_available', 'adoptions_this_month', 'donations_received', 'pending_applications'],
  },
  // Alias for database role name
  pet_adoption_center: {
    displayName: 'Pet Shelter',
    icon: '🏡',
    color: 'cyan',
    category: 'shelter',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : undefined 
      })),
      { id: 'adoptions', label: 'Adoptions', icon: '❤️', priority: 4 },
      { id: 'donations', label: 'Donations', icon: '💝', priority: 5 },
      { id: 'memorial', label: 'Memorial', icon: '🕯️', priority: 6 },
      { id: 'medical_records', label: 'Medical Records', icon: '📋', priority: 7, requiresCapability: 'medical_records' },
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 8, requiresCapability: 'staff_create' },
    ],
    primaryActions: ['view_applications', 'add_pet', 'manage_donations'],
    quickStats: ['pets_available', 'adoptions_this_month', 'donations_received', 'pending_applications'],
  },
  
  pharmacy: {
    displayName: 'Pet Pharmacy',
    icon: '💊',
    color: 'red',
    category: 'pharmacy',
    dashboardSections: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', priority: 0 },
      { id: 'profile', label: 'Profile', icon: '👤', priority: 1 },
      { id: 'inventory', label: 'Inventory & Catalog', icon: '📦', priority: 2, requiresCapability: 'inventory_manage' },
      { id: 'orders', label: 'Orders', icon: '🛍️', priority: 3, requiresCapability: 'orders' },
      { id: 'prescriptions', label: 'Prescription Verification', icon: '✅', priority: 4, requiresCapability: 'prescription_verification' },
      { id: 'delivery', label: 'Delivery Management', icon: '🚚', priority: 5, requiresCapability: 'delivery' },
      { id: 'expiry_management', label: 'Expiry Tracking', icon: '📆', priority: 6, requiresCapability: 'expiry_management' },
      { id: 'controlled_substances', label: 'Controlled Drugs', icon: '🔒', priority: 7, requiresCapability: 'controlled_substances' },
      { id: 'catalog', label: 'Product Catalog', icon: '📚', priority: 8, requiresCapability: 'product_catalog' },
      { id: 'earnings', label: 'Earnings', icon: '💰', priority: 10 },
      { id: 'settings', label: 'Settings', icon: '⚙️', priority: 20 },
    ],
    allowedServiceStyles: [SERVICE_STYLES.at_center], // Pharmacy only operates at center
    primaryActions: ['verify_prescription', 'check_inventory', 'process_order', 'manage_catalog'],
    quickStats: ['pending_orders', 'prescriptions_verified', 'low_stock_items', 'monthly_revenue'],
  },
  // Additional healthcare roles from database
  vet_clinic: {
    displayName: 'Veterinary Clinic',
    icon: '🏥',
    color: 'emerald',
    category: 'healthcare',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      ...HEALTHCARE_SECTIONS.map(s => ({ ...s })),
      ...STAFF_SECTIONS.map(s => ({ ...s, requiresCapability: 'staff_create' })),
      { id: 'specialized', label: 'Specialized Services', icon: '🔬', priority: 4.5, requiresCapability: 'diagnostic_results' },
      { id: 'inventory', label: 'Inventory', icon: '📦', priority: 9, requiresCapability: 'inventory_manage' },
    ],
    primaryActions: ['view_appointments', 'create_prescription', 'start_consultation'],
    quickStats: ['today_appointments', 'pending_consultations', 'monthly_revenue', 'patient_count'],
  },
  ambulance: {
    displayName: 'Pet Ambulance Service',
    icon: '🚑',
    color: 'red',
    category: 'healthcare',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_view' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'gps_tracking', label: 'GPS Tracking', icon: '📍', priority: 4, requiresCapability: 'gps_tracking' },
    ],
    primaryActions: ['view_bookings', 'start_trip', 'update_location'],
    quickStats: ['active_trips', 'completed_trips', 'monthly_revenue', 'rating'],
  },
  diagnostics_center: {
    displayName: 'Diagnostics Center',
    icon: '🔬',
    color: 'blue',
    category: 'healthcare',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'diagnostics', label: 'Diagnostic Results', icon: '📊', priority: 4, requiresCapability: 'diagnostic_results' },
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 7, requiresCapability: 'staff_create' },
    ],
    primaryActions: ['view_bookings', 'upload_results', 'manage_tests'],
    quickStats: ['pending_tests', 'completed_tests', 'monthly_revenue', 'rating'],
  },
  pet_insurance: {
    displayName: 'Pet Insurance Provider',
    icon: '🛡️',
    color: 'indigo',
    category: 'specialist',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
    ],
    primaryActions: ['view_applications', 'process_claims', 'manage_policies'],
    quickStats: ['active_policies', 'pending_claims', 'monthly_revenue', 'rating'],
  },
  pet_sitter: {
    displayName: 'Pet Sitter',
    icon: '🏠',
    color: 'green',
    category: 'service_provider',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_view' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
    ],
    primaryActions: ['view_bookings', 'send_updates', 'manage_schedule'],
    quickStats: ['active_bookings', 'completed_sessions', 'monthly_revenue', 'rating'],
  },
  pet_transport: {
    displayName: 'Pet Transport',
    icon: '🚐',
    color: 'blue',
    category: 'service_provider',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_view' : undefined 
      })),
      { id: 'gps_tracking', label: 'GPS Tracking', icon: '📍', priority: 4, requiresCapability: 'gps_tracking' },
    ],
    primaryActions: ['view_bookings', 'start_trip', 'update_location'],
    quickStats: ['active_trips', 'completed_trips', 'monthly_revenue', 'rating'],
  },
  pet_photographer: {
    displayName: 'Pet Photographer',
    icon: '📸',
    color: 'purple',
    category: 'service_provider',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'gallery', label: 'Portfolio', icon: '📸', priority: 4 },
    ],
    primaryActions: ['view_bookings', 'upload_photos', 'manage_portfolio'],
    quickStats: ['sessions_today', 'completed_sessions', 'monthly_revenue', 'rating'],
  },
  pet_spa: {
    displayName: 'Pet Spa',
    icon: '💆',
    color: 'pink',
    category: 'service_provider',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 7, requiresCapability: 'staff_create' },
      { id: 'schedule', label: 'Schedule', icon: '🗓️', priority: 3, requiresCapability: 'staff_schedule' },
    ],
    primaryActions: ['view_appointments', 'manage_staff', 'view_schedule'],
    quickStats: ['today_appointments', 'completed_services', 'monthly_revenue', 'rating'],
  },
  pet_event_organizer: {
    displayName: 'Pet Event Organizer',
    icon: '🎉',
    color: 'yellow',
    category: 'service_provider',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'events', label: 'Events', icon: '📅', priority: 4 },
    ],
    primaryActions: ['view_events', 'create_event', 'manage_registrations'],
    quickStats: ['upcoming_events', 'total_registrations', 'monthly_revenue', 'rating'],
  },
  pet_relocation: {
    displayName: 'Pet Relocation',
    icon: '✈️',
    color: 'teal',
    category: 'service_provider',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'gps_tracking', label: 'GPS Tracking', icon: '📍', priority: 4, requiresCapability: 'gps_tracking' },
    ],
    primaryActions: ['view_bookings', 'track_shipment', 'update_status'],
    quickStats: ['active_shipments', 'completed_shipments', 'monthly_revenue', 'rating'],
  },
  pet_daycare: {
    displayName: 'Pet Daycare',
    icon: '🏫',
    color: 'orange',
    category: 'service_provider',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_create' : s.id === 'services' ? 'service_pricing' : undefined 
      })),
      { id: 'staff', label: 'Staff Management', icon: '👥', priority: 7, requiresCapability: 'staff_create' },
      { id: 'schedule', label: 'Schedule', icon: '🗓️', priority: 3, requiresCapability: 'staff_schedule' },
    ],
    primaryActions: ['view_bookings', 'manage_staff', 'view_schedule'],
    quickStats: ['current_occupancy', 'check_ins_today', 'monthly_revenue', 'rating'],
  },
  
  walker: {
    displayName: 'Dog Walker',
    icon: '🚶',
    color: 'blue',
    category: 'walking',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_view' : undefined 
      })),
      { id: 'live_tracking', label: 'Live Tracking', icon: '📍', priority: 4, requiresCapability: 'gps_tracking' },
      { id: 'routes', label: 'Routes', icon: '🗺️', priority: 5 },
      { id: 'subscriptions', label: 'Subscriptions', icon: '📅', priority: 6 },
    ],
    primaryActions: ['start_walk', 'view_schedule', 'send_update'],
    quickStats: ['walks_today', 'active_subscriptions', 'monthly_revenue', 'rating'],
  },
  // Alias for database role name
  pet_walker: {
    displayName: 'Dog Walker',
    icon: '🚶',
    color: 'blue',
    category: 'walking',
    dashboardSections: [
      ...COMMON_SECTIONS.map(s => ({ 
        ...s, 
        requiresCapability: s.id === 'bookings' ? 'booking_view' : undefined 
      })),
      { id: 'live_tracking', label: 'Live Tracking', icon: '📍', priority: 4, requiresCapability: 'gps_tracking' },
      { id: 'routes', label: 'Routes', icon: '🗺️', priority: 5 },
      { id: 'subscriptions', label: 'Subscriptions', icon: '📅', priority: 6 },
    ],
    primaryActions: ['start_walk', 'view_schedule', 'send_update'],
    quickStats: ['walks_today', 'active_subscriptions', 'monthly_revenue', 'rating'],
  },
  
  seller: {
    displayName: 'Pet Store / E-commerce',
    icon: '🛒',
    color: 'indigo',
    category: 'ecommerce',
    dashboardSections: [
      ...COMMON_SECTIONS,
      { id: 'products', label: 'Products', icon: '📦', priority: 4, requiresCapability: 'product_catalog' }, // Fixed: catalog -> product_catalog
      { id: 'inventory', label: 'Inventory', icon: '📊', priority: 5, requiresCapability: 'inventory' },
      { id: 'orders', label: 'Orders', icon: '🛍️', priority: 6 },
      { id: 'returns', label: 'Returns', icon: '↩️', priority: 7 },
      { id: 'promotions', label: 'Promotions', icon: '🎁', priority: 8 },
    ],
    primaryActions: ['add_product', 'view_orders', 'manage_inventory'],
    quickStats: ['orders_today', 'pending_orders', 'low_stock_items', 'monthly_revenue'],
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get role configuration by role ID or name
 * Handles both database role names (pet_*) and UI role names
 */
export function getRoleConfig(roleIdOrName: string): RoleConfig | null {
  if (!roleIdOrName) return null;
  
  // Normalize role name - try both DB and UI names
  const normalized = roleIdOrName.toLowerCase().trim();
  
  // Try direct match first
  if (ROLE_CONFIGS[normalized]) {
    return {
      roleId: normalized,
      roleName: normalized,
      ...ROLE_CONFIGS[normalized],
    } as RoleConfig;
  }
  
  // Try mapped name (DB <-> UI)
  const mappedName = ROLE_NAME_MAPPING[normalized];
  if (mappedName && ROLE_CONFIGS[mappedName]) {
    return {
      roleId: mappedName,
      roleName: mappedName,
      ...ROLE_CONFIGS[mappedName],
    } as RoleConfig;
  }
  
  // Try reverse mapping (if normalized is DB name, try UI name)
  for (const [uiName, dbName] of Object.entries(ROLE_NAME_MAPPING)) {
    if (dbName === normalized && ROLE_CONFIGS[uiName]) {
      return {
        roleId: uiName,
        roleName: uiName,
        ...ROLE_CONFIGS[uiName],
      } as RoleConfig;
    }
  }
  
  // Try to find by display name or partial match
  for (const [key, config] of Object.entries(ROLE_CONFIGS)) {
    if (config.displayName?.toLowerCase().includes(normalized)) {
      return {
        roleId: key,
        roleName: key,
        ...config,
      } as RoleConfig;
    }
  }
  
  return null;
}

/**
 * Get dashboard sections for a role, filtered by capabilities
 */
export function getDashboardSections(
  roleIdOrName: string,
  capabilities: string[] = []
): DashboardSection[] {
  const config = getRoleConfig(roleIdOrName);
  if (!config) {
    return COMMON_SECTIONS;
  }
  
  return config.dashboardSections
    .filter(section => {
      // Include if no capability required or user has the capability
      if (!section.requiresCapability) return true;
      return capabilities.includes(section.requiresCapability);
    })
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get allowed service styles for a role
 */
export function getAllowedServiceStyles(
  roleStyleConfig: string[] = []
): ServiceStyleConfig[] {
  return roleStyleConfig
    .map(style => {
      const normalized = normalizeServiceStyle(style);
      return SERVICE_STYLES[normalized];
    })
    .filter(Boolean);
}

/**
 * Check if a service style is allowed for a role
 */
export function isStyleAllowedForRole(
  style: string,
  allowedStyles: string[]
): boolean {
  const normalized = normalizeServiceStyle(style);
  return allowedStyles.some(s => normalizeServiceStyle(s) === normalized);
}

/**
 * Get color classes for a role
 */
export function getRoleColorClasses(roleIdOrName: string): {
  bg: string;
  text: string;
  border: string;
  gradient: string;
} {
  const config = getRoleConfig(roleIdOrName);
  const color = config?.color || 'gray';
  
  return {
    bg: `bg-${color}-50`,
    text: `text-${color}-600`,
    border: `border-${color}-200`,
    gradient: `from-${color}-500 to-${color}-600`,
  };
}
