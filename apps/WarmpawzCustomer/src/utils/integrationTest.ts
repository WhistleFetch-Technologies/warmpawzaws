/**
 * Integration Test Utilities
 * Helper functions for testing API endpoints
 */

import { CustomerApi, PaymentApi, WalletApi, BookingOtpApi } from '../services/api';
import { registerForPushNotifications, registerPushTokenWithBackend } from './notifications';

export interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  data?: any;
  duration?: number;
}

export class IntegrationTester {
  private results: TestResult[] = [];

  async runAllTests(customerId: string, phone: string): Promise<TestResult[]> {
    console.log('🧪 Starting Integration Tests...\n');

    // Authentication Tests
    await this.testOTPGeneration(phone);
    await this.testOTPVerification(phone, '123456'); // Mock OTP

    // Booking Tests
    await this.testServiceSearch();
    await this.testBookingCreation(customerId);
    await this.testBookingDetails('booking-123'); // Mock booking ID

    // Payment Tests
    await this.testPaymentOrderCreation('booking-123', customerId, 1000);
    await this.testPaymentVerification('order-123', 'payment-123', 'signature-123');

    // Wallet Tests
    await this.testWalletBalance(customerId);
    await this.testWalletTransactions(customerId);

    // Notification Tests
    await this.testNotificationRegistration(customerId);
    await this.testGetNotifications(customerId);

    console.log('\n✅ Integration Tests Complete!');
    return this.results;
  }

  private async runTest(
    testName: string,
    testFn: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    try {
      console.log(`🧪 Testing: ${testName}...`);
      const data = await testFn();
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        data,
        duration,
      });
      console.log(`✅ PASS: ${testName} (${duration}ms)\n`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        error: error.message || String(error),
        duration,
      });
      console.log(`❌ FAIL: ${testName} - ${error.message}\n`);
    }
  }

  // Authentication Tests
  async testOTPGeneration(phone: string): Promise<void> {
    await this.runTest('OTP Generation', async () => {
      const response = await CustomerApi.generateOtp(phone);
      if (!response || !response.success) {
        throw new Error('OTP generation failed');
      }
      return response;
    });
  }

  async testOTPVerification(phone: string, otp: string): Promise<void> {
    await this.runTest('OTP Verification', async () => {
      const response = await CustomerApi.verifyOtp(phone, otp);
      if (!response || !response.token) {
        throw new Error('OTP verification failed');
      }
      return response;
    });
  }

  // Booking Tests
  async testServiceSearch(): Promise<void> {
    await this.runTest('Service Search', async () => {
      const response = await CustomerApi.searchServices({
        query: 'grooming',
        latitude: 19.0760,
        longitude: 72.8777,
      });
      if (!response || !Array.isArray(response)) {
        throw new Error('Service search failed');
      }
      return response;
    });
  }

  async testBookingCreation(customerId: string): Promise<void> {
    await this.runTest('Booking Creation', async () => {
      const bookingData = {
        serviceId: 'service-123',
        vendorId: 'vendor-456',
        petId: 'pet-789',
        date: '2025-01-30',
        timeSlot: '10:00 AM',
        addressId: 'addr-123',
        customerId,
      };
      const response = await CustomerApi.createBooking(bookingData);
      if (!response || !response.bookingId) {
        throw new Error('Booking creation failed');
      }
      return response;
    });
  }

  async testBookingDetails(bookingId: string): Promise<void> {
    await this.runTest('Booking Details', async () => {
      const response = await CustomerApi.getBookingDetails(bookingId);
      if (!response || !response.bookingId) {
        throw new Error('Booking details fetch failed');
      }
      return response;
    });
  }

  async testBookingCheckIn(bookingId: string): Promise<void> {
    await this.runTest('Booking Check-in', async () => {
      const checkInData = {
        latitude: 19.0760,
        longitude: 72.8777,
        timestamp: new Date().toISOString(),
      };
      const response = await CustomerApi.checkInBooking(bookingId, checkInData);
      if (!response || !response.success) {
        throw new Error('Booking check-in failed');
      }
      return response;
    });
  }

  async testBookingFeedback(bookingId: string, customerId: string): Promise<void> {
    await this.runTest('Booking Feedback', async () => {
      const feedbackData = {
        rating: 5,
        feedback: 'Great service!',
        customerId,
      };
      const response = await CustomerApi.submitFeedback(bookingId, feedbackData);
      if (!response || !response.success) {
        throw new Error('Feedback submission failed');
      }
      return response;
    });
  }

  // Payment Tests
  async testPaymentOrderCreation(
    bookingId: string,
    customerId: string,
    amount: number
  ): Promise<void> {
    await this.runTest('Payment Order Creation', async () => {
      const orderData = {
        amount,
        currency: 'INR',
        receipt: bookingId,
        bookingId,
        customerId,
      };
      const response = await PaymentApi.createRazorpayOrder(orderData);
      if (!response || !response.razorpayOrderId) {
        throw new Error('Payment order creation failed');
      }
      return response;
    });
  }

  async testPaymentVerification(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<void> {
    await this.runTest('Payment Verification', async () => {
      const paymentData = {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      };
      const response = await PaymentApi.verifyRazorpayPayment(paymentData);
      if (!response || !response.success) {
        throw new Error('Payment verification failed');
      }
      return response;
    });
  }

  // Wallet Tests
  async testWalletBalance(customerId: string): Promise<void> {
    await this.runTest('Wallet Balance', async () => {
      const response = await WalletApi.getWallet(customerId);
      if (!response || typeof response.balance !== 'number') {
        throw new Error('Wallet balance fetch failed');
      }
      return response;
    });
  }

  async testWalletTransactions(customerId: string): Promise<void> {
    await this.runTest('Wallet Transactions', async () => {
      const response = await WalletApi.getWalletTransactions(customerId);
      if (!response || !Array.isArray(response)) {
        throw new Error('Wallet transactions fetch failed');
      }
      return response;
    });
  }

  // Notification Tests
  async testNotificationRegistration(customerId: string): Promise<void> {
    await this.runTest('Notification Registration', async () => {
      const tokenData = await registerForPushNotifications();
      if (!tokenData) {
        throw new Error('Push token generation failed');
      }
      const registered = await registerPushTokenWithBackend(
        customerId,
        tokenData.token,
        'ios'
      );
      if (!registered) {
        throw new Error('Push token registration failed');
      }
      return { token: tokenData.token, registered };
    });
  }

  async testGetNotifications(customerId: string): Promise<void> {
    await this.runTest('Get Notifications', async () => {
      const response = await CustomerApi.getNotifications(customerId);
      if (!response || !Array.isArray(response)) {
        throw new Error('Notifications fetch failed');
      }
      return response;
    });
  }

  // Generate Test Report
  generateReport(): string {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const avgDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;

    let report = '\n📊 INTEGRATION TEST REPORT\n';
    report += '='.repeat(50) + '\n';
    report += `Total Tests: ${total}\n`;
    report += `Passed: ${passed} ✅\n`;
    report += `Failed: ${failed} ❌\n`;
    report += `Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`;
    report += `Average Duration: ${avgDuration.toFixed(0)}ms\n`;
    report += '='.repeat(50) + '\n\n';

    report += 'DETAILED RESULTS:\n';
    report += '-'.repeat(50) + '\n';
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      report += `${index + 1}. ${status} ${result.testName} (${result.duration}ms)\n`;
      if (!result.passed && result.error) {
        report += `   Error: ${result.error}\n`;
      }
    });

    return report;
  }
}

// Export singleton instance
export const integrationTester = new IntegrationTester();

