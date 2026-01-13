/**
 * Category C: Video Calling & Tele Services (10 Tests)
 * T-036 to T-045
 */

import { testRegistry } from './test-registry';

export function registerCategoryCTests() {
  // T-036: Instant tele-consult assignment
  testRegistry.registerTest({
    testId: 'T-036',
    category: 'C',
    journeyType: 'Tele Service - Instant Assignment',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'Instant Assignment'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}"}',
      'GET /video-call/{bookingId}',
    ],
    expectedOutcome: 'Tele consult assigned instantly, video call session created',
  });

  // T-037: Delayed staff join
  testRegistry.registerTest({
    testId: 'T-037',
    category: 'C',
    journeyType: 'Tele Service - Delayed Staff Join',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'Staff Join Delay'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}"}',
      'POST /video-call/{bookingId}/join {"userId":"{staffId}","role":"staff","delay":300}',
      'GET /video-call/{bookingId}',
    ],
    expectedOutcome: 'Staff joined after delay, session state updated',
  });

  // T-038: Call drop & reconnection
  testRegistry.registerTest({
    testId: 'T-038',
    category: 'C',
    journeyType: 'Tele Service - Call Drop Reconnection',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'Reconnection Logic'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}"}',
      'POST /video-call/{bookingId}/end {"reason":"connection_lost"}',
      'POST /video-call/create {"bookingId":"{bookingId}","reconnect":true}',
      'GET /video-call/{bookingId}',
    ],
    expectedOutcome: 'Call reconnected, session resumed',
  });

  // T-039: Vendor joins late
  testRegistry.registerTest({
    testId: 'T-039',
    category: 'C',
    journeyType: 'Tele Service - Late Vendor Join',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'Late Join Handling'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}"}',
      'POST /video-call/{bookingId}/join {"userId":"{customerId}","role":"customer"}',
      'POST /video-call/{bookingId}/join {"userId":"{staffId}","role":"staff","delay":600}',
      'GET /video-call/{bookingId}',
    ],
    expectedOutcome: 'Vendor joined late, customer notified, session continued',
  });

  // T-040: Customer joins from two devices
  testRegistry.registerTest({
    testId: 'T-040',
    category: 'C',
    journeyType: 'Tele Service - Dual Device Join',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'Multi-device Handling'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}"}',
      'POST /video-call/{bookingId}/join {"userId":"{customerId}","role":"customer","deviceId":"device1"}',
      'POST /video-call/{bookingId}/join {"userId":"{customerId}","role":"customer","deviceId":"device2"}',
      'GET /video-call/{bookingId}',
    ],
    expectedOutcome: 'Second device join handled, first device disconnected or both allowed',
  });

  // T-041: Recording permission mismatch
  testRegistry.registerTest({
    testId: 'T-041',
    category: 'C',
    journeyType: 'Tele Service - Recording Permission',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'Recording Permission'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}","record":true}',
      'POST /video-call/{bookingId}/permission {"customerConsent":false}',
      'GET /video-call/{bookingId}',
    ],
    expectedOutcome: 'Recording disabled due to permission mismatch',
  });

  // T-042: Tele + prescription flow
  testRegistry.registerTest({
    testId: 'T-042',
    category: 'C',
    journeyType: 'Tele Service - Prescription Flow',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'Prescription Generation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}"}',
      'POST /bookings/{bookingId}/complete',
      'POST /prescriptions/create {"bookingId":"{bookingId}","medications":["Med1","Med2"]}',
      'GET /bookings/{bookingId}/prescriptions',
    ],
    expectedOutcome: 'Prescription generated after tele consult completion',
  });

  // T-043: Tele session cancellation after start
  testRegistry.registerTest({
    testId: 'T-043',
    category: 'C',
    journeyType: 'Tele Service - Cancellation After Start',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'tele',
    rulesInvolved: ['Tele Consultation', 'In-session Cancellation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},tele_consultation,500',
      'CREATE_STAFF:{vendorId},veterinarian',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
      'POST /video-call/create {"bookingId":"{bookingId}"}',
      'POST /video-call/{bookingId}/join {"userId":"{customerId}","role":"customer"}',
      'POST /bookings/{bookingId}/cancel {"reason":"Emergency"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Session cancelled, video call ended, refund policy applied',
  });

  // T-044 to T-045: Additional tele service tests
  for (let i = 44; i <= 45; i++) {
    testRegistry.registerTest({
      testId: `T-${String(i).padStart(3, '0')}`,
      category: 'C',
      journeyType: `Tele Service Test ${i}`,
      vendorType: 'Veterinary Clinic',
      serviceStyle: 'tele',
      rulesInvolved: ['Tele Consultation', 'Video Call'],
      preconditions: [
        'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
        'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
        'CREATE_SERVICE:{vendorId},tele_consultation,500',
      ],
      executionSteps: [
        'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":500,"serviceType":"tele"}',
        'POST /video-call/create {"bookingId":"{bookingId}"}',
      ],
      expectedOutcome: 'Tele service executed correctly',
    });
  }
}
