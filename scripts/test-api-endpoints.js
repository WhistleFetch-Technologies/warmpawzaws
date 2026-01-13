#!/usr/bin/env node
/**
 * ============================================================================
 * API ENDPOINT TESTING SUITE
 * ============================================================================
 * Tests critical API endpoints to ensure system is fully functional
 * ============================================================================
 */

const https = require('https');

const API_BASE = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

class APITester {
  constructor() {
    this.results = [];
  }

  async testEndpoint(name, path, method = 'GET', body = null) {
    return new Promise((resolve) => {
      const url = new URL(path, API_BASE);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-UAT-Mode': 'true',
          'X-UAT-Token': 'uat-token-test'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const success = res.statusCode >= 200 && res.statusCode < 400;
          this.results.push({
            name,
            path,
            method,
            status: res.statusCode,
            success,
            responseTime: Date.now()
          });
          
          const icon = success ? '✅' : '❌';
          console.log(`${icon} [${method}] ${path} - HTTP ${res.statusCode}`);
          resolve({ success, status: res.statusCode, data });
        });
      });

      req.on('error', (error) => {
        console.log(`❌ [${method}] ${path} - Error: ${error.message}`);
        this.results.push({
          name,
          path,
          method,
          status: 0,
          success: false,
          error: error.message
        });
        resolve({ success: false, error: error.message });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  async runTests() {
    console.log('🚀 Running API Endpoint Tests...\n');
    console.log('='.repeat(70));
    console.log('API Base:', API_BASE);
    console.log('='.repeat(70));
    console.log();

    // Core Health & System Tests
    console.log('📊 Testing Core System Endpoints:\n');
    await this.testEndpoint('Health Check', '/health');
    await this.testEndpoint('System Health', '/system/health');
    
    console.log();

    // Region Tests
    console.log('🌍 Testing Region Endpoints:\n');
    await this.testEndpoint('List Regions', '/regions');
    
    console.log();

    // Vendor Tests
    console.log('🏪 Testing Vendor Endpoints:\n');
    await this.testEndpoint('Search Vendors', '/customer/vendors/search?city=Bangalore');
    await this.testEndpoint('Discover Services', '/customer/discover-services?lat=12.9716&lng=77.5946');
    
    console.log();

    // Service Tests
    console.log('🛍️ Testing Service Endpoints:\n');
    await this.testEndpoint('Service Catalog', '/services');
    
    console.log();

    // Roles & Capabilities Tests
    console.log('🔐 Testing RBAC Endpoints:\n');
    await this.testEndpoint('List Roles', '/roles');
    await this.testEndpoint('List Capabilities', '/admin/capabilities');
    
    console.log();
  }

  generateReport() {
    console.log();
    console.log('='.repeat(70));
    console.log('📊 API TEST REPORT');
    console.log('='.repeat(70));
    
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`Total Tests:     ${total}`);
    console.log(`✅ Passed:       ${passed} (${passRate}%)`);
    console.log(`❌ Failed:       ${failed}`);
    console.log();

    if (failed > 0) {
      console.log('Failed Tests:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  ❌ [${r.method}] ${r.path} - ${r.error || `HTTP ${r.status}`}`);
      });
    }

    console.log('='.repeat(70));
    
    if (passRate >= 80) {
      console.log('✅ API TESTS PASSED - System is operational!');
    } else {
      console.log('⚠️  API TESTS PARTIAL - Some endpoints need attention');
    }
    
    return passRate >= 80 ? 0 : 1;
  }

  async run() {
    await this.runTests();
    const exitCode = this.generateReport();
    process.exit(exitCode);
  }
}

// Run tests
const tester = new APITester();
tester.run();
