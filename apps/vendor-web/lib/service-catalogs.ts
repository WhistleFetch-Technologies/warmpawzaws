/**
 * Service Catalogs by Role
 * Pre-defined service templates for each vendor role
 * These help vendors quickly set up their service offerings
 */

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string;
  duration: number; // minutes
  priceRange: { min: number; max: number };
  icon?: string;
  category: string;
  subCategory?: string;
  requiredCapabilities?: string[];
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  applicableRoles: string[]; // Role names that can use this service
  isPackage?: boolean;
  packageDetails?: {
    sessionsPerDay?: number;
    sessionDuration?: number;
    packageDuration?: number; // days
    totalSessions?: number;
  };
}

/**
 * Veterinarian Services Catalog
 */
const VETERINARIAN_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'general_consultation',
    name: 'General Consultation',
    description: 'Basic health checkup and consultation for your pet',
    duration: 30,
    priceRange: { min: 500, max: 2000 },
    category: 'Consultation',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'vet'],
  },
  {
    id: 'vaccination',
    name: 'Vaccination',
    description: 'Standard pet vaccinations (DHPP, Rabies, etc.)',
    duration: 20,
    priceRange: { min: 800, max: 1500 },
    category: 'Preventive Care',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'vet'],
  },
  {
    id: 'surgery',
    name: 'Surgery',
    description: 'Surgical procedures (spay, neuter, minor surgeries)',
    duration: 60,
    priceRange: { min: 3000, max: 50000 },
    category: 'Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'vet'],
    requiredCapabilities: ['surgery'],
  },
  {
    id: 'dental',
    name: 'Dental Care',
    description: 'Dental cleaning, scaling, and oral health check',
    duration: 45,
    priceRange: { min: 1200, max: 5000 },
    category: 'Dental',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'vet'],
  },
  {
    id: 'emergency',
    name: 'Emergency Care',
    description: 'Emergency treatment and urgent care services',
    duration: 60,
    priceRange: { min: 2000, max: 10000 },
    category: 'Emergency',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'vet'],
  },
  {
    id: 'lab_tests',
    name: 'Lab Tests',
    description: 'Blood work, urine analysis, and diagnostic tests',
    duration: 30,
    priceRange: { min: 500, max: 5000 },
    category: 'Diagnostics',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'vet'],
  },
  {
    id: 'tele_consultation',
    name: 'Video Consultation',
    description: 'Online video consultation with veterinarian',
    duration: 30,
    priceRange: { min: 400, max: 1500 },
    category: 'Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'vet'],
    requiredCapabilities: ['tele_consultation'],
  },
  {
    id: 'home_visit',
    name: 'Home Visit',
    description: 'Veterinary consultation at your home',
    duration: 45,
    priceRange: { min: 1000, max: 3000 },
    category: 'Consultation',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'vet'],
  },
];

/**
 * Groomer Services Catalog
 */
const GROOMER_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'full_grooming',
    name: 'Full Grooming',
    description: 'Complete grooming service including bath, haircut, nail trim, and ear cleaning',
    duration: 90,
    priceRange: { min: 800, max: 3000 },
    category: 'Full Service',
    serviceStyle: 'at_center',
    applicableRoles: ['groomer', 'pet_groomer'],
  },
  {
    id: 'bath_blow',
    name: 'Bath & Blow Dry',
    description: 'Bathing and professional blow dry service',
    duration: 45,
    priceRange: { min: 500, max: 1500 },
    category: 'Basic Service',
    serviceStyle: 'at_center',
    applicableRoles: ['groomer', 'pet_groomer'],
  },
  {
    id: 'haircut',
    name: 'Haircut/Styling',
    description: 'Professional haircut and styling based on breed standards',
    duration: 60,
    priceRange: { min: 600, max: 2000 },
    category: 'Styling',
    serviceStyle: 'at_center',
    applicableRoles: ['groomer', 'pet_groomer'],
  },
  {
    id: 'nail_trim',
    name: 'Nail Trimming',
    description: 'Professional nail trimming and filing',
    duration: 15,
    priceRange: { min: 150, max: 300 },
    category: 'Basic Service',
    serviceStyle: 'at_center',
    applicableRoles: ['groomer', 'pet_groomer'],
  },
  {
    id: 'ear_cleaning',
    name: 'Ear Cleaning',
    description: 'Deep ear cleaning and inspection',
    duration: 15,
    priceRange: { min: 150, max: 300 },
    category: 'Basic Service',
    serviceStyle: 'at_center',
    applicableRoles: ['groomer', 'pet_groomer'],
  },
  {
    id: 'de_matting',
    name: 'De-matting',
    description: 'Removal of mats and tangles from coat',
    duration: 30,
    priceRange: { min: 400, max: 800 },
    category: 'Specialty Service',
    serviceStyle: 'at_center',
    applicableRoles: ['groomer', 'pet_groomer'],
  },
  {
    id: 'mobile_grooming',
    name: 'Mobile Grooming',
    description: 'Full grooming service at customer location',
    duration: 90,
    priceRange: { min: 1200, max: 3500 },
    category: 'Full Service',
    serviceStyle: 'at_home',
    applicableRoles: ['groomer', 'pet_groomer'],
  },
];

/**
 * Walker Services Catalog
 */
const WALKER_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'quick_walk',
    name: 'Quick Walk',
    description: 'Short 20-minute walk for quick exercise',
    duration: 20,
    priceRange: { min: 150, max: 300 },
    category: 'Walking',
    serviceStyle: 'at_home',
    applicableRoles: ['walker', 'pet_walker'],
    requiredCapabilities: ['gps_tracking'],
  },
  {
    id: 'standard_walk',
    name: 'Standard Walk',
    description: 'Regular 30-minute walk with exercise and potty breaks',
    duration: 30,
    priceRange: { min: 200, max: 400 },
    category: 'Walking',
    serviceStyle: 'at_home',
    applicableRoles: ['walker', 'pet_walker'],
    requiredCapabilities: ['gps_tracking'],
  },
  {
    id: 'extended_walk',
    name: 'Extended Walk',
    description: '45-minute walk for active dogs needing more exercise',
    duration: 45,
    priceRange: { min: 300, max: 600 },
    category: 'Walking',
    serviceStyle: 'at_home',
    applicableRoles: ['walker', 'pet_walker'],
    requiredCapabilities: ['gps_tracking'],
  },
  {
    id: 'power_walk',
    name: 'Power Walk',
    description: 'Intensive 60-minute walk for high-energy dogs',
    duration: 60,
    priceRange: { min: 400, max: 800 },
    category: 'Walking',
    serviceStyle: 'at_home',
    applicableRoles: ['walker', 'pet_walker'],
    requiredCapabilities: ['gps_tracking'],
  },
  {
    id: 'group_walk',
    name: 'Group Walk',
    description: 'Social group walk with other dogs (2-3 dogs)',
    duration: 30,
    priceRange: { min: 150, max: 300 },
    category: 'Walking',
    serviceStyle: 'at_home',
    applicableRoles: ['walker', 'pet_walker'],
    requiredCapabilities: ['gps_tracking'],
  },
];

/**
 * Trainer Services Catalog
 */
const TRAINER_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'consultation',
    name: 'Consultation/Assessment',
    description: 'Initial assessment and training plan development',
    duration: 60,
    priceRange: { min: 500, max: 1500 },
    category: 'Assessment',
    serviceStyle: 'at_center',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'basic_training',
    name: 'Basic Training Session',
    description: 'Basic obedience training (sit, stay, come, down)',
    duration: 60,
    priceRange: { min: 800, max: 2000 },
    category: 'Training',
    serviceStyle: 'at_center',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'advanced_training',
    name: 'Advanced Training',
    description: 'Advanced commands and behavior training',
    duration: 60,
    priceRange: { min: 1200, max: 3000 },
    category: 'Training',
    serviceStyle: 'at_center',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'behavior_modification',
    name: 'Behavior Modification',
    description: 'Specialized training for behavioral issues',
    duration: 90,
    priceRange: { min: 1500, max: 4000 },
    category: 'Specialty Training',
    serviceStyle: 'at_center',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'puppy_training',
    name: 'Puppy Training',
    description: 'Early training for puppies (8 weeks - 6 months)',
    duration: 60,
    priceRange: { min: 800, max: 2000 },
    category: 'Training',
    serviceStyle: 'at_center',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'home_training',
    name: 'Home Training Session',
    description: 'Training session at customer location',
    duration: 60,
    priceRange: { min: 1200, max: 2500 },
    category: 'Training',
    serviceStyle: 'at_home',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  // Additional at_home services for solo trainers
  {
    id: 'home_basic_obedience',
    name: 'Basic Obedience (Home Visit)',
    description: 'Teach sit, stay, come, heel in home environment',
    duration: 60,
    priceRange: { min: 1500, max: 2500 },
    category: 'Training',
    serviceStyle: 'at_home',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'home_puppy_training',
    name: 'Puppy Training (Home Visit)',
    description: 'Early socialization in comfortable home setting',
    duration: 45,
    priceRange: { min: 1200, max: 2000 },
    category: 'Training',
    serviceStyle: 'at_home',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'home_behavior_modification',
    name: 'Behavior Modification (Home Visit)',
    description: 'Address behavioral issues where they occur',
    duration: 90,
    priceRange: { min: 2000, max: 4000 },
    category: 'Specialty Training',
    serviceStyle: 'at_home',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'home_leash_training',
    name: 'Leash Walking Training (Home)',
    description: 'Teach proper leash walking behavior',
    duration: 45,
    priceRange: { min: 1200, max: 2000 },
    category: 'Training',
    serviceStyle: 'at_home',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  // Tele/Video consultation services for trainers
  {
    id: 'tele_consultation',
    name: 'Training Consultation (Video)',
    description: 'Initial assessment and training plan via video call',
    duration: 30,
    priceRange: { min: 400, max: 800 },
    category: 'Assessment',
    serviceStyle: 'tele',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'tele_behavior_assessment',
    name: 'Behavior Assessment (Video)',
    description: 'Remote behavior evaluation via video consultation',
    duration: 45,
    priceRange: { min: 500, max: 1000 },
    category: 'Assessment',
    serviceStyle: 'tele',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'tele_puppy_guidance',
    name: 'Puppy Training Guidance (Video)',
    description: 'Video guidance for new puppy owners on basics',
    duration: 30,
    priceRange: { min: 300, max: 600 },
    category: 'Training',
    serviceStyle: 'tele',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'tele_behavior_coaching',
    name: 'Behavior Coaching Session (Video)',
    description: 'Real-time coaching for behavioral issues',
    duration: 45,
    priceRange: { min: 500, max: 1000 },
    category: 'Specialty Training',
    serviceStyle: 'tele',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'tele_followup',
    name: 'Training Follow-up (Video)',
    description: 'Progress check and training adjustments',
    duration: 20,
    priceRange: { min: 250, max: 500 },
    category: 'Follow-up',
    serviceStyle: 'tele',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
  {
    id: 'tele_qa_session',
    name: 'Q&A Training Session (Video)',
    description: 'Open Q&A session for training questions',
    duration: 20,
    priceRange: { min: 200, max: 400 },
    category: 'Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['trainer', 'pet_trainer'],
  },
];

/**
 * Pharmacy Services Catalog
 * Note: Pharmacy primarily sells products, but can offer services
 */
const PHARMACY_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'prescription_fulfillment',
    name: 'Prescription Fulfillment',
    description: 'Process and fulfill veterinary prescriptions',
    duration: 0,
    priceRange: { min: 0, max: 0 }, // Price based on medication
    category: 'Prescription',
    serviceStyle: 'at_center',
    applicableRoles: ['pharmacy', 'pet_pharmacy'],
    requiredCapabilities: ['prescriptions'],
  },
  {
    id: 'medication_compounding',
    name: 'Medication Compounding',
    description: 'Custom medication compounding service',
    duration: 0,
    priceRange: { min: 200, max: 1000 },
    category: 'Specialty Service',
    serviceStyle: 'at_center',
    applicableRoles: ['pharmacy', 'pet_pharmacy'],
  },
  {
    id: 'home_delivery',
    name: 'Home Delivery',
    description: 'Delivery of medications to customer location',
    duration: 0,
    priceRange: { min: 50, max: 200 },
    category: 'Delivery',
    serviceStyle: 'at_home',
    applicableRoles: ['pharmacy', 'pet_pharmacy'],
  },
  {
    id: 'express_delivery',
    name: 'Express Delivery',
    description: 'Same-day or 2-4 hour delivery service',
    duration: 0,
    priceRange: { min: 100, max: 300 },
    category: 'Delivery',
    serviceStyle: 'at_home',
    applicableRoles: ['pharmacy', 'pet_pharmacy'],
  },
];

/**
 * Nutritionist Services Catalog
 */
const NUTRITIONIST_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'diet_consultation',
    name: 'Diet Consultation',
    description: 'Nutritional assessment and diet plan consultation',
    duration: 60,
    priceRange: { min: 500, max: 2000 },
    category: 'Consultation',
    serviceStyle: 'at_center',
    applicableRoles: ['nutritionist', 'pet_nutritionist'],
  },
  {
    id: 'custom_meal_plan',
    name: 'Custom Meal Plan',
    description: 'Personalized meal plan based on pet needs',
    duration: 0,
    priceRange: { min: 2000, max: 10000 },
    category: 'Meal Planning',
    serviceStyle: 'at_center',
    applicableRoles: ['nutritionist', 'pet_nutritionist'],
  },
  {
    id: 'fresh_meals',
    name: 'Fresh Meal Delivery',
    description: 'Daily/weekly fresh cooked meal delivery',
    duration: 0,
    priceRange: { min: 150, max: 500 }, // Per meal
    category: 'Meal Delivery',
    serviceStyle: 'at_home',
    applicableRoles: ['nutritionist', 'pet_nutritionist'],
  },
  {
    id: 'weight_management',
    name: 'Weight Management Program',
    description: 'Comprehensive weight loss/gain program with tracking',
    duration: 0,
    priceRange: { min: 5000, max: 20000 },
    category: 'Program',
    serviceStyle: 'at_center',
    applicableRoles: ['nutritionist', 'pet_nutritionist'],
    isPackage: true,
    packageDetails: {
      packageDuration: 60, // days
      totalSessions: 8,
    },
  },
  {
    id: 'online_consultation',
    name: 'Online Nutrition Consultation',
    description: 'Video consultation for diet planning',
    duration: 45,
    priceRange: { min: 400, max: 1500 },
    category: 'Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['nutritionist', 'pet_nutritionist'],
  },
];

/**
 * Diagnostics Center Services Catalog
 * Lab tests, home sample collection, diagnostic services
 */
const DIAGNOSTICS_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'blood_tests',
    name: 'Blood Tests',
    description: 'Complete blood count, biochemistry panel, and other blood work',
    duration: 30,
    priceRange: { min: 500, max: 3000 },
    category: 'Lab Tests',
    serviceStyle: 'at_center',
    applicableRoles: ['diagnostics', 'diagnostics_center', 'diagnostic_center'],
  },
  {
    id: 'urine_analysis',
    name: 'Urine Analysis',
    description: 'Urinalysis and urine culture',
    duration: 20,
    priceRange: { min: 300, max: 1500 },
    category: 'Lab Tests',
    serviceStyle: 'at_center',
    applicableRoles: ['diagnostics', 'diagnostics_center', 'diagnostic_center'],
  },
  {
    id: 'home_sample_collection',
    name: 'Home Sample Collection',
    description: 'Sample collection at customer location for lab tests',
    duration: 30,
    priceRange: { min: 200, max: 500 },
    category: 'Sample Collection',
    serviceStyle: 'at_home',
    applicableRoles: ['diagnostics', 'diagnostics_center', 'diagnostic_center'],
  },
  {
    id: 'diagnostic_package',
    name: 'Diagnostic Package',
    description: 'Preventive health screening package',
    duration: 60,
    priceRange: { min: 1500, max: 5000 },
    category: 'Packages',
    serviceStyle: 'at_center',
    applicableRoles: ['diagnostics', 'diagnostics_center', 'diagnostic_center'],
  },
  {
    id: 'x_ray',
    name: 'X-Ray / Imaging',
    description: 'Radiology and imaging services',
    duration: 30,
    priceRange: { min: 500, max: 3000 },
    category: 'Imaging',
    serviceStyle: 'at_center',
    applicableRoles: ['diagnostics', 'diagnostics_center', 'diagnostic_center'],
  },
  {
    id: 'ultrasound',
    name: 'Ultrasound',
    description: 'Sonography and ultrasound imaging',
    duration: 45,
    priceRange: { min: 1000, max: 4000 },
    category: 'Imaging',
    serviceStyle: 'at_center',
    applicableRoles: ['diagnostics', 'diagnostics_center', 'diagnostic_center'],
  },
];

/**
 * E-commerce/Seller Services Catalog
 * Note: Sellers primarily sell products, but can offer services
 */
const SELLER_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'product_delivery',
    name: 'Product Delivery',
    description: 'Standard delivery of products to customer',
    duration: 0,
    priceRange: { min: 50, max: 200 },
    category: 'Delivery',
    serviceStyle: 'at_home',
    applicableRoles: ['seller', 'pet_products_store'],
  },
  {
    id: 'express_delivery',
    name: 'Express Delivery',
    description: 'Same-day or 2-4 hour delivery',
    duration: 0,
    priceRange: { min: 100, max: 300 },
    category: 'Delivery',
    serviceStyle: 'at_home',
    applicableRoles: ['seller', 'pet_products_store'],
  },
  {
    id: 'gift_wrapping',
    name: 'Gift Wrapping',
    description: 'Professional gift wrapping service',
    duration: 0,
    priceRange: { min: 50, max: 200 },
    category: 'Additional Service',
    serviceStyle: 'at_center',
    applicableRoles: ['seller', 'pet_products_store'],
  },
  {
    id: 'product_installation',
    name: 'Product Installation',
    description: 'Installation and setup of products (crates, beds, etc.)',
    duration: 60,
    priceRange: { min: 500, max: 2000 },
    category: 'Installation',
    serviceStyle: 'at_home',
    applicableRoles: ['seller', 'pet_products_store'],
  },
];

/**
 * Complete Service Catalog by Role
 */
export const SERVICE_CATALOGS: Record<string, ServiceCatalogItem[]> = {
  veterinarian: VETERINARIAN_SERVICES,
  vet: VETERINARIAN_SERVICES,
  vet_solo: VETERINARIAN_SERVICES,
  vet_clinic: VETERINARIAN_SERVICES,
  veterinary_clinic: VETERINARIAN_SERVICES,
  groomer: GROOMER_SERVICES,
  pet_groomer: GROOMER_SERVICES,
  groomer_solo: GROOMER_SERVICES,
  groomer_center: GROOMER_SERVICES,
  walker: WALKER_SERVICES,
  pet_walker: WALKER_SERVICES,
  dog_walker: WALKER_SERVICES,
  trainer: TRAINER_SERVICES,
  pet_trainer: TRAINER_SERVICES,
  trainer_solo: TRAINER_SERVICES,
  trainer_center: TRAINER_SERVICES,
  pharmacy: PHARMACY_SERVICES,
  pet_pharmacy: PHARMACY_SERVICES,
  nutritionist: NUTRITIONIST_SERVICES,
  pet_nutritionist: NUTRITIONIST_SERVICES,
  nutritionist_solo: NUTRITIONIST_SERVICES,
  nutritionist_center: NUTRITIONIST_SERVICES,
  seller: SELLER_SERVICES,
  pet_products_store: SELLER_SERVICES,
  ecommerce: SELLER_SERVICES,
  diagnostics: DIAGNOSTICS_SERVICES,
  diagnostics_center: DIAGNOSTICS_SERVICES,
  diagnostics_provider: DIAGNOSTICS_SERVICES,
  diagnostics_solo: DIAGNOSTICS_SERVICES,
  diagnostic_center: DIAGNOSTICS_SERVICES,
};

/** Check if string looks like a UUID (not a role name/code) */
const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * Get service catalog for a specific role
 * @param roleIdOrName - Role ID (UUID), role name, or role code (e.g. 'diagnostics_center', 'vet')
 * @param roleName - Optional role display name (e.g. 'Diagnostics Center') - used when roleIdOrName is a UUID
 */
export function getServiceCatalogForRole(
  roleIdOrName: string | null | undefined,
  roleName?: string | null
): ServiceCatalogItem[] {
  if (!roleIdOrName && !roleName) return [];
  
  // When roleId is a UUID, use roleName for lookup (catalog keys are role names/codes, not UUIDs)
  let lookupKey = roleIdOrName || roleName || '';
  if (lookupKey && isUUID(String(lookupKey)) && roleName) {
    lookupKey = roleName;
  }
  if (!lookupKey) return [];
  
  const normalizedRoleId = String(lookupKey).toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  
  // Direct match
  if (SERVICE_CATALOGS[normalizedRoleId]) {
    return SERVICE_CATALOGS[normalizedRoleId];
  }
  
  // Try role name variations (canonical roles post-migration 521/522)
  const roleVariations: Record<string, string[]> = {
    'veterinarian': ['vet', 'vet_solo', 'vet_clinic', 'veterinary', 'veterinary_clinic'],
    'pet_groomer': ['groomer', 'groomer_solo', 'groomer_center', 'grooming'],
    'pet_walker': ['walker', 'dog_walker', 'walking'],
    'pet_trainer': ['trainer', 'trainer_solo', 'trainer_center', 'training'],
    'pet_pharmacy': ['pharmacy', 'pharmacist'],
    'pet_nutritionist': ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'nutrition'],
    'pet_products_store': ['seller', 'store', 'retailer', 'ecommerce'],
    'diagnostics': ['diagnostics_center', 'diagnostic_center', 'diagnostics_provider', 'diagnostics_solo'],
    'diagnostics_center': ['diagnostics', 'diagnostic_center', 'diagnostics_provider', 'diagnostics_solo'],
  };
  
  for (const [mainRole, variations] of Object.entries(roleVariations)) {
    if (normalizedRoleId === mainRole || variations.includes(normalizedRoleId)) {
      return SERVICE_CATALOGS[mainRole] || SERVICE_CATALOGS[variations[0]] || [];
    }
  }
  
  // Try matching "diagnostics center" -> diagnostics_center
  const withUnderscores = normalizedRoleId.replace(/\s+/g, '_');
  if (SERVICE_CATALOGS[withUnderscores]) {
    return SERVICE_CATALOGS[withUnderscores];
  }
  
  return [];
}

/**
 * Get all services (for admin/catalog view)
 */
export function getAllServices(): ServiceCatalogItem[] {
  return Object.values(SERVICE_CATALOGS).flat();
}

/**
 * Get services by category
 */
export function getServicesByCategory(category: string): ServiceCatalogItem[] {
  return getAllServices().filter(service => 
    service.category && service.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get services by service style
 */
export function getServicesByStyle(style: 'at_home' | 'at_center' | 'tele'): ServiceCatalogItem[] {
  return getAllServices().filter(service => service.serviceStyle === style);
}

/**
 * Search services by name or description
 */
export function searchServices(query: string): ServiceCatalogItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  return getAllServices().filter(service =>
    (service.name && service.name.toLowerCase().includes(normalizedQuery)) ||
    (service.description && service.description.toLowerCase().includes(normalizedQuery)) ||
    (service.category && service.category.toLowerCase().includes(normalizedQuery))
  );
}
