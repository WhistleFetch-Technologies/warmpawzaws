/**
 * Category D: Home Services & Map Tracking (15 Tests)
 * T-046 to T-060
 */

import { testRegistry } from './test-registry';

export function registerCategoryDTests() {
  // T-046: Distance threshold breach
  testRegistry.registerTest({
    testId: 'T-046',
    category: 'D',
    journeyType: 'Home Service - Distance Threshold',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['Distance Calculation', 'Service Area Validation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","address":"Pune,Maharashtra,411001","latitude":18.5204,"longitude":73.8567}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Distance validated, service area check passed or rejected',
  });

  // T-047: Staff running late
  testRegistry.registerTest({
    testId: 'T-047',
    category: 'D',
    journeyType: 'Home Service - Staff Late',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['ETA Calculation', 'Late Arrival Handling'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'POST /bookings/{bookingId}/status {"status":"in_progress","staffLocation":{"latitude":19.0760,"longitude":72.8777},"delay":30}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Staff marked as late, customer notified, ETA updated',
  });

  // T-048: GPS spoof / signal loss
  testRegistry.registerTest({
    testId: 'T-048',
    category: 'D',
    journeyType: 'Home Service - GPS Signal Loss',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['GPS Tracking', 'Signal Loss Handling'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'POST /bookings/{bookingId}/status {"status":"in_progress","gpsSignal":false}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'GPS signal loss detected, fallback tracking enabled',
  });

  // T-049: Buffer time violation
  testRegistry.registerTest({
    testId: 'T-049',
    category: 'D',
    journeyType: 'Home Service - Buffer Time',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['Buffer Time', 'Scheduling Rules'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:30","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Buffer time violation detected, booking rejected or rescheduled',
  });

  // T-050: Overlapping bookings
  testRegistry.registerTest({
    testId: 'T-050',
    category: 'D',
    journeyType: 'Home Service - Overlapping Bookings',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['Booking Conflict', 'Staff Availability'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Overlapping booking rejected, conflict detected',
  });

  // T-051: Staff multi-service capability conflict
  testRegistry.registerTest({
    testId: 'T-051',
    category: 'D',
    journeyType: 'Home Service - Multi-service Conflict',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['Staff Capabilities', 'Service Conflict'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_SERVICE:{vendorId},consultation,1500',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId2}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":1500,"serviceType":"at_home","staffId":"{staffId}"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Multi-service conflict detected, booking rejected or different staff assigned',
  });

  // T-052: Commute time recalculation
  testRegistry.registerTest({
    testId: 'T-052',
    category: 'D',
    journeyType: 'Home Service - Commute Recalculation',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['Commute Time', 'ETA Recalculation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}"}',
      'POST /bookings/{bookingId}/update-location {"staffLocation":{"latitude":19.0760,"longitude":72.8777},"customerLocation":{"latitude":19.2183,"longitude":72.9781}}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Commute time recalculated, ETA updated',
  });

  // T-053: Live tracking permission revoke
  testRegistry.registerTest({
    testId: 'T-053',
    category: 'D',
    journeyType: 'Home Service - Tracking Permission',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_home',
    rulesInvolved: ['Live Tracking', 'Permission Management'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,2000',
      'CREATE_STAFF:{vendorId},groomer',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","staffId":"{staffId}","trackingEnabled":true}',
      'POST /bookings/{bookingId}/tracking/revoke {"customerId":"{customerId}"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tracking permission revoked, location updates stopped',
  });

  // T-054 to T-060: Additional home service tests
  for (let i = 54; i <= 60; i++) {
    testRegistry.registerTest({
      testId: `T-${String(i).padStart(3, '0')}`,
      category: 'D',
      journeyType: `Home Service Test ${i}`,
      vendorType: 'Grooming Salon',
      serviceStyle: 'at_home',
      rulesInvolved: ['Home Service', 'GPS Tracking'],
      preconditions: [
        'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
        'CREATE_VENDOR:grooming,Test Grooming',
        'CREATE_SERVICE:{vendorId},grooming,2000',
      ],
      executionSteps: [
        'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home"}',
        'GET /bookings/{bookingId}',
      ],
      expectedOutcome: 'Home service executed correctly',
    });
  }
}
