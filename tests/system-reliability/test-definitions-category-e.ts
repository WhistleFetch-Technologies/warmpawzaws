/**
 * Category E: Pet Cafe Booking (10 Tests)
 * T-061 to T-070
 */

import { testRegistry } from './test-registry';

export function registerCategoryETests() {
  // T-061: Concurrent table booking
  testRegistry.registerTest({
    testId: 'T-061',
    category: 'E',
    journeyType: 'Cafe - Concurrent Table Booking',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Table Booking', 'Concurrency Control'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'GET /vendor/{vendorId}/cafe/tables/availability {"date":"2026-01-15"}',
    ],
    expectedOutcome: 'Concurrent booking rejected, table already booked',
  });

  // T-062: Pet policy violation
  testRegistry.registerTest({
    testId: 'T-062',
    category: 'E',
    journeyType: 'Cafe - Pet Policy Violation',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Pet Policy', 'Policy Enforcement'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","petId":"pet1","petType":"aggressive_breed"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Pet policy violation detected, booking rejected',
  });

  // T-063: Overbooking prevention
  testRegistry.registerTest({
    testId: 'T-063',
    category: 'E',
    journeyType: 'Cafe - Overbooking Prevention',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Capacity Management', 'Overbooking Prevention'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /vendor/{vendorId}/cafe/tables {"table_number":"table1","capacity":2,"max_concurrent_bookings":1}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'GET /vendor/{vendorId}/cafe/tables/availability {"date":"2026-01-15"}',
    ],
    expectedOutcome: 'Overbooking prevented, capacity limit enforced',
  });

  // T-064: Time slot overlap
  testRegistry.registerTest({
    testId: 'T-064',
    category: 'E',
    journeyType: 'Cafe - Time Slot Overlap',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Time Slot Management', 'Overlap Detection'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1","duration":120}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"11:00","amount":500,"serviceType":"pet_cafe","tableId":"table1","duration":60}',
      'GET /vendor/{vendorId}/cafe/tables/availability {"date":"2026-01-15"}',
    ],
    expectedOutcome: 'Time slot overlap detected, booking rejected',
  });

  // T-065: Group booking cancellation
  testRegistry.registerTest({
    testId: 'T-065',
    category: 'E',
    journeyType: 'Cafe - Group Booking Cancellation',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Group Booking', 'Cancellation Policy'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"pet_cafe","tableId":"table1","groupSize":4}',
      'POST /bookings/{bookingId}/cancel {"reason":"Group cancellation"}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Group booking cancelled, refund policy applied',
  });

  // T-066: Menu pre-order + cancellation
  testRegistry.registerTest({
    testId: 'T-066',
    category: 'E',
    journeyType: 'Cafe - Menu Pre-order Cancellation',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Menu Pre-order', 'Order Cancellation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'POST /orders/create {"bookingId":"{bookingId}","items":[{"menuItemId":"item1","quantity":2}]}',
      'POST /bookings/{bookingId}/cancel {"reason":"Booking cancelled"}',
      'GET /orders/{orderId}',
    ],
    expectedOutcome: 'Menu pre-order cancelled, refund processed',
  });

  // T-067: Peak-hour pricing rules
  testRegistry.registerTest({
    testId: 'T-067',
    category: 'E',
    journeyType: 'Cafe - Peak Hour Pricing',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Peak Hour Pricing', 'Dynamic Pricing'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"18:00","amount":500,"serviceType":"pet_cafe","tableId":"table1"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Peak hour pricing applied, amount increased',
  });

  // T-068: Multi-pet restriction enforcement
  testRegistry.registerTest({
    testId: 'T-068',
    category: 'E',
    journeyType: 'Cafe - Multi-pet Restriction',
    vendorType: 'Pet Cafe',
    serviceStyle: 'at_center',
    rulesInvolved: ['Pet Restrictions', 'Multi-pet Policy'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
      'CREATE_SERVICE:{vendorId},cafe_booking,500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe","tableId":"table1","petIds":["pet1","pet2","pet3","pet4"]}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Multi-pet restriction enforced, max pets limit applied',
  });

  // T-069 to T-070: Additional cafe tests
  for (let i = 69; i <= 70; i++) {
    testRegistry.registerTest({
      testId: `T-${String(i).padStart(3, '0')}`,
      category: 'E',
      journeyType: `Cafe Test ${i}`,
      vendorType: 'Pet Cafe',
      serviceStyle: 'at_center',
      rulesInvolved: ['Cafe Booking', 'Table Management'],
      preconditions: [
        'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
        'CREATE_VENDOR:pet_cafe,Test Pet Cafe',
        'CREATE_SERVICE:{vendorId},cafe_booking,500',
      ],
      executionSteps: [
        'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"pet_cafe"}',
        'GET /bookings/{bookingId}',
      ],
      expectedOutcome: 'Cafe booking executed correctly',
    });
  }
}
