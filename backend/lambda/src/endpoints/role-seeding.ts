/**
 * ============================================================================
 * ROLE SEEDING & MANAGEMENT SYSTEM
 * ============================================================================
 * 
 * Based on reference implementation from Figma/Supabase
 * Seeds all 20 standard roles with configurations, onboarding forms, and service catalogs
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// STANDARD ROLE DEFINITIONS (From Reference)
// ============================================================================

const KNOWN_ROLE_NAMES: Record<string, string> = {
  'veterinarian': 'Veterinarian',
  'pet_walker': 'Pet Walker',
  'pet_groomer': 'Pet Grooming Salon',
  'pet_clinic': 'Pet Clinic / Hospital',
  'veterinary_clinic': 'Veterinary Clinic',
  'pet_pharmacy': 'Pet Pharmacy',
  'pet_boarding': 'Pet Boarding / Kennel',
  'pet_sitter': 'Pet Sitter',
  'pet_trainer': 'Pet Trainer',
  'pet_taxi': 'Pet Taxi',
  'pet_transport': 'Pet Taxi',
  'product_seller': 'Pet Store / Retailer',
  'pet_product': 'Pet Store / Retailer',
  'pet_products_store': 'Pet Store / Retailer',
  'pet_insurance': 'Insurance Agent',
  'pet_behaviorist': 'Pet Behaviorist',
  'pet_nutritionist': 'Pet Nutritionist',
  'nutritionist': 'Pet Nutritionist',
  'pet_photographer': 'Pet Photographer',
  'pet_shelter': 'Pet Shelter / NGO',
  'event_organizer': 'Event Organizer',
  'pet_ambulance': 'Pet Ambulance',
  'pet_relocation': 'Pet Relocation',
  'pet_cafe': 'Pet Cafe',
  'pet_resort': 'Pet Resort',
  'pet_holiday': 'Pet Holiday Planner',
  'pet_holiday_planner': 'Pet Holiday Planner',
  'pet_sunset_services': 'Pet Sunset Services',
  'service_provider': 'Service Provider',
  'pet_breeder': 'Pet Breeder',
  'insurance': 'Pet Insurance Provider',
};

// ============================================================================
// BASE CAPABILITIES - Available to ALL vendor roles
// These are horizontal capabilities required for all vendors
// ============================================================================
const BASE_CAPABILITIES = [
  'dashboard',        // Core Operations - Dashboard overview
  'profile',          // Core Operations - Update vendor profile
  'earnings',         // Finance & Payments - View earnings
  'settlements',      // Finance & Payments - View payouts
  'bank_account',     // Finance & Payments - Manage bank details
  'notifications',    // Communication - Notifications
  'reports',          // Operations - Reports and analytics
  'bank_verification', // Verification - Bank account verification
];

// Only these 25 canonical roles are active; inactive roles are removed from catalog/DB
const CANONICAL_ACTIVE_ROLE_NAMES: string[] = [
  'vet_solo', 'vet_clinic', 'groomer_solo', 'groomer_center', 'trainer_solo', 'trainer_center',
  'boarding', 'walker', 'sitter', 'adoption_center', 'cafe', 'photographer', 'pharmacy', 'seller',
  'ambulance', 'insurance', 'nutritionist', 'nutritionist_center', 'relocation', 'resort', 'holiday',
  'sunset', 'breeder', 'diagnostics_center', 'event_organizer',
];

// Map canonical role name -> legacy definition key (for config/capabilities)
const CANONICAL_TO_LEGACY_DEF: Record<string, string> = {
  vet_solo: 'veterinarian',
  vet_clinic: 'veterinary_clinic',
  groomer_solo: 'pet_groomer',
  groomer_center: 'pet_groomer',
  trainer_solo: 'pet_trainer',
  trainer_center: 'pet_trainer',
  boarding: 'pet_boarding',
  walker: 'pet_walker',
  sitter: 'pet_sitter',
  adoption_center: 'pet_shelter',
  cafe: 'pet_cafe',
  photographer: 'pet_photographer',
  pharmacy: 'pet_pharmacy',
  seller: 'pet_products_store',
  ambulance: 'pet_ambulance',
  insurance: 'insurance',
  nutritionist: 'nutritionist',
  nutritionist_center: 'nutritionist',
  relocation: 'pet_taxi',
  resort: 'pet_resort',
  holiday: 'pet_holiday_planner',
  sunset: 'pet_sunset_services',
  breeder: 'pet_breeder',
  diagnostics_center: 'veterinary_clinic',
  event_organizer: 'event_organizer',
};

// Display names for canonical roles (catalog/admin)
const CANONICAL_ROLE_DISPLAY_NAMES: Record<string, string> = {
  vet_solo: 'Veterinarian (Solo)',
  vet_clinic: 'Veterinary Clinic',
  groomer_solo: 'Pet Groomer (Solo)',
  groomer_center: 'Pet Grooming Salon',
  trainer_solo: 'Pet Trainer (Solo)',
  trainer_center: 'Pet Training Center',
  boarding: 'Pet Boarding / Kennel',
  walker: 'Pet Walker',
  sitter: 'Pet Sitter',
  adoption_center: 'Pet Shelter / NGO',
  cafe: 'Pet Cafe',
  photographer: 'Pet Photographer',
  pharmacy: 'Pet Pharmacy',
  seller: 'Pet Store / Retailer',
  ambulance: 'Pet Ambulance',
  insurance: 'Pet Insurance Provider',
  nutritionist: 'Pet Nutritionist',
  nutritionist_center: 'Nutritionist (Center)',
  relocation: 'Pet Relocation',
  resort: 'Pet Resort',
  holiday: 'Pet Holiday Planner',
  sunset: 'Pet Sunset Services',
  breeder: 'Pet Breeder',
  diagnostics_center: 'Diagnostics Center',
  event_organizer: 'Event Organizer',
};

function getDefinitionsForCanonicalRolesOnly(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const canonicalName of CANONICAL_ACTIVE_ROLE_NAMES) {
    const legacyKey = CANONICAL_TO_LEGACY_DEF[canonicalName];
    const def = STANDARD_ROLE_DEFINITIONS[legacyKey];
    if (def) out[canonicalName] = { ...def };
  }
  return out;
}

const STANDARD_ROLE_DEFINITIONS: Record<string, any> = {
  'veterinarian': {
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['at_clinic', 'video_consultation', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'prescriptions',
      'medical_records',
      'bookings',
      'chat',
      'staff',
      'tele_consultation',
      'emergency',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'vet_summary',
      'patient_monitoring'
    ],
    icon: '🩺',
    category: 'healthcare',
  },
  'veterinary_clinic': {
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['at_clinic', 'video_consultation', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'prescriptions',
      'medical_records',
      'bookings',
      'chat',
      'staff',
      'tele_consultation',
      'emergency',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'vet_summary',
      'patient_monitoring',
      'multi_doctor_management',
      'ambulance_services',
      'diagnostic_lab',
      'emergency_protocols'
    ],
    icon: '🏥',
    category: 'healthcare',
  },
  'pet_groomer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'gallery',
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages'
    ],
    icon: '✂️',
    category: 'grooming',
  },
  'pet_boarding': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'cctv_access',
      'photo_updates',
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'rooms',
      'nightly_pricing',
      'occupancy_tracking'
    ],
    icon: '🏨',
    category: 'petcare',
  },
  'pet_resort': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'cctv_access',
      'photo_updates',
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'rooms',
      'nightly_pricing',
      'occupancy_tracking'
    ],
    icon: '🏝️',
    category: 'petcare',
  },
  'pet_walker': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    // ✅ Solo-focused role: No packages capability, only custom_services
    capabilities: [
      ...BASE_CAPABILITIES,
      'gps_tracking',
      'photo_updates',
      'bookings',
      'facility_management',
      'schedule',
      'custom_services',
      'chat'
    ],
    icon: '🦮',
    category: 'petcare',
  },
  'pet_trainer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center', 'online'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'progress_tracking',
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages'
    ],
    icon: '🎾',
    category: 'training',
  },
  'pet_behaviorist': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center', 'video_consultation'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'progress_tracking',
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'tele_consultation'
    ],
    icon: '🧠',
    category: 'training',
  },
  'pet_sitter': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    // ✅ Solo-focused role: No packages capability, only custom_services
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'photo_updates',
      'chat',
      'facility_management',
      'schedule',
      'custom_services'
    ],
    icon: '🏠',
    category: 'petcare',
  },
  'pet_taxi': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    // ✅ Solo-focused role: No packages capability, only custom_services
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'gps_tracking',
      'emergency',
      'facility_management',
      'schedule',
      'custom_services',
      'distance_pricing',
      'chat'
    ],
    icon: '🚕',
    category: 'specialty',
  },
  'pet_products_store': {
    vendorTypes: ['seller'],
    serviceStyles: ['delivery', 'pickup'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'catalog',
      'inventory',
      'orders',
      'delivery',
      'staff',
      'facility_management',
      'schedule'
    ],
    icon: '🛍️',
    category: 'retail',
  },
  'pet_pharmacy': {
    vendorTypes: ['seller', 'healthcare_provider'],
    serviceStyles: ['delivery', 'pickup'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'catalog',
      'inventory',
      'prescriptions',
      'delivery',
      'staff',
      'facility_management',
      'schedule',
      'prescription_verification',
      'controlled_substances',
      'expiry_management',
      'order_dispatch',
      'availability_check',
      'invoice_generation',
      'order_broadcast'
    ],
    icon: '💊',
    category: 'healthcare',
  },
  'pet_cafe': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'menu',
      'events',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'cafe_tables',
      'pax_management',
      'chat'
    ],
    icon: '☕',
    category: 'lifestyle',
  },
  'pet_photographer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'at_home', 'outdoor'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'gallery',
      'portfolio',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'chat'
    ],
    icon: '📸',
    category: 'lifestyle',
  },
  'pet_shelter': {
    vendorTypes: ['service_provider', 'ngo'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: false, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'adoption',
      'donation',
      'pet_profiles',
      'events',
      'staff',
      'facility_management',
      'schedule',
      'chat'
    ],
    icon: '🏠',
    category: 'specialty',
  },
  'event_organizer': {
    vendorTypes: ['service_provider', 'ngo', 'organization'],
    serviceStyles: ['at_center', 'outdoor'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'events',
      'bookings',
      'staff',
      'facility_management',
      'schedule',
      'chat',
      'custom_services',
      'packages'
    ],
    icon: '📅',
    category: 'lifestyle',
  },
  'pet_holiday_planner': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'at_home', 'online'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages'
    ],
    icon: '🏖️',
    category: 'lifestyle',
  },
  'pet_sunset_services': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'memorial',
      'counseling',
      'staff',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'chat'
    ],
    icon: '🌅',
    category: 'specialty',
  },
  'nutritionist': {
    vendorTypes: ['healthcare_provider', 'service_provider'],
    serviceStyles: ['at_center', 'video_consultation', 'home_visit', 'delivery'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'chat',
      'staff',
      'tele_consultation',
      'video_calling',
      'facility_management',
      'schedule',
      'custom_services',
      'packages',
      'meal_plans',
      'diet_charts',
      'prescriptions',
      'delivery',
      'progress_tracking'
    ],
    icon: '🥗',
    category: 'healthcare',
  },
  'insurance': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['online', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'policy_management',
      'claims_management',
      'insurance_plans'
    ],
    icon: '🛡️',
    category: 'specialty',
  },
  'pet_ambulance': {
    vendorTypes: ['healthcare_provider', 'service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    // ✅ Solo-focused role: Primarily solo operators
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'gps_tracking',
      'live_location',
      'emergency',
      'facility_management',
      'schedule',
      'chat',
      'emergency_protocols',
      'custom_services'
    ],
    icon: '🚑',
    category: 'healthcare',
  },
  'pet_breeder': {
    vendorTypes: ['seller', 'service_provider'],
    serviceStyles: ['at_center', 'at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      ...BASE_CAPABILITIES,
      'catalog',
      'pet_profiles',
      'bookings',
      'chat',
      'facility_management',
      'schedule',
      'custom_services',
      'gallery'
    ],
    icon: '🐶',
    category: 'retail',
  },
  // ============================================================================
  // DIAGNOSTICS ROLE - For home sample collection services
  // ============================================================================
  'diagnostics': {
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['at_home', 'at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      ...BASE_CAPABILITIES,
      'bookings',
      'diagnostics',
      'diagnostic_lab',
      'medical_records',
      'gps_tracking',
      'live_location',
      'chat',
      'staff',
      'facility_management',
      'schedule',
      'custom_services'
    ],
    icon: '🔬',
    category: 'healthcare',
  },
};

// Standard onboarding form fields (applied to all roles by default)
const STANDARD_ONBOARDING_FIELDS = [
  {
    fieldName: 'businessName',
    label: 'Business Name',
    type: 'text',
    section: 'business_information',
    isMandatory: true,
    displayOrder: 1,
  },
  {
    fieldName: 'fullName',
    label: 'Contact Person Name',
    type: 'text',
    section: 'business_information',
    isMandatory: true,
    displayOrder: 2,
  },
  {
    fieldName: 'phone',
    label: 'Phone Number',
    type: 'phone',
    section: 'business_information',
    isMandatory: true,
    displayOrder: 3,
  },
  {
    fieldName: 'email',
    label: 'Email',
    type: 'email',
    section: 'business_information',
    isMandatory: true,
    displayOrder: 4,
  },
  {
    fieldName: 'businessType',
    label: 'Business Type',
    type: 'dropdown',
    section: 'business_information',
    isMandatory: true,
    options: ['Solo Practitioner', 'Clinic', 'Home Service', 'Mobile Unit'],
    displayOrder: 5,
  },
  {
    fieldName: 'address',
    label: 'Address',
    type: 'textarea',
    section: 'location_information',
    isMandatory: true,
    displayOrder: 6,
  },
  {
    fieldName: 'city',
    label: 'City',
    type: 'text',
    section: 'location_information',
    isMandatory: true,
    displayOrder: 7,
  },
  {
    fieldName: 'state',
    label: 'State',
    type: 'text',
    section: 'location_information',
    isMandatory: true,
    displayOrder: 8,
  },
  {
    fieldName: 'pin',
    label: 'PIN Code',
    type: 'text',
    section: 'location_information',
    isMandatory: true,
    displayOrder: 9,
  },
  {
    fieldName: 'gstNumber',
    label: 'GST Number',
    type: 'text',
    section: 'business_information',
    isMandatory: false,
    displayOrder: 10,
  },
];

// Standard service catalog entries (applied to roles based on serviceStyles)
// Maps serviceStyles from role definitions to actual service catalog entries
const STANDARD_SERVICE_CATALOG: Record<string, any[]> = {
  'at_home': [
    { serviceName: 'Home Visit Consultation', basePrice: 500, duration: 60, serviceStyle: 'at_home' },
    { serviceName: 'Home Service', basePrice: 800, duration: 90, serviceStyle: 'at_home' },
  ],
  'home_visit': [ // Alias for at_home
    { serviceName: 'Home Visit Consultation', basePrice: 500, duration: 60, serviceStyle: 'at_home' },
    { serviceName: 'Home Service', basePrice: 800, duration: 90, serviceStyle: 'at_home' },
  ],
  'at_center': [
    { serviceName: 'Clinic Visit', basePrice: 300, duration: 30, serviceStyle: 'at_center' },
    { serviceName: 'Center Service', basePrice: 600, duration: 60, serviceStyle: 'at_center' },
  ],
  'at_clinic': [ // Alias for at_center
    { serviceName: 'Clinic Visit', basePrice: 300, duration: 30, serviceStyle: 'at_center' },
    { serviceName: 'Center Service', basePrice: 600, duration: 60, serviceStyle: 'at_center' },
  ],
  'video_consultation': [
    { serviceName: 'Video Consultation', basePrice: 400, duration: 30, serviceStyle: 'video_consultation' },
    { serviceName: 'Tele Consultation', basePrice: 350, duration: 30, serviceStyle: 'video_consultation' },
  ],
  'tele': [
    { serviceName: 'Tele Consultation', basePrice: 350, duration: 30, serviceStyle: 'tele' },
  ],
  'online': [
    { serviceName: 'Online Service', basePrice: 200, duration: 15, serviceStyle: 'online' },
  ],
  'delivery': [
    { serviceName: 'Home Delivery', basePrice: 50, duration: 0, serviceStyle: 'delivery' },
  ],
  'pickup': [
    { serviceName: 'Store Pickup', basePrice: 0, duration: 0, serviceStyle: 'pickup' },
  ],
  'outdoor': [
    { serviceName: 'Outdoor Service', basePrice: 600, duration: 60, serviceStyle: 'outdoor' },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function seedOnboardingForm(roleId: string): Promise<boolean> {
  try {
    // Check if onboarding_forms table exists, create if not (match schema from onboarding-form-management.ts)
    await query(`
      CREATE TABLE IF NOT EXISTS onboarding_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id VARCHAR(255) UNIQUE NOT NULL,
        fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'active',
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_onboarding_forms_role_id ON onboarding_forms(role_id);
      
      -- Add is_active column if it doesn't exist (for compatibility)
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'onboarding_forms' AND column_name = 'is_active'
        ) THEN
          ALTER TABLE onboarding_forms ADD COLUMN is_active BOOLEAN DEFAULT true;
          CREATE INDEX IF NOT EXISTS idx_onboarding_forms_is_active ON onboarding_forms(is_active);
        END IF;
      END $$;
    `).catch((error) => {
      // Expected: ignore if column already exists
      if (error instanceof Error && !error.message.includes('already exists')) {
        console.warn('[ROLE-SEEDING] Unexpected error adding is_active column:', error.message);
      }
    }); // Ignore if already exists

    // Check if form already exists
    const existingForm = await select('onboarding_forms', { role_id: roleId });
    
    const fields = STANDARD_ONBOARDING_FIELDS.map((f, idx) => ({
      id: `field_${roleId}_${idx + 1}`,
      fieldName: f.fieldName,
      label: f.label,
      type: f.type,
      section: f.section,
      isMandatory: f.isMandatory,
      requiresDocument: false,
      placeholder: '',
      helpText: '',
      options: f.options || [],
      validation: {},
      displayOrder: f.displayOrder || idx + 1,
      isActive: true,
      defaultValue: '',
      dependsOn: null,
    }));

    if (existingForm.length > 0) {
      // Update existing form with standard fields
      // Use both status and is_active for compatibility
      const updateData: any = {
        fields: fields,
        version: 1,
        updated_at: new Date().toISOString(),
      };
      // Try to set both status and is_active (one might not exist, that's ok)
      updateData.status = 'active';
      try {
        updateData.is_active = true;
        await update('onboarding_forms', { role_id: roleId }, updateData);
      } catch (err: any) {
        // If is_active doesn't exist, just use status
        if (err.message && err.message.includes('is_active')) {
          delete updateData.is_active;
          await update('onboarding_forms', { role_id: roleId }, updateData);
        } else {
          throw err;
        }
      }
      return false; // Updated, not created
    } else {
      // Create new form - use status (required) and is_active (if exists)
      const insertData: any = {
        role_id: roleId,
        fields: fields,
        version: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Try to add is_active (column might not exist)
      try {
        insertData.is_active = true;
        await insert('onboarding_forms', insertData);
      } catch (err: any) {
        // If is_active doesn't exist, just use status
        if (err.message && err.message.includes('is_active')) {
          delete insertData.is_active;
          await insert('onboarding_forms', insertData);
        } else {
          throw err;
        }
      }
      return true; // Created
    }
  } catch (error: any) {
    console.error(`Error seeding onboarding form for ${roleId}:`, error);
    return false; // Error occurred
  }
}

async function seedServiceCatalog(roleId: string, serviceStyles: string[]): Promise<number> {
  let createdCount = 0;
  try {
    // Check if service_catalog table exists, create if not (with correct schema matching admin-advanced.ts migration)
    await query(`
      CREATE TABLE IF NOT EXISTS service_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id TEXT UNIQUE,
        role_id VARCHAR(255),
        service_name VARCHAR(255) NOT NULL,
        display_name TEXT,
        description TEXT,
        category_id TEXT,
        category_name TEXT,
        sub_category_id TEXT,
        sub_category_name TEXT,
        applicable_roles TEXT[] NOT NULL DEFAULT '{}',
        service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'at_clinic', 'tele', 'video_consultation', 'home_visit', 'online', 'delivery', 'pickup', 'outdoor', 'all')),
        base_price DECIMAL(10, 2) DEFAULT 0,
        duration_minutes INTEGER DEFAULT 30,
        duration INTEGER DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
        publish_status TEXT DEFAULT 'published' CHECK (publish_status IN ('draft', 'published', 'archived')),
        is_active BOOLEAN DEFAULT true,
        metadata JSONB,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category_id);
      CREATE INDEX IF NOT EXISTS idx_service_catalog_sub_category ON service_catalog(sub_category_id);
      CREATE INDEX IF NOT EXISTS idx_service_catalog_applicable_roles ON service_catalog USING gin(applicable_roles);
      CREATE INDEX IF NOT EXISTS idx_service_catalog_service_style ON service_catalog(service_style);
      CREATE INDEX IF NOT EXISTS idx_service_catalog_status ON service_catalog(status, publish_status);
      CREATE INDEX IF NOT EXISTS idx_service_catalog_role_id ON service_catalog(role_id);
    `).catch((error) => {
      // Expected: ignore if column already exists
      if (error instanceof Error && !error.message.includes('already exists')) {
        console.warn('[ROLE-SEEDING] Unexpected error adding is_active column:', error.message);
      }
    }); // Ignore if already exists

    // Get existing services for this role (using applicable_roles array, role_id is optional)
    let existingServices: any[] = [];
    try {
      // First try with applicable_roles (primary method)
      const result = await query(
        `SELECT * FROM service_catalog WHERE $1 = ANY(applicable_roles)`,
        [roleId]
      );
      existingServices = result.rows || [];
    } catch (err: any) {
      // If that fails, try with role_id if column exists
      try {
        const result = await query(
          `SELECT * FROM service_catalog WHERE role_id = $1`,
          [roleId]
        );
        existingServices = result.rows || [];
      } catch (err2: any) {
        console.warn(`Could not query existing services for role ${roleId}:`, err2.message);
        existingServices = [];
      }
    }

    // Create services for each service style
    console.log(`Seeding service catalog for role ${roleId} with styles:`, serviceStyles);
    for (const style of serviceStyles) {
      // Map service style variants (at_clinic -> at_center, home_visit -> at_home)
      const mappedStyle = style === 'at_clinic' ? 'at_center' : (style === 'home_visit' ? 'at_home' : style);
      const catalogEntries = STANDARD_SERVICE_CATALOG[style] || STANDARD_SERVICE_CATALOG[mappedStyle] || [];
      
      console.log(`Style ${style} (mapped: ${mappedStyle}) has ${catalogEntries.length} entries`);
      
      if (catalogEntries.length === 0) {
        console.warn(`No catalog entries found for style: ${style} (mapped: ${mappedStyle})`);
        continue;
      }
      
      for (const entry of catalogEntries) {
        // Check if service already exists (by service_name and service_style and role)
        const exists = existingServices.some((s: any) => 
          s.service_name === entry.serviceName && 
          (s.service_style === entry.serviceStyle || s.service_style === mappedStyle) &&
          (s.role_id === roleId || (s.applicable_roles && Array.isArray(s.applicable_roles) && s.applicable_roles.includes(roleId)))
        );

        if (!exists) {
          const serviceId = `svc_${roleId}_${entry.serviceStyle || mappedStyle}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          try {
            // Use applicable_roles array (primary) and role_id (if column exists, for backward compatibility)
            // ✅ FIX: Include role mappings in applicable_roles for better matching (align with service-catalog roleMappings)
            const roleMappings: Record<string, string[]> = {
              'pet_trainer': ['pet_trainer', 'trainer'],
              'pet_walker': ['pet_walker', 'walker', 'dog_walker'],
              'walker': ['walker', 'pet_walker', 'dog_walker'],
              'pet_groomer': ['pet_groomer', 'groomer'],
              'veterinarian': ['veterinarian', 'vet'],
            };
            const mappedRoles = roleMappings[roleId] || [roleId];
            const applicableRoles = [roleId, ...mappedRoles.filter(r => r !== roleId)]; // Ensure roleId is first, then mapped roles
            
            // Ensure every catalog entry has a category so nothing appears uncategorized in service management
            const roleDef = STANDARD_ROLE_DEFINITIONS[roleId];
            const categorySlug = (roleDef?.category || 'general').replace(/\s+/g, '_');
            const categoryName = categorySlug.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            
            const insertData: any = {
              service_id: serviceId,
              service_name: entry.serviceName,
              display_name: entry.serviceName,
              description: `${entry.serviceName} for ${KNOWN_ROLE_NAMES[roleId] || roleId}`,
              base_price: entry.basePrice || 0,
              duration_minutes: entry.duration || 30,
              service_style: entry.serviceStyle || mappedStyle,
              applicable_roles: applicableRoles, // ✅ Include both roleId and mapped roles (e.g., ['pet_trainer', 'trainer'])
              status: 'active',
              publish_status: 'published',
              display_order: 0,
              category_id: categorySlug,
              category_name: categoryName,
            };
            
            // Add optional columns if they exist in table
            // These will be ignored if columns don't exist (INSERT will still work)
            insertData.role_id = roleId; // For backward compatibility if column exists
            insertData.duration = entry.duration || 30; // For compatibility
            insertData.is_active = true; // For compatibility
            
            const insertResult = await insert('service_catalog', insertData);
            console.log(`Created service: ${entry.serviceName} for role ${roleId}`);
            createdCount++;
          } catch (err: any) {
            // If error is about missing columns, try without optional columns
            if (err.message && (err.message.includes('column') || err.message.includes('does not exist'))) {
              console.warn(`Retrying insert without optional columns for ${entry.serviceName}:`, err.message);
              try {
                // Retry with minimal required columns only
                // ✅ FIX: Include role mappings in applicable_roles (same as above)
                const roleMappings: Record<string, string[]> = {
                  'pet_trainer': ['pet_trainer', 'trainer'],
                  'pet_walker': ['pet_walker', 'walker', 'dog_walker'],
                  'walker': ['walker', 'pet_walker', 'dog_walker'],
                  'pet_groomer': ['pet_groomer', 'groomer'],
                  'veterinarian': ['veterinarian', 'vet'],
                };
                const mappedRoles = roleMappings[roleId] || [roleId];
                const applicableRoles = [roleId, ...mappedRoles.filter(r => r !== roleId)];
                
                const roleDefMin = STANDARD_ROLE_DEFINITIONS[roleId];
                const catSlug = (roleDefMin?.category || 'general').replace(/\s+/g, '_');
                const catName = catSlug.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                await insert('service_catalog', {
                  service_id: serviceId,
                  service_name: entry.serviceName,
                  display_name: entry.serviceName,
                  description: `${entry.serviceName} for ${KNOWN_ROLE_NAMES[roleId] || roleId}`,
                  base_price: entry.basePrice || 0,
                  duration_minutes: entry.duration || 30,
                  service_style: entry.serviceStyle || mappedStyle,
                  applicable_roles: applicableRoles, // ✅ Include both roleId and mapped roles
                  status: 'active',
                  publish_status: 'published',
                  display_order: 0,
                  category_id: catSlug,
                  category_name: catName,
                });
                console.log(`Created service (minimal columns): ${entry.serviceName} for role ${roleId}`);
                createdCount++;
              } catch (retryErr: any) {
                console.error(`Error creating service catalog entry for ${roleId} ${entry.serviceName} (retry failed):`, retryErr.message || retryErr);
              }
            } else {
              console.error(`Error creating service catalog entry for ${roleId} ${entry.serviceName}:`, err.message || err);
            }
          }
        } else {
          console.log(`Service ${entry.serviceName} already exists for role ${roleId}`);
        }
      }
    }
    console.log(`Created ${createdCount} services for role ${roleId}`);
  } catch (error: any) {
    console.error(`Error seeding service catalog for role ${roleId}:`, error);
  }
  return createdCount;
}

// ============================================================================
// EXPORT
// ============================================================================

export function registerRoleSeedingEndpoints(app: Hono) {
  /**
   * POST /admin/roles/seed
   * By default (updateOnly=true): only updates existing roles (config, display_name, description); never creates; does not change is_active or is_system_role.
   * ?updateOnly=false: full seed (create missing roles, update existing, seed forms/catalogs).
   */
  app.post('/admin/roles/seed', async (c) => {
    try {
      const stats = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[],
      };

      // Query param: updateOnly=true = only update existing roles, never create; only touch config/display fields; preserve is_active, is_system_role
      const updateOnly = (c.req.query('updateOnly') ?? 'true') === 'true';

      const definitionsToSeed = getDefinitionsForCanonicalRolesOnly();
      for (const [roleId, def] of Object.entries(definitionsToSeed)) {
        try {
          const existing = await select('roles', { name: roleId });

          if (existing.length === 0) {
            // Do not create new roles when updateOnly
            if (updateOnly) {
              stats.skipped++;
              continue;
            }
            // Legacy full-seed path: create new role (only when updateOnly=false)
            const roleData: any = {
              name: roleId,
              display_name: CANONICAL_ROLE_DISPLAY_NAMES[roleId] || KNOWN_ROLE_NAMES[roleId] || roleId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              description: `Standard ${KNOWN_ROLE_NAMES[roleId] || roleId} role`,
              is_system_role: true,
              is_active: true,
              config: {
                category: def.category || 'general',
                icon: def.icon || '🔧',
                vendorTypes: def.vendorTypes || [],
                serviceStyles: def.serviceStyles || [],
                pricingControl: def.pricingControl || { canControlPrice: false, canControlDuration: false },
              },
            };
            const newRole = await insert('roles', roleData);
            if (def.capabilities?.length) {
              for (const capName of def.capabilities) {
                await insert('role_permissions', { role_id: newRole[0].id, permission_name: capName, resource: '*', action: '*' }).catch(() => {});
              }
            }
            stats.created++;
            continue;
          }

          // Update existing role only: required config fields; do not change is_active or is_system_role
          const current = existing[0] as any;
          const currentConfig = (current.config && typeof current.config === 'object') ? current.config : {};
          const updateData: any = {
            display_name: CANONICAL_ROLE_DISPLAY_NAMES[roleId] ?? KNOWN_ROLE_NAMES[roleId] ?? current.display_name ?? roleId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            description: current.description ?? `Standard ${CANONICAL_ROLE_DISPLAY_NAMES[roleId] || KNOWN_ROLE_NAMES[roleId] || roleId} role`,
            config: {
              ...currentConfig,
              category: def.category ?? currentConfig.category ?? 'general',
              icon: def.icon ?? currentConfig.icon ?? '🔧',
              vendorTypes: def.vendorTypes ?? currentConfig.vendorTypes ?? [],
              serviceStyles: def.serviceStyles ?? currentConfig.serviceStyles ?? [],
              pricingControl: def.pricingControl ?? currentConfig.pricingControl ?? { canControlPrice: false, canControlDuration: false },
            },
          };
          await update('roles', { name: roleId }, updateData);
          stats.updated++;
        } catch (error: any) {
          console.error(`Error seeding role ${roleId}:`, error);
          stats.errors.push(`${roleId}: ${error.message}`);
          stats.skipped++;
        }
      }

      return c.json({
        success: true,
        message: updateOnly ? 'Roles update completed (existing only; status preserved)' : 'Roles seeding completed',
        stats,
        totalRoles: Object.keys(definitionsToSeed).length,
      });
    } catch (error: any) {
      console.error('Error seeding roles:', error);
      return c.json({ error: `Seeding failed: ${error.message}` }, 500);
    }
  });

  /**
   * POST /admin/roles/resurrect
   * Nuclear option: Delete all system roles and re-seed from standard definitions
   */
  app.post('/admin/roles/resurrect', async (c) => {
    try {
      // Delete all existing system roles
      await query('DELETE FROM roles WHERE is_system_role = true').catch((error) => {
        console.warn('[ROLE-SEEDING] Error deleting system roles:', error instanceof Error ? error.message : 'Unknown error');
      });
      
      // Delete all role permissions for system roles
      await query('DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system_role = true)').catch((error) => {
        console.warn('[ROLE-SEEDING] Error deleting role permissions:', error instanceof Error ? error.message : 'Unknown error');
      });
      
      // Re-seed all roles by calling the seed endpoint logic
      const stats = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[],
      };

      const definitionsToResurrect = getDefinitionsForCanonicalRolesOnly();
      for (const [roleId, def] of Object.entries(definitionsToResurrect)) {
        try {
          const roleData: any = {
            name: roleId,
            display_name: CANONICAL_ROLE_DISPLAY_NAMES[roleId] || KNOWN_ROLE_NAMES[roleId] || roleId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            description: `Standard ${CANONICAL_ROLE_DISPLAY_NAMES[roleId] || KNOWN_ROLE_NAMES[roleId] || roleId} role`,
            is_system_role: true,
            is_active: true,
            config: {
              category: def.category || 'general',
              icon: def.icon || '🔧',
              vendorTypes: def.vendorTypes || [],
              serviceStyles: def.serviceStyles || [],
              pricingControl: def.pricingControl || {
                canControlPrice: false,
                canControlDuration: false,
              },
            },
          };

          const newRole = await insert('roles', roleData);
          const roleRecordId = newRole[0].id;
          
          // Insert capabilities
          if (def.capabilities && def.capabilities.length > 0) {
            for (const capName of def.capabilities) {
              await insert('role_permissions', {
                role_id: roleRecordId,
                permission_name: capName,
                resource: '*',
                action: '*',
              }).catch(err => console.error(`Error adding capability ${capName} to role ${roleId}:`, err));
            }
          }
          stats.created++;

          // Seed onboarding form for this role
          await seedOnboardingForm(roleId);

          // Seed service catalog for this role
          await seedServiceCatalog(roleId, def.serviceStyles || []);

        } catch (error: any) {
          console.error(`Error resurrecting role ${roleId}:`, error);
          stats.errors.push(`${roleId}: ${error.message}`);
          stats.skipped++;
        }
      }

      return c.json({
        success: true,
        message: 'Roles resurrection completed',
        stats,
        totalRoles: Object.keys(definitionsToResurrect).length,
      });
    } catch (error: any) {
      console.error('Error resurrecting roles:', error);
      return c.json({ error: `Resurrection failed: ${error.message}` }, 500);
    }
  });
}
