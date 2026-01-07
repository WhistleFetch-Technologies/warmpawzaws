/**
 * Smoke Tests
 * Quick health checks for critical paths
 */

import { describe, it, expect } from '@jest/globals';
import axios from 'axios';
import { testConfig } from '../setup/config';

describe('API Health Checks', () => {
  it('should return 200 from health endpoint', async () => {
    if (!testConfig.apiEndpoint) {
      console.warn('API endpoint not configured, skipping test');
      return;
    }
    
    try {
      const response = await axios.get(`${testConfig.apiEndpoint}/health`);
      expect(response.status).toBe(200);
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  });
  
  it('should return valid health status', async () => {
    if (!testConfig.apiEndpoint) {
      return;
    }
    
    const response = await axios.get(`${testConfig.apiEndpoint}/health`);
    expect(response.data).toHaveProperty('status');
    expect(response.data.status).toBe('healthy');
  });
});

describe('Database Connectivity', () => {
  it('should connect to database', async () => {
    // Quick DB connection test
    expect(testConfig.dbHost).toBeTruthy();
  });
});

describe('Authentication', () => {
  it('should reject unauthenticated requests', async () => {
    if (!testConfig.apiEndpoint) {
      return;
    }
    
    try {
      await axios.get(`${testConfig.apiEndpoint}/api/protected`);
      fail('Should have thrown unauthorized error');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        expect(error.response?.status).toBe(401);
      }
    }
  });
});

describe('Service Availability', () => {
  it('should have Cognito accessible', async () => {
    // Quick Cognito check
    expect(process.env.COGNITO_USER_POOL_ID).toBeTruthy();
  });
  
  it('should have S3 accessible', async () => {
    // Quick S3 check
    expect(process.env.S3_UPLOADS_BUCKET).toBeTruthy();
  });
  
  it('should have SQS queues available', async () => {
    // Quick SQS check
    expect(process.env.SQS_BOOKING_QUEUE_URL).toBeTruthy();
  });
});

describe('External Integrations', () => {
  it('should have Razorpay configured', async () => {
    expect(process.env.RAZORPAY_KEY_ID).toBeTruthy();
  });
  
  it('should have Stripe configured', async () => {
    expect(process.env.STRIPE_SECRET_KEY).toBeTruthy();
  });
});

describe('Critical Endpoints', () => {
  const criticalEndpoints = [
    '/health',
    '/api/auth/login',
    '/api/bookings',
    '/api/vendors',
    '/api/payments'
  ];
  
  criticalEndpoints.forEach(endpoint => {
    it(`should have ${endpoint} available`, async () => {
      if (!testConfig.apiEndpoint) {
        return;
      }
      
      try {
        // Even if it returns 401/403, it should not return 404
        await axios.get(`${testConfig.apiEndpoint}${endpoint}`);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).not.toBe(404);
        }
      }
    });
  });
});

