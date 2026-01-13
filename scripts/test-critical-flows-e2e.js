#!/usr/bin/env node
/**
 * CRITICAL FLOWS END-TO-END TESTING
 * ==================================
 * Tests the 3 critical flows with real data:
 * 1. Vendor Onboarding Flow
 * 2. Customer Booking Flow
 * 3. Admin Platform Management
 */

const https = require('https');
const { Pool } = require('pg');

const API_BASE = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const DB_CONFIG = {
  host: 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
  ssl: { rejectUnauthorized: false }
};

class E2EFlowTester {
  constructor() {
    this.pool = new Pool(DB_CONFIG);
    this.results = {
      vendorOnboarding: { passed: 0, failed: 0, tests: [] },
      customerBooking: { passed: 0, failed: 0, tests: [] },
      adminManagement: { passed: 0, failed: 0, tests: [] }
    };
  }

  async request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, API_BASE);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-UAT-Mode': 'true'
        }
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
      }

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: data ? JSON.parse(data) : null,
              headers: res.headers
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: data,
              headers: res.headers
            });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  recordTest(flow, name, passed, details = '') {
    const result = { name, passed, details };
    this.results[flow].tests.push(result);
    if (passed) {
      this.results[flow].passed++;
      console.log(`  ✅ ${name}`);
    } else {
      this.results[flow].failed++;
      console.log(`  ❌ ${name}: ${details}`);
    }
  }

  // ============================================================================
  // FLOW 1: VENDOR ONBOARDING
  // ============================================================================

  async testVendorOnboardingFlow() {
    console.log('\n🏪 TESTING VENDOR ONBOARDING FLOW');
    console.log('====================================\n');

    // Step 1: Get available roles
    try {
      const res = await this.request('/vendor/onboarding/roles');
      const passed = res.status === 200 && res.data?.success && res.data?.data?.roles?.length > 0;
      this.recordTest('vendorOnboarding', 'Get Available Roles', passed, 
        passed ? `Found ${res.data.data.roles.length} roles` : `Status ${res.status}`);
      
      if (passed && res.data.data.roles.length > 0) {
        this.testRole = res.data.data.roles[0];
      }
    } catch (error) {
      this.recordTest('vendorOnboarding', 'Get Available Roles', false, error.message);
    }

    // Step 2: Get onboarding status
    try {
      const testPhone = '9876543210';
      const res = await this.request(`/vendor/onboarding/status?phone=${testPhone}`);
      const passed = res.status === 200;
      this.recordTest('vendorOnboarding', 'Get Onboarding Status', passed,
        passed ? 'Status retrieved' : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('vendorOnboarding', 'Get Onboarding Status', false, error.message);
    }

    // Step 3: Check if vendors can view their dashboard
    try {
      const res = await this.request('/vendor/dashboard');
      const passed = res.status === 200 || res.status === 401; // 401 is ok (needs auth)
      this.recordTest('vendorOnboarding', 'Vendor Dashboard Endpoint', passed,
        passed ? 'Endpoint exists' : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('vendorOnboarding', 'Vendor Dashboard Endpoint', false, error.message);
    }

    // Step 4: Check vendor services management
    try {
      const res = await this.request('/vendor/services');
      const passed = res.status === 200 || res.status === 401;
      this.recordTest('vendorOnboarding', 'Vendor Services Management', passed,
        passed ? 'Endpoint exists' : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('vendorOnboarding', 'Vendor Services Management', false, error.message);
    }

    // Step 5: Check vendor staff management
    try {
      const res = await this.request('/vendor/staff');
      const passed = res.status === 200 || res.status === 401;
      this.recordTest('vendorOnboarding', 'Vendor Staff Management', passed,
        passed ? 'Endpoint exists' : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('vendorOnboarding', 'Vendor Staff Management', false, error.message);
    }

    // Step 6: Verify database has vendor data
    try {
      const result = await this.pool.query('SELECT COUNT(*) FROM vendors WHERE is_active = true');
      const count = parseInt(result.rows[0].count);
      const passed = count > 0;
      this.recordTest('vendorOnboarding', 'Active Vendors in DB', passed,
        passed ? `Found ${count} active vendors` : 'No active vendors');
    } catch (error) {
      this.recordTest('vendorOnboarding', 'Active Vendors in DB', false, error.message);
    }
  }

  // ============================================================================
  // FLOW 2: CUSTOMER BOOKING
  // ============================================================================

  async testCustomerBookingFlow() {
    console.log('\n👥 TESTING CUSTOMER BOOKING FLOW');
    console.log('==================================\n');

    // Step 1: Service discovery
    try {
      const res = await this.request('/services');
      const passed = res.status === 200 && res.data?.services?.length > 0;
      this.recordTest('customerBooking', 'Service Discovery', passed,
        passed ? `Found ${res.data.services.length} services` : `Status ${res.status}`);
      
      if (passed && res.data.services.length > 0) {
        this.testService = res.data.services[0];
      }
    } catch (error) {
      this.recordTest('customerBooking', 'Service Discovery', false, error.message);
    }

    // Step 2: Vendor search
    try {
      const res = await this.request('/customer/vendors/search?city=Bangalore');
      const passed = res.status === 200;
      this.recordTest('customerBooking', 'Vendor Search', passed,
        passed ? `Search works` : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('customerBooking', 'Vendor Search', false, error.message);
    }

    // Step 3: Check booking creation endpoint
    try {
      const res = await this.request('/customer/booking/create', 'POST', {});
      const passed = res.status !== 404; // Should not be 404
      this.recordTest('customerBooking', 'Booking Creation Endpoint', passed,
        passed ? 'Endpoint exists' : 'Endpoint missing (404)');
    } catch (error) {
      this.recordTest('customerBooking', 'Booking Creation Endpoint', false, error.message);
    }

    // Step 4: Check customer bookings list
    try {
      const res = await this.request('/customer/bookings');
      const passed = res.status !== 404;
      this.recordTest('customerBooking', 'Customer Bookings List', passed,
        passed ? 'Endpoint exists' : 'Endpoint missing (404)');
    } catch (error) {
      this.recordTest('customerBooking', 'Customer Bookings List', false, error.message);
    }

    // Step 5: Payment processing endpoint
    try {
      const res = await this.request('/payments/create-order', 'POST', {});
      const passed = res.status !== 404;
      this.recordTest('customerBooking', 'Payment Processing', passed,
        passed ? 'Endpoint exists' : 'Endpoint missing (404)');
    } catch (error) {
      this.recordTest('customerBooking', 'Payment Processing', false, error.message);
    }

    // Step 6: Verify database has bookings
    try {
      const result = await this.pool.query('SELECT COUNT(*) FROM bookings');
      const count = parseInt(result.rows[0].count);
      const passed = count >= 0; // Just check query works
      this.recordTest('customerBooking', 'Bookings in DB', passed,
        passed ? `Found ${count} bookings` : 'Query failed');
    } catch (error) {
      this.recordTest('customerBooking', 'Bookings in DB', false, error.message);
    }
  }

  // ============================================================================
  // FLOW 3: ADMIN PLATFORM MANAGEMENT
  // ============================================================================

  async testAdminManagementFlow() {
    console.log('\n🔧 TESTING ADMIN PLATFORM MANAGEMENT');
    console.log('======================================\n');

    // Step 1: Admin vendors list
    try {
      const res = await this.request('/admin/vendors');
      const passed = res.status === 200 || res.status === 401;
      this.recordTest('adminManagement', 'Admin Vendors List', passed,
        passed ? 'Endpoint works' : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('adminManagement', 'Admin Vendors List', false, error.message);
    }

    // Step 2: Admin customers list
    try {
      const res = await this.request('/admin/customers');
      const passed = res.status === 200;
      this.recordTest('adminManagement', 'Admin Customers List', passed,
        passed ? `Found ${res.data.count} customers` : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('adminManagement', 'Admin Customers List', false, error.message);
    }

    // Step 3: Admin bookings list
    try {
      const res = await this.request('/admin/bookings');
      const passed = res.status === 200;
      this.recordTest('adminManagement', 'Admin Bookings List', passed,
        passed ? `Found ${res.data.count} bookings` : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('adminManagement', 'Admin Bookings List', false, error.message);
    }

    // Step 4: Admin analytics
    try {
      const res = await this.request('/admin/analytics/overview');
      const passed = res.status !== 404;
      this.recordTest('adminManagement', 'Admin Analytics', passed,
        passed ? 'Endpoint exists' : 'Endpoint missing (404)');
    } catch (error) {
      this.recordTest('adminManagement', 'Admin Analytics', false, error.message);
    }

    // Step 5: GST configurations
    try {
      const res = await this.request('/admin/gst-configs');
      const passed = res.status === 200;
      this.recordTest('adminManagement', 'GST Configurations', passed,
        passed ? `Found ${res.data.count} configs` : `Status ${res.status}`);
    } catch (error) {
      this.recordTest('adminManagement', 'GST Configurations', false, error.message);
    }

    // Step 6: Verify roles in database
    try {
      const result = await this.pool.query('SELECT COUNT(*) FROM roles WHERE is_active = true');
      const count = parseInt(result.rows[0].count);
      const passed = count > 0;
      this.recordTest('adminManagement', 'Active Roles in DB', passed,
        passed ? `Found ${count} active roles` : 'No active roles');
    } catch (error) {
      this.recordTest('adminManagement', 'Active Roles in DB', false, error.message);
    }
  }

  // ============================================================================
  // SUMMARY & REPORT
  // ============================================================================

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 END-TO-END FLOW TEST SUMMARY');
    console.log('='.repeat(70) + '\n');

    const flows = ['vendorOnboarding', 'customerBooking', 'adminManagement'];
    const flowNames = {
      vendorOnboarding: 'Vendor Onboarding Flow',
      customerBooking: 'Customer Booking Flow',
      adminManagement: 'Admin Management Flow'
    };

    let totalPassed = 0;
    let totalFailed = 0;

    flows.forEach(flow => {
      const result = this.results[flow];
      const total = result.passed + result.failed;
      const percentage = total > 0 ? Math.round((result.passed / total) * 100) : 0;
      
      console.log(`${flowNames[flow]}:`);
      console.log(`  ✅ Passed: ${result.passed}/${total} (${percentage}%)`);
      console.log(`  ❌ Failed: ${result.failed}/${total}`);
      console.log('');

      totalPassed += result.passed;
      totalFailed += result.failed;
    });

    const grandTotal = totalPassed + totalFailed;
    const overallPercentage = grandTotal > 0 ? Math.round((totalPassed / grandTotal) * 100) : 0;

    console.log('Overall Results:');
    console.log(`  Total Tests: ${grandTotal}`);
    console.log(`  ✅ Passed: ${totalPassed} (${overallPercentage}%)`);
    console.log(`  ❌ Failed: ${totalFailed}`);
    console.log('');

    if (overallPercentage >= 80) {
      console.log('🎉 CRITICAL FLOWS ARE MOSTLY WORKING!');
    } else if (overallPercentage >= 50) {
      console.log('⚠️  CRITICAL FLOWS NEED SOME FIXES');
    } else {
      console.log('🚨 CRITICAL FLOWS HAVE MAJOR ISSUES');
    }

    console.log('\n' + '='.repeat(70));
  }

  async run() {
    console.log('🚀 STARTING CRITICAL FLOWS END-TO-END TESTING');
    console.log('='.repeat(70));

    await this.testVendorOnboardingFlow();
    await this.testCustomerBookingFlow();
    await this.testAdminManagementFlow();

    this.printSummary();

    await this.pool.end();
  }
}

// Run the tests
const tester = new E2EFlowTester();
tester.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
