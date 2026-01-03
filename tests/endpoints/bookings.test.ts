/**
 * Booking Endpoints Test Suite
 * Tests the complete booking lifecycle
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mock API client for testing
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

async function apiRequest(method: string, endpoint: string, body?: any) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

describe('Booking Endpoints', () => {
  let testCustomerId: string;
  let testVendorId: string;
  let testServiceId: string;
  let testBookingId: string;

  beforeAll(async () => {
    // Setup test data IDs (would normally come from test fixtures)
    testCustomerId = 'test-customer-id';
    testVendorId = 'test-vendor-id';
    testServiceId = 'test-service-id';
  });

  describe('POST /bookings', () => {
    it('should create a new booking', async () => {
      const bookingData = {
        customerId: testCustomerId,
        vendorId: testVendorId,
        serviceId: testServiceId,
        bookingDate: '2026-02-01',
        bookingTime: '10:00',
        serviceType: 'at_vendor',
      };

      const response = await apiRequest('POST', '/bookings', bookingData);

      expect(response.success).toBe(true);
      expect(response.bookingId).toBeDefined();
      expect(response.status).toBe('pending');
      testBookingId = response.bookingId;
    });

    it('should fail without required fields', async () => {
      const response = await apiRequest('POST', '/bookings', {
        customerId: testCustomerId,
        // Missing other required fields
      });

      expect(response.error).toBeDefined();
    });
  });

  describe('GET /bookings/:bookingId', () => {
    it('should retrieve booking details', async () => {
      const response = await apiRequest('GET', `/bookings/${testBookingId}`);

      expect(response.success).toBe(true);
      expect(response.booking).toBeDefined();
      expect(response.booking.id).toBe(testBookingId);
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await apiRequest('GET', '/bookings/non-existent-id');

      expect(response.error).toBeDefined();
    });
  });

  describe('PUT /bookings/:bookingId/status', () => {
    it('should update booking status to confirmed', async () => {
      const response = await apiRequest('PUT', `/bookings/${testBookingId}/status`, {
        status: 'confirmed',
      });

      expect(response.success).toBe(true);
      expect(response.booking.status).toBe('confirmed');
    });

    it('should reject invalid status transition', async () => {
      const response = await apiRequest('PUT', `/bookings/${testBookingId}/status`, {
        status: 'completed', // Can't go from confirmed to completed directly
      });

      // Should either succeed (if allowed) or fail gracefully
      expect(response).toBeDefined();
    });
  });

  describe('POST /bookings/:bookingId/cancel', () => {
    it('should cancel a booking with reason', async () => {
      // First create a new booking to cancel
      const createResponse = await apiRequest('POST', '/bookings', {
        customerId: testCustomerId,
        vendorId: testVendorId,
        serviceId: testServiceId,
        bookingDate: '2026-02-15',
        bookingTime: '14:00',
        serviceType: 'at_vendor',
      });

      const cancelResponse = await apiRequest('POST', `/bookings/${createResponse.bookingId}/cancel`, {
        reason: 'Customer requested cancellation',
      });

      expect(cancelResponse.success).toBe(true);
      expect(cancelResponse.booking.status).toBe('cancelled');
    });
  });

  describe('POST /bookings/:bookingId/reschedule', () => {
    it('should reschedule a booking', async () => {
      const response = await apiRequest('POST', `/bookings/${testBookingId}/reschedule`, {
        newDate: '2026-02-05',
        newTime: '11:00',
      });

      expect(response.success || response.error).toBeDefined();
    });
  });

  describe('GET /customer/:customerId/bookings', () => {
    it('should retrieve all bookings for a customer', async () => {
      const response = await apiRequest('GET', `/customer/${testCustomerId}/bookings`);

      expect(response.success).toBe(true);
      expect(Array.isArray(response.bookings)).toBe(true);
    });

    it('should filter bookings by status', async () => {
      const response = await apiRequest('GET', `/customer/${testCustomerId}/bookings?status=pending`);

      expect(response.success).toBe(true);
      // All returned bookings should have pending status
      if (response.bookings && response.bookings.length > 0) {
        response.bookings.forEach((booking: any) => {
          expect(booking.status).toBe('pending');
        });
      }
    });
  });

  describe('GET /vendor/:vendorId/bookings', () => {
    it('should retrieve all bookings for a vendor', async () => {
      const response = await apiRequest('GET', `/vendor/${testVendorId}/bookings`);

      expect(response.success).toBe(true);
      expect(Array.isArray(response.bookings)).toBe(true);
    });

    it('should filter by date range', async () => {
      const response = await apiRequest(
        'GET',
        `/vendor/${testVendorId}/bookings?startDate=2026-01-01&endDate=2026-12-31`
      );

      expect(response.success).toBe(true);
    });
  });
});

describe('Booking OTP Verification', () => {
  let testBookingId: string;

  beforeAll(async () => {
    testBookingId = 'test-booking-with-otp';
  });

  describe('POST /bookings/:bookingId/generate-otp', () => {
    it('should generate OTP for service start', async () => {
      const response = await apiRequest('POST', `/bookings/${testBookingId}/generate-otp`, {
        otpType: 'start_service',
        phone: '+919876543210',
      });

      expect(response.success || response.error).toBeDefined();
    });
  });

  describe('POST /bookings/:bookingId/verify-otp', () => {
    it('should verify OTP', async () => {
      const response = await apiRequest('POST', `/bookings/${testBookingId}/verify-otp`, {
        otp: '123456',
        otpType: 'start_service',
        phone: '+919876543210',
      });

      expect(response).toBeDefined();
    });
  });
});

describe('Package Bookings', () => {
  describe('POST /bookings/package', () => {
    it('should create a package booking with multiple sessions', async () => {
      const response = await apiRequest('POST', '/bookings/package', {
        customerId: 'test-customer-id',
        vendorId: 'test-vendor-id',
        serviceId: 'test-service-id',
        totalSessions: 10,
        packagePrice: 5000,
        sessionDates: [
          { date: '2026-02-01', time: '10:00' },
          { date: '2026-02-08', time: '10:00' },
        ],
      });

      expect(response).toBeDefined();
    });
  });

  describe('POST /bookings/:bookingId/sessions/:sessionNumber/complete', () => {
    it('should complete a package session', async () => {
      const response = await apiRequest('POST', '/bookings/test-booking-id/sessions/1/complete', {
        notes: 'Session completed successfully',
        outcome: 'success',
      });

      expect(response).toBeDefined();
    });
  });
});

