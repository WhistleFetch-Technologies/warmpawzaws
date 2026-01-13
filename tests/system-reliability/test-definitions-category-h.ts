/**
 * Category H: Cross-Journey Conflicts (10 Tests)
 * T-091 to T-100
 */

import { testRegistry } from './test-registry';

export function registerCategoryHTests() {
  // T-091: Vendor running home + tele simultaneously
  testRegistry.registerTest({
    testId: 'T-091',
    category: 'H',
    journeyType: 'Cross-Journey - Simultaneous Services',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'hybrid',
    rulesInvolved: ['Service Conflict', 'Staff Availability'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId2}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele","staffId":"{staffId}"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Conflict detected, second booking rejected or different staff assigned',
  });

  // T-092: Same staff assigned to two services
  testRegistry.registerTest({
    testId: 'T-092',
    category: 'H',
    journeyType: 'Cross-Journey - Staff Double Assignment',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_center',
    rulesInvolved: ['Staff Assignment', 'Conflict Prevention'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_center","staffId":"{staffId}"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_center","staffId":"{staffId}"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Staff double assignment prevented, second booking rejected',
  });

  // T-093: Package + one-time overlap
  testRegistry.registerTest({
    testId: 'T-093',
    category: 'H',
    journeyType: 'Cross-Journey - Package One-time Overlap',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_center',
    rulesInvolved: ['Package Booking', 'One-time Booking', 'Conflict Resolution'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_SERVICE:{vendorId},package,5000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_center","staffId":"{staffId}"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId2}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":5000,"serviceType":"at_center","staffId":"{staffId}","isPackage":true}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Package and one-time booking conflict resolved',
  });

  // T-094: Wallet negative balance attempt
  testRegistry.registerTest({
    testId: 'T-094',
    category: 'H',
    journeyType: 'Cross-Journey - Negative Wallet Balance',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Wallet Balance', 'Payment Validation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'SET_WALLET_BALANCE:{customerId},500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /payments/create {"bookingId":"{bookingId}","amount":2360,"walletAmount":3000}',
      'GET /wallet/{customerId}',
    ],
    expectedOutcome: 'Negative wallet balance prevented, payment rejected',
  });

  // T-095: Booking during maintenance window
  testRegistry.registerTest({
    testId: 'T-095',
    category: 'H',
    journeyType: 'Cross-Journey - Maintenance Window',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Maintenance Window', 'Booking Blocking'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /admin/maintenance/window {"startTime":"2026-01-15T02:00","endTime":"2026-01-15T04:00"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"03:00","amount":2000}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Booking blocked during maintenance window',
  });

  // T-096: Admin config change mid-booking
  testRegistry.registerTest({
    testId: 'T-096',
    category: 'H',
    journeyType: 'Cross-Journey - Config Change Mid-booking',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Configuration Change', 'Booking State'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'PUT /admin/platform/settings {"taxRate":20}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Existing booking unaffected, new bookings use new config',
  });

  // T-097: Concurrent payment processing
  testRegistry.registerTest({
    testId: 'T-097',
    category: 'H',
    journeyType: 'Cross-Journey - Concurrent Payments',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Payment Processing', 'Concurrency Control'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /payments/create {"bookingId":"{bookingId}","amount":2360}',
      'POST /payments/create {"bookingId":"{bookingId}","amount":2360}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Duplicate payment prevented, idempotency enforced',
  });

  // T-098: Service availability race condition
  testRegistry.registerTest({
    testId: 'T-098',
    category: 'H',
    journeyType: 'Cross-Journey - Availability Race Condition',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Availability Check', 'Race Condition'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'GET /vendor/{vendorId}/cafe/tables/availability {"date":"2026-01-15"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'GET /vendor/{vendorId}/cafe/tables/availability {"date":"2026-01-15"}',
    ],
    expectedOutcome: 'Race condition handled, only one booking succeeds',
  });

  // T-099: Multi-tenant data isolation
  testRegistry.registerTest({
    testId: 'T-099',
    category: 'H',
    journeyType: 'Cross-Journey - Data Isolation',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Data Isolation', 'Multi-tenancy'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'GET /bookings/{bookingId} {"vendorId":"other_vendor"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Data isolation enforced, unauthorized access blocked',
  });

  // T-100: System-wide state consistency
  testRegistry.registerTest({
    testId: 'T-100',
    category: 'H',
    journeyType: 'Cross-Journey - State Consistency',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['State Consistency', 'System Integrity'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /payments/create {"bookingId":"{bookingId}","amount":2360}',
      'POST /bookings/{bookingId}/cancel {"reason":"Test"}',
      'GET /bookings/{bookingId}',
      'GET /payments/{paymentId}',
      'GET /wallet/{customerId}',
    ],
    expectedOutcome: 'System state consistent across all services',
  });
}
