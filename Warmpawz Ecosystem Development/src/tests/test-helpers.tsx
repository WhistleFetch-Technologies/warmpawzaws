/**
 * 🛠️ TEST HELPER UTILITIES
 * 
 * Reusable helper functions for testing
 */

import { getApiBaseUrl, getAuthHeaders } from '../utils/api-config';

export const BASE_URL = `${getApiBaseUrl()}`;

/**
 * Create mock data generators
 */
export const MockData = {
  customer: (overrides = {}) => ({
    customerId: `customer-${Date.now()}`,
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '+919876543210',
    ...overrides
  }),

  pet: (overrides = {}) => ({
    petId: `pet-${Date.now()}`,
    name: 'Max',
    species: 'dog',
    breed: 'Labrador',
    age: 3,
    weight: 25,
    ...overrides
  }),

  vendor: (overrides = {}) => ({
    vendorId: `vendor-${Date.now()}`,
    businessName: 'Test Pet Clinic',
    fullName: 'Dr. Test Vet',
    email: 'vendor@example.com',
    phone: '+919876543210',
    services: ['grooming', 'veterinary'],
    ...overrides
  }),

  booking: (overrides = {}) => ({
    bookingId: `BOOK-${Date.now()}`,
    customerId: 'test-customer-001',
    petId: 'test-pet-001',
    vendorId: 'test-vendor-001',
    serviceId: 'test-service-001',
    appointmentDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    appointmentTime: '10:00 AM',
    status: 'pending',
    ...overrides
  }),

  ambulanceBooking: (overrides = {}) => ({
    customerId: 'test-customer-001',
    petId: 'test-pet-001',
    emergencyType: 'accident',
    severity: 'urgent',
    description: 'Test emergency',
    pickupLocation: {
      address: '123 Test St',
      lat: 28.6139,
      lng: 77.2090,
      contactName: 'Test User',
      contactPhone: '9876543210'
    },
    dropLocation: {
      address: '456 Hospital Rd',
      lat: 28.6200,
      lng: 77.2100,
      facilityName: 'Test Hospital'
    },
    ...overrides
  })
};

/**
 * API Request Helper
 */
export class APIClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string = BASE_URL, authToken: string = publicAnonKey) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async request(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    headers: Record<string, string> = {}
  ) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: response.headers
    };
  }

  async get(endpoint: string, headers?: Record<string, string>) {
    return this.request(endpoint, 'GET', undefined, headers);
  }

  async post(endpoint: string, body: any, headers?: Record<string, string>) {
    return this.request(endpoint, 'POST', body, headers);
  }

  async put(endpoint: string, body: any, headers?: Record<string, string>) {
    return this.request(endpoint, 'PUT', body, headers);
  }

  async patch(endpoint: string, body: any, headers?: Record<string, string>) {
    return this.request(endpoint, 'PATCH', body, headers);
  }

  async delete(endpoint: string, headers?: Record<string, string>) {
    return this.request(endpoint, 'DELETE', undefined, headers);
  }
}

/**
 * Test Assertion Helpers
 */
export class Assertions {
  static assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(
        message || `Assertion failed: expected ${expected}, got ${actual}`
      );
    }
  }

  static assertNotEqual(actual: any, expected: any, message?: string) {
    if (actual === expected) {
      throw new Error(
        message || `Assertion failed: expected ${actual} to not equal ${expected}`
      );
    }
  }

  static assertTrue(condition: boolean, message?: string) {
    if (!condition) {
      throw new Error(message || 'Assertion failed: expected true');
    }
  }

  static assertFalse(condition: boolean, message?: string) {
    if (condition) {
      throw new Error(message || 'Assertion failed: expected false');
    }
  }

  static assertExists(value: any, message?: string) {
    if (value === null || value === undefined) {
      throw new Error(message || 'Assertion failed: expected value to exist');
    }
  }

  static assertNull(value: any, message?: string) {
    if (value !== null) {
      throw new Error(message || `Assertion failed: expected null, got ${value}`);
    }
  }

  static assertUndefined(value: any, message?: string) {
    if (value !== undefined) {
      throw new Error(message || `Assertion failed: expected undefined, got ${value}`);
    }
  }

  static assertArrayLength(array: any[], expectedLength: number, message?: string) {
    if (!Array.isArray(array)) {
      throw new Error(message || 'Assertion failed: value is not an array');
    }
    if (array.length !== expectedLength) {
      throw new Error(
        message || `Assertion failed: expected array length ${expectedLength}, got ${array.length}`
      );
    }
  }

  static assertObjectHasKey(obj: any, key: string, message?: string) {
    if (typeof obj !== 'object' || obj === null) {
      throw new Error(message || 'Assertion failed: value is not an object');
    }
    if (!(key in obj)) {
      throw new Error(
        message || `Assertion failed: object does not have key '${key}'`
      );
    }
  }

  static assertStatusCode(statusCode: number, expected: number, message?: string) {
    if (statusCode !== expected) {
      throw new Error(
        message || `Assertion failed: expected status ${expected}, got ${statusCode}`
      );
    }
  }

  static assertResponseTime(responseTime: number, maxTime: number, message?: string) {
    if (responseTime > maxTime) {
      throw new Error(
        message || `Assertion failed: response time ${responseTime}ms exceeds max ${maxTime}ms`
      );
    }
  }
}

/**
 * Test Data Cleanup Helper
 */
export class TestCleanup {
  private cleanupTasks: (() => Promise<void>)[] = [];

  addCleanupTask(task: () => Promise<void>) {
    this.cleanupTasks.push(task);
  }

  async runCleanup() {
    console.log(`\n🧹 Running cleanup (${this.cleanupTasks.length} tasks)...`);

    for (const task of this.cleanupTasks) {
      try {
        await task();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    }

    this.cleanupTasks = [];
    console.log('✅ Cleanup complete\n');
  }
}

/**
 * Wait/Delay Helper
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry Helper
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await wait(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Parallel Execution Helper
 */
export async function runInParallel<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  record(label: string, duration: number) {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
  }

  getStats(label: string) {
    const values = this.metrics.get(label) || [];
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  printStats() {
    console.log('\n📊 Performance Statistics:');
    console.log('─'.repeat(80));

    for (const [label, values] of this.metrics) {
      const stats = this.getStats(label);
      if (stats) {
        console.log(`\n${label}:`);
        console.log(`  Count: ${stats.count}`);
        console.log(`  Min: ${stats.min}ms`);
        console.log(`  Max: ${stats.max}ms`);
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
        console.log(`  Median: ${stats.median}ms`);
        console.log(`  P95: ${stats.p95}ms`);
        console.log(`  P99: ${stats.p99}ms`);
      }
    }

    console.log('\n' + '─'.repeat(80) + '\n');
  }
}

/**
 * Test Logger
 */
export class TestLogger {
  private logs: { level: string; message: string; timestamp: Date }[] = [];

  log(message: string) {
    this.logs.push({ level: 'info', message, timestamp: new Date() });
    console.log(`ℹ️  ${message}`);
  }

  success(message: string) {
    this.logs.push({ level: 'success', message, timestamp: new Date() });
    console.log(`✅ ${message}`);
  }

  error(message: string) {
    this.logs.push({ level: 'error', message, timestamp: new Date() });
    console.error(`❌ ${message}`);
  }

  warn(message: string) {
    this.logs.push({ level: 'warn', message, timestamp: new Date() });
    console.warn(`⚠️  ${message}`);
  }

  debug(message: string) {
    this.logs.push({ level: 'debug', message, timestamp: new Date() });
    console.log(`🐛 ${message}`);
  }

  getLogs() {
    return this.logs;
  }

  exportLogs(): string {
    return this.logs
      .map(log => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
  }
}

/**
 * Environment Helper
 */
export const Environment = {
  isDevelopment: () => process.env.NODE_ENV === 'development',
  isProduction: () => process.env.NODE_ENV === 'production',
  isTest: () => process.env.NODE_ENV === 'test',
  
  getProjectId: () => projectId,
  getAnonKey: () => publicAnonKey,
  getBaseUrl: () => BASE_URL
};
