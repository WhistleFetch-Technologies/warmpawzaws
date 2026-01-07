#!/usr/bin/env node
/**
 * Script to verify API integration in screens
 * Identifies screens that need API integration
 */

const fs = require('fs');
const path = require('path');

// Screens that should have API integration
const SCREENS_NEEDING_API = {
  // Customer Mobile
  'AppointmentDetailScreen': { endpoint: '/customer/appointments/:id', method: 'GET' },
  'AppointmentListScreen': { endpoint: '/customer/appointments', method: 'GET' },
  'AppointmentRescheduleScreen': { endpoint: '/customer/appointments/:id/reschedule', method: 'POST' },
  'BookingDetailScreen': { endpoint: '/bookings/:id', method: 'GET' },
  'BookingListScreen': { endpoint: '/customer/bookings', method: 'GET' },
  'OrderDetailScreen': { endpoint: '/customer/orders/:id', method: 'GET' },
  'OrderHistoryScreen': { endpoint: '/customer/orders', method: 'GET' },
  'OrderTrackingScreen': { endpoint: '/customer/orders/:id/tracking', method: 'GET' },
  'OrderInvoiceScreen': { endpoint: '/customer/orders/:id/invoice', method: 'GET' },
  'CustomerProfileScreen': { endpoint: '/customer/profile', method: 'GET' },
  'EditProfileScreen': { endpoint: '/customer/profile', method: 'PUT' },
  'CustomerPetsPageScreen': { endpoint: '/customer/pets', method: 'GET' },
  'CustomerPetProfileScreen': { endpoint: '/pets/:id', method: 'GET' },
  'PetProfileDashboardScreen': { endpoint: '/pets/:id', method: 'GET' },
  'ServiceDiscoveryScreen': { endpoint: '/search/universal', method: 'GET' },
  'VendorProfileScreen': { endpoint: '/vendor/:id', method: 'GET' },
  'ChatScreen': { endpoint: '/chat/messages', method: 'GET' },
  'SettingsScreen': { endpoint: '/customer/settings', method: 'GET' },
  
  // Vendor Mobile
  'VendorDashboardScreen': { endpoint: '/vendor/dashboard', method: 'GET' },
  'BookingManagementScreen': { endpoint: '/vendor/bookings', method: 'GET' },
  'VendorServiceManagementScreen': { endpoint: '/vendor/services', method: 'GET' },
  'VendorProfileScreen': { endpoint: '/vendor/profile', method: 'GET' },
  'VendorSettingsScreen': { endpoint: '/vendor/settings', method: 'GET' },
  
  // Customer Web
  'CustomerUserProfile': { endpoint: '/customer/profile', method: 'GET' },
  'CustomerPetProfile': { endpoint: '/customer/pets', method: 'GET' },
  'ServiceDiscovery': { endpoint: '/search/universal', method: 'GET' },
  'CustomerBookingsPage': { endpoint: '/customer/bookings', method: 'GET' },
  'CustomerWallet': { endpoint: '/customer/wallet', method: 'GET' },
  
  // Vendor Web
  'VendorServiceManagement': { endpoint: '/vendor/services', method: 'GET' },
  'VendorSettings': { endpoint: '/vendor/settings', method: 'GET' },
  'VendorBookings': { endpoint: '/vendor/bookings', method: 'GET' },
};

function checkFileForAPI(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.tsx');
    
    // Check for API patterns
    const hasApiClient = /apiClient|ApiService|Api\.|CustomerApi|VendorApi|AppointmentApi|OrderApi/.test(content);
    const hasUseEffect = /useEffect/.test(content);
    const hasFetch = /fetch\(|\.get\(|\.post\(|\.put\(|\.delete\(/.test(content);
    const hasApiCall = hasApiClient || hasFetch;
    const hasDataFetching = hasUseEffect && hasApiCall;
    
    // Check if it's a data-displaying screen (has state but no API)
    const hasState = /useState/.test(content);
    const needsAPI = hasState && !hasDataFetching;
    
    return {
      file: filePath,
      fileName,
      hasApiClient,
      hasUseEffect,
      hasFetch,
      hasApiCall,
      hasDataFetching,
      needsAPI,
      hasState
    };
  } catch (error) {
    return null;
  }
}

function getAllTsxFiles(dir) {
  const files = [];
  
  function walkDir(currentPath) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  walkDir(dir);
  return files;
}

function main() {
  console.log('🔍 Verifying API Integration...\n');
  
  const directories = [
    'apps/WarmpawzCustomer/src/screens',
    'apps/WarmpawzVendor/src/screens',
    'apps/customer-web/components/customer',
    'apps/vendor-web/components/vendor',
  ];
  
  const results = {
    withAPI: [],
    withoutAPI: [],
    needsAPI: []
  };
  
  for (const dir of directories) {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Directory not found: ${dir}`);
      continue;
    }
    
    const files = getAllTsxFiles(fullPath);
    console.log(`📁 ${dir}: ${files.length} files`);
    
    for (const file of files) {
      const result = checkFileForAPI(file);
      if (result) {
        if (result.hasDataFetching) {
          results.withAPI.push(result);
        } else if (result.needsAPI) {
          results.needsAPI.push(result);
          results.withoutAPI.push(result);
        } else {
          results.withoutAPI.push(result);
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Screens with API: ${results.withAPI.length}`);
  console.log(`❌ Screens without API: ${results.withoutAPI.length}`);
  console.log(`⚠️  Screens that need API: ${results.needsAPI.length}`);
  
  if (results.needsAPI.length > 0) {
    console.log('\n⚠️  Screens that need API integration:');
    results.needsAPI.slice(0, 20).forEach(r => {
      console.log(`   - ${r.fileName} (${path.relative(process.cwd(), r.file)})`);
    });
    if (results.needsAPI.length > 20) {
      console.log(`   ... and ${results.needsAPI.length - 20} more`);
    }
  }
  
  // Save results
  const output = {
    summary: {
      withAPI: results.withAPI.length,
      withoutAPI: results.withoutAPI.length,
      needsAPI: results.needsAPI.length
    },
    screens: {
      withAPI: results.withAPI.map(r => ({
        file: path.relative(process.cwd(), r.file),
        fileName: r.fileName
      })),
      needsAPI: results.needsAPI.map(r => ({
        file: path.relative(process.cwd(), r.file),
        fileName: r.fileName
      }))
    }
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'API_INTEGRATION_VERIFICATION.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('\n✅ Results saved to API_INTEGRATION_VERIFICATION.json');
}

if (require.main === module) {
  main();
}

module.exports = { checkFileForAPI };

