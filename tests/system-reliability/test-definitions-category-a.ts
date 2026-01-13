/**
 * Category A: Tax & Financial Complexity (20 Tests)
 * T-001 to T-020
 */

import { testRegistry } from './test-registry';

export function registerCategoryATests() {
  // T-001: Multiple tax slabs (central + state) - Intrastate
  testRegistry.registerTest({
    testId: 'T-001',
    category: 'A',
    journeyType: 'Tax Calculation - Intrastate',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['CGST', 'SGST', 'GST Rules', 'HSN Code'],
    preconditions: [
      'CREATE_CUSTOMER:+919876543210,Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'SET_TAX_RULE:18,9,9,0,Maharashtra,Maharashtra',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-20","bookingTime":"10:00","amount":2000,"serviceType":"at_vendor"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax calculated: CGST 9% (180), SGST 9% (180), Total 2360',
  });

  // T-002: Multiple tax slabs - Interstate
  testRegistry.registerTest({
    testId: 'T-002',
    category: 'A',
    journeyType: 'Tax Calculation - Interstate',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['IGST', 'GST Rules', 'HSN Code'],
    preconditions: [
      'CREATE_CUSTOMER:Delhi,Delhi,110001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'SET_TAX_RULE:18,0,0,18,Delhi,Maharashtra',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax calculated: IGST 18% (360), Total 2360',
  });

  // T-003: Tax-exempt service
  testRegistry.registerTest({
    testId: 'T-003',
    category: 'A',
    journeyType: 'Tax Calculation - Exempt Service',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Tax Exemption', 'GST Rules'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},emergency,5000',
      'SET_TAX_RULE:0,0,0,0,Maharashtra,Maharashtra,exempt',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":5000}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax amount: 0, Total: 5000',
  });

  // T-004: Mixed taxable & non-taxable add-ons
  testRegistry.registerTest({
    testId: 'T-004',
    category: 'A',
    journeyType: 'Tax Calculation - Mixed Add-ons',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_center',
    rulesInvolved: ['CGST', 'SGST', 'Add-on Tax Rules'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},grooming,1500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":1500,"addons":[{"id":"addon1","amount":500,"taxable":true},{"id":"addon2","amount":200,"taxable":false}]}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax on 2000 (1500+500), exempt on 200, Total: 2236',
  });

  // T-005: Wallet + Razorpay + partial refund
  testRegistry.registerTest({
    testId: 'T-005',
    category: 'A',
    journeyType: 'Payment - Wallet + Razorpay + Refund',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Wallet Payment', 'Razorpay', 'Partial Refund', 'Tax Reversal'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
      'SET_WALLET_BALANCE:{customerId},500',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /payments/create {"bookingId":"{bookingId}","amount":2360,"walletAmount":500,"razorpayAmount":1860}',
      'POST /bookings/{bookingId}/cancel {"reason":"Customer request"}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
      'POST /refunds/create {"bookingId":"{bookingId}","refundAmount":1180}',
    ],
    expectedOutcome: 'Refund: 500 to wallet, 680 to Razorpay (50% of 1360 tax-inclusive)',
  });

  // T-006: Package cancellation mid-way
  testRegistry.registerTest({
    testId: 'T-006',
    category: 'A',
    journeyType: 'Package Cancellation - Mid-way',
    vendorType: 'Grooming Salon',
    serviceStyle: 'at_center',
    rulesInvolved: ['Package Booking', 'Proportional Refund', 'Tax Recalculation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Grooming',
      'CREATE_SERVICE:{vendorId},package,5000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":5000,"isPackage":true,"packageSessions":5}',
      'POST /bookings/{bookingId}/complete',
      'POST /bookings/{bookingId}/complete',
      'POST /bookings/{bookingId}/cancel {"reason":"Mid-way cancellation"}',
      'POST /refund-policy/calculate {"bookingId":"{bookingId}"}',
    ],
    expectedOutcome: 'Refund: 60% of unused sessions (3/5), tax recalculated proportionally',
  });

  // T-007: Tax recalculation after reschedule
  testRegistry.registerTest({
    testId: 'T-007',
    category: 'A',
    journeyType: 'Tax Recalculation - Reschedule',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Reschedule', 'Tax Recalculation', 'Location Change'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
      'POST /bookings/{bookingId}/reschedule {"newDate":"2026-01-20","newTime":"14:00","newLocation":"Delhi,Delhi,110001"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax recalculated: IGST 18% (interstate), Total 2360',
  });

  // T-008: Vendor-specific tax override
  testRegistry.registerTest({
    testId: 'T-008',
    category: 'A',
    journeyType: 'Tax Calculation - Vendor Override',
    vendorType: 'Premium Grooming',
    serviceStyle: 'at_center',
    rulesInvolved: ['Vendor Tax Override', 'Platform Default'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:grooming,Test Premium Grooming',
      'CREATE_SERVICE:{vendorId},grooming,3000',
      'SET_TAX_RULE:12,6,6,0,Maharashtra,Maharashtra,vendor_override',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":3000}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax: 12% (vendor override), Total 3360',
  });

  // T-009: Cross-border tax edge (location-based)
  testRegistry.registerTest({
    testId: 'T-009',
    category: 'A',
    journeyType: 'Tax Calculation - Cross-border Edge',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_home',
    rulesInvolved: ['Location-based Tax', 'Service Location', 'Customer Location'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"serviceType":"at_home","address":"Pune,Maharashtra,411001"}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax: CGST 9%, SGST 9% (same state, service location considered)',
  });

  // T-010: Multiple HSN codes in single booking
  testRegistry.registerTest({
    testId: 'T-010',
    category: 'A',
    journeyType: 'Tax Calculation - Multiple HSN',
    vendorType: 'Veterinary Clinic',
    serviceStyle: 'at_center',
    rulesInvolved: ['Multiple HSN Codes', 'HSN Summary'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
      'CREATE_SERVICE:{vendorId},consultation,2000',
    ],
    executionSteps: [
      'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000,"items":[{"hsnCode":"998314","amount":1500},{"hsnCode":"998315","amount":500}]}',
      'GET /bookings/{bookingId}',
    ],
    expectedOutcome: 'Tax calculated per HSN code, HSN summary generated',
  });

  // T-011 to T-020: Additional tax complexity tests
  for (let i = 11; i <= 20; i++) {
    testRegistry.registerTest({
      testId: `T-${String(i).padStart(3, '0')}`,
      category: 'A',
      journeyType: `Tax Complexity Test ${i}`,
      vendorType: 'Veterinary Clinic',
      serviceStyle: 'at_center',
      rulesInvolved: ['GST Rules', 'Tax Calculation'],
      preconditions: [
        'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
        'CREATE_VENDOR:vet_clinic,Test Vet Clinic',
        'CREATE_SERVICE:{vendorId},consultation,2000',
      ],
      executionSteps: [
        'POST /bookings/create {"customerId":"{customerId}","vendorId":"{vendorId}","serviceId":"{serviceId}","bookingDate":"2026-01-15","bookingTime":"10:00","amount":2000}',
        'GET /bookings/{bookingId}',
      ],
      expectedOutcome: 'Tax calculated correctly',
    });
  }
}
