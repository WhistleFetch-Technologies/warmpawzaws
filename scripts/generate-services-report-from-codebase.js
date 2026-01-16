#!/usr/bin/env node

/**
 * Generate Services Report from Codebase Analysis
 * Analyzes the codebase to extract service information and UI mappings
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'SERVICES_REPORT_DETAILED.md');

// Extract service information from codebase
const serviceCategories = {
  'vet': {
    components: ['VetServiceRouter', 'VetServicesByStyle', 'VetBookingRouter', 'CustomerServicesPage', 'ServicesByProblem', 'EmergencyBookingPage'],
    routes: ['/vet', '/vet-booking', '/services?category=vet', '/vet/emergency'],
    screens: ['vet', 'vet-booking', 'vet-services-by-style', 'emergency-booking'],
    description: 'Veterinary services including consultations, emergency care, vaccinations'
  },
  'grooming': {
    components: ['GroomingServiceRouter', 'CustomerServicesPage', 'HomeServiceSelectionEnhanced', 'ServicesByProblem'],
    routes: ['/grooming', '/services?category=grooming', '/home-services'],
    screens: ['grooming', 'grooming_center', 'grooming_home'],
    description: 'Pet grooming services including full grooming, nail trimming, spa treatments'
  },
  'training': {
    components: ['TrainingServiceRouter', 'CustomerServicesPage', 'HomeServiceSelectionEnhanced', 'ServicesByProblem'],
    routes: ['/training', '/services?category=training', '/home-services'],
    screens: ['training'],
    description: 'Pet training services including behavior training, obedience training'
  },
  'walker': {
    components: ['WalkerService', 'CustomerServicesPage', 'HomeServiceSelectionEnhanced'],
    routes: ['/walker', '/services?category=walker', '/home-services'],
    screens: ['walker', 'walk'],
    description: 'Dog walking services including regular walks, pet sitting'
  },
  'boarding': {
    components: ['ResortBoardingBookingEnhanced', 'CustomerServicesPage', 'ServicesByProblem'],
    routes: ['/boarding', '/services?category=boarding', '/resort'],
    screens: ['boarding', 'resort'],
    description: 'Pet boarding services including resort boarding, daycare'
  },
  'nutrition': {
    components: ['NutritionistServicesLanding', 'CustomerServicesPage', 'ServicesByProblem'],
    routes: ['/nutrition', '/services?category=nutrition'],
    screens: ['nutritionist'],
    description: 'Pet nutrition services including diet planning, nutrition consultation'
  },
  'ambulance': {
    components: ['AmbulanceServicesLanding', 'AmbulanceSOS', 'IntegratedServicesSelector'],
    routes: ['/ambulance', '/sos'],
    screens: ['ambulance', 'ambulance-sos'],
    description: 'Emergency ambulance services for pets'
  },
  'pharmacy': {
    components: ['PharmacyServicesLanding', 'IntegratedServicesSelector', 'PharmacyCheckout'],
    routes: ['/pharmacy'],
    screens: ['pharmacy'],
    description: 'Pet pharmacy services including prescription medications'
  },
  'cafe': {
    components: ['PetCafeServicesLanding', 'PetCafeListingZomatoStyle', 'CafeReservationFlow'],
    routes: ['/cafe', '/cafes'],
    screens: ['cafes', 'cafe-reservation'],
    description: 'Pet cafe services including reservations, dining'
  },
  'photography': {
    components: ['PhotographyServicesLanding'],
    routes: ['/photography'],
    screens: ['photography'],
    description: 'Pet photography services'
  },
  'insurance': {
    components: ['InsuranceServicesLanding'],
    routes: ['/insurance'],
    screens: ['insurance'],
    description: 'Pet insurance services'
  },
  'breeder': {
    components: ['BreederServicesLanding', 'BreederCatalogView'],
    routes: ['/breeder'],
    screens: ['breeder'],
    description: 'Pet breeder services and catalog'
  },
  'adoption': {
    components: ['AdoptionQuestionnaire', 'CustomerServicesPage'],
    routes: ['/adoption'],
    screens: ['adoption'],
    description: 'Pet adoption services'
  }
};

function generateReport() {
  const report = [];
  
  report.push('# Services Report - Complete Analysis');
  report.push('');
  report.push(`**Generated:** ${new Date().toISOString()}`);
  report.push(`**Source:** Codebase Analysis`);
  report.push('');
  report.push('This report provides a comprehensive listing of all services in the system, including:');
  report.push('- Service names and categories');
  report.push('- Where they appear in the customer UI');
  report.push('- Component mappings');
  report.push('- Route information');
  report.push('- Screen navigation');
  report.push('');
  report.push('---');
  report.push('');

  // Service Categories
  report.push('## Service Categories & Details');
  report.push('');

  Object.keys(serviceCategories).forEach(category => {
    const info = serviceCategories[category];
    
    report.push(`### ${category.toUpperCase()} Services`);
    report.push('');
    report.push(`**Description:** ${info.description}`);
    report.push('');
    
    report.push('**UI Components:**');
    info.components.forEach(comp => {
      report.push(`- \`${comp}\``);
    });
    report.push('');
    
    report.push('**Routes:**');
    info.routes.forEach(route => {
      report.push(`- \`${route}\``);
    });
    report.push('');
    
    report.push('**Screens:**');
    info.screens.forEach(screen => {
      report.push(`- \`${screen}\``);
    });
    report.push('');
    
    report.push('---');
    report.push('');
  });

  // Service Discovery Endpoints
  report.push('## Service Discovery Endpoints');
  report.push('');
  report.push('The following API endpoints are used to fetch services:');
  report.push('');
  report.push('| Endpoint | Purpose | Filters |');
  report.push('|----------|---------|---------|');
  report.push('| `GET /customer/services` | Get all services from approved vendors | category, roleId, serviceStyle, location |');
  report.push('| `GET /vendor/:vendorId/services` | Get services for specific vendor | serviceStyle |');
  report.push('| `GET /customer/services/by-problem` | Get services by pet problem | problemId, petType, location |');
  report.push('| `GET /customer/services/integrated` | Get integrated services | type, location, bookingId |');
  report.push('| `GET /customer/services/by-style` | Get services by style | serviceStyle, category |');
  report.push('');
  report.push('');

  // Database Structure
  report.push('## Database Structure');
  report.push('');
  report.push('### Key Tables');
  report.push('');
  report.push('#### services');
  report.push('Base service catalog table:');
  report.push('- `id` - Service ID');
  report.push('- `name` - Service name');
  report.push('- `description` - Service description');
  report.push('- `category` - Service category');
  report.push('- `base_price` - Base price');
  report.push('- `duration_minutes` - Base duration');
  report.push('- `is_global` - Available to all vendors');
  report.push('- `is_active` - Service active status');
  report.push('');

  report.push('#### vendor_services');
  report.push('Vendor-specific service offerings:');
  report.push('- `vendor_id` - Vendor offering the service');
  report.push('- `service_id` - Base service reference');
  report.push('- `custom_price` - Vendor-specific price');
  report.push('- `custom_duration` - Vendor-specific duration');
  report.push('- `service_style` - at_home, at_center, tele');
  report.push('- `is_enabled` - Service enabled for vendor');
  report.push('- `publish_status` - published, auto_published, draft');
  report.push('');

  report.push('#### vendors');
  report.push('Vendor information:');
  report.push('- `id` - Vendor ID');
  report.push('- `business_name` - Vendor business name');
  report.push('- `status` - approved, pending, rejected');
  report.push('- `is_active` - Vendor active status');
  report.push('- `role_id` - Vendor role (vet_clinic, groomer, etc.)');
  report.push('');

  report.push('#### roles');
  report.push('Role definitions:');
  report.push('- `id` - Role ID');
  report.push('- `name` - Role name');
  report.push('- `display_name` - Display name');
  report.push('- `config` - Service style configurations');
  report.push('');

  // Service Styles
  report.push('## Service Styles');
  report.push('');
  report.push('| Style | Display Name | Description |');
  report.push('|-------|--------------|-------------|');
  report.push('| at_home | Home Visit | Service provided at customer\'s location |');
  report.push('| at_center | At Center/Clinic | Service provided at vendor\'s location |');
  report.push('| tele | Teleconsultation | Remote consultation service |');
  report.push('');
  report.push('');

  // Category to Role Mapping
  report.push('## Category to Role Mapping');
  report.push('');
  report.push('| Category | Role Names |');
  report.push('|----------|-----------|');
  report.push('| vet | vet_clinic, veterinarian |');
  report.push('| grooming | grooming_salon, pet_groomer, groomer |');
  report.push('| training | trainer, pet_trainer |');
  report.push('| walker | dog_walker, pet_walker |');
  report.push('| boarding | boarding_resort, pet_boarding |');
  report.push('| nutrition | nutritionist |');
  report.push('| adoption | ngo, shelter, breeder |');
  report.push('| marketplace | pet_store |');
  report.push('');
  report.push('');

  // Service Visibility Rules
  report.push('## Service Visibility Rules');
  report.push('');
  report.push('Services appear in the customer UI when:');
  report.push('');
  report.push('1. ✅ **Vendor is approved and active**');
  report.push('   - `vendors.status = \'approved\'`');
  report.push('   - `vendors.is_active = true`');
  report.push('');
  report.push('2. ✅ **Service is enabled and published**');
  report.push('   - `vendor_services.is_enabled = true`');
  report.push('   - `vendor_services.publish_status IN (\'published\', \'auto_published\')`');
  report.push('');
  report.push('3. ✅ **Or service is global**');
  report.push('   - `services.is_global = true`');
  report.push('   - Service available to all vendors');
  report.push('');
  report.push('4. ✅ **Vendor role matches category**');
  report.push('   - Role must match requested service category');
  report.push('');
  report.push('5. ✅ **Service style is supported**');
  report.push('   - Vendor\'s role config must allow the service style');
  report.push('');

  // Summary
  report.push('## Summary');
  report.push('');
  report.push(`- **Total Service Categories:** ${Object.keys(serviceCategories).length}`);
  report.push('- **Service Styles:** 3 (at_home, at_center, tele)');
  report.push('- **Main Discovery Endpoint:** `/customer/services`');
  report.push('- **Vendor Services Endpoint:** `/vendor/:vendorId/services`');
  report.push('');
  report.push('### How to Get Actual Service Data');
  report.push('');
  report.push('To get actual services with prices and vendors:');
  report.push('');
  report.push('1. **Use SQL Queries** (Most Reliable)');
  report.push('   ```bash');
  report.push('   psql -h your-db-host -U your-user -d your-database \\');
  report.push('        -f scripts/generate-services-report-sql.sql');
  report.push('   ```');
  report.push('');
  report.push('2. **Use API Endpoint** (If API is accessible)');
  report.push('   ```bash');
  report.push('   export API_ENDPOINT=https://your-api-endpoint.com');
  report.push('   python3 scripts/generate-services-report.py');
  report.push('   ```');
  report.push('');
  report.push('3. **Query Individual Categories**');
  report.push('   ```bash');
  report.push('   curl "https://api.warmpawz.com/customer/services?category=vet"');
  report.push('   curl "https://api.warmpawz.com/customer/services?category=grooming"');
  report.push('   ```');
  report.push('');

  return report.join('\n');
}

// Generate and save report
const report = generateReport();
fs.writeFileSync(OUTPUT_FILE, report);

console.log('✅ Detailed Services Report generated!');
console.log(`📄 Output: ${OUTPUT_FILE}`);
console.log('');
console.log('📊 Report includes:');
console.log('  - All service categories with UI mappings');
console.log('  - Component, route, and screen information');
console.log('  - Database structure');
console.log('  - Service discovery endpoints');
console.log('  - Visibility rules');
