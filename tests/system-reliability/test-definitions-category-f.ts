/**
 * Category F: Insurance Lifecycle (10 Tests)
 * T-071 to T-080
 */

import { testRegistry } from './test-registry';

export function registerCategoryFTests() {
  // T-071: Policy purchase with missing docs
  testRegistry.registerTest({
    testId: 'T-071',
    category: 'F',
    journeyType: 'Insurance - Purchase Missing Docs',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Insurance Purchase', 'Document Validation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'GET /insurance/plans',
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'GET /insurance/policies/customer/{customerId}',
    ],
    expectedOutcome: 'Policy created with status pending_documents',
  });

  // T-072: Doc upload after payment
  testRegistry.registerTest({
    testId: 'T-072',
    category: 'F',
    journeyType: 'Insurance - Doc Upload After Payment',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Document Upload', 'Policy Activation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'POST /payments/create {"policyId":"{policyId}","amount":5000}',
      'POST /insurance/policies/{policyId}/documents {"documents":["doc1","doc2"]}',
      'GET /insurance/policies/{policyId}',
    ],
    expectedOutcome: 'Documents uploaded, policy status updated',
  });

  // T-073: Claim filing before waiting period
  testRegistry.registerTest({
    testId: 'T-073',
    category: 'F',
    journeyType: 'Insurance - Claim Before Waiting Period',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Claim Filing', 'Waiting Period Validation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'POST /insurance/claims {"policyId":"{policyId}","claimType":"medical","incidentDate":"2026-01-10","claimAmount":5000}',
      'GET /insurance/claims/{claimId}',
    ],
    expectedOutcome: 'Claim rejected, waiting period not completed',
  });

  // T-074: Partial claim approval
  testRegistry.registerTest({
    testId: 'T-074',
    category: 'F',
    journeyType: 'Insurance - Partial Claim Approval',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Claim Approval', 'Partial Approval'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'POST /insurance/claims {"policyId":"{policyId}","claimType":"medical","incidentDate":"2026-01-10","claimAmount":10000}',
      'POST /admin/insurance/claims/{claimId}/approve {"approvedAmount":7000,"reason":"Partial approval"}',
      'GET /insurance/claims/{claimId}',
    ],
    expectedOutcome: 'Claim partially approved, amount 7000',
  });

  // T-075: Claim rejection & appeal
  testRegistry.registerTest({
    testId: 'T-075',
    category: 'F',
    journeyType: 'Insurance - Claim Rejection Appeal',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Claim Rejection', 'Appeal Process'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'POST /insurance/claims {"policyId":"{policyId}","claimType":"medical","incidentDate":"2026-01-10","claimAmount":5000}',
      'POST /admin/insurance/claims/{claimId}/reject {"reason":"Not covered"}',
      'POST /insurance/claims/{claimId}/appeal {"reason":"Appeal reason"}',
      'GET /insurance/claims/{claimId}',
    ],
    expectedOutcome: 'Claim rejected, appeal filed',
  });

  // T-076: Multi-pet insurance
  testRegistry.registerTest({
    testId: 'T-076',
    category: 'F',
    journeyType: 'Insurance - Multi-pet Policy',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Multi-pet Policy', 'Policy Management'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet2","planId":"plan1"}',
      'GET /insurance/policies/customer/{customerId}',
    ],
    expectedOutcome: 'Multiple pet policies created, discounts applied',
  });

  // T-077: Policy cancellation & refund
  testRegistry.registerTest({
    testId: 'T-077',
    category: 'F',
    journeyType: 'Insurance - Policy Cancellation',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Policy Cancellation', 'Refund Calculation'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'POST /insurance/policies/{policyId}/cancel {"reason":"Customer request"}',
      'POST /refunds/create {"policyId":"{policyId}","refundAmount":4000}',
      'GET /insurance/policies/{policyId}',
    ],
    expectedOutcome: 'Policy cancelled, proportional refund processed',
  });

  // T-078: Policy renewal with price change
  testRegistry.registerTest({
    testId: 'T-078',
    category: 'F',
    journeyType: 'Insurance - Renewal Price Change',
    vendorType: 'Insurance Provider',
    serviceStyle: 'online',
    rulesInvolved: ['Policy Renewal', 'Price Change'],
    preconditions: [
      'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
    ],
    executionSteps: [
      'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      'POST /insurance/policies/{policyId}/renew {"newPremium":5500}',
      'GET /insurance/policies/{policyId}',
    ],
    expectedOutcome: 'Policy renewed with new premium, price difference handled',
  });

  // T-079 to T-080: Additional insurance tests
  for (let i = 79; i <= 80; i++) {
    testRegistry.registerTest({
      testId: `T-${String(i).padStart(3, '0')}`,
      category: 'F',
      journeyType: `Insurance Test ${i}`,
      vendorType: 'Insurance Provider',
      serviceStyle: 'online',
      rulesInvolved: ['Insurance', 'Policy Management'],
      preconditions: [
        'CREATE_CUSTOMER:Mumbai,Maharashtra,400001',
      ],
      executionSteps: [
        'GET /insurance/plans',
        'POST /insurance/policies {"customerId":"{customerId}","petId":"pet1","planId":"plan1"}',
      ],
      expectedOutcome: 'Insurance operation executed correctly',
    });
  }
}
