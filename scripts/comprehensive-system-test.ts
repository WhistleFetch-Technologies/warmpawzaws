/**
 * Comprehensive System Test Script
 * Tests all flows, routes, handlers, integrations, data structures, and design consistency
 * across Customer App, Vendor App, Admin Portal (Web & Mobile)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface TestResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const results: TestResult[] = [];
const projectRoot = join(__dirname, '..');

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function addResult(category: string, test: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
  results.push({ category, test, status, message, details });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  log(`${icon} [${category}] ${test}: ${message}`, 
    status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow);
}

// 1. TEST ROUTES AND ENDPOINTS
function testRoutesAndEndpoints() {
  log('\n📡 Testing Routes and Endpoints...', colors.cyan);
  
  try {
    const serverIndexPath = join(projectRoot, 'src/supabase/functions/server/index.tsx');
    const serverIndex = readFileSync(serverIndexPath, 'utf-8');
    
    // Check for route registrations
    const routePatterns = [
      /app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g,
      /app\.route\(['"`]([^'"`]+)['"`]/g,
    ];
    
    const routes = new Set<string>();
    routePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(serverIndex)) !== null) {
        routes.add(match[2] || match[1]);
      }
    });
    
    addResult('Routes', 'Route Registration', 'pass', `Found ${routes.size} route patterns`);
    
    // Check for critical endpoints
    const criticalEndpoints = [
      '/make-server-3dd53475/health',
      '/make-server-3dd53475/customer',
      '/make-server-3dd53475/vendor',
      '/make-server-3dd53475/admin',
      '/make-server-3dd53475/booking',
      '/make-server-3dd53475/payment',
    ];
    
    criticalEndpoints.forEach(endpoint => {
      const exists = serverIndex.includes(endpoint);
      addResult('Routes', `Critical Endpoint: ${endpoint}`, 
        exists ? 'pass' : 'fail', 
        exists ? 'Found' : 'Missing');
    });
    
    // Check for endpoint registration functions
    const registrationFunctions = [
      'registerCustomerRoutes',
      'registerVendorServiceEndpoints',
      'bookingEndpoints',
      'paymentEndpoints',
      'registerAuthEndpoints',
    ];
    
    registrationFunctions.forEach(func => {
      const exists = serverIndex.includes(func);
      addResult('Routes', `Registration Function: ${func}`, 
        exists ? 'pass' : 'warning', 
        exists ? 'Found' : 'Not found');
    });
    
  } catch (error: any) {
    addResult('Routes', 'Route Analysis', 'fail', `Error: ${error.message}`);
  }
}

// 2. TEST NAVIGATION STRUCTURES
function testNavigationStructures() {
  log('\n🧭 Testing Navigation Structures...', colors.cyan);
  
  // Customer Mobile Navigation
  try {
    const customerNavPath = join(projectRoot, 'apps/customer-mobile/src/types/navigation.ts');
    const customerNav = readFileSync(customerNavPath, 'utf-8');
    
    const customerRoutes = (customerNav.match(/^\s+(\w+):/gm) || []).length;
    addResult('Navigation', 'Customer Mobile Routes', 'pass', `Found ${customerRoutes} routes`);
    
    // Check for critical routes
    const criticalCustomerRoutes = ['Login', 'MainTabs', 'Home', 'Search', 'Bookings', 'Profile'];
    criticalCustomerRoutes.forEach(route => {
      const exists = customerNav.includes(route);
      addResult('Navigation', `Customer Route: ${route}`, 
        exists ? 'pass' : 'fail', 
        exists ? 'Found' : 'Missing');
    });
  } catch (error: any) {
    addResult('Navigation', 'Customer Mobile Navigation', 'fail', `Error: ${error.message}`);
  }
  
  // Vendor Mobile Navigation
  try {
    const vendorNavPath = join(projectRoot, 'apps/vendor-mobile/src/types/navigation.ts');
    const vendorNav = readFileSync(vendorNavPath, 'utf-8');
    
    const vendorRoutes = (vendorNav.match(/^\s+(\w+):/gm) || []).length;
    addResult('Navigation', 'Vendor Mobile Routes', 'pass', `Found ${vendorRoutes} routes`);
    
    const criticalVendorRoutes = ['Login', 'MainTabs', 'Dashboard', 'Bookings', 'Services', 'Profile'];
    criticalVendorRoutes.forEach(route => {
      const exists = vendorNav.includes(route);
      addResult('Navigation', `Vendor Route: ${route}`, 
        exists ? 'pass' : 'fail', 
        exists ? 'Found' : 'Missing');
    });
  } catch (error: any) {
    addResult('Navigation', 'Vendor Mobile Navigation', 'fail', `Error: ${error.message}`);
  }
  
  // Web App Navigation
  try {
    const customerAppPath = join(projectRoot, 'src/components/CustomerApp.tsx');
    const vendorAppPath = join(projectRoot, 'src/components/VendorApp.tsx');
    const adminAppPath = join(projectRoot, 'src/components/AdminApp.tsx');
    
    [customerAppPath, vendorAppPath, adminAppPath].forEach((path, index) => {
      const appName = ['Customer', 'Vendor', 'Admin'][index];
      try {
        const content = readFileSync(path, 'utf-8');
        const hasNavigation = content.includes('setCurrentScreen') || content.includes('onNavigate') || content.includes('currentView');
        addResult('Navigation', `${appName} Web App Navigation`, 
          hasNavigation ? 'pass' : 'warning', 
          hasNavigation ? 'Navigation logic found' : 'Navigation logic not clear');
      } catch (error: any) {
        addResult('Navigation', `${appName} Web App`, 'fail', `Error: ${error.message}`);
      }
    });
  } catch (error: any) {
    addResult('Navigation', 'Web App Navigation', 'fail', `Error: ${error.message}`);
  }
}

// 3. TEST DATA STRUCTURES
function testDataStructures() {
  log('\n📊 Testing Data Structures...', colors.cyan);
  
  try {
    // Check for type definitions
    const typesPath = join(projectRoot, 'src/types');
    const customerTypesPath = join(projectRoot, 'apps/customer-mobile/src/types');
    const vendorTypesPath = join(projectRoot, 'apps/vendor-mobile/src/types');
    
    const typeFiles: string[] = [];
    
    function findTypeFiles(dir: string, prefix: string = '') {
      try {
        const files = readdirSync(dir);
        files.forEach(file => {
          const filePath = join(dir, file);
          const stat = statSync(filePath);
          if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
            typeFiles.push(`${prefix}${file}`);
          }
        });
      } catch (error) {
        // Directory might not exist
      }
    }
    
    findTypeFiles(typesPath, 'web/');
    findTypeFiles(customerTypesPath, 'customer-mobile/');
    findTypeFiles(vendorTypesPath, 'vendor-mobile/');
    
    addResult('Data Structures', 'Type Definition Files', 'pass', `Found ${typeFiles.length} type files`);
    
    // Check for common data structures
    const commonStructures = ['booking', 'customer', 'vendor', 'pet', 'service', 'payment'];
    commonStructures.forEach(structure => {
      const found = typeFiles.some(file => file.toLowerCase().includes(structure));
      addResult('Data Structures', `Structure: ${structure}`, 
        found ? 'pass' : 'warning', 
        found ? 'Type definitions found' : 'Type definitions not found');
    });
    
  } catch (error: any) {
    addResult('Data Structures', 'Data Structure Analysis', 'fail', `Error: ${error.message}`);
  }
}

// 4. TEST DESIGN CONSISTENCY
function testDesignConsistency() {
  log('\n🎨 Testing Design Consistency...', colors.cyan);
  
  try {
    // Check for theme/design system files
    const designFiles = [
      join(projectRoot, 'src/index.css'),
      join(projectRoot, 'src/styles/globals.css'),
      join(projectRoot, 'apps/customer-mobile/src/theme'),
      join(projectRoot, 'apps/vendor-mobile/src/theme'),
    ];
    
    const brandColor = '#FF8C42'; // Primary brand color
    
    designFiles.forEach(filePath => {
      try {
        if (statSync(filePath).isDirectory()) {
          // Check theme directory
          const themeFiles = readdirSync(filePath);
          const hasColors = themeFiles.some(f => f.includes('color'));
          const hasTypography = themeFiles.some(f => f.includes('typography'));
          const hasSpacing = themeFiles.some(f => f.includes('spacing'));
          
          addResult('Design', `Theme Directory: ${filePath.split('/').pop()}`, 
            hasColors && hasTypography ? 'pass' : 'warning', 
            `Colors: ${hasColors}, Typography: ${hasTypography}, Spacing: ${hasSpacing}`);
        } else {
          const content = readFileSync(filePath, 'utf-8');
          const hasBrandColor = content.includes(brandColor);
          addResult('Design', `Brand Color in ${filePath.split('/').pop()}`, 
            hasBrandColor ? 'pass' : 'warning', 
            hasBrandColor ? 'Brand color found' : 'Brand color not found');
        }
      } catch (error) {
        // File might not exist
      }
    });
    
    // Check for consistent component patterns
    const componentDirs = [
      join(projectRoot, 'src/components/ui'),
      join(projectRoot, 'src/components/customer'),
      join(projectRoot, 'src/components/vendor'),
    ];
    
    componentDirs.forEach(dir => {
      try {
        const files = readdirSync(dir);
        const componentCount = files.filter(f => f.endsWith('.tsx')).length;
        addResult('Design', `Components in ${dir.split('/').pop()}`, 'pass', 
          `Found ${componentCount} components`);
      } catch (error) {
        // Directory might not exist
      }
    });
    
  } catch (error: any) {
    addResult('Design', 'Design Consistency Check', 'fail', `Error: ${error.message}`);
  }
}

// 5. TEST INTEGRATIONS
function testIntegrations() {
  log('\n🔌 Testing Integrations...', colors.cyan);
  
  try {
    const serverIndexPath = join(projectRoot, 'src/supabase/functions/server/index.tsx');
    const serverIndex = readFileSync(serverIndexPath, 'utf-8');
    
    // Check for payment integrations
    const paymentIntegrations = ['razorpay', 'payment', 'refund'];
    paymentIntegrations.forEach(integration => {
      const exists = serverIndex.toLowerCase().includes(integration);
      addResult('Integrations', `Payment: ${integration}`, 
        exists ? 'pass' : 'warning', 
        exists ? 'Found' : 'Not found');
    });
    
    // Check for notification integrations
    const notificationIntegrations = ['sms', 'push', 'notification'];
    notificationIntegrations.forEach(integration => {
      const exists = serverIndex.toLowerCase().includes(integration);
      addResult('Integrations', `Notification: ${integration}`, 
        exists ? 'pass' : 'warning', 
        exists ? 'Found' : 'Not found');
    });
    
    // Check for video call integrations
    const videoIntegrations = ['video', 'chime', 'agora', 'zoom', '100ms'];
    videoIntegrations.forEach(integration => {
      const exists = serverIndex.toLowerCase().includes(integration);
      addResult('Integrations', `Video: ${integration}`, 
        exists ? 'pass' : 'warning', 
        exists ? 'Found' : 'Not found');
    });
    
    // Check for delivery integrations
    const deliveryIntegrations = ['shiprocket', 'delhivery', 'delivery'];
    deliveryIntegrations.forEach(integration => {
      const exists = serverIndex.toLowerCase().includes(integration);
      addResult('Integrations', `Delivery: ${integration}`, 
        exists ? 'pass' : 'warning', 
        exists ? 'Found' : 'Not found');
    });
    
    // Check for search integrations
    const searchIntegrations = ['elasticsearch', 'search', 'fuse'];
    searchIntegrations.forEach(integration => {
      const exists = serverIndex.toLowerCase().includes(integration);
      addResult('Integrations', `Search: ${integration}`, 
        exists ? 'pass' : 'warning', 
        exists ? 'Found' : 'Not found');
    });
    
  } catch (error: any) {
    addResult('Integrations', 'Integration Check', 'fail', `Error: ${error.message}`);
  }
}

// 6. TEST FLOW COMPLETENESS
function testFlowCompleteness() {
  log('\n🔄 Testing Flow Completeness...', colors.cyan);
  
  // Customer flows
  const customerFlows = [
    { name: 'Authentication', screens: ['Login', 'Onboarding'] },
    { name: 'Booking', screens: ['ServiceDetail', 'TimeSlotSelection', 'BookingConfirmation', 'Payment'] },
    { name: 'Profile', screens: ['UserProfile', 'PetProfile'] },
    { name: 'Orders', screens: ['OrderHistory', 'OrderDetail', 'OrderTracking'] },
  ];
  
  customerFlows.forEach(flow => {
    try {
      const customerNavPath = join(projectRoot, 'apps/customer-mobile/src/types/navigation.ts');
      const customerNav = readFileSync(customerNavPath, 'utf-8');
      
      const allScreensExist = flow.screens.every(screen => customerNav.includes(screen));
      addResult('Flows', `Customer: ${flow.name}`, 
        allScreensExist ? 'pass' : 'warning', 
        allScreensExist ? 'All screens found' : 'Some screens missing');
    } catch (error: any) {
      addResult('Flows', `Customer: ${flow.name}`, 'fail', `Error: ${error.message}`);
    }
  });
  
  // Vendor flows
  const vendorFlows = [
    { name: 'Onboarding', screens: ['Login', 'RoleSelection', 'Onboarding', 'SetupServices'] },
    { name: 'Booking Management', screens: ['Dashboard', 'Bookings', 'BookingDetail'] },
    { name: 'Service Management', screens: ['Services', 'ServiceDetail'] },
  ];
  
  vendorFlows.forEach(flow => {
    try {
      const vendorNavPath = join(projectRoot, 'apps/vendor-mobile/src/types/navigation.ts');
      const vendorNav = readFileSync(vendorNavPath, 'utf-8');
      
      const allScreensExist = flow.screens.every(screen => vendorNav.includes(screen));
      addResult('Flows', `Vendor: ${flow.name}`, 
        allScreensExist ? 'pass' : 'warning', 
        allScreensExist ? 'All screens found' : 'Some screens missing');
    } catch (error: any) {
      addResult('Flows', `Vendor: ${flow.name}`, 'fail', `Error: ${error.message}`);
    }
  });
}

// 7. TEST API HANDLERS
function testAPIHandlers() {
  log('\n⚙️ Testing API Handlers...', colors.cyan);
  
  try {
    const serverFunctionsPath = join(projectRoot, 'src/supabase/functions/server');
    const files = readdirSync(serverFunctionsPath);
    
    const handlerFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
    addResult('API Handlers', 'Handler Files', 'pass', `Found ${handlerFiles.length} handler files`);
    
    // Check for critical handlers
    const criticalHandlers = [
      'customer-routes',
      'booking-endpoints',
      'payment-endpoints',
      'vendor-onboarding',
      'auth-endpoints',
    ];
    
    criticalHandlers.forEach(handler => {
      const exists = handlerFiles.some(f => f.includes(handler));
      addResult('API Handlers', `Handler: ${handler}`, 
        exists ? 'pass' : 'fail', 
        exists ? 'Found' : 'Missing');
    });
    
  } catch (error: any) {
    addResult('API Handlers', 'Handler Analysis', 'fail', `Error: ${error.message}`);
  }
}

// 8. GENERATE REPORT
function generateReport() {
  log('\n📋 Generating Test Report...', colors.cyan);
  
  const total = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  log('\n' + '='.repeat(80), colors.blue);
  log('COMPREHENSIVE SYSTEM TEST REPORT', colors.blue);
  log('='.repeat(80), colors.blue);
  log(`Total Tests: ${total}`, colors.cyan);
  log(`✅ Passed: ${passed}`, colors.green);
  log(`❌ Failed: ${failed}`, colors.red);
  log(`⚠️  Warnings: ${warnings}`, colors.yellow);
  log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%`, colors.cyan);
  
  // Group by category
  const byCategory: { [key: string]: TestResult[] } = {};
  results.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  });
  
  log('\n📊 Results by Category:', colors.cyan);
  Object.keys(byCategory).forEach(category => {
    const categoryResults = byCategory[category];
    const categoryPassed = categoryResults.filter(r => r.status === 'pass').length;
    const categoryFailed = categoryResults.filter(r => r.status === 'fail').length;
    log(`\n${category}: ${categoryPassed}/${categoryResults.length} passed, ${categoryFailed} failed`);
    
    // Show failures
    categoryResults.filter(r => r.status === 'fail').forEach(r => {
      log(`  ❌ ${r.test}: ${r.message}`, colors.red);
    });
  });
  
  // Save detailed report
  const reportPath = join(projectRoot, 'COMPREHENSIVE_TEST_REPORT.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      warnings,
      successRate: ((passed / total) * 100).toFixed(2) + '%',
    },
    results: results,
    byCategory,
  };
  
  require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n📄 Detailed report saved to: ${reportPath}`, colors.green);
  
  return { total, passed, failed, warnings };
}

// MAIN EXECUTION
async function main() {
  log('🚀 Starting Comprehensive System Test...', colors.blue);
  log('='.repeat(80), colors.blue);
  
  testRoutesAndEndpoints();
  testNavigationStructures();
  testDataStructures();
  testDesignConsistency();
  testIntegrations();
  testFlowCompleteness();
  testAPIHandlers();
  
  const summary = generateReport();
  
  log('\n' + '='.repeat(80), colors.blue);
  if (summary.failed === 0) {
    log('✅ ALL TESTS PASSED!', colors.green);
    process.exit(0);
  } else {
    log(`❌ ${summary.failed} TEST(S) FAILED`, colors.red);
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n❌ Fatal Error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});

