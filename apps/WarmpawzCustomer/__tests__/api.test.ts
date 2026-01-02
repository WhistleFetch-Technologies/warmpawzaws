/**
 * API Service Tests
 * Tests for API service methods
 */

import { ApiService, CustomerApi, PaymentApi } from '../src/services/api';

describe('ApiService', () => {
  describe('getAuthHeaders', () => {
    it('should return headers with token when token exists', async () => {
      // Mock AsyncStorage
      const mockToken = 'test-token-123';
      await ApiService.saveSessionToken(mockToken);
      
      const headers = await ApiService.getAuthHeaders();
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should return headers without token when no token exists', async () => {
      await ApiService.clearSessionToken();
      const headers = await ApiService.getAuthHeaders();
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toBe('Bearer ');
    });
  });

  describe('token management', () => {
    it('should save and retrieve session token', async () => {
      const testToken = 'test-token-456';
      await ApiService.saveSessionToken(testToken);
      const retrievedToken = await ApiService.getSessionToken();
      expect(retrievedToken).toBe(testToken);
    });

    it('should clear session token', async () => {
      await ApiService.saveSessionToken('test-token');
      await ApiService.clearSessionToken();
      const token = await ApiService.getSessionToken();
      expect(token).toBeNull();
    });
  });
});

describe('CustomerApi', () => {
  it('should have all required methods', () => {
    expect(CustomerApi).toHaveProperty('generateOtp');
    expect(CustomerApi).toHaveProperty('verifyOtp');
    expect(CustomerApi).toHaveProperty('getProfile');
    expect(CustomerApi).toHaveProperty('getPets');
    expect(CustomerApi).toHaveProperty('createBooking');
    expect(CustomerApi).toHaveProperty('getBookingDetails');
    expect(CustomerApi).toHaveProperty('getNotifications');
  });
});

describe('PaymentApi', () => {
  it('should have all required methods', () => {
    expect(PaymentApi).toHaveProperty('createRazorpayOrder');
    expect(PaymentApi).toHaveProperty('verifyRazorpayPayment');
    expect(PaymentApi).toHaveProperty('getPaymentStatus');
    expect(PaymentApi).toHaveProperty('requestRefund');
  });
});

