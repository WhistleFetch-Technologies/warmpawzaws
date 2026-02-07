#!/usr/bin/env node
/**
 * Complete forensic systematic validation: code trace + E2E suite.
 * 1. Prints code trace for discovery → vendor → services → slots → payment → create (with file:line).
 * 2. Runs the full forensic suite and reports pass/fail.
 *
 * Usage: TEST_API_URL=<base> node scripts/forensic-systematic-validation.js
 */

const { spawn } = require('child_process');
const path = require('path');

const TRACE = [
  {
    phase: 'Phase 0: Discovery backend',
    steps: [
      { name: 'discover-services (publish_status, style-strict)', backend: 'service-discovery.ts (discover-services handler)', ui: null },
      { name: 'vendors/search with publish_status in EXISTS', backend: 'service-discovery.ts (vendors/search EXISTS ~2176-2184)', ui: null },
      { name: 'GET /customer/services (vendor_services-based)', backend: 'service-discovery.ts GET /customer/services (~268-310)', ui: 'DiagnosticsServicesLanding, HomeServiceLanding, CustomerServicesPage, PharmacyServicesLanding, AmbulanceSOS' },
      { name: 'Vendor photo in discovery', backend: 'service-discovery.ts COALESCE(profile_photo_url, profile_image, logo_url)', ui: null },
      { name: 'Parameter contract', backend: 'constants/booking-contract.ts', ui: null },
    ],
  },
  {
    phase: 'Phase 1: Vet center (at_center)',
    steps: [
      { name: 'Discovery', backend: 'service-discovery.ts GET /customer/discover-services', ui: 'VetServiceRouter.tsx loadVetData ~168-170' },
      { name: 'Vendor profile', backend: 'service-discovery.ts GET /customer/vendor/:vendorId ~2050', ui: 'VetBookingRouter.tsx (vendorId from discovery)' },
      { name: 'Vendor services', backend: 'service-discovery.ts GET /customer/vendor/:vendorId/services ~1946', ui: 'VetBookingRouter.tsx loadVendorServices' },
      { name: 'Available slots', backend: 'service-discovery.ts GET /customer/vendor/:vendorId/available-slots ~1361', ui: 'VetBookingRouter.tsx loadTimeSlots ~281-283' },
      { name: 'Create booking', backend: 'bookings-enhanced.ts POST /bookings/create ~2183, resolveVendorById', ui: 'VetBookingRouter.tsx ~719-736, UniversalPaymentPage.tsx ~1117-1120' },
    ],
  },
  {
    phase: 'Phase 2: Grooming (at_center + at_home)',
    steps: [
      { name: 'Discovery', backend: 'service-discovery.ts discover-services', ui: 'GroomingServiceRouter.tsx ~97' },
      { name: 'Slots with totalDuration/serviceIds', backend: 'service-discovery.ts available-slots', ui: 'GroomingBookingRouter.tsx ~337-338' },
      { name: 'Payment → create', backend: 'bookings-enhanced.ts POST /bookings/create', ui: 'GroomingBookingRouter → UniversalPaymentPage' },
    ],
  },
  {
    phase: 'Phase 3: Walker + Training',
    steps: [
      { name: 'Walker discovery (at_home)', backend: 'service-discovery.ts category=walker&serviceStyle=at_home', ui: 'WalkerService.tsx ~129' },
      { name: 'Training discovery', backend: 'service-discovery.ts category=training', ui: 'TrainingServiceRouter.tsx ~129' },
      { name: 'Slots + create', backend: 'service-discovery.ts available-slots, bookings-enhanced create', ui: 'WalkerBookingRouter, TrainingBookingRouter' },
    ],
  },
  {
    phase: 'Staff decommissioned',
    steps: [
      { name: 'No staff endpoints', backend: 'handler/index.ts registerStaffEndpoints commented', ui: 'BookingFlow.tsx loadAvailableStaff → setAvailableStaff([]), UnifiedBookingEngine.tsx same' },
    ],
  },
  {
    phase: 'Phase 5: Reschedule slots',
    steps: [
      { name: 'Vendor reschedule slots', backend: 'followup-reschedule.ts GET /vendor/available-slots, getVendorIdsForAvailabilityLookup, service_style/service_styles', ui: 'Vendor reschedule UI' },
    ],
  },
  {
    phase: 'Phase 6: Payment (dynamic)',
    steps: [
      { name: 'Platform fees', backend: 'config-policies.ts GET /config/fees', ui: 'UniversalPaymentPage.tsx loadPlatformFees ~541-590' },
      { name: 'Tax', backend: 'tax-management.ts POST /tax/calculate', ui: 'UniversalPaymentPage.tsx calculateTax ~612-663' },
      { name: 'Payment/refund policies', backend: 'config-policies.ts GET /config/policies, refund-policy-engine.ts GET /customer/refund-policy', ui: 'UniversalPaymentPage.tsx loadPaymentAndRefundPolicies, policy summary block' },
      { name: 'Coupon', backend: 'promotions/validate-code or coupons/validate', ui: 'UniversalPaymentPage.tsx handleApplyCoupon ~665-731' },
      { name: 'Wallet', backend: 'GET /customer/wallet', ui: 'UniversalPaymentPage.tsx loadPaymentData ~459-466' },
    ],
  },
  {
    phase: 'Phase 7: Style-specific',
    steps: [
      { name: 'Video call', backend: 'video-call.ts GET /video-call/:bookingId, create-meeting, join', ui: 'VideoCallInterface.tsx, ChimeVideoCall' },
      { name: 'GPS/tracking', backend: 'location-sharing.ts POST /location/update', ui: 'GPSTrackingView, HomeServiceLiveTracking' },
      { name: 'Prescription', backend: 'config/policies prescription', ui: 'PrescriptionModal, pharmacy flows' },
      { name: 'Diagnostics', backend: 'discover-services category=diagnostics', ui: 'DiagnosticsBookingFlow, DiagnosticsServicesLanding' },
    ],
  },
];

function runSuite() {
  return new Promise((resolve) => {
    const base = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
    const child = spawn('node', [path.join(__dirname, 'run-forensic-full-suite.js')], {
      stdio: 'inherit',
      env: { ...process.env, TEST_API_URL: base, API_BASE_URL: base },
    });
    child.on('close', (code) => resolve(code));
  });
}

function main() {
  console.log('\n' + '═'.repeat(72));
  console.log('FORENSIC SYSTEMATIC VALIDATION – Code trace + suite');
  console.log('═'.repeat(72));
  console.log(`API: ${process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'}`);
  console.log('═'.repeat(72));

  console.log('\n📋 CODE TRACE (backend = backend/lambda/src/endpoints unless noted)\n');
  for (const { phase, steps } of TRACE) {
    console.log(`\n${phase}`);
    console.log('─'.repeat(72));
    for (const step of steps) {
      console.log(`  • ${step.name}`);
      if (step.backend) console.log(`    Backend: ${step.backend}`);
      if (step.ui) console.log(`    UI: ${step.ui}`);
    }
  }

  console.log('\n' + '═'.repeat(72));
  console.log('RUNNING FULL FORENSIC SUITE');
  console.log('═'.repeat(72));

  runSuite().then((code) => {
    console.log('\n' + '═'.repeat(72));
    console.log(code === 0 ? '✅ SYSTEMATIC VALIDATION: PASSED (trace + suite)' : '❌ SYSTEMATIC VALIDATION: SUITE FAILED');
    console.log('═'.repeat(72) + '\n');
    process.exit(code);
  });
}

main();
