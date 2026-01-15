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
    icon: '🏥',
    color: 'blue',
    description: 'Services provided at your facility',
  },
  at_home: {
    id: 'at_home',
    label: 'Home Visit',
    icon: '🏠',
    color: 'green',
    description: 'Services provided at customer location',
  },
  tele: {
    id: 'tele',
    label: 'Video Consultation',
    icon: '📱',
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
  { id: 'dashboard', label: 'Dashboard', icon: '📊', priority: 0 },
  { id: 'bookings', label: 'Bookings', icon: '📅', priority: 1 },
  { id: 'services', label: 'Services', icon: '🛠️', priority: 2 },
  { id: 'schedule', label: 'Schedule', icon: '🗓️', priority: 3 },
  { id: 'earnings', label: 'Earnings', icon: '💰', priority: 10 },
  { id: 'settings', label: 'Settings', icon: '⚙️', priority: 20 },
];

const HEALTHCARE_SECTIONS: DashboardSection[] = [
  { id: 'prescriptions', label: 'Prescriptions', icon: '💊', priority: 4, requiresCapability: 'prescriptions' },
  { id: 'medical_records', label: 'Medical Records', icon: '📋', priority: 5, requiresCapability: 'medical_records' },
  { id: 'patient_monitoring', label: 'Patient Monitoring', icon: '❤️', priority: 6, requiresCapability: 'patient_monitoring' },
];

const STAFF_SECTIONS: DashboardSection[] = [
  { id: 'staff', label: 'Staff Management', icon: '👥', priority: 7, requiresCapability: 'staff_management' },
];

const FACILITY_SECTIONS: DashboardSection[] = [
  { id: 'facility', label: 'Facility', icon: '🏢', priority: 8, requiresCapability: 'facility_management' },
];

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
      ...COMMON_SECTIONS,
      ...HEALTHCARE_SECTIONS,
      ...STAFF_SECTIONS,
      { id: 'specialized', label: 'Specialized Services', icon: '🔬', priority: 4.5 },
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
      ...COMMON_SECTIONS,
      { id: 'gallery', label: 'Portfolio', icon: '📸', priority: 4 },
      { id: 'packages', label: 'Packages', icon: '📦', priority: 5 },
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
      ...COMMON_SECTIONS,
      ...FACILITY_SECTIONS,
      { id: 'cctv', label: 'CCTV Access', icon: '📹', priority: 4 },
      { id: 'daily_updates', label: 'Daily Updates', icon: '📝', priority: 5 },
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
      ...COMMON_SECTIONS,
      { id: 'training_programs', label: 'Programs', icon: '📚', priority: 4 },
      { id: 'progress_tracking', label: 'Progress', icon: '📈', priority: 5 },
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
      ...COMMON_SECTIONS,
      { id: 'diet_plans', label: 'Diet Plans', icon: '📋', priority: 4 },
      { id: 'meal_management', label: 'Meal Plans', icon: '🍽️', priority: 5 },
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
      ...COMMON_SECTIONS,
      { id: 'table_management', label: 'Tables', icon: '🪑', priority: 4 },
      { id: 'events', label: 'Events', icon: '🎉', priority: 5 },
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
      ...COMMON_SECTIONS,
      { id: 'adoptions', label: 'Adoptions', icon: '❤️', priority: 4 },
      { id: 'donations', label: 'Donations', icon: '💝', priority: 5 },
      { id: 'memorial', label: 'Memorial', icon: '🕯️', priority: 6 },
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
      ...COMMON_SECTIONS,
      { id: 'prescription_verification', label: 'Rx Verification', icon: '✅', priority: 4 },
      { id: 'inventory', label: 'Inventory', icon: '📦', priority: 5 },
      { id: 'expiry_management', label: 'Expiry Tracking', icon: '📆', priority: 6 },
      { id: 'controlled_substances', label: 'Controlled Drugs', icon: '🔒', priority: 7 },
    ],
    primaryActions: ['verify_prescription', 'check_inventory', 'process_order'],
    quickStats: ['pending_orders', 'prescriptions_verified', 'low_stock_items', 'monthly_revenue'],
  },
  
  walker: {
    displayName: 'Dog Walker',
    icon: '🚶',
    color: 'blue',
    category: 'walking',
    dashboardSections: [
      ...COMMON_SECTIONS,
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
      { id: 'products', label: 'Products', icon: '📦', priority: 4, requiresCapability: 'catalog' },
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
 */
export function getRoleConfig(roleIdOrName: string): RoleConfig | null {
  // Try direct match first
  if (ROLE_CONFIGS[roleIdOrName]) {
    return {
      roleId: roleIdOrName,
      roleName: roleIdOrName,
      ...ROLE_CONFIGS[roleIdOrName],
    } as RoleConfig;
  }
  
  // Try to find by display name or partial match
  for (const [key, config] of Object.entries(ROLE_CONFIGS)) {
    if (config.displayName?.toLowerCase().includes(roleIdOrName.toLowerCase())) {
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
