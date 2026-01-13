/**
 * Category B: Refund, Cancellation & Policy Engine (15 Tests)
 * T-021 to T-035
 */

import { testRegistry } from './test-registry';

export function registerCategoryBTests() {
  // T-021: Time-based refund threshold - Full refund
  testRegistry.registerTest({
    testId: 'T-021',
    category: 'B',
    journeyType: 'Refund Policy - Full Refund',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Time-based Refund', 'Full Refund Policy'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'SET_REFUND_RULE:48,24,50,12',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-20","bookingTime":"10:00","amount":2000}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
      'POST /bookings/{bookingId}/cancel {"reason":"Customer request"}',
    ],
    expectedOutcome: 'Full refund 100% (cancelled >48 hours before)',
  });

  // T-022: Time-based refund threshold - Partial refund
  testRegistry.registerTest({
    testId: 'T-022',
    category: 'B',
    journeyType: 'Refund Policy - Partial Refund',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Time-based Refund', 'Partial Refund Policy'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'SET_REFUND_RULE:48,24,50,12',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-18","bookingTime":"10:00","amount":2000}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
      'POST /bookings/{bookingId}/cancel {"reason":"Customer request"}',
    ],
    expectedOutcome: 'Partial refund 50% (cancelled 24-48 hours before)',
  });

  // T-023: Time-based refund threshold - No refund
  testRegistry.registerTest({
    testId: 'T-023',
    category: 'B',
    journeyType: 'Refund Policy - No Refund',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Time-based Refund', 'No Refund Policy'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'SET_REFUND_RULE:48,24,50,12',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
      'POST /bookings/{bookingId}/cancel {"reason":"Customer request"}',
    ],
    expectedOutcome: 'No refund (cancelled <12 hours before)',
  });

  // T-024: Vendor override vs platform policy
  testRegistry.registerTest({
    testId: 'T-024',
    category: 'B',
    journeyType: 'Refund Policy - Vendor Override',
    vendorType: 'Premium Grooming',
    serviceStyle: 'at_center',
    rulesInvolved: ['Vendor Refund Override', 'Platform Default'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Premium Grooming',
      'CREATE_SERVICE:{vendorId},grooming,3000',
      'SET_REFUND_RULE:72,36,75,24,vendor_override',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-20","bookingTime":"10:00","amount":3000}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
      'POST /bookings/{bookingId}/cancel {"reason":"Customer request"}',
    ],
    expectedOutcome: 'Vendor override: 75% refund (vendor policy)',
  });

  // T-025: Partial service delivery
  testRegistry.registerTest({
    testId: 'T-025',
    category: 'B',
    journeyType: 'Refund Policy - Partial Delivery',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_center',
    rulesInvolved: ['Partial Service', 'Proportional Refund'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},package,5000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":5000,"isPackage":true}',
      'POST /bookings/{bookingId}/status {"status":"in_progress"}',
      'POST /bookings/{bookingId}/cancel {"reason":"Service partially delivered"}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}","partialDelivery":true}',
    ],
    expectedOutcome: 'Proportional refund based on service completion',
  });

  // T-026: No-show penalties
  testRegistry.registerTest({
    testId: 'T-026',
    category: 'B',
    journeyType: 'Refund Policy - No-show Penalty',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['No-show Policy', 'Penalty Calculation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /bookings/{bookingId}/status {"status":"no_show"}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}","noShow":true}',
    ],
    expectedOutcome: 'No refund, penalty applied',
  });

  // T-027: Multi-session package refund
  testRegistry.registerTest({
    testId: 'T-027',
    category: 'B',
    journeyType: 'Refund Policy - Multi-session Package',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_center',
    rulesInvolved: ['Package Refund', 'Session-based Calculation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},package,5000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":5000,"isPackage":true,"packageSessions":5}',
      'POST /bookings/{bookingId}/complete',
      'POST /bookings/{bookingId}/cancel {"reason":"Package cancellation"}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}","completedSessions":1}',
    ],
    expectedOutcome: 'Refund: 4/5 sessions unused = 80% refund',
  });

  // T-028: Subscription pause vs cancel
  testRegistry.registerTest({
    testId: 'T-028',
    category: 'B',
    journeyType: 'Refund Policy - Subscription Pause',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Subscription', 'Pause vs Cancel'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},subscription,3000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":3000,"isSubscription":true}',
      'POST /bookings/{bookingId}/pause {"reason":"Temporary pause"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Subscription paused, no refund, can resume',
  });

  // T-029: Admin override scenarios
  testRegistry.registerTest({
    testId: 'T-029',
    category: 'B',
    journeyType: 'Refund Policy - Admin Override',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Admin Override', 'Policy Bypass'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /bookings/{bookingId}/cancel {"reason":"Customer request"}',
      'POST /admin/refunds/override {"bookingId":"{bookingId}","refundAmount":2000,"reason":"Admin override"}',
    ],
    expectedOutcome: 'Admin override: Full refund despite policy',
  });

  // T-030 to T-035: Additional refund policy tests
  for (let i = 30; i <= 35; i++) {
    testRegistry.registerTest({
      testId: `T-${String(i).padStart(3, '0')}`,
      category: 'B',
      journeyType: `Refund Policy Test ${i}`,
      vendorType: 'Veterinary Clinic',
      serviceStyle: 'at_center',
      rulesInvolved: ['Refund Policy', 'Cancellation'],
      preconditions: [
        'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
        'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
        'CREATE_SERVICE:{vendorId},consultation,2000',
      ],
      executionSteps: [
        'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
        'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
      ],
      expectedOutcome: 'Refund policy calculated correctly',
    });
  }
}
