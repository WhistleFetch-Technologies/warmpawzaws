#!/usr/bin/env node

/**
 * Service Report Generator (API Version)
 * 
 * Fetches real data from API and generates comprehensive report
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_ENDPOINT = process.env.API_ENDPOINT || 'https://api.warmpawz.com';
const OUTPUT_FILE = path.join(__dirname, '..', 'SERVICES_REPORT.md');

// Helper to make API requests
function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_ENDPOINT);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Service to UI Component Mapping
const SERVICE_UI_MAPPING = {
  'vet': {
    components: ['VetServiceRouter', 'VetServicesByStyle', 'VetBookingRouter', 'CustomerServicesPage', 'ServicesByProblem'],
    routes: ['/vet', '/vet-booking', '/services?category=vet'],
    screens: ['vet', 'vet-booking', 'vet-services-by-style']
  },
  'grooming': {
    components: ['GroomingServiceRouter', 'CustomerServicesPage', 'HomeServiceSelectionEnhanced', 'ServicesByProblem'],
    routes: ['/grooming', '/services?category=grooming', '/home-services'],
    screens: ['grooming', 'grooming_center', 'grooming_home']
  },
  'training': {
    components: ['TrainingServiceRouter', 'CustomerServicesPage', 'HomeServiceSelectionEnhanced', 'ServicesByProblem'],
    routes: ['/training', '/services?category=training', '/home-services'],
    screens: ['training']
  },
  'walker': {
    components: ['WalkerService', 'CustomerServicesPage', 'HomeServiceSelectionEnhanced'],
    routes: ['/walker', '/services?category=walker', '/home-services'],
    screens: ['walker', 'walk']
  },
  'boarding': {
    components: ['ResortBoardingBookingEnhanced', 'CustomerServicesPage', 'ServicesByProblem'],
    routes: ['/boarding', '/services?category=boarding', '/resort'],
    screens: ['boarding', 'resort']
  },
  'nutrition': {
    components: ['NutritionistServicesLanding', 'CustomerServicesPage', 'ServicesByProblem'],
    routes: ['/nutrition', '/services?category=nutrition'],
    screens: ['nutritionist']
  },
  'ambulance': {
    components: ['AmbulanceServicesLanding', 'AmbulanceSOS', 'IntegratedServicesSelector'],
    routes: ['/ambulance', '/sos'],
    screens: ['ambulance', 'ambulance-sos']
  },
  'pharmacy': {
    components: ['PharmacyServicesLanding', 'IntegratedServicesSelector', 'PharmacyCheckout'],
    routes: ['/pharmacy'],
    screens: ['pharmacy']
  },
  'cafe': {
    components: ['PetCafeServicesLanding', 'PetCafeListingZomatoStyle', 'CafeReservationFlow'],
    routes: ['/cafe', '/cafes'],
    screens: ['cafes', 'cafe-reservation']
  }
};

const SERVICE_STYLES = {
  'at_home': 'Home Visit',
  'at_center': 'At Center/Clinic',
  'tele': 'Teleconsultation'
};

async function fetchAllServices() {
  console.log('📡 Fetching services from API...');
  
  const categories = ['vet', 'grooming', 'training', 'walker', 'boarding', 'nutrition'];
  const allServices = [];
  
  for (const category of categories) {
    try {
      console.log(`  Fetching ${category} services...`);
      const response = await apiRequest(`/customer/services?category=${category}`);
      if (response.success && response.services) {
        response.services.forEach(service => {
          service.category = category;
          allServices.push(service);
        });
        console.log(`  ✓ Found ${response.services.length} ${category} services`);
      }
    } catch (error) {
      console.log(`  ✗ Error fetching ${category}: ${error.message}`);
    }
  }
  
  return allServices;
}

async function fetchVendors() {
  console.log('📡 Fetching vendors from API...');
  
  try {
    // Try to get vendors - this endpoint may not exist, so we'll handle gracefully
    const response = await apiRequest('/vendors?status=approved&is_active=true');
    if (response.vendors || Array.isArray(response)) {
      return response.vendors || response;
    }
    return [];
  } catch (error) {
    console.log(`  ⚠ Could not fetch vendors: ${error.message}`);
    return [];
  }
}

function generateReport(services, vendors = []) {
  const report = [];
  
  report.push('# Services Report - Complete Analysis');
  report.push('');
  report.push(`**Generated:** ${new Date().toISOString()}`);
  report.push(`**Total Services:** ${services.length}`);
  report.push(`**Total Vendors:** ${vendors.length}`);
  report.push('');
  report.push('---');
  report.push('');

  // Group by category
  const byCategory = {};
  services.forEach(service => {
    const cat = service.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(service);
  });

  // Generate detailed report
  Object.keys(byCategory).sort().forEach(category => {
    const catServices = byCategory[category];
    
    report.push(`## ${category.toUpperCase()} Services (${catServices.length})`);
    report.push('');
    
    // Table
    report.push('| Service Name | Price | Duration | Style | UI Location | Enabled Vendors |');
    report.push('|-------------|-------|----------|-------|-------------|----------------|');
    
    catServices.forEach(service => {
      const ui = SERVICE_UI_MAPPING[category] || {
        components: ['CustomerServicesPage'],
        routes: [`/services?category=${category}`],
        screens: [category]
      };
      
      const style = SERVICE_STYLES[service.serviceStyle] || service.serviceStyle || 'N/A';
      const price = service.price || service.custom_price || service.base_price || 'N/A';
      const duration = service.duration || service.duration_minutes || 'N/A';
      
      // Find vendors
      const enabledVendors = vendors
        .filter(v => v.services?.some(s => 
          s.serviceId === service.id || 
          s.id === service.id ||
          s.service_id === service.id
        ))
        .map(v => v.business_name || v.name || v.vendorName)
        .join(', ') || (service.vendorName || 'N/A');
      
      const uiLocation = ui.components.join(', ');
      
      report.push(`| ${service.serviceName || service.name || 'N/A'} | ₹${price} | ${duration} min | ${style} | ${uiLocation} | ${enabledVendors} |`);
    });
    
    report.push('');
    report.push('### UI Components & Routes');
    report.push('');
    const ui = SERVICE_UI_MAPPING[category] || { components: [], routes: [], screens: [] };
    report.push(`- **Components:** ${ui.components.join(', ')}`);
    report.push(`- **Routes:** ${ui.routes.join(', ')}`);
    report.push(`- **Screens:** ${ui.screens.join(', ')}`);
    report.push('');
    report.push('---');
    report.push('');
  });

  // Summary
  report.push('## Summary Statistics');
  report.push('');
  report.push('### Services by Category');
  Object.keys(byCategory).forEach(cat => {
    report.push(`- **${cat}**: ${byCategory[cat].length} services`);
  });
  report.push('');

  report.push('### Services by Style');
  const byStyle = {};
  services.forEach(s => {
    const style = s.serviceStyle || 'unknown';
    byStyle[style] = (byStyle[style] || 0) + 1;
  });
  Object.keys(byStyle).forEach(style => {
    report.push(`- **${SERVICE_STYLES[style] || style}**: ${byStyle[style]} services`);
  });
  report.push('');

  report.push('### Price Range');
  const prices = services
    .map(s => parseFloat(s.price || s.custom_price || s.base_price || 0))
    .filter(p => p > 0)
    .sort((a, b) => a - b);
  if (prices.length > 0) {
    report.push(`- **Min Price**: ₹${prices[0]}`);
    report.push(`- **Max Price**: ₹${prices[prices.length - 1]}`);
    report.push(`- **Average Price**: ₹${Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)}`);
  }
  report.push('');

  return report.join('\n');
}

async function main() {
  console.log('🚀 Starting Services Report Generation...');
  console.log(`📡 API Endpoint: ${API_ENDPOINT}`);
  console.log('');

  try {
    const services = await fetchAllServices();
    const vendors = await fetchVendors();
    
    console.log('');
    console.log(`✅ Fetched ${services.length} services`);
    console.log(`✅ Fetched ${vendors.length} vendors`);
    console.log('');
    
    const report = generateReport(services, vendors);
    
    fs.writeFileSync(OUTPUT_FILE, report);
    
    console.log('✅ Report generated successfully!');
    console.log(`📄 Output: ${OUTPUT_FILE}`);
    console.log('');
    console.log('📊 Report includes:');
    console.log('  - All services with prices and durations');
    console.log('  - UI component mappings');
    console.log('  - Route information');
    console.log('  - Vendor enablement status');
    console.log('  - Summary statistics');
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateReport, fetchAllServices, fetchVendors };
