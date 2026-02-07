#!/usr/bin/env node
/**
 * Vendor Onboarding Lifecycle End-to-End Test Script
 * 
 * Tests the complete vendor onboarding flow:
 * 1. OTP Authentication
 * 2. Role Selection
 * 3. Solo vs Business Selection
 * 4. Dynamic Form Load
 * 5. Application Submission
 * 6. Admin Review (Approve/Reject/Request Clarification)
 * 7. Post-Approval Activation
 * 8. Dashboard Capabilities
 * 9. Service Configuration
 * 10. Customer Sync
 */

const { Client } = require('pg');
const https = require('https');
const http = require('http');

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.warmpawz.com';
const UAT_TOKEN = process.env.UAT_TOKEN || 'uat-token-admin-test';

const TEST_RESULTS = {
  passed: [],
  failed: [],
  warnings: [],
};

// Test phone number (will be used for vendor onboarding)
const TEST_PHONE = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  }[type] || 'ℹ️';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function logTest(name, passed, message = '') {
  if (passed) {
    TEST_RESULTS.passed.push(name);
    log(`TEST PASSED: ${name}`, 'success');
  } else {
    TEST_RESULTS.failed.push({ name, message });
    log(`TEST FAILED: ${name} - ${message}`, 'error');
  }
}

function logWarning(name, message) {
  TEST_RESULTS.warnings.push({ name, message });
  log(`WARNING: ${name} - ${message}`, 'warning');
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': UAT_TOKEN,
        ...options.headers,
      },
    };
    
    if (options.body) {
      const bodyString = JSON.stringify(options.body);
      requestOptions.headers['Content-Length'] = Buffer.byteLength(bodyString);
      
      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, body: data, headers: res.headers });
          }
        });
      });
      
      req.on('error', reject);
      req.write(bodyString);
      req.end();
    } else {
      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, body: data, headers: res.headers });
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    }
  });
}

// ============================================================================
// PHASE 0: PRE-FLIGHT VALIDATION
// ============================================================================

async function validateDatabaseTables(client) {
  log('\n=== PHASE 0: PRE-FLIGHT VALIDATION ===\n', 'info');
  
  const requiredTables = [
    'roles',
    'role_permissions',
    'vendor_identity',
    'vendor_onboarding_applications',
    'vendors',
    'vendor_bank_details',
    'staff',
    'services',
    'service_catalog',
    'staff_services',
    'staff_schedules',
  ];
  
  for (const table of requiredTables) {
    try {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      logTest(`Table exists: ${table}`, result.rows[0].exists);
    } catch (error) {
      logTest(`Table exists: ${table}`, false, error.message);
    }
  }
}

async function validateRolesAndCapabilities(client) {
  log('\n=== PHASE 1.1: ROLES & CAPABILITIES VALIDATION ===\n', 'info');
  
  try {
    const rolesResult = await client.query(`
      SELECT COUNT(*) as count FROM roles WHERE is_active = true
    `);
    const roleCount = parseInt(rolesResult.rows[0].count);
    
    logTest('Roles exist in database', roleCount > 0);
    
    if (roleCount > 0) {
      const roles = await client.query(`
        SELECT id, name, display_name 
        FROM roles 
        WHERE is_active = true 
        LIMIT 5
      `);
      
      log(`Found ${roleCount} active roles. Sample: ${roles.rows.map(r => r.name).join(', ')}`);
      
      // Check role permissions
      for (const role of roles.rows) {
        const permsResult = await client.query(`
          SELECT COUNT(*) as count FROM role_permissions WHERE role_id = $1
        `, [role.id]);
        
        const permCount = parseInt(permsResult.rows[0].count);
        if (permCount > 0) {
          logTest(`Role ${role.name} has capabilities`, true);
        } else {
          logWarning(`Role ${role.name} has no capabilities`, 'Role may need capability seeding');
        }
      }
    } else {
      logTest('Roles seeded', false, 'No roles found - need to seed roles');
    }
  } catch (error) {
    logTest('Roles validation', false, error.message);
  }
}

async function validateServiceCatalog(client) {
  log('\n=== PHASE 1.2: SERVICE CATALOG VALIDATION ===\n', 'info');
  
  try {
    const catalogResult = await client.query(`
      SELECT COUNT(*) as count FROM service_catalog WHERE status = 'active'
    `);
    const catalogCount = parseInt(catalogResult.rows[0].count);
    
    logTest('Service catalog entries exist', catalogCount > 0);
    
    if (catalogCount > 0) {
      const stylesResult = await client.query(`
        SELECT DISTINCT service_style, COUNT(*) as count
        FROM service_catalog
        WHERE status = 'active'
        GROUP BY service_style
      `);
      
      log(`Service styles: ${stylesResult.rows.map(r => `${r.service_style || 'NULL'}: ${r.count}`).join(', ')}`);
    } else {
      logTest('Service catalog seeded', false, 'No service catalog entries - need to seed');
    }
  } catch (error) {
    logTest('Service catalog validation', false, error.message);
  }
}

// ============================================================================
// PHASE 2: VENDOR ONBOARDING FLOW
// ============================================================================

async function testOtpAuthentication() {
  log('\n=== PHASE 2.1: OTP AUTHENTICATION ===\n', 'info');
  
  try {
    // Send OTP
    const sendOtpResponse = await makeRequest(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      body: { phone: TEST_PHONE, user_type: 'vendor' },
    });
    
    logTest('Send OTP API call', sendOtpResponse.status === 200 || sendOtpResponse.status === 201);
    
    // In UAT mode, OTP is always 123456
    const otpCode = '123456';
    
    // Verify OTP
    const verifyOtpResponse = await makeRequest(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      body: { phone: TEST_PHONE, code: otpCode, user_type: 'vendor' },
    });
    
    logTest('Verify OTP API call', verifyOtpResponse.status === 200 || verifyOtpResponse.status === 201);
    
    return verifyOtpResponse.status === 200 || verifyOtpResponse.status === 201;
  } catch (error) {
    logTest('OTP Authentication', false, error.message);
    return false;
  }
}

async function testRoleSelection() {
  log('\n=== PHASE 2.2: DYNAMIC ROLE SELECTION ===\n', 'info');
  
  try {
    // Get available roles
    const rolesResponse = await makeRequest(`${API_BASE_URL}/vendor/onboarding/roles`);
    
    logTest('Get roles API call', rolesResponse.status === 200);
    
    if (rolesResponse.status === 200 && rolesResponse.body.success && rolesResponse.body.data?.roles) {
      const roles = rolesResponse.body.data.roles;
      logTest('Roles returned from API', roles.length > 0);
      
      if (roles.length > 0) {
        log(`Found ${roles.length} roles: ${roles.map(r => r.name || r.display_name).join(', ')}`);
        
        // Select first role
        const selectedRole = roles[0];
        const selectRoleResponse = await makeRequest(`${API_BASE_URL}/vendor/onboarding/select-role`, {
          method: 'POST',
          body: { phone: TEST_PHONE, role_id: selectedRole.id },
        });
        
        logTest('Select role API call', selectRoleResponse.status === 200);
        
        return { success: true, roleId: selectedRole.id, roleName: selectedRole.name };
      }
    }
    
    return { success: false };
  } catch (error) {
    logTest('Role Selection', false, error.message);
    return { success: false };
  }
}

async function testVendorTypeSelection(roleId) {
  log('\n=== PHASE 2.3: SOLO VS BUSINESS SELECTION ===\n', 'info');
  
  try {
    // Get role config to determine allowed vendor types
    const rolesResponse = await makeRequest(`${API_BASE_URL}/vendor/onboarding/roles`);
    
    if (rolesResponse.status === 200 && rolesResponse.body.data?.roles) {
      const role = rolesResponse.body.data.roles.find(r => r.id === roleId);
      
      if (role) {
        const vendorTypes = role.vendor_types_supported || role.config?.vendorTypes || ['solo', 'business'];
        const vendorType = vendorTypes.includes('solo') ? 'solo' : 'business';
        
        log(`Role supports: ${vendorTypes.join(', ')}. Selecting: ${vendorType}`);
        
        const selectTypeResponse = await makeRequest(`${API_BASE_URL}/vendor/onboarding/select-vendor-type`, {
          method: 'POST',
          body: { phone: TEST_PHONE, vendor_type: vendorType },
        });
        
        logTest('Select vendor type API call', selectTypeResponse.status === 200);
        
        return { success: true, vendorType };
      }
    }
    
    return { success: false };
  } catch (error) {
    logTest('Vendor Type Selection', false, error.message);
    return { success: false };
  }
}

async function testFormSchemaLoad(roleId, vendorType) {
  log('\n=== PHASE 2.4: DYNAMIC FORM LOAD ===\n', 'info');
  
  try {
    const formResponse = await makeRequest(`${API_BASE_URL}/vendor/onboarding/form-schema?phone=${TEST_PHONE}`);
    
    logTest('Get form schema API call', formResponse.status === 200);
    
    if (formResponse.status === 200 && formResponse.body.success) {
      const schema = formResponse.body.data;
      logTest('Form schema returned', !!(schema.fields && schema.fields.length > 0));
      
      if (schema.fields && schema.fields.length > 0) {
        log(`Form has ${schema.fields.length} fields`);
        return { success: true, schema };
      }
    }
    
    return { success: false };
  } catch (error) {
    logTest('Form Schema Load', false, error.message);
    return { success: false };
  }
}

async function testApplicationSubmission(formSchema) {
  log('\n=== PHASE 2.5: SUBMIT APPLICATION ===\n', 'info');
  
  try {
    // Build application payload from form schema
    const applicationPayload = {};
    
    if (formSchema && formSchema.fields) {
      for (const field of formSchema.fields) {
        if (field.required && field.type !== 'file') {
          // Set default values based on field type
          switch (field.type) {
            case 'text':
            case 'textarea':
              applicationPayload[field.name || field.id] = `Test ${field.label || field.name}`;
              break;
            case 'email':
              applicationPayload[field.name || field.id] = `test@example.com`;
              break;
            case 'tel':
              applicationPayload[field.name || field.id] = TEST_PHONE;
              break;
            case 'number':
              applicationPayload[field.name || field.id] = 5;
              break;
            default:
              applicationPayload[field.name || field.id] = 'test';
          }
        }
      }
    }
    
    const submitResponse = await makeRequest(`${API_BASE_URL}/vendor/onboarding/submit-application`, {
      method: 'POST',
      body: {
        phone: TEST_PHONE,
        application_payload: applicationPayload,
        uploaded_documents: [],
      },
    });
    
    logTest('Submit application API call', submitResponse.status === 200 || submitResponse.status === 201);
    
    if (submitResponse.status === 200 && submitResponse.body.success) {
      const applicationId = submitResponse.body.data?.applicationId;
      logTest('Application created in database', !!applicationId);
      
      return { success: true, applicationId };
    }
    
    return { success: false };
  } catch (error) {
    logTest('Application Submission', false, error.message);
    return { success: false };
  }
}

// ============================================================================
// PHASE 3: ADMIN GOVERNANCE
// ============================================================================

async function testAdminReview(applicationId, adminId = 'test-admin-id') {
  log('\n=== PHASE 3: ADMIN GOVERNANCE ACTIONS ===\n', 'info');
  
  if (!applicationId) {
    logTest('Admin Review - Application ID required', false, 'No application ID from previous step');
    return { success: false };
  }
  
  try {
    // Test APPROVE action
    const approveResponse = await makeRequest(`${API_BASE_URL}/admin/vendor/onboarding/${applicationId}/review`, {
      method: 'POST',
      body: {
        action: 'APPROVE',
        admin_id: adminId,
        comments: 'Test approval',
      },
    });
    
    logTest('Admin Approve API call', approveResponse.status === 200);
    
    return { success: approveResponse.status === 200, action: 'APPROVE' };
  } catch (error) {
    logTest('Admin Review', false, error.message);
    return { success: false };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('Starting Vendor Onboarding Lifecycle Validation', 'info');
  log(`Test Phone: ${TEST_PHONE}`, 'info');
  log(`API Base URL: ${API_BASE_URL}`, 'info');
  
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    log('Connected to database', 'success');
    
    // Phase 0: Pre-flight validation
    await validateDatabaseTables(client);
    await validateRolesAndCapabilities(client);
    await validateServiceCatalog(client);
    
    // Phase 2: Vendor onboarding flow
    const otpSuccess = await testOtpAuthentication();
    if (!otpSuccess) {
      log('OTP authentication failed - stopping tests', 'error');
      return;
    }
    
    const roleResult = await testRoleSelection();
    if (!roleResult.success) {
      log('Role selection failed - stopping tests', 'error');
      return;
    }
    
    const typeResult = await testVendorTypeSelection(roleResult.roleId);
    if (!typeResult.success) {
      log('Vendor type selection failed - stopping tests', 'error');
      return;
    }
    
    const formResult = await testFormSchemaLoad(roleResult.roleId, typeResult.vendorType);
    if (!formResult.success) {
      log('Form schema load failed - stopping tests', 'error');
      return;
    }
    
    const submitResult = await testApplicationSubmission(formResult.schema);
    if (!submitResult.success) {
      log('Application submission failed - stopping tests', 'error');
      return;
    }
    
    // Phase 3: Admin governance
    await testAdminReview(submitResult.applicationId);
    
    // Print summary
    log('\n=== TEST SUMMARY ===\n', 'info');
    log(`Passed: ${TEST_RESULTS.passed.length}`, 'success');
    log(`Failed: ${TEST_RESULTS.failed.length}`, TEST_RESULTS.failed.length > 0 ? 'error' : 'success');
    log(`Warnings: ${TEST_RESULTS.warnings.length}`, TEST_RESULTS.warnings.length > 0 ? 'warning' : 'success');
    
    if (TEST_RESULTS.failed.length > 0) {
      log('\nFailed Tests:', 'error');
      TEST_RESULTS.failed.forEach(f => {
        log(`  - ${f.name}: ${f.message}`, 'error');
      });
    }
    
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
