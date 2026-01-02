/**
 * Test Helpers
 * Utilities for testing Batch 1 screens
 */

import { Alert } from 'react-native';

export interface TestResult {
  screen: string;
  test: string;
  passed: boolean;
  error?: string;
  timestamp: string;
}

export class Batch1Tester {
  private results: TestResult[] = [];

  logTest(screen: string, test: string, passed: boolean, error?: string) {
    const result: TestResult = {
      screen,
      test,
      passed,
      error,
      timestamp: new Date().toISOString(),
    };
    this.results.push(result);
    console.log(`[TEST] ${screen} - ${test}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (error) {
      console.error(`[TEST ERROR] ${error}`);
    }
  }

  getResults(): TestResult[] {
    return this.results;
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = total - passed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';

    return {
      total,
      passed,
      failed,
      passRate: `${passRate}%`,
      results: this.results,
    };
  }

  reset() {
    this.results = [];
  }
}

export const batch1Tester = new Batch1Tester();

/**
 * Mock API responses for testing
 */
export const mockApiResponses = {
  booking: {
    id: 'test-booking-123',
    status: 'confirmed',
    customerName: 'Test Customer',
    serviceName: 'Veterinary Consultation',
    amount: 500,
    scheduledDate: new Date().toISOString(),
    scheduledTime: '10:00 AM',
  },
  staff: [
    { id: 'staff-1', name: 'Dr. John Doe', role: 'Veterinarian', phone: '+1234567890' },
    { id: 'staff-2', name: 'Jane Smith', role: 'Assistant', phone: '+1234567891' },
  ],
  trackingSession: {
    id: 'track-123',
    bookingId: 'test-booking-123',
    status: 'active',
  },
};

/**
 * Validate screen props
 */
export function validateScreenProps(screen: string, props: any): boolean {
  const requiredProps: Record<string, string[]> = {
    BookingCompletionScreen: ['bookingId', 'vendorId'],
    BookingDetailScreen: ['bookingId', 'vendorId'],
    StaffAssignmentScreen: ['bookingId', 'vendorId'],
    BookingCheckInScreen: ['bookingId', 'vendorId'],
    StartServiceScreen: ['bookingId', 'vendorId'],
    GPSTrackingScreen: ['bookingId', 'vendorId'],
    RouteTrackingScreen: ['bookingId', 'vendorId'],
    FileUploadScreen: ['bookingId', 'vendorId'],
    BookingActionsScreen: ['bookingId', 'vendorId'],
  };

  const required = requiredProps[screen] || [];
  const missing = required.filter((prop) => !props[prop]);

  if (missing.length > 0) {
    console.error(`[VALIDATION] ${screen} missing props: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Test navigation flow
 */
export async function testNavigationFlow(
  navigate: (screen: string, data?: any) => void,
  screens: string[]
): Promise<boolean> {
  try {
    for (const screen of screens) {
      navigate(screen, { bookingId: 'test-123', vendorId: 'test-vendor' });
      // Wait a bit for navigation
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return true;
  } catch (error) {
    console.error('[NAVIGATION TEST] Error:', error);
    return false;
  }
}

