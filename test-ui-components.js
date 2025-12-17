/**
 * UI COMPONENT PRESENCE AND RENDERING TEST
 * Tests React component existence, imports, and basic structure
 */

const fs = require('fs');
const path = require('path');

const components = [
  {
    name: 'SubscriptionPackageScheduleSelector',
    path: 'src/components/customer/booking/SubscriptionPackageScheduleSelector.tsx',
    requiredExports: ['SubscriptionPackageScheduleSelector'],
    requiredImports: ['react', 'Button', 'Card', 'Clock', 'Calendar']
  },
  {
    name: 'PreviousProvidersCarousel',
    path: 'src/components/customer/PreviousProvidersCarousel.tsx',
    requiredExports: ['PreviousProvidersCarousel'],
    requiredImports: ['react', 'Card', 'Button', 'Star']
  },
  {
    name: 'RadarServiceDiscovery',
    path: 'src/components/customer/RadarServiceDiscovery.tsx',
    requiredExports: ['RadarServiceDiscovery'],
    requiredImports: ['react', 'Card', 'Button', 'MapPin']
  }
];

console.log('🧪 UI COMPONENT TEST SUITE');
console.log('==========================\n');

let passed = 0;
let failed = 0;

components.forEach(component => {
  console.log(`Testing: ${component.name}`);
  console.log(`  Path: ${component.path}`);
  
  // Check file exists
  if (!fs.existsSync(component.path)) {
    console.log(`  ❌ File not found\n`);
    failed++;
    return;
  }
  
  console.log(`  ✓ File exists`);
  passed++;
  
  // Read file content
  const content = fs.readFileSync(component.path, 'utf8');
  
  // Check required exports
  component.requiredExports.forEach(exportName => {
    if (content.includes(`export function ${exportName}`) || 
        content.includes(`export const ${exportName}`) ||
        content.includes(`export { ${exportName}`)) {
      console.log(`  ✓ Export '${exportName}' found`);
      passed++;
    } else {
      console.log(`  ❌ Export '${exportName}' NOT found`);
      failed++;
    }
  });
  
  // Check required imports
  component.requiredImports.forEach(importName => {
    if (content.includes(`from '${importName}'`) || 
        content.includes(`from "${importName}"`) ||
        content.includes(`import.*${importName}`)) {
      console.log(`  ✓ Import '${importName}' found`);
      passed++;
    } else {
      console.log(`  ⚠ Import '${importName}' not explicitly found (may be indirect)`);
    }
  });
  
  // Check for TypeScript interface
  if (content.includes('interface') || content.includes('type ')) {
    console.log(`  ✓ TypeScript types defined`);
    passed++;
  }
  
  // Check for props interface
  if (content.includes('Props') || content.includes('interface')) {
    console.log(`  ✓ Component props defined`);
    passed++;
  }
  
  console.log('');
});

console.log('==========================================');
console.log('📊 UI COMPONENT TEST RESULTS');
console.log('==========================================');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('');

if (failed === 0) {
  console.log('✅ All UI component tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some UI component tests failed');
  process.exit(1);
}

