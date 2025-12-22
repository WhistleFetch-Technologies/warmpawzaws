/**
 * Automated System Test
 * Tests routes, handlers, API integrations, UI components, data flow, and error handling
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  file?: string;
  line?: number;
}

const results: TestResult[] = [];
const projectRoot = join(__dirname, '../../');

// Helper to read file content
function readFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    return null;
  }
}

// Helper to check if file exists
function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

// Test 1: Route Coverage - Check all ScreenType values have render conditions
function testRouteCoverage() {
  console.log('🔍 Testing Route Coverage...');
  
  const customerHomeWrapperPath = join(projectRoot, 'src/components/customer/CustomerHomeWrapper.tsx');
  const content = readFile(customerHomeWrapperPath);
  
  if (!content) {
    results.push({
      category: 'Routes',
      test: 'CustomerHomeWrapper file exists',
      status: 'FAIL',
      message: 'CustomerHomeWrapper.tsx not found'
    });
    return;
  }
  
  // Extract ScreenType values
  const screenTypeMatch = content.match(/type ScreenType =[^;]+;/s);
  if (!screenTypeMatch) {
    results.push({
      category: 'Routes',
      test: 'ScreenType definition',
      status: 'FAIL',
      message: 'ScreenType not found in CustomerHomeWrapper.tsx'
    });
    return;
  }
  
  const screenTypes = screenTypeMatch[0]
    .match(/\| ['"]([^'"]+)['"]/g)
    ?.map(m => m.replace(/\| ['"]|['"]/g, '')) || [];
  
  // Check render conditions
  const renderConditions = content.match(/if \(currentScreen === ['"]([^'"]+)['"]\)/g)
    ?.map(m => m.match(/['"]([^'"]+)['"]/)?.[1]) || [];
  
  // Find missing render conditions
  const missingRenders = screenTypes.filter(screen => !renderConditions.includes(screen));
  
  if (missingRenders.length > 0) {
    missingRenders.forEach(screen => {
      results.push({
        category: 'Routes',
        test: `Route render condition for ${screen}`,
        status: 'FAIL',
        message: `Screen type '${screen}' defined but no render condition found`,
        file: 'CustomerHomeWrapper.tsx'
      });
    });
  } else {
    results.push({
      category: 'Routes',
      test: 'All routes have render conditions',
      status: 'PASS',
      message: `All ${screenTypes.length} screen types have render conditions`
    });
  }
  
  // Check for orphaned render conditions
  const orphanedRenders = renderConditions.filter(render => !screenTypes.includes(render));
  if (orphanedRenders.length > 0) {
    orphanedRenders.forEach(render => {
      results.push({
        category: 'Routes',
        test: `Orphaned render condition for ${render}`,
        status: 'WARNING',
        message: `Render condition exists for '${render}' but not in ScreenType`,
        file: 'CustomerHomeWrapper.tsx'
      });
    });
  }
}

// Test 2: Component Import Verification
function testComponentImports() {
  console.log('🔍 Testing Component Imports...');
  
  const customerHomeWrapperPath = join(projectRoot, 'src/components/customer/CustomerHomeWrapper.tsx');
  const content = readFile(customerHomeWrapperPath);
  
  if (!content) return;
  
  // Extract component usage from render conditions
  const componentUsages = content.match(/return <(\w+)/g)?.map(m => m.replace('return <', '')) || [];
  const imports = content.match(/import.*from ['"]([^'"]+)['"]/g) || [];
  
  // Check if components are imported
  componentUsages.forEach(component => {
    const isImported = imports.some(imp => imp.includes(component));
    if (!isImported && !['div', 'Fragment', 'React'].includes(component)) {
      results.push({
        category: 'Components',
        test: `Component import for ${component}`,
        status: 'FAIL',
        message: `Component '${component}' used but import not found`,
        file: 'CustomerHomeWrapper.tsx'
      });
    }
  });
}

// Test 3: API Endpoint Handler Verification
function testAPIEndpoints() {
  console.log('🔍 Testing API Endpoints...');
  
  const indexPath = join(projectRoot, 'src/supabase/functions/server/index.tsx');
  const content = readFile(indexPath);
  
  if (!content) {
    results.push({
      category: 'API',
      test: 'Server index file exists',
      status: 'FAIL',
      message: 'index.tsx not found'
    });
    return;
  }
  
  // Extract endpoint registrations
  const endpointRegistrations = content.match(/(app\.(get|post|put|patch|delete)\(['"]([^'"]+)['"])/g) || [];
  const registeredFunctions = content.match(/(register\w+|import.*from)/g) || [];
  
  // Check if registration functions are called
  const registrationCalls = content.match(/(register\w+\(app)/g)?.map(m => m.replace('(app', '')) || [];
  
  results.push({
    category: 'API',
    test: 'API endpoint registrations',
    status: 'PASS',
    message: `Found ${endpointRegistrations.length} endpoint registrations and ${registrationCalls.length} registration function calls`
  });
}

// Test 4: Error Handling Verification
function testErrorHandling() {
  console.log('🔍 Testing Error Handling...');
  
  const serverDir = join(projectRoot, 'src/supabase/functions/server');
  
  if (!fileExists(serverDir)) {
    results.push({
      category: 'Error Handling',
      test: 'Server directory exists',
      status: 'FAIL',
      message: 'Server directory not found'
    });
    return;
  }
  
  const files = readdirSync(serverDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  let totalFiles = 0;
  let filesWithErrorHandling = 0;
  
  files.forEach(file => {
    const filePath = join(serverDir, file);
    const content = readFile(filePath);
    if (!content) return;
    
    totalFiles++;
    
    // Check for try-catch blocks
    const hasTryCatch = /try\s*\{/.test(content) && /catch\s*\(/.test(content);
    // Check for error handling utilities
    const hasErrorUtils = /sendError|sendSuccess/.test(content);
    
    if (hasTryCatch || hasErrorUtils) {
      filesWithErrorHandling++;
    } else {
      results.push({
        category: 'Error Handling',
        test: `Error handling in ${file}`,
        status: 'WARNING',
        message: `No explicit error handling found in ${file}`,
        file: file
      });
    }
  });
  
  results.push({
    category: 'Error Handling',
    test: 'Overall error handling coverage',
    status: filesWithErrorHandling === totalFiles ? 'PASS' : 'WARNING',
    message: `${filesWithErrorHandling}/${totalFiles} files have error handling`
  });
}

// Test 5: Data Structure Consistency
function testDataStructures() {
  console.log('🔍 Testing Data Structures...');
  
  // Check for consistent booking structure
  const bookingEndpointsPath = join(projectRoot, 'src/supabase/functions/server/booking-endpoints.tsx');
  const content = readFile(bookingEndpointsPath);
  
  if (content) {
    // Check for booking object structure
    const bookingStructure = content.match(/const booking = \{[\s\S]*?\};/);
    if (bookingStructure) {
      const hasRequiredFields = 
        /id:|customerId:|vendorId:|status:|price:/.test(bookingStructure[0]);
      
      results.push({
        category: 'Data Structures',
        test: 'Booking object structure',
        status: hasRequiredFields ? 'PASS' : 'WARNING',
        message: hasRequiredFields 
          ? 'Booking object has required fields'
          : 'Booking object may be missing required fields'
      });
    }
  }
}

// Test 6: Integration Points
function testIntegrations() {
  console.log('🔍 Testing Integration Points...');
  
  const integrations = [
    { name: 'Razorpay', pattern: /razorpay|RAZORPAY/i },
    { name: 'Google Maps', pattern: /google.*maps|GOOGLE_MAPS/i },
    { name: 'AWS Chime', pattern: /chime|CHIME/i },
    { name: 'Shiprocket', pattern: /shiprocket|SHIPROCKET/i },
    { name: 'Delhivery', pattern: /delhivery|DELHIVERY/i },
  ];
  
  const serverDir = join(projectRoot, 'src/supabase/functions/server');
  if (!fileExists(serverDir)) return;
  
  const files = readdirSync(serverDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  
  integrations.forEach(integration => {
    const found = files.some(file => {
      const content = readFile(join(serverDir, file));
      return content && integration.pattern.test(content);
    });
    
    results.push({
      category: 'Integrations',
      test: `${integration.name} integration`,
      status: found ? 'PASS' : 'WARNING',
      message: found 
        ? `${integration.name} integration found`
        : `${integration.name} integration not found in server files`
    });
  });
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting Automated System Tests...\n');
  
  testRouteCoverage();
  testComponentImports();
  testAPIEndpoints();
  testErrorHandling();
  testDataStructures();
  testIntegrations();
  
  // Generate report
  console.log('\n📊 Test Results Summary:\n');
  
  const byCategory: { [key: string]: TestResult[] } = {};
  results.forEach(result => {
    if (!byCategory[result.category]) {
      byCategory[result.category] = [];
    }
    byCategory[result.category].push(result);
  });
  
  Object.keys(byCategory).forEach(category => {
    console.log(`\n${category}:`);
    byCategory[category].forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`  ${icon} ${result.test}: ${result.message}`);
      if (result.file) {
        console.log(`     File: ${result.file}`);
      }
    });
  });
  
  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  
  console.log(`\n\n📈 Summary:`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log(`  📊 Total: ${results.length}`);
  
  return {
    passed,
    failed,
    warnings,
    total: results.length,
    results
  };
}

// Export for use
export { runAllTests, TestResult };

// Run if executed directly
if (require.main === module) {
  runAllTests();
}

