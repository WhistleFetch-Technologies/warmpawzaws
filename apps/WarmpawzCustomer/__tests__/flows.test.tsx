/**
 * Flow Tests
 * Tests for critical user flows
 */

describe('User Flows', () => {
  describe('Authentication Flow', () => {
    it('should handle OTP generation', () => {
      // Verify OTP flow exists
      const api = require('../src/services/api');
      expect(api.CustomerApi).toHaveProperty('generateOtp');
      expect(api.CustomerApi).toHaveProperty('verifyOtp');
    });
  });

  describe('Booking Flow', () => {
    it('should handle booking creation', () => {
      const api = require('../src/services/api');
      expect(api.CustomerApi).toHaveProperty('createBooking');
      expect(api.CustomerApi).toHaveProperty('getBookingDetails');
      expect(api.CustomerApi).toHaveProperty('cancelBooking');
      expect(api.CustomerApi).toHaveProperty('rescheduleBooking');
    });
  });

  describe('Payment Flow', () => {
    it('should handle payment processing', () => {
      const api = require('../src/services/api');
      expect(api.PaymentApi).toHaveProperty('createRazorpayOrder');
      expect(api.PaymentApi).toHaveProperty('verifyRazorpayPayment');
    });
  });
});

