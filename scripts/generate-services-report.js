#!/usr/bin/env node

/**
 * Service Report Generator
 * 
 * Generates a comprehensive report of all services including:
 * - Service name and price
 * - Where it appears in customer UI
 * - Which vendors have it enabled
 */

const fs = require('fs');
const path = require('path');

// Service to UI Component Mapping
const SERVICE_UI_MAPPING = {
  // Vet Services
  'vet': {
    components: [
      'VetServiceRouter',
      'VetServicesByStyle',
      'VetBookingRouter',
      'CustomerServicesPage (category=vet)',
      'ServicesByProblem (vet-related)'
    ],
    routes: ['/vet', '/vet-booking', '/services?category=vet'],
    screens: ['vet', 'vet-booking', 'vet-services-by-style']
  },
  'veterinarian': {
    components: ['VetServiceRouter', 'CustomerServicesPage'],
    routes: ['/vet', '/services?category=vet'],
    screens: ['vet']
  },
  'emergency': {
    components: ['EmergencyBookingPage', 'VetServiceRouter'],
    routes: ['/vet/emergency'],
    screens: ['emergency-booking']
  },
  
  // Grooming Services
  'grooming': {
    components: [
      'GroomingServiceRouter',
      'CustomerServicesPage (category=grooming)',
      'HomeServiceSelectionEnhanced',
      'ServicesByProblem (grooming-related)'
    ],
    routes: ['/grooming', '/services?category=grooming', '/home-services'],
    screens: ['grooming', 'grooming_center', 'grooming_home']
  },
  'groomer': {
    components: ['GroomingServiceRouter', 'CustomerServicesPage'],
    routes: ['/grooming', '/services?category=grooming'],
    screens: ['grooming']
  },
  
  // Training Services
  'training': {
    components: [
      'TrainingServiceRouter',
      'CustomerServicesPage (category=training)',
      'HomeServiceSelectionEnhanced',
      'ServicesByProblem (training-related)'
    ],
    routes: ['/training', '/services?category=training', '/home-services'],
    screens: ['training']
  },
  'trainer': {
    components: ['TrainingServiceRouter', 'CustomerServicesPage'],
    routes: ['/training', '/services?category=training'],
    screens: ['training']
  },
  
  // Walking Services
  'walking': {
    components: [
      'WalkerService',
      'CustomerServicesPage',
      'HomeServiceSelectionEnhanced'
    ],
    routes: ['/walker', '/services?category=walker', '/home-services'],
    screens: ['walker', 'walk']
  },
  'dog_walker': {
    components: ['WalkerService', 'CustomerServicesPage'],
    routes: ['/walker', '/services?category=walker'],
    screens: ['walker']
  },
  
  // Boarding Services
  'boarding': {
    components: [
      'ResortBoardingBookingEnhanced',
      'CustomerServicesPage (category=boarding)',
      'ServicesByProblem (boarding-related)'
    ],
    routes: ['/boarding', '/services?category=boarding', '/resort'],
    screens: ['boarding', 'resort']
  },
  'boarding_resort': {
    components: ['ResortBoardingBookingEnhanced', 'CustomerServicesPage'],
    routes: ['/boarding', '/resort'],
    screens: ['boarding']
  },
  
  // Nutrition Services
  'nutrition': {
    components: [
      'NutritionistServicesLanding',
      'CustomerServicesPage',
      'ServicesByProblem'
    ],
    routes: ['/nutrition', '/services?category=nutrition'],
    screens: ['nutritionist']
  },
  'nutritionist': {
    components: ['NutritionistServicesLanding', 'CustomerServicesPage'],
    routes: ['/nutrition'],
    screens: ['nutritionist']
  },
  
  // Integrated Services
  'ambulance': {
    components: [
      'AmbulanceServicesLanding',
      'AmbulanceSOS',
      'IntegratedServicesSelector'
    ],
    routes: ['/ambulance', '/sos'],
    screens: ['ambulance', 'ambulance-sos']
  },
  'pharmacy': {
    components: [
      'PharmacyServicesLanding',
      'IntegratedServicesSelector',
      'PharmacyCheckout'
    ],
    routes: ['/pharmacy'],
    screens: ['pharmacy']
  },
  'diagnostic': {
    components: [
      'IntegratedServicesSelector',
      'CustomerServicesPage'
    ],
    routes: ['/diagnostics'],
    screens: ['diagnostic']
  },
  
  // Other Services
  'cafe': {
    components: [
      'PetCafeServicesLanding',
      'PetCafeListingZomatoStyle',
      'CafeReservationFlow'
    ],
    routes: ['/cafe', '/cafes'],
    screens: ['cafes', 'cafe-reservation']
  },
  'photography': {
    components: ['PhotographyServicesLanding'],
    routes: ['/photography'],
    screens: ['photography']
  },
  'insurance': {
    components: ['InsuranceServicesLanding'],
    routes: ['/insurance'],
    screens: ['insurance']
  },
  'breeder': {
    components: [
      'BreederServicesLanding',
      'BreederCatalogView'
    ],
    routes: ['/breeder'],
    screens: ['breeder']
  },
  'adoption': {
    components: [
      'AdoptionQuestionnaire',
      'CustomerServicesPage'
    ],
    routes: ['/adoption'],
    screens: ['adoption']
  },
  'relocation': {
    components: ['RelocationServicesLanding'],
    routes: ['/relocation'],
    screens: ['relocation']
  },
  'resort': {
    components: [
      'ResortServicesLanding',
      'ResortBoardingBookingEnhanced'
    ],
    routes: ['/resort'],
    screens: ['resort']
  },
  'holiday': {
    components: ['PetHolidayServicesLanding'],
    routes: ['/holiday'],
    screens: ['holiday']
  },
  
  // Shop/Marketplace
  'shop': {
    components: [
      'ShopDashboard',
      'ProductDetailPage',
      'IntegratedServicesHub'
    ],
    routes: ['/shop'],
    screens: ['shop']
  },
  'marketplace': {
    components: ['ShopDashboard', 'CustomerServicesPage'],
    routes: ['/shop', '/services?category=marketplace'],
    screens: ['shop']
  }
};

// Service Style Mapping
const SERVICE_STYLES = {
  'at_home': 'Home Visit',
  'at_center': 'At Center/Clinic',
  'tele': 'Teleconsultation'
};

// Category to Role Mapping
const CATEGORY_ROLE_MAP = {
  'vet': ['vet_clinic', 'veterinarian'],
  'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
  'training': ['trainer', 'pet_trainer'],
  'walker': ['dog_walker', 'pet_walker'],
  'boarding': ['boarding_resort', 'pet_boarding'],
  'nutrition': ['nutritionist'],
  'adoption': ['ngo', 'shelter', 'breeder'],
  'marketplace': ['pet_store']
};

function generateReport(servicesData, vendorsData) {
  const report = [];
  report.push('# Services Report');
  report.push('');
  report.push('Generated: ' + new Date().toISOString());
  report.push('');
  report.push('---');
  report.push('');

  // Group services by category
  const servicesByCategory = {};
  
  servicesData.forEach(service => {
    const category = service.category || 'other';
    if (!servicesByCategory[category]) {
      servicesByCategory[category] = [];
    }
    servicesByCategory[category].push(service);
  });

  // Generate report for each category
  Object.keys(servicesByCategory).sort().forEach(category => {
    const services = servicesByCategory[category];
    
    report.push(`## ${category.toUpperCase()} Services`);
    report.push('');
    report.push(`Total Services: ${services.length}`);
    report.push('');

    // Table header
    report.push('| Service Name | Price | Duration | Style | UI Components | Routes | Enabled Vendors |');
    report.push('|-------------|-------|----------|-------|---------------|--------|----------------|');

    services.forEach(service => {
      const uiMapping = SERVICE_UI_MAPPING[service.name?.toLowerCase()] || 
                       SERVICE_UI_MAPPING[service.category] || 
                       { components: ['CustomerServicesPage'], routes: ['/services'], screens: ['services'] };
      
      const components = uiMapping.components.join(', ');
      const routes = uiMapping.routes.join(', ');
      const style = SERVICE_STYLES[service.serviceStyle] || service.serviceStyle || 'N/A';
      
      // Find vendors with this service enabled
      const enabledVendors = vendorsData
        .filter(v => v.services?.some(s => s.serviceId === service.id || s.id === service.id))
        .map(v => v.business_name || v.name)
        .join(', ') || 'None';
      
      const price = service.price || service.custom_price || service.base_price || 'N/A';
      const duration = service.duration || service.duration_minutes || 'N/A';
      
      report.push(`| ${service.name || service.serviceName || 'N/A'} | ₹${price} | ${duration} min | ${style} | ${components} | ${routes} | ${enabledVendors} |`);
    });

    report.push('');
    report.push('---');
    report.push('');
  });

  // Summary section
  report.push('## Summary');
  report.push('');
  report.push(`- **Total Services**: ${servicesData.length}`);
  report.push(`- **Total Categories**: ${Object.keys(servicesByCategory).length}`);
  report.push(`- **Total Vendors**: ${vendorsData.length}`);
  report.push('');

  // Vendor breakdown
  report.push('### Vendor Breakdown by Category');
  report.push('');
  Object.keys(CATEGORY_ROLE_MAP).forEach(category => {
    const roles = CATEGORY_ROLE_MAP[category];
    const vendors = vendorsData.filter(v => 
      roles.some(role => v.role_name === role || v.role_id === role)
    );
    report.push(`- **${category}**: ${vendors.length} vendors`);
  });
  report.push('');

  return report.join('\n');
}

// Main function
async function main() {
  const apiEndpoint = process.env.API_ENDPOINT || 'https://api.warmpawz.com';
  
  console.log('🔍 Generating Services Report...');
  console.log(`📡 API Endpoint: ${apiEndpoint}`);
  console.log('');

  // Sample data structure (in real implementation, this would fetch from API)
  const sampleServices = [
    {
      id: 'service-1',
      name: 'General Consultation',
      category: 'vet',
      base_price: 500,
      duration_minutes: 30,
      serviceStyle: 'at_center'
    },
    {
      id: 'service-2',
      name: 'Home Visit',
      category: 'vet',
      base_price: 800,
      duration_minutes: 45,
      serviceStyle: 'at_home'
    },
    {
      id: 'service-3',
      name: 'Full Grooming',
      category: 'grooming',
      base_price: 1200,
      duration_minutes: 120,
      serviceStyle: 'at_center'
    }
  ];

  const sampleVendors = [
    {
      id: 'vendor-1',
      business_name: 'Pet Care Clinic',
      role_name: 'vet_clinic',
      services: [{ serviceId: 'service-1' }, { serviceId: 'service-2' }]
    },
    {
      id: 'vendor-2',
      business_name: 'Grooming Salon',
      role_name: 'grooming_salon',
      services: [{ serviceId: 'service-3' }]
    }
  ];

  const report = generateReport(sampleServices, sampleVendors);
  
  const outputPath = path.join(__dirname, '..', 'SERVICES_REPORT.md');
  fs.writeFileSync(outputPath, report);
  
  console.log('✅ Report generated successfully!');
  console.log(`📄 Output: ${outputPath}`);
  console.log('');
  console.log('Note: This is a template report. To generate a real report with actual data,');
  console.log('you need to:');
  console.log('1. Set up API endpoint connection');
  console.log('2. Fetch services from GET /customer/services');
  console.log('3. Fetch vendors from GET /vendors');
  console.log('4. Match services to vendors');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateReport, SERVICE_UI_MAPPING, CATEGORY_ROLE_MAP };
