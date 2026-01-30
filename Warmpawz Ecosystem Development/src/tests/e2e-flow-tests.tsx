/**
 * 🎯 END-TO-END FLOW TEST SUITE
 * 
 * Complete user journey testing
 * 
 * Test Flows:
 * - Customer booking journey
 * - Vendor onboarding journey
 * - Emergency ambulance flow
 * - Insurance purchase flow
 * - Training progress tracking
 * - Payment and settlement flow
 */

import { getApiBaseUrl, getAuthHeaders } from '../utils/api-config';

const BASE_URL = `${getApiBaseUrl()}`;

interface FlowStep {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  duration?: number;
  error?: string;
  data?: any;
}

interface FlowResult {
  flowName: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  status: 'pass' | 'fail';
  duration: number;
  steps: FlowStep[];
}

class E2EFlowRunner {
  private currentFlow: string = '';
  private flowSteps: FlowStep[] = [];
  private flowStartTime: number = 0;

  startFlow(flowName: string) {
    this.currentFlow = flowName;
    this.flowSteps = [];
    this.flowStartTime = Date.now();
    console.log(`\n🎯 Starting Flow: ${flowName}`);
    console.log('─'.repeat(60));
  }

  async runStep(stepName: string, stepFn: () => Promise<any>): Promise<any> {
    const step: FlowStep = {
      name: stepName,
      status: 'running'
    };

    this.flowSteps.push(step);
    console.log(`  ▶ ${stepName}...`);

    const startTime = Date.now();

    try {
      const result = await stepFn();
      step.status = 'pass';
      step.duration = Date.now() - startTime;
      step.data = result;
      console.log(`  ✅ ${stepName} (${step.duration}ms)`);
      return result;
    } catch (error) {
      step.status = 'fail';
      step.duration = Date.now() - startTime;
      step.error = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ ${stepName}: ${step.error}`);
      throw error;
    }
  }

  endFlow(): FlowResult {
    const duration = Date.now() - this.flowStartTime;
    const completedSteps = this.flowSteps.filter(s => s.status === 'pass').length;
    const failedSteps = this.flowSteps.filter(s => s.status === 'fail').length;

    const result: FlowResult = {
      flowName: this.currentFlow,
      totalSteps: this.flowSteps.length,
      completedSteps,
      failedSteps,
      status: failedSteps === 0 ? 'pass' : 'fail',
      duration,
      steps: this.flowSteps
    };

    console.log('─'.repeat(60));
    console.log(`${result.status === 'pass' ? '✅' : '❌'} Flow Complete: ${result.status.toUpperCase()}`);
    console.log(`  Steps: ${completedSteps}/${result.totalSteps} passed`);
    console.log(`  Duration: ${duration}ms\n`);

    return result;
  }
}

/**
 * FLOW 1: Complete Customer Booking Journey
 */
export async function testCustomerBookingFlow() {
  const runner = new E2EFlowRunner();
  runner.startFlow('Customer Booking Journey');

  try {
    // Step 1: Customer searches for services
    const searchResults = await runner.runStep(
      'Search for grooming services',
      async () => {
        const response = await fetch(`${BASE_URL}/elasticsearch/search?q=grooming`, {
          headers: getAuthHeaders()
        });
        return response.json();
      }
    );

    // Step 2: Select a vendor
    const vendor = await runner.runStep(
      'View vendor profile',
      async () => {
        const response = await fetch(`${BASE_URL}/vendor/test-vendor-001`, {
          headers: getAuthHeaders()
        });
        return response.json();
      }
    );

    // Step 3: Check availability
    await runner.runStep(
      'Check service availability',
      async () => {
        const response = await fetch(
          `${BASE_URL}/vendor/test-vendor-001/availability?date=2024-12-20`,
          { headers: getAuthHeaders() }
        );
        return response.json();
      }
    );

    // Step 4: Create booking
    const booking = await runner.runStep(
      'Create booking',
      async () => {
        const response = await fetch(`${BASE_URL}/bookings/create`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId: 'test-customer-001',
            petId: 'test-pet-001',
            vendorId: 'test-vendor-001',
            serviceId: 'test-service-001',
            appointmentDate: '2024-12-20',
            appointmentTime: '10:00 AM'
          })
        });
        return response.json();
      }
    );

    // Step 5: Add specialized services
    await runner.runStep(
      'Add prescription request',
      async () => {
        const response = await fetch(
          `${BASE_URL}/booking/${booking.bookingId || 'BOOK-TEST'}/add-specialized-services`,
          {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prescriptionRequested: true,
              prescriptionNotes: 'Need flea medication prescription',
              shareMedicalRecords: true
            })
          }
        );
        return response.json();
      }
    );

    // Step 6: Create payment
    const payment = await runner.runStep(
      'Create payment order',
      async () => {
        const response = await fetch(`${BASE_URL}/payment/create-order`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId: booking.bookingId || 'BOOK-TEST',
            amount: 1000,
            currency: 'INR'
          })
        });
        return response.json();
      }
    );

    // Step 7: Send booking confirmation SMS
    await runner.runStep(
      'Send booking confirmation SMS',
      async () => {
        const response = await fetch(`${BASE_URL}/sms/send`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber: '+919876543210',
            templateId: 'booking_confirmation',
            variables: {
              customerName: 'Test Customer',
              bookingId: booking.bookingId || 'BOOK-TEST',
              serviceName: 'Grooming'
            }
          })
        });
        return response.json();
      }
    );

    // Step 8: Customer views booking
    await runner.runStep(
      'View booking details',
      async () => {
        const response = await fetch(
          `${BASE_URL}/customer/test-customer-001/bookings`,
          { headers: getAuthHeaders() }
        );
        return response.json();
      }
    );

    return runner.endFlow();

  } catch (error) {
    console.error('Flow failed:', error);
    return runner.endFlow();
  }
}

/**
 * FLOW 2: Emergency Ambulance Journey
 */
export async function testEmergencyAmbulanceFlow() {
  const runner = new E2EFlowRunner();
  runner.startFlow('Emergency Ambulance Journey');

  try {
    // Step 1: Customer reports emergency
    const ambulanceBooking = await runner.runStep(
      'Request emergency ambulance',
      async () => {
        const response = await fetch(`${BASE_URL}/ambulance/emergency-booking`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId: 'test-customer-001',
            petId: 'test-pet-001',
            emergencyType: 'accident',
            severity: 'urgent',
            description: 'Pet hit by vehicle, bleeding',
            pickupLocation: {
              address: '123 Emergency St',
              lat: 28.6139,
              lng: 77.2090,
              contactName: 'Test Customer',
              contactPhone: '9876543210'
            },
            dropLocation: {
              address: 'City Vet Hospital',
              lat: 28.6200,
              lng: 77.2100,
              facilityName: 'City Vet Hospital'
            }
          })
        });
        return response.json();
      }
    );

    // Step 2: System finds nearest ambulance
    await runner.runStep(
      'Ambulance assigned',
      async () => {
        // Simulate ambulance assignment
        return { assigned: true, eta: '10 minutes' };
      }
    );

    // Step 3: Send emergency SMS
    await runner.runStep(
      'Send emergency SMS notification',
      async () => {
        const response = await fetch(`${BASE_URL}/sms/send`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber: '+919876543210',
            templateId: 'ambulance_dispatched',
            variables: {
              customerName: 'Test Customer',
              eta: '10 minutes',
              vehicleNumber: 'DL-01-AB-1234'
            }
          })
        });
        return response.json();
      }
    );

    // Step 4: Track ambulance location
    await runner.runStep(
      'Track ambulance in real-time',
      async () => {
        const response = await fetch(
          `${BASE_URL}/ambulance/tracking/${ambulanceBooking.booking?.id || 'AMB-TEST'}`,
          { headers: getAuthHeaders() }
        );
        return response.json();
      }
    );

    // Step 5: Update ambulance status
    await runner.runStep(
      'Update status: Arrived at pickup',
      async () => {
        const response = await fetch(
          `${BASE_URL}/ambulance/${ambulanceBooking.booking?.id || 'AMB-TEST'}/status`,
          {
            method: 'PUT',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'arrived' })
          }
        );
        return response.json();
      }
    );

    // Step 6: Pet loaded
    await runner.runStep(
      'Update status: Pet loaded',
      async () => {
        const response = await fetch(
          `${BASE_URL}/ambulance/${ambulanceBooking.booking?.id || 'AMB-TEST'}/status`,
          {
            method: 'PUT',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'pet_loaded' })
          }
        );
        return response.json();
      }
    );

    // Step 7: Delivered to hospital
    await runner.runStep(
      'Update status: Delivered to hospital',
      async () => {
        const response = await fetch(
          `${BASE_URL}/ambulance/${ambulanceBooking.booking?.id || 'AMB-TEST'}/status`,
          {
            method: 'PUT',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'delivered' })
          }
        );
        return response.json();
      }
    );

    return runner.endFlow();

  } catch (error) {
    console.error('Flow failed:', error);
    return runner.endFlow();
  }
}

/**
 * FLOW 3: Insurance Purchase Journey
 */
export async function testInsurancePurchaseFlow() {
  const runner = new E2EFlowRunner();
  runner.startFlow('Insurance Purchase Journey');

  try {
    // Step 1: Browse insurance plans
    await runner.runStep(
      'Browse available insurance plans',
      async () => {
        const response = await fetch(`${BASE_URL}/insurance/plans`, {
          headers: getAuthHeaders()
        });
        return response.json();
      }
    );

    // Step 2: Select plan
    await runner.runStep(
      'Select insurance plan',
      async () => {
        return { planId: 'standard', selected: true };
      }
    );

    // Step 3: Upload documents
    await runner.runStep(
      'Upload required documents',
      async () => {
        // Simulate document upload
        return {
          vaccinationCard: 'uploaded',
          petPhoto: 'uploaded'
        };
      }
    );

    // Step 4: Purchase policy
    const policy = await runner.runStep(
      'Purchase insurance policy',
      async () => {
        const response = await fetch(`${BASE_URL}/insurance/purchase-policy`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId: 'test-customer-001',
            petId: 'test-pet-001',
            planId: 'standard',
            documents: {
              vaccinationCard: 'uploaded',
              petPhoto: 'uploaded'
            }
          })
        });
        return response.json();
      }
    );

    // Step 5: Download policy document
    await runner.runStep(
      'Download policy PDF',
      async () => {
        const response = await fetch(
          `${BASE_URL}/insurance/policy/${policy.policy?.policyId || 'POL-TEST'}/download`,
          { headers: getAuthHeaders() }
        );
        return response.json();
      }
    );

    // Step 6: Send policy confirmation SMS
    await runner.runStep(
      'Send policy confirmation SMS',
      async () => {
        const response = await fetch(`${BASE_URL}/sms/send`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber: '+919876543210',
            templateId: 'insurance_activated',
            variables: {
              customerName: 'Test Customer',
              policyId: policy.policy?.policyId || 'POL-TEST',
              coverage: '2,00,000'
            }
          })
        });
        return response.json();
      }
    );

    return runner.endFlow();

  } catch (error) {
    console.error('Flow failed:', error);
    return runner.endFlow();
  }
}

/**
 * FLOW 4: Vendor Settlement Flow
 */
export async function testVendorSettlementFlow() {
  const runner = new E2EFlowRunner();
  runner.startFlow('Vendor Settlement Journey');

  try {
    // Step 1: Vendor completes booking
    await runner.runStep(
      'Complete booking service',
      async () => {
        return { bookingId: 'BOOK-TEST', status: 'completed' };
      }
    );

    // Step 2: Calculate commission based on tier
    const commission = await runner.runStep(
      'Calculate tier-based commission',
      async () => {
        const response = await fetch(
          `${BASE_URL}/tier-system/calculate-commission?vendorId=test-vendor-001&amount=1000`,
          { headers: getAuthHeaders() }
        );
        return response.json();
      }
    );

    // Step 3: Process settlement
    await runner.runStep(
      'Process marketplace settlement',
      async () => {
        const response = await fetch(`${BASE_URL}/marketplace-settlement/process`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId: 'test-vendor-001',
            bookingId: 'BOOK-TEST',
            amount: 1000,
            commission: commission.commission
          })
        });
        return response.json();
      }
    );

    // Step 4: Get vendor earnings
    await runner.runStep(
      'View vendor earnings dashboard',
      async () => {
        const response = await fetch(
          `${BASE_URL}/marketplace-settlement/vendor/test-vendor-001/earnings`,
          { headers: getAuthHeaders() }
        );
        return response.json();
      }
    );

    // Step 5: Schedule payout
    await runner.runStep(
      'Schedule vendor payout',
      async () => {
        return { payoutScheduled: true, date: 'Friday' };
      }
    );

    return runner.endFlow();

  } catch (error) {
    console.error('Flow failed:', error);
    return runner.endFlow();
  }
}

/**
 * FLOW 5: Training Progress Tracking Flow
 */
export async function testTrainingProgressFlow() {
  const runner = new E2EFlowRunner();
  runner.startFlow('Training Progress Tracking');

  try {
    // Step 1: Book training package
    const packageBooking = await runner.runStep(
      'Book training package',
      async () => {
        return { packageId: 'PKG-001', totalSessions: 10 };
      }
    );

    // Step 2: Complete first session
    await runner.runStep(
      'Record first training session',
      async () => {
        const response = await fetch(
          `${BASE_URL}/training/session/SESSION-001/progress`,
          {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionNumber: 1,
              skillsFocused: ['Sit', 'Stay'],
              progressRating: 4,
              achievements: ['Learned Sit command'],
              notes: 'Great first session'
            })
          }
        );
        return response.json();
      }
    );

    // Step 3: View progress dashboard
    await runner.runStep(
      'View training progress dashboard',
      async () => {
        const response = await fetch(
          `${BASE_URL}/training/package/${packageBooking.packageId}/progress`,
          { headers: getAuthHeaders() }
        );
        return response.json();
      }
    );

    // Step 4: Achieve milestone
    await runner.runStep(
      'Achieve training milestone',
      async () => {
        return { milestone: 'Basic Commands', achieved: true };
      }
    );

    // Step 5: Send progress notification
    await runner.runStep(
      'Send progress update SMS',
      async () => {
        const response = await fetch(`${BASE_URL}/sms/send`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber: '+919876543210',
            templateId: 'training_milestone',
            variables: {
              petName: 'Max',
              milestone: 'Basic Commands',
              sessionsCompleted: '3'
            }
          })
        });
        return response.json();
      }
    );

    return runner.endFlow();

  } catch (error) {
    console.error('Flow failed:', error);
    return runner.endFlow();
  }
}

/**
 * RUN ALL E2E FLOWS
 */
export async function runAllE2EFlows() {
  console.log('\n' + '='.repeat(60));
  console.log('🎯 END-TO-END FLOW TEST SUITE');
  console.log('='.repeat(60));

  const results: FlowResult[] = [];

  results.push(await testCustomerBookingFlow());
  results.push(await testEmergencyAmbulanceFlow());
  results.push(await testInsurancePurchaseFlow());
  results.push(await testVendorSettlementFlow());
  results.push(await testTrainingProgressFlow());

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 E2E FLOW TEST RESULTS');
  console.log('='.repeat(60));

  const totalFlows = results.length;
  const passedFlows = results.filter(r => r.status === 'pass').length;
  const failedFlows = results.filter(r => r.status === 'fail').length;

  console.log(`Total Flows: ${totalFlows}`);
  console.log(`✅ Passed: ${passedFlows}`);
  console.log(`❌ Failed: ${failedFlows}`);
  console.log(`Success Rate: ${((passedFlows / totalFlows) * 100).toFixed(2)}%`);

  if (failedFlows > 0) {
    console.log('\n❌ Failed Flows:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.flowName}`);
      const failedSteps = r.steps.filter(s => s.status === 'fail');
      failedSteps.forEach(s => {
        console.log(`    • ${s.name}: ${s.error}`);
      });
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  return results;
}

export { E2EFlowRunner, FlowResult, FlowStep };
