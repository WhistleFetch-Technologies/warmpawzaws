/**
 * Test Configuration
 * Common test setup and utilities
 */

import { config } from 'dotenv';

// Load environment-specific config
const environment = process.env.ENVIRONMENT || 'dev';
config({ path: `.env.${environment}` });

export const testConfig = {
  environment,
  apiEndpoint: process.env.API_ENDPOINT || '',
  dbHost: process.env.DB_HOST || '',
  timeout: {
    unit: 5000,
    integration: 30000,
    e2e: 60000,
    smoke: 10000
  },
  retry: {
    attempts: 3,
    delay: 1000
  }
};

export const mockData = {
  customer: {
    email: 'test.customer@example.com',
    name: 'Test Customer',
    phone: '+919876543210'
  },
  vendor: {
    email: 'test.vendor@example.com',
    name: 'Test Vendor',
    phone: '+919876543211',
    businessName: 'Test Pet Services'
  },
  booking: {
    serviceType: 'grooming',
    petType: 'dog',
    date: new Date(Date.now() + 86400000).toISOString(),
    duration: 60
  }
};

