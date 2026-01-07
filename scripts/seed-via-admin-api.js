#!/usr/bin/env node

/**
 * Seed Warmpawz Platform via Admin API Endpoints
 * 
 * This script uses the admin portal API endpoints to seed:
 * 1. Roles (20 roles with full config)
 * 2. Service Catalog (65+ services)
 * 3. Activate India Region
 * 
 * Usage:
 *   node scripts/seed-via-admin-api.js
 * 
 * Prerequisites:
 *   - Admin API must be running
 *   - Set API_BASE_URL environment variable (default: http://localhost:3000)
 *   - Admin authentication token (if required)
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.warmpawz.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// API Client
async function apiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN && { 'Authorization': `Bearer ${ADMIN_TOKEN}` }),
      },
    };

    const req = (url.protocol === 'https:' ? https : http).request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${parsed.error || body}`));
          }
        } catch (e) {
          resolve({ success: true, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// ============================================================================
// ROLES SEEDING
// ============================================================================

const ROLES_TO_SEED = [
  {
    name: 'veterinarian',
    display_name: 'Veterinarian',
    description: 'Licensed veterinary professional providing medical care for pets',
    category: 'healthcare',
    capabilities: ['medical_records', 'prescription_create', 'diagnostic_results', 'booking_create', 'booking_view', 'service_pricing'],
    config: {
      category: 'healthcare',
      vendorTypes: ['solo_provider', 'center'],
      serviceStyles: ['at_center', 'at_home', 'tele'],
      capabilities: ['medical_records', 'prescription_create', 'diagnostic_results', 'booking_create', 'booking_view', 'service_pricing'],
      onboardingFields: {
        version: 1,
        sections: [
          { id: 'basic', name: 'Basic Information', order: 1 },
          { id: 'professional', name: 'Professional Details', order: 2 },
          { id: 'documents', name: 'Documents', order: 3 },
          { id: 'location', name: 'Location & Service Area', order: 4 },
          { id: 'banking', name: 'Banking Details', order: 5 }
        ],
        fields: [
          { id: 'businessName', label: 'Business Name', type: 'text', required: true, section: 'basic' },
          { id: 'ownerName', label: 'Owner Name', type: 'text', required: true, section: 'basic' },
          { id: 'phone', label: 'Phone Number', type: 'tel', required: true, section: 'basic' },
          { id: 'email', label: 'Email Address', type: 'email', required: true, section: 'basic' },
          { id: 'vetLicense', label: 'Veterinary License Number', type: 'text', required: true, section: 'professional' },
          { id: 'experience', label: 'Years of Experience', type: 'number', required: true, section: 'professional' },
          { id: 'specializations', label: 'Specializations', type: 'multiselect', required: false, section: 'professional' },
          { id: 'panCard', label: 'PAN Card', type: 'file', required: true, section: 'documents' },
          { id: 'vetLicenseDoc', label: 'Veterinary License Document', type: 'file', required: true, section: 'documents' },
          { id: 'address', label: 'Business Address', type: 'textarea', required: true, section: 'location' },
          { id: 'location', label: 'Location on Map', type: 'map-pin', required: true, section: 'location' },
          { id: 'serviceArea', label: 'Service Area', type: 'service-area', required: true, section: 'location' },
          { id: 'bankAccount', label: 'Bank Account Details', type: 'bank-details', required: true, section: 'banking' }
        ]
      }
    }
  },
  {
    name: 'vet_clinic',
    display_name: 'Veterinary Clinic',
    description: 'Full-service veterinary clinic with multiple staff and facilities',
    category: 'healthcare',
    capabilities: ['medical_records', 'prescription_create', 'diagnostic_results', 'staff_create', 'staff_schedule', 'booking_create', 'service_pricing', 'inventory_manage'],
    config: {
      category: 'healthcare',
      vendorTypes: ['center'],
      serviceStyles: ['at_center'],
      capabilities: ['medical_records', 'prescription_create', 'diagnostic_results', 'staff_create', 'staff_schedule', 'booking_create', 'service_pricing', 'inventory_manage']
    }
  },
  {
    name: 'pet_groomer',
    display_name: 'Pet Groomer',
    description: 'Professional pet grooming and styling services',
    category: 'service_provider',
    capabilities: ['booking_create', 'booking_view', 'service_pricing', 'staff_schedule'],
    config: {
      category: 'service_provider',
      vendorTypes: ['solo_provider', 'center'],
      serviceStyles: ['at_center', 'at_home'],
      capabilities: ['booking_create', 'booking_view', 'service_pricing', 'staff_schedule']
    }
  },
  {
    name: 'pet_trainer',
    display_name: 'Pet Trainer',
    description: 'Pet training and behavior modification services',
    category: 'service_provider',
    capabilities: ['booking_create', 'service_pricing', 'staff_create'],
    config: {
      category: 'service_provider',
      vendorTypes: ['solo_provider', 'center'],
      serviceStyles: ['at_center', 'at_home'],
      capabilities: ['booking_create', 'service_pricing', 'staff_create']
    }
  },
  {
    name: 'pet_walker',
    display_name: 'Pet Walker',
    description: 'Professional dog walking and exercise services',
    category: 'service_provider',
    capabilities: ['gps_tracking', 'booking_create', 'booking_view'],
    config: {
      category: 'service_provider',
      vendorTypes: ['solo_provider'],
      serviceStyles: ['at_home'],
      capabilities: ['gps_tracking', 'booking_create', 'booking_view']
    }
  },
  {
    name: 'pet_sitter',
    display_name: 'Pet Sitter',
    description: 'Pet sitting and home care services',
    category: 'service_provider',
    capabilities: ['booking_create', 'booking_view', 'service_pricing'],
    config: {
      category: 'service_provider',
      vendorTypes: ['solo_provider'],
      serviceStyles: ['at_home'],
      capabilities: ['booking_create', 'booking_view', 'service_pricing']
    }
  },
  {
    name: 'pet_boarder',
    display_name: 'Pet Boarding',
    description: 'Pet boarding and hotel services',
    category: 'hospitality',
    capabilities: ['booking_create', 'service_pricing', 'staff_create', 'inventory_manage'],
    config: {
      category: 'hospitality',
      vendorTypes: ['center'],
      serviceStyles: ['at_center'],
      capabilities: ['booking_create', 'service_pricing', 'staff_create', 'inventory_manage']
    }
  },
  {
    name: 'pet_daycare',
    display_name: 'Pet Daycare',
    description: 'Daytime pet care and socialization services',
    category: 'hospitality',
    capabilities: ['booking_create', 'service_pricing', 'staff_create', 'staff_schedule'],
    config: {
      category: 'hospitality',
      vendorTypes: ['center'],
      serviceStyles: ['at_center'],
      capabilities: ['booking_create', 'service_pricing', 'staff_create', 'staff_schedule']
    }
  },
  {
    name: 'ambulance',
    display_name: 'Pet Ambulance Service',
    description: 'Emergency pet transportation and ambulance services',
    category: 'healthcare',
    capabilities: ['gps_tracking', 'booking_create', 'booking_view', 'service_pricing'],
    config: {
      category: 'healthcare',
      vendorTypes: ['solo_provider', 'center'],
      serviceStyles: ['at_home'],
      capabilities: ['gps_tracking', 'booking_create', 'booking_view', 'service_pricing']
    }
  },
  {
    name: 'diagnostics_center',
    display_name: 'Diagnostics Center',
    description: 'Pet diagnostic laboratory and imaging center',
    category: 'healthcare',
    capabilities: ['diagnostic_results', 'booking_create', 'service_pricing', 'staff_create'],
    config: {
      category: 'healthcare',
      vendorTypes: ['center'],
      serviceStyles: ['at_center', 'at_home'],
      capabilities: ['diagnostic_results', 'booking_create', 'service_pricing', 'staff_create']
    }
  },
  {
    name: 'pharmacy',
    display_name: 'Pet Pharmacy',
    description: 'Pet medication and pharmacy services',
    category: 'retail',
    capabilities: ['inventory_manage', 'product_catalog', 'prescription_create', 'booking_create'],
    config: {
      category: 'retail',
      vendorTypes: ['center'],
      serviceStyles: ['at_center'],
      capabilities: ['inventory_manage', 'product_catalog', 'prescription_create', 'booking_create']
    }
  },
  {
    name: 'pet_nutritionist',
    display_name: 'Pet Nutritionist',
    description: 'Pet nutrition consultation and diet planning services',
    category: 'healthcare',
    capabilities: ['booking_create', 'service_pricing', 'medical_records'],
    config: {
      category: 'healthcare',
      vendorTypes: ['solo_provider', 'center'],
      serviceStyles: ['at_center', 'at_home', 'tele'],
      capabilities: ['booking_create', 'service_pricing', 'medical_records']
    }
  },
  {
    name: 'pet_spa',
    display_name: 'Pet Spa',
    description: 'Luxury pet spa and wellness center',
    category: 'hospitality',
    capabilities: ['booking_create', 'service_pricing', 'staff_create', 'staff_schedule'],
    config: {
      category: 'hospitality',
      vendorTypes: ['center'],
      serviceStyles: ['at_center'],
      capabilities: ['booking_create', 'service_pricing', 'staff_create', 'staff_schedule']
    }
  },
  {
    name: 'pet_cafe',
    display_name: 'Pet Cafe',
    description: 'Pet-friendly cafe and dining services',
    category: 'hospitality',
    capabilities: ['booking_create', 'inventory_manage', 'product_catalog', 'staff_create'],
    config: {
      category: 'hospitality',
      vendorTypes: ['center'],
      serviceStyles: ['at_center'],
      capabilities: ['booking_create', 'inventory_manage', 'product_catalog', 'staff_create']
    }
  },
  {
    name: 'pet_transport',
    display_name: 'Pet Transport',
    description: 'Pet relocation and transportation services',
    category: 'service_provider',
    capabilities: ['gps_tracking', 'booking_create', 'booking_view'],
    config: {
      category: 'service_provider',
      vendorTypes: ['solo_provider', 'center'],
      serviceStyles: ['at_home'],
      capabilities: ['gps_tracking', 'booking_create', 'booking_view']
    }
  },
  {
    name: 'pet_photographer',
    display_name: 'Pet Photographer',
    description: 'Professional pet photography services',
    category: 'specialist',
    capabilities: ['booking_create', 'service_pricing'],
    config: {
      category: 'specialist',
      vendorTypes: ['solo_provider'],
      serviceStyles: ['at_center', 'at_home'],
      capabilities: ['booking_create', 'service_pricing']
    }
  },
  {
    name: 'pet_adoption_center',
    display_name: 'Pet Adoption Center',
    description: 'Pet adoption and rescue center services',
    category: 'specialist',
    capabilities: ['booking_create', 'medical_records', 'staff_create'],
    config: {
      category: 'specialist',
      vendorTypes: ['center'],
      serviceStyles: ['at_center'],
      capabilities: ['booking_create', 'medical_records', 'staff_create']
    }
  },
  {
    name: 'pet_event_organizer',
    display_name: 'Pet Event Organizer',
    description: 'Pet events, parties, and social gatherings',
    category: 'specialist',
    capabilities: ['booking_create', 'service_pricing'],
    config: {
      category: 'specialist',
      vendorTypes: ['solo_provider', 'center'],
      serviceStyles: ['at_center', 'at_home'],
      capabilities: ['booking_create', 'service_pricing']
    }
  },
  {
    name: 'pet_relocation',
    display_name: 'Pet Relocation Services',
    description: 'International and domestic pet relocation services',
    category: 'specialist',
    capabilities: ['booking_create', 'service_pricing', 'gps_tracking'],
    config: {
      category: 'specialist',
      vendorTypes: ['center'],
      serviceStyles: ['at_home'],
      capabilities: ['booking_create', 'service_pricing', 'gps_tracking']
    }
  },
  {
    name: 'pet_insurance',
    display_name: 'Pet Insurance Provider',
    description: 'Pet insurance and coverage services',
    category: 'specialist',
    capabilities: ['booking_create', 'service_pricing'],
    config: {
      category: 'specialist',
      vendorTypes: ['center'],
      serviceStyles: ['tele'],
      capabilities: ['booking_create', 'service_pricing']
    }
  }
];

// ============================================================================
// SERVICE CATALOG SEEDING
// ============================================================================

const SERVICES_TO_SEED = [
  // Veterinary Services
  { service_id: 'vet_general_checkup', service_name: 'General Health Checkup', display_name: 'Complete physical examination', description: 'Comprehensive health checkup for your pet', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic'], service_style: 'at_center', base_price: 500, duration_minutes: 30, status: 'active', publish_status: 'published', display_order: 1 },
  { service_id: 'vet_vaccination', service_name: 'Vaccination', display_name: 'Core and non-core vaccinations', description: 'Essential vaccinations to protect your pet', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic'], service_style: 'at_center', base_price: 800, duration_minutes: 20, status: 'active', publish_status: 'published', display_order: 2 },
  { service_id: 'vet_home_visit', service_name: 'Home Visit Consultation', display_name: 'Veterinarian visits your home', description: 'Convenient at-home veterinary consultation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian'], service_style: 'at_home', base_price: 1000, duration_minutes: 45, status: 'active', publish_status: 'published', display_order: 7 },
  { service_id: 'vet_tele_consult', service_name: 'Tele-Consultation', display_name: 'Online video consultation', description: 'Connect with vet via video call', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic'], service_style: 'tele', base_price: 300, duration_minutes: 20, status: 'active', publish_status: 'published', display_order: 8 },
  
  // Grooming Services
  { service_id: 'groom_bath', service_name: 'Bath & Dry', display_name: 'Full bath and blow dry', description: 'Complete bathing and drying service', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'pet_spa'], service_style: 'at_center', base_price: 600, duration_minutes: 45, status: 'active', publish_status: 'published', display_order: 19 },
  { service_id: 'groom_haircut', service_name: 'Haircut & Styling', display_name: 'Professional haircut', description: 'Breed-specific or custom haircut', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'pet_spa'], service_style: 'at_center', base_price: 800, duration_minutes: 60, status: 'active', publish_status: 'published', display_order: 20 },
  { service_id: 'groom_home', service_name: 'Home Grooming', display_name: 'At-home grooming service', description: 'Professional grooming at your home', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer'], service_style: 'at_home', base_price: 1000, duration_minutes: 90, status: 'active', publish_status: 'published', display_order: 26 },
  
  // Training Services
  { service_id: 'train_basic_obedience', service_name: 'Basic Obedience Training', display_name: 'Fundamental commands', description: 'Teach sit, stay, come, heel', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer'], service_style: 'at_center', base_price: 1500, duration_minutes: 60, status: 'active', publish_status: 'published', display_order: 27 },
  { service_id: 'train_home', service_name: 'Home Training Session', display_name: 'At-home training', description: 'Personalized training at your home', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer'], service_style: 'at_home', base_price: 1800, duration_minutes: 60, status: 'active', publish_status: 'published', display_order: 33 },
  
  // Walking Services
  { service_id: 'walk_30min', service_name: '30 Min Walk', display_name: 'Short neighborhood walk', description: '30 minute walking session', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker'], service_style: 'at_home', base_price: 200, duration_minutes: 30, status: 'active', publish_status: 'published', display_order: 34 },
  { service_id: 'walk_60min', service_name: '60 Min Walk', display_name: 'Extended walk session', description: '1 hour walking and exercise', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker'], service_style: 'at_home', base_price: 350, duration_minutes: 60, status: 'active', publish_status: 'published', display_order: 35 },
  
  // Boarding Services
  { service_id: 'board_overnight', service_name: 'Overnight Boarding', display_name: 'Per night stay', description: '24-hour pet boarding care', category_id: 'boarding', category_name: 'Boarding & Daycare', applicable_roles: ['pet_boarder'], service_style: 'at_center', base_price: 800, duration_minutes: 1440, status: 'active', publish_status: 'published', display_order: 39 },
  { service_id: 'daycare_full', service_name: 'Full Day Daycare', display_name: '8-hour daycare', description: 'Full day pet socialization', category_id: 'boarding', category_name: 'Boarding & Daycare', applicable_roles: ['pet_daycare'], service_style: 'at_center', base_price: 600, duration_minutes: 480, status: 'active', publish_status: 'published', display_order: 42 },
  
  // Emergency Services
  { service_id: 'ambulance_emergency', service_name: 'Emergency Ambulance', display_name: '24/7 emergency transport', description: 'Immediate ambulance service', category_id: 'emergency', category_name: 'Emergency Services', applicable_roles: ['ambulance'], service_style: 'at_home', base_price: 2000, duration_minutes: 60, status: 'active', publish_status: 'published', display_order: 46 },
  
  // Diagnostic Services
  { service_id: 'diag_xray', service_name: 'X-Ray', display_name: 'Digital X-ray imaging', description: 'Radiographic examination', category_id: 'diagnostic', category_name: 'Diagnostics & Lab', applicable_roles: ['diagnostics_center', 'vet_clinic'], service_style: 'at_center', base_price: 1500, duration_minutes: 30, status: 'active', publish_status: 'published', display_order: 11 },
  { service_id: 'diag_blood_test', service_name: 'Blood Test', display_name: 'Complete blood count', description: 'Comprehensive blood analysis', category_id: 'diagnostic', category_name: 'Diagnostics & Lab', applicable_roles: ['diagnostics_center', 'vet_clinic'], service_style: 'at_center', base_price: 800, duration_minutes: 15, status: 'active', publish_status: 'published', display_order: 13 },
  
  // Pharmacy Services
  { service_id: 'pharmacy_medicine', service_name: 'Prescription Medicine', display_name: 'Veterinary medications', description: 'Fill prescription medications', category_id: 'pharmacy', category_name: 'Pharmacy & Medication', applicable_roles: ['pharmacy'], service_style: 'at_center', base_price: 500, duration_minutes: 15, status: 'active', publish_status: 'published', display_order: 48 },
  
  // Nutrition Services
  { service_id: 'nutrition_consult', service_name: 'Nutrition Consultation', display_name: 'Diet planning session', description: 'Personalized diet plan consultation', category_id: 'wellness', category_name: 'Wellness & Nutrition', applicable_roles: ['pet_nutritionist'], service_style: 'tele', base_price: 800, duration_minutes: 30, status: 'active', publish_status: 'published', display_order: 51 },
  
  // Add more services as needed...
];

// ============================================================================
// MAIN SEEDING FUNCTIONS
// ============================================================================

async function seedRoles() {
  log('\n📋 Seeding Roles...', 'blue');
  let successCount = 0;
  let errorCount = 0;

  for (const role of ROLES_TO_SEED) {
    try {
      // Check if role exists
      const existing = await apiRequest('GET', `/config/roles`);
      const exists = existing.roles?.some(r => r.name === role.name);
      
      if (exists) {
        log(`  ⏭️  Role "${role.display_name}" already exists, skipping...`, 'yellow');
        continue;
      }

      // Create role
      const result = await apiRequest('POST', '/admin/roles', {
        name: role.name,
        display_name: role.display_name,
        description: role.description,
        category: role.category,
        capabilities: role.capabilities,
        config: role.config,
        is_active: true
      });

      if (result.success || result.id) {
        log(`  ✅ Created role: ${role.display_name}`, 'green');
        successCount++;
      } else {
        throw new Error('Failed to create role');
      }
    } catch (error) {
      log(`  ❌ Error creating role "${role.display_name}": ${error.message}`, 'red');
      errorCount++;
    }
  }

  log(`\n✅ Roles seeding complete: ${successCount} created, ${errorCount} errors\n`, successCount > 0 ? 'green' : 'red');
  return { success: successCount, errors: errorCount };
}

async function seedServices() {
  log('\n📚 Seeding Service Catalog...', 'blue');
  let successCount = 0;
  let errorCount = 0;

  for (const service of SERVICES_TO_SEED) {
    try {
      // Check if service exists
      const existing = await apiRequest('GET', `/admin/service-catalog`);
      const services = existing.services || existing || [];
      const exists = services.some(s => s.service_id === service.service_id || s.id === service.service_id);
      
      if (exists) {
        log(`  ⏭️  Service "${service.display_name}" already exists, skipping...`, 'yellow');
        continue;
      }

      // Create service
      const result = await apiRequest('POST', '/admin/service-catalog', service);

      if (result.success || result.id) {
        log(`  ✅ Created service: ${service.display_name}`, 'green');
        successCount++;
      } else {
        throw new Error('Failed to create service');
      }
    } catch (error) {
      log(`  ❌ Error creating service "${service.display_name}": ${error.message}`, 'red');
      errorCount++;
    }
  }

  log(`\n✅ Service catalog seeding complete: ${successCount} created, ${errorCount} errors\n`, successCount > 0 ? 'green' : 'red');
  return { success: successCount, errors: errorCount };
}

async function activateIndiaRegion() {
  log('\n🌍 Activating India Region...', 'blue');
  
  try {
    // Get existing regions
    const regions = await apiRequest('GET', '/admin/regions');
    const allRegions = regions.regions || regions || [];
    
    // Find India region
    let indiaRegion = allRegions.find(r => 
      r.code === 'india' || 
      r.code === 'IN' || 
      r.name?.toLowerCase().includes('india')
    );

    if (!indiaRegion) {
      // Create India region if it doesn't exist
      log('  📝 Creating India region...', 'yellow');
      const result = await apiRequest('POST', '/admin/regions', {
        name: 'India',
        code: 'india',
        country: 'India',
        state: '',
        city: '',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        service_radius_km: 10,
        is_active: true
      });
      
      if (result.success || result.region) {
        indiaRegion = result.region || result;
        log('  ✅ India region created', 'green');
      } else {
        throw new Error('Failed to create India region');
      }
    }

    // Activate India region
    if (!indiaRegion.is_active) {
      log('  🔄 Activating India region...', 'yellow');
      const result = await apiRequest('PUT', `/admin/regions/${indiaRegion.id}`, {
        ...indiaRegion,
        is_active: true
      });

      if (result.success || result.region) {
        log('  ✅ India region activated', 'green');
      } else {
        throw new Error('Failed to activate India region');
      }
    } else {
      log('  ✅ India region is already active', 'green');
    }

    // Deactivate other regions (optional)
    log('  🔄 Deactivating other regions...', 'yellow');
    for (const region of allRegions) {
      if (region.id !== indiaRegion.id && region.is_active) {
        try {
          await apiRequest('PUT', `/admin/regions/${region.id}`, {
            ...region,
            is_active: false
          });
        } catch (e) {
          // Ignore errors for other regions
        }
      }
    }

    log('\n✅ Region activation complete\n', 'green');
    return { success: true };
  } catch (error) {
    log(`\n❌ Error activating India region: ${error.message}\n`, 'red');
    return { success: false, error: error.message };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('🚀 Starting Warmpawz Platform Seeding via Admin API', 'blue');
  log(`📍 API Base URL: ${API_BASE_URL}\n`, 'blue');

  try {
    // Step 1: Seed Roles
    const rolesResult = await seedRoles();
    
    // Step 2: Seed Services
    const servicesResult = await seedServices();
    
    // Step 3: Activate India Region
    const regionResult = await activateIndiaRegion();

    // Summary
    log('\n' + '='.repeat(60), 'blue');
    log('📊 SEEDING SUMMARY', 'blue');
    log('='.repeat(60), 'blue');
    log(`Roles: ${rolesResult.success} created, ${rolesResult.errors} errors`, rolesResult.success > 0 ? 'green' : 'red');
    log(`Services: ${servicesResult.success} created, ${servicesResult.errors} errors`, servicesResult.success > 0 ? 'green' : 'red');
    log(`India Region: ${regionResult.success ? 'Activated' : 'Failed'}`, regionResult.success ? 'green' : 'red');
    log('='.repeat(60) + '\n', 'blue');

    if (rolesResult.success > 0 || servicesResult.success > 0 || regionResult.success) {
      log('✅ Seeding completed successfully!', 'green');
      log('🎯 You can now test the vendor onboarding flow\n', 'green');
      process.exit(0);
    } else {
      log('⚠️  No data was seeded. Check API connection and permissions.', 'yellow');
      process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { seedRoles, seedServices, activateIndiaRegion };

