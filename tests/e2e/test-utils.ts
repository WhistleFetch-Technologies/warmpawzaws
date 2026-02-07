/**
 * ============================================================================
 * E2E TEST UTILITIES
 * ============================================================================
 * 
 * Common utilities and helpers for E2E tests
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export const TEST_CONFIG = {
  apiBaseUrl: process.env.TEST_API_URL || process.env.API_URL || process.env.API_BASE_URL || '',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// ============================================================================
// TEST DATA
// ============================================================================

export const TEST_DATA = {
  // Test customer
  customer: {
    phone: '9876543210',
    name: 'Test Customer',
    email: 'test.customer@warmpawz.test',
  },
  
  // Test vendor (should exist in test DB)
  vendor: {
    id: '', // Will be populated during setup
    phone: '9876543211',
    businessName: 'Test Vet Clinic',
    roleCode: 'veterinarian',
  },
  
  // Test service
  service: {
    id: '', // Will be populated during setup
    name: 'General Consultation',
    price: 500,
    duration: 30,
    serviceStyle: 'at_center',
  },
  
  // Test pet
  pet: {
    name: 'Buddy',
    type: 'dog',
    breed: 'Labrador',
    age: 3,
  },
  
  // Test booking date (tomorrow)
  getBookingDate: () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  },
  
  // Test booking time
  bookingTime: '10:00',
};

// ============================================================================
// API CLIENT
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Make an API request with automatic retry and error handling
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = TEST_CONFIG.timeout,
  } = options;

  const url = `${TEST_CONFIG.apiBaseUrl}${endpoint}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    return {
      success: response.ok,
      data: response.ok ? data : undefined,
      error: !response.ok ? (data.error || response.statusText) : undefined,
      statusCode: response.status,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout',
        statusCode: 408,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
    };
  }
}

/**
 * Make API request with retry on failure
 */
export async function apiRequestWithRetry<T = any>(
  endpoint: string,
  options: RequestOptions = {},
  retries: number = TEST_CONFIG.retryAttempts
): Promise<ApiResponse<T>> {
  let lastError: ApiResponse<T> | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await apiRequest<T>(endpoint, options);

    if (response.success || response.statusCode < 500) {
      return response;
    }

    lastError = response;

    if (attempt < retries) {
      await sleep(TEST_CONFIG.retryDelay * attempt);
    }
  }

  return lastError || { success: false, error: 'All retries failed', statusCode: 500 };
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random phone number for testing
 */
export function generateTestPhone(): string {
  const randomDigits = Math.floor(Math.random() * 900000000) + 100000000;
  return `9${randomDigits}`;
}

/**
 * Generate a random UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// ASSERTIONS
// ============================================================================

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

/**
 * Assert condition with descriptive error
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert that two values are equal
 */
export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

/**
 * Assert that value is defined
 */
export function assertDefined<T>(value: T | undefined | null, message: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`${message}: value is ${value}`);
  }
}

/**
 * Assert array has length
 */
export function assertArrayLength(arr: any[], minLength: number, message: string): void {
  if (!Array.isArray(arr) || arr.length < minLength) {
    throw new Error(`${message}: expected array with at least ${minLength} items, got ${arr?.length || 0}`);
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

export interface TestSuite {
  name: string;
  tests: Array<{
    name: string;
    fn: () => Promise<void>;
    skip?: boolean;
  }>;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

/**
 * Run a test suite and return results
 */
export async function runTestSuite(suite: TestSuite): Promise<{
  suiteName: string;
  results: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}> {
  const results: TestResult[] = [];
  const suiteStart = Date.now();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 ${suite.name}`);
  console.log('═'.repeat(60));

  // Run setup
  if (suite.setup) {
    try {
      await suite.setup();
      console.log('✅ Setup completed');
    } catch (error) {
      console.error('❌ Setup failed:', error);
      return {
        suiteName: suite.name,
        results: [],
        passed: 0,
        failed: suite.tests.length,
        skipped: 0,
        duration: Date.now() - suiteStart,
      };
    }
  }

  // Run tests
  for (const test of suite.tests) {
    if (test.skip) {
      results.push({
        name: test.name,
        passed: false,
        duration: 0,
        error: 'SKIPPED',
      });
      console.log(`⏭️  ${test.name} - SKIPPED`);
      continue;
    }

    const testStart = Date.now();
    
    try {
      await test.fn();
      const duration = Date.now() - testStart;
      results.push({
        name: test.name,
        passed: true,
        duration,
      });
      console.log(`✅ ${test.name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - testStart;
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({
        name: test.name,
        passed: false,
        duration,
        error: errorMsg,
      });
      console.log(`❌ ${test.name} - ${errorMsg}`);
    }
  }

  // Run teardown
  if (suite.teardown) {
    try {
      await suite.teardown();
      console.log('✅ Teardown completed');
    } catch (error) {
      console.error('⚠️ Teardown failed:', error);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed && r.error !== 'SKIPPED').length;
  const skipped = results.filter(r => r.error === 'SKIPPED').length;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('─'.repeat(60));

  return {
    suiteName: suite.name,
    results,
    passed,
    failed,
    skipped,
    duration: Date.now() - suiteStart,
  };
}

// ============================================================================
// LOGGING
// ============================================================================

export function log(step: string, message: string, data?: any): void {
  console.log(`  [${step}] ${message}`);
  if (data && process.env.VERBOSE_TESTS === 'true') {
    console.log('  ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n  '));
  }
}

export function logError(step: string, error: any): void {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`  [${step}] ERROR: ${errorMsg}`);
}
