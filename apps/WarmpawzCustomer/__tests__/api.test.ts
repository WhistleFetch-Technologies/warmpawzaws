/**
 * API Service Tests
 * Tests for API service methods and shop path parity
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { ApiService, CustomerApi, OrderReturnApi, PaymentApi } from '../src/services/api';

const apiSource = readFileSync(join(__dirname, '../src/services/api.ts'), 'utf8');

describe('ApiService', () => {
  describe('getAuthHeaders', () => {
    it('should return headers with token when token exists', async () => {
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

  it('should expose canonical shop order methods', () => {
    expect(CustomerApi).toHaveProperty('cancelOrder');
    expect(CustomerApi).toHaveProperty('cancelDraftOrder');
    expect(CustomerApi).toHaveProperty('getOrderTracking');
    expect(CustomerApi).toHaveProperty('getOrderPaymentResume');
    expect(CustomerApi).toHaveProperty('createEcommerceOrder');
    expect(CustomerApi).toHaveProperty('returnOrder');
    expect(CustomerApi).toHaveProperty('getOrderReturnEligibility');
  });
});

describe('shop API path contract', () => {
  it('does not use dead /customer/shop/orders paths for cancel, track, or checkout', () => {
    expect(apiSource).not.toMatch(/\/customer\/shop\/orders\/\$\{[^}]+\}\/cancel/);
    expect(apiSource).not.toMatch(/\/customer\/shop\/orders\/\$\{[^}]+\}\/track/);
    expect(apiSource).not.toContain("'/customer/shop/checkout'");
  });

  it('uses canonical cancel, tracking, ecommerce, and return paths', () => {
    expect(apiSource).toContain('`/orders/${orderId}/cancel`');
    expect(apiSource).toContain('`/customer/orders/${orderId}/cancel-draft`');
    expect(apiSource).toContain('`/orders/${orderId}/tracking`');
    expect(apiSource).toContain("'/ecommerce/orders'");
    expect(apiSource).toContain('`/customer/orders/${orderId}/return`');
    expect(apiSource).toContain('`/orders/${orderId}/return-eligibility`');
  });

  it('uses /razorpay/create-order for shop Razorpay (not /payment/razorpay)', () => {
    expect(apiSource).toContain("'/razorpay/create-order'");
    expect(apiSource).toContain("'/razorpay/verify-payment'");
    expect(apiSource).not.toContain("'/payment/razorpay/create-order'");
    expect(apiSource).not.toContain("'/payment/razorpay/verify'");
  });
});

describe('PaymentApi', () => {
  it('should have all required methods', () => {
    expect(PaymentApi).toHaveProperty('createRazorpayOrder');
    expect(PaymentApi).toHaveProperty('createShopRazorpayOrder');
    expect(PaymentApi).toHaveProperty('verifyRazorpayPayment');
    expect(PaymentApi).toHaveProperty('verifyShopRazorpayPayment');
    expect(PaymentApi).toHaveProperty('getPaymentStatus');
    expect(PaymentApi).toHaveProperty('requestRefund');
  });
});

describe('OrderReturnApi', () => {
  it('posts to canonical customer orders return route', () => {
    expect(apiSource).toContain('OrderReturnApi');
    expect(apiSource).toContain('`/customer/orders/${orderId}/return`');
    expect(apiSource).not.toMatch(/OrderReturnApi[\s\S]*\/customer\/returns['`]/);
  });
});
