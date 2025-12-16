/**
 * Package Dependency Test Script
 * Tests all npm and jsr packages to ensure they can be imported and their dependencies are available
 */

console.log('🧪 Testing package imports and dependencies...\n');

const packages = [
  // Core Framework
  { name: 'hono', import: "npm:hono@^4.6.14" },
  { name: 'hono/cors', import: "npm:hono@^4.6.14/cors" },
  { name: 'hono/logger', import: "npm:hono@^4.6.14/logger" },
  { name: 'hono/streaming', import: "npm:hono@^4.6.14/streaming" },
  { name: 'hono/utils/http-status', import: "npm:hono@^4.6.14/utils/http-status" },
  
  // Utilities
  { name: 'fuse.js', import: "npm:fuse.js@^7.0.0" },
  { name: 'date-fns', import: "npm:date-fns@^3.0.0" },
  
  // AWS SDK
  { name: '@aws-sdk/client-bedrock-runtime', import: "npm:@aws-sdk/client-bedrock-runtime@^3" },
  { name: '@aws-sdk/client-chime-sdk-meetings', import: "npm:@aws-sdk/client-chime-sdk-meetings@^3.450.0" },
  { name: '@aws-sdk/client-s3', import: "npm:@aws-sdk/client-s3@^3" },
  { name: '@aws-sdk/client-sns', import: "npm:@aws-sdk/client-sns@^3" },
  { name: '@aws-sdk/client-ses', import: "npm:@aws-sdk/client-ses@^3" },
  { name: '@aws-sdk/client-sts', import: "npm:@aws-sdk/client-sts@^3" },
  { name: '@smithy/node-http-handler', import: "npm:@smithy/node-http-handler@^3" },
  
  // Supabase
  { name: '@supabase/supabase-js', import: "jsr:@supabase/supabase-js@2" },
  { name: '@supabase/supabase-js@2.49.8', import: "jsr:@supabase/supabase-js@2.49.8" },
];

const results: Array<{ name: string; status: 'pass' | 'fail'; error?: string }> = [];

for (const pkg of packages) {
  try {
    console.log(`Testing ${pkg.name}...`);
    const module = await import(pkg.import);
    
    if (module && (module.default || Object.keys(module).length > 0)) {
      console.log(`  ✅ ${pkg.name} - OK`);
      results.push({ name: pkg.name, status: 'pass' });
    } else {
      console.log(`  ⚠️  ${pkg.name} - Empty module`);
      results.push({ name: pkg.name, status: 'fail', error: 'Empty module' });
    }
  } catch (error: any) {
    console.log(`  ❌ ${pkg.name} - FAILED: ${error.message}`);
    results.push({ name: pkg.name, status: 'fail', error: error.message });
  }
}

console.log('\n📊 Test Results Summary:');
console.log('='.repeat(50));

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;

console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed > 0) {
  console.log('\n❌ Failed Packages:');
  results.filter(r => r.status === 'fail').forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
}

console.log('\n' + '='.repeat(50));

if (failed === 0) {
  console.log('🎉 All packages are working correctly!');
  Deno.exit(0);
} else {
  console.log('⚠️  Some packages failed. Please check the errors above.');
  Deno.exit(1);
}

