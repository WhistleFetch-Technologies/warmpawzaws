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

const STANDARD_ROLE_DEFINITIONS: Record<string, any> = {
  'veterinarian': {
    vendorTypes: ['healthcare_provider'],
    serviceStyles: ['at_clinic', 'video_consultation', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'prescription',
      'medical_records',
      'booking',
      'chat',
      'staff_management',
      'tele',
      'emergency',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
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
      'prescription',
      'medical_records',
      'booking',
      'chat',
      'staff_management',
      'tele',
      'emergency',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
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
      'booking',
      'portfolio',
      'gallery',
      'chat',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management'
    ],
    icon: '✂️',
    category: 'service_provider',
  },
  'pet_boarding': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking',
      'cctv_access',
      'photo_updates',
      'chat',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'room_management',
      'nightly_pricing',
      'occupancy_tracking'
    ],
    icon: '🏨',
    category: 'service_provider',
  },
  'pet_resort': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking',
      'cctv_access',
      'photo_updates',
      'chat',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'room_management',
      'nightly_pricing',
      'occupancy_tracking'
    ],
    icon: '🏝️',
    category: 'service_provider',
  },
  'pet_walker': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'gps_tracking',
      'photo_updates',
      'booking',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'chat'
    ],
    icon: '🦮',
    category: 'service_provider',
  },
  'pet_trainer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center', 'online'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking',
      'progress_tracking',
      'chat',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management'
    ],
    icon: '🎾',
    category: 'service_provider',
  },
  'pet_behaviorist': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home', 'at_center', 'video_consultation'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking',
      'progress_tracking',
      'chat',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'tele'
    ],
    icon: '🧠',
    category: 'service_provider',
  },
  'pet_sitter': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking',
      'photo_updates',
      'chat',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'staff_management'
    ],
    icon: '🏠',
    category: 'service_provider',
  },
  'pet_taxi': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking',
      'gps_tracking',
      'emergency',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'distance_pricing',
      'chat'
    ],
    icon: '🚕',
    category: 'service_provider',
  },
  'pet_products_store': {
    vendorTypes: ['seller'],
    serviceStyles: ['delivery', 'pickup'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'catalog',
      'inventory',
      'orders',
      'delivery',
      'staff_management',
      'facility_management',
      'schedule_management'
    ],
    icon: '🛍️',
    category: 'retail',
  },
  'pet_pharmacy': {
    vendorTypes: ['seller', 'healthcare_provider'],
    serviceStyles: ['delivery', 'pickup'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'catalog',
      'inventory',
      'prescription',
      'delivery',
      'staff_management',
      'facility_management',
      'schedule_management',
      'prescription_verification',
      'controlled_substances',
      'expiry_management'
    ],
    icon: '💊',
    category: 'healthcare',
  },
  'pet_cafe': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking',
      'menu',
      'events',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'table_management',
      'pax_management',
      'chat'
    ],
    icon: '☕',
    category: 'hospitality',
  },
  'pet_photographer': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'at_home', 'outdoor'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking',
      'portfolio',
      'gallery',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'chat'
    ],
    icon: '📸',
    category: 'service_provider',
  },
  'pet_shelter': {
    vendorTypes: ['service_provider', 'ngo'],
    serviceStyles: ['at_center'],
    pricingControl: { canControlPrice: false, canControlDuration: false },
    capabilities: [
      'adoption',
      'donation',
      'events',
      'staff_management',
      'facility_management',
      'schedule_management',
      'chat'
    ],
    icon: '🏠',
    category: 'specialist',
  },
  'event_organizer': {
    vendorTypes: ['service_provider', 'ngo', 'organization'],
    serviceStyles: ['at_center', 'outdoor'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'events',
      'booking',
      'staff_management',
      'facility_management',
      'schedule_management',
      'chat',
      'custom_services',
      'package_management'
    ],
    icon: '📅',
    category: 'specialist',
  },
  'pet_sunset_services': {
    vendorTypes: ['service_provider'],
    serviceStyles: ['at_center', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking',
      'memorial',
      'counseling',
      'staff_management',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'chat'
    ],
    icon: '🌅',
    category: 'specialist',
  },
  'nutritionist': {
    vendorTypes: ['healthcare_provider', 'service_provider'],
    serviceStyles: ['at_center', 'video_consultation', 'home_visit'],
    pricingControl: { canControlPrice: true, canControlDuration: true },
    capabilities: [
      'booking',
      'chat',
      'staff_management',
      'tele',
      'facility_management',
      'schedule_management',
      'custom_services',
      'package_management',
      'meal_plans',
      'diet_charts',
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
      'chat',
      'staff_management',
      'facility_management',
      'schedule_management',
      'policy_management',
      'claims_management'
    ],
    icon: '🛡️',
    category: 'service_provider',
  },
  'pet_ambulance': {
    vendorTypes: ['healthcare_provider', 'service_provider'],
    serviceStyles: ['at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'booking',
      'gps_tracking',
      'emergency',
      'facility_management',
      'schedule_management',
      'chat',
      'emergency_protocols'
    ],
    icon: '🚑',
    category: 'healthcare',
  },
  'pet_breeder': {
    vendorTypes: ['seller', 'service_provider'],
    serviceStyles: ['at_center', 'at_home'],
    pricingControl: { canControlPrice: true, canControlDuration: false },
    capabilities: [
      'catalog',
      'booking',
      'chat',
      'facility_management',
      'schedule_management',
      'custom_services'
    ],
    icon: '🐶',
    category: 'retail',
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
    `).catch(() => {}); // Ignore if already exists

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
    `).catch(() => {}); // Ignore if already exists

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
            const insertData: any = {
              service_id: serviceId,
              service_name: entry.serviceName,
              display_name: entry.serviceName,
              description: `${entry.serviceName} for ${KNOWN_ROLE_NAMES[roleId] || roleId}`,
              base_price: entry.basePrice || 0,
              duration_minutes: entry.duration || 30,
              service_style: entry.serviceStyle || mappedStyle,
              applicable_roles: [roleId], // Primary way to link to role
              status: 'active',
              publish_status: 'published',
              display_order: 0,
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
                await insert('service_catalog', {
                  service_id: serviceId,
                  service_name: entry.serviceName,
                  display_name: entry.serviceName,
                  description: `${entry.serviceName} for ${KNOWN_ROLE_NAMES[roleId] || roleId}`,
                  base_price: entry.basePrice || 0,
                  duration_minutes: entry.duration || 30,
                  service_style: entry.serviceStyle || mappedStyle,
                  applicable_roles: [roleId],
                  status: 'active',
                  publish_status: 'published',
                  display_order: 0,
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
   * Seed all 20 standard roles with configurations, onboarding forms, and service catalogs
   */
  app.post('/admin/roles/seed', async (c) => {
    try {
      const stats = {
        created: 0,
        updated: 0,
        skipped: 0,
        formsCreated: 0,
        catalogsCreated: 0,
        errors: [] as string[],
      };

      for (const [roleId, def] of Object.entries(STANDARD_ROLE_DEFINITIONS)) {
        try {
          // Check if role exists
          const existing = await select('roles', { name: roleId });
          
          const roleData: any = {
            name: roleId,
            display_name: KNOWN_ROLE_NAMES[roleId] || roleId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            description: `Standard ${KNOWN_ROLE_NAMES[roleId] || roleId} role`,
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

          let roleRecordId: string;

          if (existing.length > 0) {
            // Update existing role
            await update('roles', { name: roleId }, roleData);
            roleRecordId = existing[0].id;
            stats.updated++;
          } else {
            // Create new role
            const newRole = await insert('roles', roleData);
            roleRecordId = newRole[0].id;
            
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
          }

          // Seed onboarding form for this role
          const formCreated = await seedOnboardingForm(roleId);
          if (formCreated) stats.formsCreated++;

          // Seed service catalog for this role
          const catalogCount = await seedServiceCatalog(roleId, def.serviceStyles || []);
          stats.catalogsCreated += catalogCount;

        } catch (error: any) {
          console.error(`Error seeding role ${roleId}:`, error);
          stats.errors.push(`${roleId}: ${error.message}`);
          stats.skipped++;
        }
      }

      return c.json({
        success: true,
        message: 'Roles seeding completed',
        stats,
        totalRoles: Object.keys(STANDARD_ROLE_DEFINITIONS).length,
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
      await query('DELETE FROM roles WHERE is_system_role = true').catch(() => {});
      
      // Delete all role permissions for system roles
      await query('DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system_role = true)').catch(() => {});
      
      // Re-seed all roles by calling the seed endpoint logic
      const stats = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const [roleId, def] of Object.entries(STANDARD_ROLE_DEFINITIONS)) {
        try {
          const roleData: any = {
            name: roleId,
            display_name: KNOWN_ROLE_NAMES[roleId] || roleId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            description: `Standard ${KNOWN_ROLE_NAMES[roleId] || roleId} role`,
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
        totalRoles: Object.keys(STANDARD_ROLE_DEFINITIONS).length,
      });
    } catch (error: any) {
      console.error('Error resurrecting roles:', error);
      return c.json({ error: `Resurrection failed: ${error.message}` }, 500);
    }
  });
}
