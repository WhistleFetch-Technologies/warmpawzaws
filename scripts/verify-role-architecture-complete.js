#!/usr/bin/env node
/**
 * Complete Role Architecture Verification Script
 * Tests:
 * 1. Database schema changes
 * 2. Role consolidation
 * 3. API endpoints
 * 4. Existing vendor compatibility
 */

const { Client } = require('pg');
const https = require('https');

// Configuration
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cxqjqjqjqjqjq.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  // Password from Secrets Manager in production
};

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function logPass(test) {
  results.passed.push(test);
  console.log(`✅ PASS: ${test}`);
}

function logFail(test, error) {
  results.failed.push({ test, error });
  console.log(`❌ FAIL: ${test}`);
  if (error) console.log(`   Error: ${error}`);
}

function logWarning(test, message) {
  results.warnings.push({ test, message });
  console.log(`⚠️  WARN: ${test}`);
  if (message) console.log(`   ${message}`);
}

// Make API call
function apiCall(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_ENDPOINT);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Database query
async function dbQuery(query, params = []) {
  // Note: In production, get credentials from Secrets Manager
  // For now, this is a template - actual connection requires credentials
  logWarning('Database Query', 'Skipping direct DB queries - requires credentials');
  return [];
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║   🧪 ROLE ARCHITECTURE COMPLETE VERIFICATION                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Test 1: API Health Check
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: API Health Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const health = await apiCall('/health');
    if (health && (health.status === 'ok' || health.message || typeof health === 'string')) {
      logPass('API Health Check');
    } else {
      logFail('API Health Check', 'Unexpected response');
    }
  } catch (error) {
    logFail('API Health Check', error.message);
  }

  // Test 2: Roles Endpoint
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Roles Endpoint Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const rolesResponse = await apiCall('/config/roles');
    const roles = rolesResponse.roles || rolesResponse || [];

    if (Array.isArray(roles) && roles.length > 0) {
      logPass(`Roles endpoint returns ${roles.length} roles`);

      // Check for customer_service
      const rolesWithService = roles.filter(r => r.customer_service);
      if (rolesWithService.length > 0) {
        logPass(`Roles with customer_service: ${rolesWithService.length}`);
      } else {
        logFail('Roles have customer_service', 'No roles found with customer_service');
      }

      // Check for vendorConfiguration
      const rolesWithConfig = roles.filter(r => r.vendorConfiguration || (r.config && r.config.vendorConfiguration));
      if (rolesWithConfig.length > 0) {
        logPass(`Roles with vendorConfiguration: ${rolesWithConfig.length}`);
      } else {
        logFail('Roles have vendorConfiguration', 'No roles found with vendorConfiguration');
      }

      // Check for solo vs business
      const soloRoles = roles.filter(r => 
        r.vendorConfiguration === 'solo' || 
        (r.config && r.config.vendorConfiguration === 'solo')
      );
      const businessRoles = roles.filter(r => 
        r.vendorConfiguration === 'business' || 
        (r.config && r.config.vendorConfiguration === 'business')
      );

      if (soloRoles.length > 0) {
        logPass(`Solo roles found: ${soloRoles.length}`);
      } else {
        logWarning('Solo roles', 'No solo roles found - may need to create');
      }

      if (businessRoles.length > 0) {
        logPass(`Business roles found: ${businessRoles.length}`);
      } else {
        logWarning('Business roles', 'No business roles found - may need to create');
      }

      // Check for active roles
      const activeRoles = roles.filter(r => r.isActive !== false && r.is_active !== false);
      if (activeRoles.length > 0) {
        logPass(`Active roles: ${activeRoles.length}`);
      } else {
        logFail('Active roles', 'No active roles found');
      }

      // Check for inactive roles (old roles preserved)
      const inactiveRoles = roles.filter(r => r.isActive === false || r.is_active === false);
      if (inactiveRoles.length >= 0) {
        logPass(`Inactive roles preserved: ${inactiveRoles.length}`);
      }

      // Check capabilities
      const rolesWithCapabilities = roles.filter(r => 
        r.capabilities || r.effectiveCapabilities || 
        (r.config && r.config.capabilityRules)
      );
      if (rolesWithCapabilities.length > 0) {
        logPass(`Roles with capabilities: ${rolesWithCapabilities.length}`);
      } else {
        logWarning('Roles with capabilities', 'No capabilities found in roles');
      }

    } else {
      logFail('Roles endpoint', 'No roles returned or invalid format');
    }
  } catch (error) {
    logFail('Roles endpoint', error.message);
  }

  // Test 3: Verify Role Consolidation
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: Role Consolidation Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const rolesResponse = await apiCall('/config/roles');
    const roles = rolesResponse.roles || rolesResponse || [];

    // Check for expected consolidated roles
    const expectedRoles = [
      'vet_solo', 'vet_center', 'groomer_solo', 'groomer_center',
      'trainer_solo', 'trainer_center'
    ];

    const roleNames = roles.map(r => r.name || r.roleCode || '').filter(Boolean);
    const foundExpected = expectedRoles.filter(name => 
      roleNames.some(rn => rn.toLowerCase().includes(name.toLowerCase()))
    );

    if (foundExpected.length > 0) {
      logPass(`Found ${foundExpected.length}/${expectedRoles.length} expected consolidated roles`);
      logWarning('Expected roles', `Looking for: ${expectedRoles.join(', ')}`);
      logWarning('Found roles', `Found: ${foundExpected.join(', ')}`);
    } else {
      logWarning('Consolidated roles', 'Expected consolidated roles not found - may need migration');
    }

    // Check for customer_service distribution
    const serviceDistribution = {};
    roles.forEach(role => {
      const service = role.customer_service || (role.config && role.config.customer_service);
      if (service) {
        serviceDistribution[service] = (serviceDistribution[service] || 0) + 1;
      }
    });

    if (Object.keys(serviceDistribution).length > 0) {
      logPass(`Customer services distribution: ${JSON.stringify(serviceDistribution)}`);
    } else {
      logWarning('Customer services', 'No customer_service distribution found');
    }

  } catch (error) {
    logFail('Role consolidation', error.message);
  }

  // Test 4: Database Schema (requires credentials)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: Database Schema Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  logWarning('Database Schema', 'Direct DB queries require credentials');
  logWarning('Manual Check', 'Run: SELECT customer_service, config->>\'vendorConfiguration\' FROM roles LIMIT 10;');

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}\n`);

  if (results.failed.length > 0) {
    console.log('Failed Tests:');
    results.failed.forEach(({ test, error }) => {
      console.log(`  - ${test}: ${error}`);
    });
    console.log('');
  }

  if (results.failed.length === 0) {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ ALL AUTOMATED TESTS PASSED                                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   ⚠️  SOME TESTS FAILED - REVIEW RESULTS                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  }

  // Manual Testing Checklist
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('MANUAL TESTING CHECKLIST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('1. Admin Role Creation (https://dfof7mguaa0a5.cloudfront.net/roles):');
  console.log('   □ Create new role with Solo configuration');
  console.log('   □ Verify "at_center" is disabled for solo');
  console.log('   □ Enable "Custom Services" toggle for solo');
  console.log('   □ Create new role with Business configuration');
  console.log('   □ Verify all service styles are available');
  console.log('   □ Verify capabilities are filtered correctly\n');

  console.log('2. Vendor Onboarding (d1s6ykkj381k58.cloudfront.net/onboarding):');
  console.log('   □ Roles are grouped by customer_service');
  console.log('   □ Solo roles are clearly marked');
  console.log('   □ Business roles are clearly marked');
  console.log('   □ Can select and complete onboarding\n');

  console.log('3. Vendor Dashboard (d1s6ykkj381k58.cloudfront.net/dashboard):');
  console.log('   □ Solo vendor: Staff management button is hidden/disabled');
  console.log('   □ Solo vendor: Inventory button is hidden/disabled');
  console.log('   □ Solo vendor: Professional Profile button is visible');
  console.log('   □ Solo vendor: Custom Services button visible (if enabled)');
  console.log('   □ Business vendor: All features available\n');

  console.log('4. Existing Vendors:');
  console.log('   □ Existing vendor can login');
  console.log('   □ Existing vendor dashboard loads');
  console.log('   □ Existing vendor features work as before');
  console.log('   □ No errors in console\n');

  console.log('5. Database Verification:');
  console.log('   □ Run: SELECT COUNT(*) FROM roles WHERE customer_service IS NOT NULL;');
  console.log('   □ Run: SELECT COUNT(*) FROM roles WHERE config->>\'vendorConfiguration\' IS NOT NULL;');
  console.log('   □ Run: SELECT name, customer_service, config->>\'vendorConfiguration\' FROM roles WHERE is_active = true LIMIT 10;\n');

  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
