/**
 * Capability Route Mapping
 * Maps all 45 capabilities to their proper routes and categories
 */

export interface CapabilityRoute {
  name: string;
  display_name: string;
  icon: string;
  description: string;
  category: 'core' | 'services' | 'specialized' | 'operations' | 'finance' | 'communication';
  route: string;
  parentRoute?: string; // For nested routes
  requiresBusiness?: boolean; // Only for business vendors
  relatedCapabilities?: string[]; // Related capabilities that should be grouped
}

export const CAPABILITY_ROUTES: Record<string, CapabilityRoute> = {
  // Core Operations
  dashboard: {
    name: 'dashboard',
    display_name: 'Dashboard',
    icon: '📊',
    description: 'View overview and stats',
    category: 'core',
    route: '/',
  },
  bookings: {
    name: 'bookings',
    display_name: 'Bookings',
    icon: '📅',
    description: 'Manage appointments',
    category: 'core',
    route: '/bookings',
    relatedCapabilities: ['centre_booking', 'home_services', 'tele_consultation', 'walking', 'reservations', 'checkin_checkout'],
  },
  profile: {
    name: 'profile',
    display_name: 'Profile',
    icon: '👤',
    description: 'Update your profile',
    category: 'core',
    route: '/profile',
  },

  // Services & Catalog
  services: {
    name: 'services',
    display_name: 'Services',
    icon: '📋',
    description: 'Manage your services',
    category: 'services',
    route: '/services',
    relatedCapabilities: ['packages', 'pricing', 'test_catalog', 'menu', 'products', 'subscriptions'],
  },
  packages: {
    name: 'packages',
    display_name: 'Packages',
    icon: '📦',
    description: 'Session packages',
    category: 'services',
    route: '/services/packages',
    parentRoute: '/services',
  },
  pricing: {
    name: 'pricing',
    display_name: 'Pricing',
    icon: '💵',
    description: 'Manage service pricing',
    category: 'services',
    route: '/services/pricing',
    parentRoute: '/services',
  },
  test_catalog: {
    name: 'test_catalog',
    display_name: 'Test Catalog',
    icon: '🧪',
    description: 'Available tests',
    category: 'services',
    route: '/services/tests',
    parentRoute: '/services',
  },
  menu: {
    name: 'menu',
    display_name: 'Menu',
    icon: '🍽️',
    description: 'Food & drinks menu',
    category: 'services',
    route: '/services/menu',
    parentRoute: '/services',
  },
  products: {
    name: 'products',
    display_name: 'Products',
    icon: '🛍️',
    description: 'Product catalog',
    category: 'services',
    route: '/services/products',
    parentRoute: '/services',
  },
  subscriptions: {
    name: 'subscriptions',
    display_name: 'Subscriptions',
    icon: '🔄',
    description: 'Meal subscriptions',
    category: 'services',
    route: '/services/subscriptions',
    parentRoute: '/services',
  },

  // Service Styles (Booking Sub-routes)
  centre_booking: {
    name: 'centre_booking',
    display_name: 'Centre Booking',
    icon: '🏥',
    description: 'In-centre appointments',
    category: 'services',
    route: '/bookings/centre',
    parentRoute: '/bookings',
  },
  home_services: {
    name: 'home_services',
    display_name: 'Home Services',
    icon: '🏠',
    description: 'At-home visits',
    category: 'services',
    route: '/bookings/home',
    parentRoute: '/bookings',
  },
  tele_consultation: {
    name: 'tele_consultation',
    display_name: 'Tele Consultation',
    icon: '📞',
    description: 'Online consultations',
    category: 'services',
    route: '/bookings/tele',
    parentRoute: '/bookings',
  },
  walking: {
    name: 'walking',
    display_name: 'Walking Sessions',
    icon: '🚶',
    description: 'Walk bookings',
    category: 'specialized',
    route: '/bookings/walking',
    parentRoute: '/bookings',
  },
  reservations: {
    name: 'reservations',
    display_name: 'Reservations',
    icon: '📝',
    description: 'Table reservations',
    category: 'specialized',
    route: '/bookings/reservations',
    parentRoute: '/bookings',
  },
  checkin_checkout: {
    name: 'checkin_checkout',
    display_name: 'Check-in/Out',
    icon: '✅',
    description: 'Guest management',
    category: 'specialized',
    route: '/bookings/checkin',
    parentRoute: '/bookings',
  },
  route_tracking: {
    name: 'route_tracking',
    display_name: 'Route Tracking',
    icon: '🗺️',
    description: 'GPS routes',
    category: 'specialized',
    route: '/bookings/routes',
    parentRoute: '/bookings',
  },

  // Staff Management (Business Only)
  staff: {
    name: 'staff',
    display_name: 'Staff',
    icon: '👥',
    description: 'Manage team members',
    category: 'operations',
    route: '/staff',
    requiresBusiness: true,
  },

  // Schedule & Availability
  schedule: {
    name: 'schedule',
    display_name: 'Schedule',
    icon: '🗓️',
    description: 'Manage availability',
    category: 'operations',
    route: '/schedule',
  },
  service_radius: {
    name: 'service_radius',
    display_name: 'Service Radius',
    icon: '🎯',
    description: 'Coverage area',
    category: 'operations',
    route: '/schedule/radius',
    parentRoute: '/schedule',
  },
  gps_tracking: {
    name: 'gps_tracking',
    display_name: 'GPS Tracking',
    icon: '📍',
    description: 'Live location',
    category: 'operations',
    route: '/schedule/gps',
    parentRoute: '/schedule',
  },

  // Finance
  earnings: {
    name: 'earnings',
    display_name: 'Earnings',
    icon: '💰',
    description: 'View earnings',
    category: 'finance',
    route: '/finance/earnings',
    parentRoute: '/finance',
  },
  settlements: {
    name: 'settlements',
    display_name: 'Settlements',
    icon: '💳',
    description: 'View payouts',
    category: 'finance',
    route: '/finance/settlements',
    parentRoute: '/finance',
  },
  bank_account: {
    name: 'bank_account',
    display_name: 'Bank Account',
    icon: '🏦',
    description: 'Manage bank details',
    category: 'finance',
    route: '/finance/bank',
    parentRoute: '/finance',
  },

  // Medical & Healthcare
  prescriptions: {
    name: 'prescriptions',
    display_name: 'Prescriptions',
    icon: '📜',
    description: 'Issue prescriptions',
    category: 'specialized',
    route: '/medical/prescriptions',
    parentRoute: '/medical',
  },
  medical_records: {
    name: 'medical_records',
    display_name: 'Medical Records',
    icon: '📁',
    description: 'Patient records',
    category: 'specialized',
    route: '/medical/records',
    parentRoute: '/medical',
  },
  vaccination: {
    name: 'vaccination',
    display_name: 'Vaccination',
    icon: '💉',
    description: 'Vaccination records',
    category: 'specialized',
    route: '/medical/vaccination',
    parentRoute: '/medical',
  },
  diagnostics: {
    name: 'diagnostics',
    display_name: 'Diagnostics',
    icon: '🔬',
    description: 'Lab tests & results',
    category: 'specialized',
    route: '/medical/diagnostics',
    parentRoute: '/medical',
  },

  // Pharmacy
  pharmacy: {
    name: 'pharmacy',
    display_name: 'Pharmacy',
    icon: '💊',
    description: 'Medicine inventory',
    category: 'specialized',
    route: '/pharmacy',
  },
  inventory: {
    name: 'inventory',
    display_name: 'Inventory',
    icon: '📦',
    description: 'Stock management',
    category: 'specialized',
    route: '/pharmacy/inventory',
    parentRoute: '/pharmacy',
  },
  orders: {
    name: 'orders',
    display_name: 'Orders',
    icon: '📦',
    description: 'Order management',
    category: 'specialized',
    route: '/pharmacy/orders',
    parentRoute: '/pharmacy',
  },

  // Ambulance
  ambulance: {
    name: 'ambulance',
    display_name: 'Ambulance',
    icon: '🚑',
    description: 'Emergency dispatch',
    category: 'specialized',
    route: '/ambulance',
    relatedCapabilities: ['vehicles', 'gps_tracking'],
  },
  vehicles: {
    name: 'vehicles',
    display_name: 'Vehicles',
    icon: '🚐',
    description: 'Fleet management',
    category: 'specialized',
    route: '/ambulance/vehicles',
    parentRoute: '/ambulance',
  },
  
  // Training
  training: {
    name: 'training',
    display_name: 'Training',
    icon: '🎓',
    description: 'Pet training management',
    category: 'specialized',
    route: '/training',
    relatedCapabilities: ['training_programs', 'progress_tracking'],
  },
  
  // Holidays
  holidays: {
    name: 'holidays',
    display_name: 'Pet Holidays',
    icon: '✈️',
    description: 'Pet tour management',
    category: 'specialized',
    route: '/holidays',
    relatedCapabilities: ['holiday_packages', 'tour_schedule'],
  },

  // Cafe
  cafe_tables: {
    name: 'cafe_tables',
    display_name: 'Tables',
    icon: '🪑',
    description: 'Table management',
    category: 'specialized',
    route: '/cafe/tables',
    parentRoute: '/cafe',
  },

  // Resort & Boarding — rooms is for resort/boarding only; do not show under Services for vet/clinic.
  rooms: {
    name: 'rooms',
    display_name: 'Rooms',
    icon: '🛏️',
    description: 'Room management',
    category: 'specialized',
    route: '/resort/rooms',
    parentRoute: '/resort',
  },
  boarding: {
    name: 'boarding',
    display_name: 'Boarding',
    icon: '🏨',
    description: 'Pet boarding',
    category: 'specialized',
    route: '/resort/boarding',
    parentRoute: '/resort',
  },

  // Insurance
  insurance_plans: {
    name: 'insurance_plans',
    display_name: 'Insurance Plans',
    icon: '📋',
    description: 'Plan management',
    category: 'specialized',
    route: '/insurance/plans',
    parentRoute: '/insurance',
  },
  policies: {
    name: 'policies',
    display_name: 'Policies',
    icon: '📄',
    description: 'Active policies',
    category: 'specialized',
    route: '/insurance/policies',
    parentRoute: '/insurance',
  },
  claims: {
    name: 'claims',
    display_name: 'Claims',
    icon: '🎫',
    description: 'Process claims',
    category: 'specialized',
    route: '/insurance/claims',
    parentRoute: '/insurance',
  },

  // Adoption & Breeding
  adoption: {
    name: 'adoption',
    display_name: 'Adoption',
    icon: '🏠',
    description: 'Pet adoption listings',
    category: 'specialized',
    route: '/adoption',
  },
  
  // Events Management
  events: {
    name: 'events',
    display_name: 'Events',
    icon: '📅',
    description: 'Manage events and registrations',
    category: 'specialized',
    route: '/events',
    relatedCapabilities: ['booking', 'schedule_management'],
  },
  pet_profiles: {
    name: 'pet_profiles',
    display_name: 'Pet Profiles',
    icon: '🐾',
    description: 'Manage pet listings',
    category: 'specialized',
    route: '/adoption/pets',
    parentRoute: '/adoption',
  },
  lineage: {
    name: 'lineage',
    display_name: 'Lineage',
    icon: '🌳',
    description: 'Pedigree records',
    category: 'specialized',
    route: '/adoption/lineage',
    parentRoute: '/adoption',
  },

  // Training
  training_programs: {
    name: 'training_programs',
    display_name: 'Training Programs',
    icon: '🎓',
    description: 'Training packages',
    category: 'specialized',
    route: '/training/programs',
    parentRoute: '/training',
  },
  progress_tracking: {
    name: 'progress_tracking',
    display_name: 'Progress Tracking',
    icon: '📈',
    description: 'Training progress',
    category: 'specialized',
    route: '/training/progress',
    parentRoute: '/training',
  },

  // Nutrition
  meal_plans: {
    name: 'meal_plans',
    display_name: 'Meal Plans',
    icon: '🍲',
    description: 'Diet plans',
    category: 'specialized',
    route: '/nutrition/plans',
    parentRoute: '/nutrition',
  },
  food_delivery: {
    name: 'food_delivery',
    display_name: 'Food Delivery',
    icon: '🚚',
    description: 'Delivery orders',
    category: 'specialized',
    route: '/nutrition/delivery',
    parentRoute: '/nutrition',
  },

  // Holidays
  holiday_packages: {
    name: 'holiday_packages',
    display_name: 'Holiday Packages',
    icon: '✈️',
    description: 'Tour packages',
    category: 'specialized',
    route: '/holidays/packages',
    parentRoute: '/holidays',
  },
  tour_schedule: {
    name: 'tour_schedule',
    display_name: 'Tour Schedule',
    icon: '📆',
    description: 'Upcoming tours',
    category: 'specialized',
    route: '/holidays/schedule',
    parentRoute: '/holidays',
  },

  // E-commerce
  seller_hub: {
    name: 'seller_hub',
    display_name: 'Seller Hub',
    icon: '🏪',
    description: 'E-commerce management',
    category: 'specialized',
    route: '/seller',
  },

  // Communication
  chat: {
    name: 'chat',
    display_name: 'Messages',
    icon: '💬',
    description: 'Customer messages',
    category: 'communication',
    route: '/communication/messages',
    parentRoute: '/communication',
  },
  video_call: {
    name: 'video_call',
    display_name: 'Video Calls',
    icon: '📹',
    description: 'Tele consultations',
    category: 'communication',
    route: '/communication/video',
    parentRoute: '/communication',
  },
  notifications: {
    name: 'notifications',
    display_name: 'Notifications',
    icon: '🔔',
    description: 'View alerts',
    category: 'communication',
    route: '/communication/notifications',
    parentRoute: '/communication',
  },

  // Operations
  reviews: {
    name: 'reviews',
    display_name: 'Reviews',
    icon: '⭐',
    description: 'Customer feedback',
    category: 'operations',
    route: '/operations/reviews',
    parentRoute: '/operations',
  },
  analytics: {
    name: 'analytics',
    display_name: 'Analytics',
    icon: '📊',
    description: 'Business insights',
    category: 'operations',
    route: '/operations/analytics',
    parentRoute: '/operations',
  },
  reports: {
    name: 'reports',
    display_name: 'Reports',
    icon: '📑',
    description: 'Generate reports',
    category: 'operations',
    route: '/operations/reports',
    parentRoute: '/operations',
  },
  settings: {
    name: 'settings',
    display_name: 'Settings',
    icon: '⚙️',
    description: 'App settings',
    category: 'operations',
    route: '/settings',
  },
  
  // ============================================================================
  // MISSING CAPABILITIES - Added from audit (Phase 1 fixes)
  // ============================================================================
  
  // Facility Management - needed by 12+ roles
  facility_management: {
    name: 'facility_management',
    display_name: 'Facility',
    icon: '🏢',
    description: 'Manage facility details and amenities',
    category: 'operations',
    route: '/facility',
  },

  // Emergency - needed by healthcare roles
  emergency: {
    name: 'emergency',
    display_name: 'Emergency',
    icon: '🚨',
    description: 'Emergency protocols and alerts',
    category: 'specialized',
    route: '/emergency',
  },

  // Patient Monitoring - for vet/clinic
  patient_monitoring: {
    name: 'patient_monitoring',
    display_name: 'Patient Monitoring',
    icon: '❤️',
    description: 'Track patient vitals and conditions',
    category: 'specialized',
    route: '/medical/monitoring',
    parentRoute: '/medical',
  },

  // Vet Summary - for vet/clinic
  vet_summary: {
    name: 'vet_summary',
    display_name: 'Vet Summary',
    icon: '📋',
    description: 'Patient summaries and reports',
    category: 'specialized',
    route: '/medical/summary',
    parentRoute: '/medical',
  },

  // Controlled Substances - for pharmacy
  controlled_substances: {
    name: 'controlled_substances',
    display_name: 'Controlled Substances',
    icon: '🔒',
    description: 'Manage controlled medications',
    category: 'specialized',
    route: '/pharmacy/controlled',
    parentRoute: '/pharmacy',
  },

  // Prescription Verification - for pharmacy
  prescription_verification: {
    name: 'prescription_verification',
    display_name: 'Rx Verification',
    icon: '✅',
    description: 'Verify prescriptions',
    category: 'specialized',
    route: '/pharmacy/verify',
    parentRoute: '/pharmacy',
  },

  // Expiry Management - for pharmacy/seller
  expiry_management: {
    name: 'expiry_management',
    display_name: 'Expiry Tracking',
    icon: '📆',
    description: 'Track product expiration dates',
    category: 'operations',
    route: '/inventory/expiry',
    parentRoute: '/inventory',
  },

  // CCTV Access - for boarding/resort
  cctv_access: {
    name: 'cctv_access',
    display_name: 'CCTV Access',
    icon: '📹',
    description: 'Manage camera access',
    category: 'operations',
    route: '/facility/cctv',
    parentRoute: '/facility',
  },

  // Memorial - for sunset services
  memorial: {
    name: 'memorial',
    display_name: 'Memorial',
    icon: '🕯️',
    description: 'Memorial services',
    category: 'specialized',
    route: '/memorial',
  },

  // Counseling - for behaviorist/sunset
  counseling: {
    name: 'counseling',
    display_name: 'Counseling',
    icon: '💬',
    description: 'Counseling sessions',
    category: 'specialized',
    route: '/counseling',
  },

  // Custom Services - for all roles
  custom_services: {
    name: 'custom_services',
    display_name: 'Custom Services',
    icon: '✨',
    description: 'Create custom services',
    category: 'services',
    route: '/services/custom',
    parentRoute: '/services',
  },

  // Distance Pricing - for taxi/walker/ambulance
  distance_pricing: {
    name: 'distance_pricing',
    display_name: 'Distance Pricing',
    icon: '📏',
    description: 'Configure distance-based pricing',
    category: 'finance',
    route: '/pricing/distance',
    parentRoute: '/pricing',
  },
  
  // Photo Updates - for boarding/walker/sitter
  photo_updates: {
    name: 'photo_updates',
    display_name: 'Photo Updates',
    icon: '📸',
    description: 'Send photo updates to customers',
    category: 'communication',
    route: '/communication/photos',
    parentRoute: '/communication',
  },
  
  // PAX Management - for cafe/events
  pax_management: {
    name: 'pax_management',
    display_name: 'PAX Management',
    icon: '👥',
    description: 'Manage party size and capacity',
    category: 'specialized',
    route: '/cafe/capacity',
    parentRoute: '/cafe',
  },
  
  // Occupancy Tracking - for boarding/resort
  occupancy_tracking: {
    name: 'occupancy_tracking',
    display_name: 'Occupancy Tracking',
    icon: '📊',
    description: 'Track room/table occupancy',
    category: 'operations',
    route: '/resort/occupancy',
    parentRoute: '/resort',
  },
  
  // Nightly Pricing - for boarding/resort
  nightly_pricing: {
    name: 'nightly_pricing',
    display_name: 'Nightly Pricing',
    icon: '🌙',
    description: 'Configure nightly rates',
    category: 'finance',
    route: '/resort/pricing',
    parentRoute: '/resort',
  },
  
  // Emergency Protocols - for clinic/ambulance
  emergency_protocols: {
    name: 'emergency_protocols',
    display_name: 'Emergency Protocols',
    icon: '📋',
    description: 'Emergency response protocols',
    category: 'specialized',
    route: '/emergency/protocols',
    parentRoute: '/emergency',
  },
  
  // Multi Doctor Management - for clinics
  multi_doctor_management: {
    name: 'multi_doctor_management',
    display_name: 'Multi-Doctor',
    icon: '👨‍⚕️',
    description: 'Manage multiple doctors/vets',
    category: 'operations',
    route: '/staff/doctors',
    parentRoute: '/staff',
  },
  
  // Ambulance Services - for ambulance/clinic
  ambulance_services: {
    name: 'ambulance_services',
    display_name: 'Ambulance Services',
    icon: '🚑',
    description: 'Ambulance and transport',
    category: 'specialized',
    route: '/ambulance/services',
    parentRoute: '/ambulance',
  },
  
  // Diagnostic Lab - for clinic/diagnostic centers
  diagnostic_lab: {
    name: 'diagnostic_lab',
    display_name: 'Diagnostic Lab',
    icon: '🔬',
    description: 'Laboratory and diagnostic tests',
    category: 'specialized',
    route: '/medical/lab',
    parentRoute: '/medical',
  },
  
  // Catalog - for sellers/pharmacy
  catalog: {
    name: 'catalog',
    display_name: 'Catalog',
    icon: '📚',
    description: 'Product/service catalog',
    category: 'services',
    route: '/catalog',
  },
  
  // Donation - for shelters/NGOs
  donation: {
    name: 'donation',
    display_name: 'Donations',
    icon: '💝',
    description: 'Donation management',
    category: 'specialized',
    route: '/donations',
  },
  
  // Policy Management - for insurance
  policy_management: {
    name: 'policy_management',
    display_name: 'Policy Management',
    icon: '📋',
    description: 'Insurance policy management',
    category: 'specialized',
    route: '/insurance/policies',
    parentRoute: '/insurance',
  },
  
  // Claims Management - for insurance
  claims_management: {
    name: 'claims_management',
    display_name: 'Claims Management',
    icon: '📝',
    description: 'Insurance claims processing',
    category: 'specialized',
    route: '/insurance/claims',
    parentRoute: '/insurance',
  },
};

/**
 * Get route for a capability
 */
export function getCapabilityRoute(capabilityName: string): string {
  return CAPABILITY_ROUTES[capabilityName]?.route || '/';
}

/**
 * Check if capability requires business vendor type
 */
export function requiresBusiness(capabilityName: string): boolean {
  return CAPABILITY_ROUTES[capabilityName]?.requiresBusiness || false;
}

/**
 * Get all capabilities grouped by category
 */
export function getCapabilitiesByCategory(capabilityNames: string[], vendorType?: 'solo' | 'business') {
  const capabilities = capabilityNames
    .map(name => CAPABILITY_ROUTES[name])
    .filter((cap): cap is CapabilityRoute => {
      if (!cap) return false;
      // Filter out staff for solo vendors
      if (cap.requiresBusiness && vendorType === 'solo') {
        return false;
      }
      return true;
    });

  return capabilities.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, CapabilityRoute[]>);
}

