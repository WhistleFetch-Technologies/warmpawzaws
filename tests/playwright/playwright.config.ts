import { defineConfig, devices } from '@playwright/test';

/**
 * ============================================================================
 * WARMPAWZ COMPREHENSIVE E2E TEST CONFIGURATION
 * ============================================================================
 * 
 * Tests cover all major business flows:
 * - Vendor Onboarding (Center & Solo)
 * - Customer Booking (Center, Home, Tele)
 * - Home Delivery (Pharmacy, Nutritionist)
 * - Video Consultation (Schedule & Instant)
 * - Problem Grid Navigation
 * - Payment Rules & GST
 * - Admin Approval Workflow
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4,
  
  reporter: [
    ['html', { 
      outputFolder: 'test-results/html-report',
      open: 'never'
    }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'https://dfof7mguaa0a5.cloudfront.net',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // UAT Mode headers for testing
    extraHTTPHeaders: {
      'X-UAT-Mode': 'true',
      'X-UAT-Token': 'uat-test-token',
    },
  },

  projects: [
    // ========================================================================
    // VENDOR PORTAL TESTS
    // ========================================================================
    {
      name: 'vendor-onboarding',
      testMatch: /vendor-onboarding\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.VENDOR_URL || 'https://d1s6ykkj381k58.cloudfront.net',
      },
    },
    {
      name: 'vendor-chromium',
      testMatch: /vendor\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.VENDOR_URL || 'https://d1s6ykkj381k58.cloudfront.net',
      },
    },
    
    // ========================================================================
    // CUSTOMER APP TESTS
    // ========================================================================
    {
      name: 'customer-booking',
      testMatch: /customer-booking\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
      },
    },
    {
      name: 'customer-chromium',
      testMatch: /customer\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
      },
    },
    
    // ========================================================================
    // HOME DELIVERY TESTS
    // ========================================================================
    {
      name: 'home-delivery',
      testMatch: /home-delivery\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
      },
    },
    
    // ========================================================================
    // PROBLEM GRID & RULES TESTS
    // ========================================================================
    {
      name: 'problem-grid',
      testMatch: /problem-grid\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
      },
    },
    
    // ========================================================================
    // ADMIN PORTAL TESTS
    // ========================================================================
    {
      name: 'admin-chromium',
      testMatch: /admin\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.ADMIN_URL || 'https://dfof7mguaa0a5.cloudfront.net',
      },
    },
    
    // ========================================================================
    // API TESTS
    // ========================================================================
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      },
    },
    
    // ========================================================================
    // E-COMMERCE TESTS
    // ========================================================================
    {
      name: 'ecommerce',
      testMatch: /ecommerce\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
      },
    },
    
    // ========================================================================
    // E-COMMERCE REGRESSION TESTS (DB Schema to API validation)
    // ========================================================================
    {
      name: 'ecommerce-regression',
      testMatch: /ecommerce-regression\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
      },
    },
    
    // ========================================================================
    // E-COMMERCE SYNTHETIC E2E TESTS (Complete flow with real data)
    // ========================================================================
    {
      name: 'ecommerce-synthetic-e2e',
      testMatch: /ecommerce-synthetic-e2e\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
      },
      // Increase timeout for synthetic tests that create real data
      timeout: 120000,
    },
    
    // ========================================================================
    // CONTRACT TESTS - DB SCHEMA, API CONTRACTS, PARAMETER TRACING
    // ========================================================================
    {
      name: 'schema-validation',
      testMatch: /contract-tests\/schema-validation\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      },
    },
    {
      name: 'parameter-tracing',
      testMatch: /contract-tests\/parameter-tracing\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      },
    },
    {
      name: 'business-flow-integration',
      testMatch: /contract-tests\/business-flow-integration\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      },
    },
    {
      name: 'payment-rules-validation',
      testMatch: /contract-tests\/payment-rules-validation\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      },
    },
    {
      name: 'contract-tests',
      testMatch: /contract-tests\/.*\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      },
    },
    
    // ========================================================================
    // MOBILE TESTS (optional - requires webkit)
    // ========================================================================
    // {
    //   name: 'customer-mobile',
    //   testMatch: /customer.*\.spec\.ts/,
    //   use: {
    //     ...devices['iPhone 14'],
    //     baseURL: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
    //   },
    // },
    
    // ========================================================================
    // FULL SUITE - ALL TESTS
    // ========================================================================
    {
      name: 'full-suite',
      testMatch: /\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Output directory for artifacts
  outputDir: 'test-results/artifacts',
  
  // Expect configuration
  expect: {
    timeout: 10000,
  },
  
  // Global timeout per test
  timeout: 60000,
});
