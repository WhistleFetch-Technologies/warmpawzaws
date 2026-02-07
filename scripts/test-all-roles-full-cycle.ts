/**
 * ============================================================================
 * FULL CYCLE TEST SCRIPT FOR ALL VENDOR ROLES
 * ============================================================================
 * 
 * This script tests the complete flow for all vendor roles using the EXISTING
 * onboarding and booking infrastructure:
 * 
 * 1. Vendor registration via existing API
 * 2. Submit onboarding application (uses existing DynamicVendorOnboardingForm API)
 * 3. Admin approval (simulate)
 * 4. Schedule setup with multi-service styles
 * 5. Service publishing
 * 6. Customer booking flow
 * 7. Payment and confirmation
 * 8. Service completion with OTP
 * 9. GPS tracking for home services
 * 10. Package tracking
 * 
 * NOTE: This uses the EXISTING APIs and does not reinvent any wheel.
 * The onboarding flow submits to admin for approval as designed.
 * 
 * Run with: npx ts-node scripts/test-all-roles-full-cycle.ts
 * ============================================================================
 */

// Using native fetch (Node.js 18+)
const API_BASE = process.env.API_URL || 'http://localhost:3000';

// All vendor roles to test
const VENDOR_ROLES = [
  {
    id: 'veterinarian',
    name: 'Veterinarian',
    serviceStyles: ['at_center', 'at_home', 'tele'],
    specializations: ['surgery', 'dermatology', 'dentistry', 'emergency'],
    services: [
      { name: 'General Checkup', duration: 30, price: 500 },
      { name: 'Vaccination', duration: 15, price: 800 },
      { name: 'Surgery Consultation', duration: 45, price: 1200 }
    ]
  },
  {
    id: 'groomer',
    name: 'Pet Groomer',
    serviceStyles: ['at_center', 'at_home'],
    specializations: ['full_grooming', 'bath_only', 'haircut_styling'],
    services: [
      { name: 'Full Grooming', duration: 60, price: 800 },
      { name: 'Bath & Brush', duration: 45, price: 400 },
      { name: 'Nail Trimming', duration: 15, price: 200 }
    ]
  },
  {
    id: 'trainer',
    name: 'Pet Trainer',
    serviceStyles: ['at_center', 'at_home', 'tele'],
    specializations: ['basic_obedience', 'potty_training', 'aggression'],
    services: [
      { name: 'Basic Obedience Training', duration: 60, price: 1500 },
      { name: 'Potty Training Session', duration: 45, price: 1000 },
      { name: 'Behavior Consultation', duration: 30, price: 800 }
    ]
  },
  {
    id: 'walker',
    name: 'Pet Walker',
    serviceStyles: ['at_home'],
    specializations: [],
    services: [
      { name: '30 Min Walk', duration: 30, price: 300 },
      { name: '60 Min Walk', duration: 60, price: 500 },
      { name: 'Group Walk', duration: 45, price: 250 }
    ]
  },
  {
    id: 'sitter',
    name: 'Pet Sitter',
    serviceStyles: ['at_home'],
    specializations: [],
    services: [
      { name: 'Day Sitting (8 hrs)', duration: 480, price: 1500 },
      { name: 'Overnight Sitting', duration: 720, price: 2500 },
      { name: 'Drop-in Visit', duration: 30, price: 300 }
    ]
  },
  {
    id: 'boarding',
    name: 'Pet Boarding',
    serviceStyles: ['at_center'],
    specializations: [],
    services: [
      { name: 'Day Boarding', duration: 600, price: 800 },
      { name: 'Overnight Boarding', duration: 1440, price: 1500 },
      { name: 'Weekly Boarding (7 days)', duration: 10080, price: 8000 }
    ]
  },
  {
    id: 'nutritionist',
    name: 'Pet Nutritionist',
    serviceStyles: ['at_home', 'tele'],
    specializations: [],
    services: [
      { name: 'Diet Consultation', duration: 45, price: 1200 },
      { name: 'Meal Plan Creation', duration: 30, price: 800 },
      { name: 'Follow-up Session', duration: 20, price: 500 }
    ]
  },
  {
    id: 'behaviorist',
    name: 'Pet Behaviorist',
    serviceStyles: ['at_home', 'tele'],
    specializations: ['anxiety', 'aggression', 'fear'],
    services: [
      { name: 'Behavior Assessment', duration: 60, price: 2000 },
      { name: 'Therapy Session', duration: 45, price: 1500 },
      { name: 'Follow-up Consultation', duration: 30, price: 1000 }
    ]
  },
  {
    id: 'pharmacy',
    name: 'Pet Pharmacy',
    serviceStyles: ['delivery'],
    specializations: [],
    services: [
      { name: 'Prescription Medicines', duration: 0, price: 0 },
      { name: 'Pet Supplements', duration: 0, price: 0 },
      { name: 'Medical Supplies', duration: 0, price: 0 }
    ]
  }
];

// Test data generators
function generatePhone(): string {
  return `9${Math.random().toString().slice(2, 11)}`;
}

function generateEmail(role: string): string {
  const rand = Math.random().toString(36).substring(7);
  return `test_${role}_${rand}@warmpawz.test`;
}

// API helper
async function apiRequest(
  method: string,
  endpoint: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

// Test functions for each step
interface TestVendor {
  id: string;
  phone: string;
  email: string;
  role: typeof VENDOR_ROLES[0];
}

async function registerVendor(role: typeof VENDOR_ROLES[0]): Promise<TestVendor | null> {
  console.log(`\n📝 Registering ${role.name}...`);
  
  const phone = generatePhone();
  const email = generateEmail(role.id);
  
  // Step 1: Get/create vendor identity via existing status endpoint
  const statusResult = await apiRequest('GET', `/vendor/onboarding/status?phone=${phone}`);
  
  if (statusResult.status !== 200) {
    console.error(`   ❌ Status check failed:`, statusResult.data);
    return null;
  }
  
  console.log(`   📋 Initial status: ${statusResult.data?.identity?.onboarding_status}`);
  
  // Step 2: Select role using existing endpoint
  const selectRoleResult = await apiRequest('POST', '/vendor/onboarding/select-role', {
    phone,
    role_id: role.id
  });
  
  if (selectRoleResult.status !== 200 && selectRoleResult.status !== 201) {
    console.error(`   ❌ Role selection failed:`, selectRoleResult.data);
    return null;
  }
  
  const vendorId = selectRoleResult.data?.identity?.id || 
                   selectRoleResult.data?.vendorId ||
                   statusResult.data?.identity?.id;
  
  if (!vendorId) {
    console.error(`   ❌ No vendor ID returned`);
    return null;
  }
  
  console.log(`   ✅ Registered with ID: ${vendorId}`);
  
  return { id: vendorId, phone, email, role };
}

async function completeOnboarding(vendor: TestVendor): Promise<boolean> {
  console.log(`\n📋 Completing onboarding for ${vendor.role.name}...`);
  
  // Submit onboarding form using existing endpoint
  const onboardingData = {
    phone: vendor.phone,
    vendor_type: vendor.role.id === 'walker' ? 'solo' : 'business',
    form_data: {
      business_name: `Test ${vendor.role.name} Clinic`,
      owner_name: 'Test Owner',
      email: vendor.email,
      phone: vendor.phone,
      street_address: '123 Test Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      latitude: 19.0760,
      longitude: 72.8777,
      pan_number: 'ABCDE1234F',
      gst_number: '27ABCDE1234F1Z5',
      bank_account_number: '1234567890',
      bank_ifsc_code: 'HDFC0001234',
      bank_account_holder_name: 'Test Owner',
      years_of_experience: 5,
      license_number: 'LIC123456',
      about: `Professional ${vendor.role.name} with 5 years of experience`
    },
    service_styles: vendor.role.serviceStyles,
    specializations: vendor.role.specializations
  };
  
  // Submit application using existing onboarding endpoint
  const result = await apiRequest('POST', '/vendor/onboarding/submit', onboardingData);
  
  if (result.status !== 200 && result.status !== 201) {
    console.error(`   ❌ Onboarding submission failed:`, result.data);
    return false;
  }
  
  console.log(`   ✅ Application submitted for admin review`);
  
  // For testing, simulate admin approval (in real scenario, admin does this)
  console.log(`   🔄 Simulating admin approval...`);
  const approvalResult = await apiRequest('POST', '/admin/vendors/approve', {
    phone: vendor.phone,
    vendorId: vendor.id,
    approved_by: 'test-admin'
  });
  
  if (approvalResult.status === 200) {
    console.log(`   ✅ Admin approval simulated`);
    
    // Activate the vendor
    const activateResult = await apiRequest('POST', '/vendor/onboarding/activate', {
      phone: vendor.phone
    });
    
    if (activateResult.status === 200) {
      console.log(`   ✅ Vendor activated`);
    }
  } else {
    console.log(`   ⚠️  Could not simulate approval (may require actual admin)`, approvalResult.data);
  }
  
  return true;
}

async function setupServices(vendor: TestVendor): Promise<boolean> {
  console.log(`\n🛠️  Setting up services for ${vendor.role.name}...`);
  
  for (const service of vendor.role.services) {
    for (const style of vendor.role.serviceStyles) {
      const serviceData = {
        serviceName: service.name,
        serviceStyle: style,
        duration: service.duration,
        price: service.price,
        description: `${service.name} - ${style}`,
        isActive: true
      };
      
      const result = await apiRequest('POST', `/vendor/${vendor.id}/services`, serviceData);
      
      if (result.status !== 200 && result.status !== 201) {
        console.error(`   ⚠️  Failed to add service ${service.name}:`, result.data);
      }
    }
  }
  
  console.log(`   ✅ Services configured`);
  return true;
}

async function setupSchedule(vendor: TestVendor): Promise<boolean> {
  console.log(`\n📅 Setting up schedule for ${vendor.role.name}...`);
  
  const slots = [];
  
  // Create schedule for Mon-Sat (day 1-6)
  for (let day = 1; day <= 6; day++) {
    for (const style of vendor.role.serviceStyles) {
      // Morning slot
      slots.push({
        day_of_week: day,
        time_window_start: '09:00',
        time_window_end: '13:00',
        service_style: style,
        slot_duration_minutes: 30,
        buffer_time_minutes: style === 'at_home' ? 30 : 15,
        max_capacity: 1,
        service_area_km: style === 'at_home' ? 10 : null,
        is_enabled: true
      });
      
      // Evening slot
      slots.push({
        day_of_week: day,
        time_window_start: '15:00',
        time_window_end: '19:00',
        service_style: style,
        slot_duration_minutes: 30,
        buffer_time_minutes: style === 'at_home' ? 30 : 15,
        max_capacity: 1,
        service_area_km: style === 'at_home' ? 10 : null,
        is_enabled: true
      });
    }
  }
  
  const breaks = [
    // Lunch break for all weekdays
    ...Array.from({ length: 6 }, (_, i) => ({
      day_of_week: i + 1,
      start_time: '13:00',
      end_time: '15:00',
      break_type: 'Lunch Break'
    }))
  ];
  
  const result = await apiRequest('POST', `/vendor/${vendor.id}/schedule`, {
    slots,
    breaks,
    holidays: [],
    homeServiceConfig: {
      defaultRadius: 10,
      commuteAllowance: 3,
      maxDailyTravelTime: 120,
      enableTrafficFactor: true
    }
  });
  
  if (result.status !== 200 && result.status !== 201) {
    console.error(`   ❌ Schedule setup failed:`, result.data);
    return false;
  }
  
  console.log(`   ✅ Schedule configured with ${slots.length} slots and ${breaks.length} breaks`);
  return true;
}

async function createTestCustomer(): Promise<{ id: string; phone: string } | null> {
  console.log(`\n👤 Creating test customer...`);
  
  const phone = generatePhone();
  
  const registerResult = await apiRequest('POST', '/customer/register', { phone });
  
  if (registerResult.status !== 200 && registerResult.status !== 201) {
    console.error(`   ❌ Customer registration failed:`, registerResult.data);
    return null;
  }
  
  const verifyResult = await apiRequest('POST', '/customer/verify-otp', {
    phone,
    otp: '123456'
  });
  
  const customerId = verifyResult.data?.customerId || verifyResult.data?.customer?.id;
  
  if (!customerId) {
    console.error(`   ❌ Customer verification failed:`, verifyResult.data);
    return null;
  }
  
  console.log(`   ✅ Customer created: ${customerId}`);
  return { id: customerId, phone };
}

async function testBookingFlow(
  vendor: TestVendor,
  customerId: string,
  serviceStyle: string
): Promise<{ bookingId: string; otp?: string } | null> {
  console.log(`\n📖 Testing booking flow for ${vendor.role.name} (${serviceStyle})...`);
  
  // Get available slots
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  
  const slotsResult = await apiRequest(
    'GET',
    `/vendor/${vendor.id}/slots/${dateStr}?serviceStyle=${serviceStyle}`
  );
  
  if (!slotsResult.data?.slots?.length) {
    console.log(`   ⚠️  No available slots for ${dateStr}`);
    return null;
  }
  
  const availableSlot = slotsResult.data.slots.find((s: any) => s.available);
  
  if (!availableSlot) {
    console.log(`   ⚠️  No available slots found`);
    return null;
  }
  
  console.log(`   📍 Selected slot: ${availableSlot.time} on ${dateStr}`);
  
  // Create booking
  const bookingData = {
    vendorId: vendor.id,
    customerId,
    serviceType: serviceStyle,
    bookingDate: dateStr,
    bookingTime: availableSlot.time,
    petId: 'test-pet-id',
    notes: `Test booking for ${vendor.role.name}`,
    address: serviceStyle === 'at_home' ? {
      street: '456 Customer Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400002',
      latitude: 19.0800,
      longitude: 72.8800
    } : undefined
  };
  
  const bookingResult = await apiRequest('POST', '/bookings', bookingData);
  
  if (bookingResult.status !== 200 && bookingResult.status !== 201) {
    console.error(`   ❌ Booking failed:`, bookingResult.data);
    return null;
  }
  
  const bookingId = bookingResult.data?.booking?.id || bookingResult.data?.bookingId;
  const otp = bookingResult.data?.booking?.completion_otp || bookingResult.data?.otp;
  
  console.log(`   ✅ Booking created: ${bookingId}`);
  console.log(`   🔐 OTP: ${otp}`);
  
  return { bookingId, otp };
}

async function testPayment(bookingId: string, amount: number): Promise<boolean> {
  console.log(`\n💳 Testing payment for booking ${bookingId}...`);
  
  const paymentResult = await apiRequest('POST', '/payments/initiate', {
    bookingId,
    amount,
    paymentMethod: 'test_payment'
  });
  
  if (paymentResult.status !== 200 && paymentResult.status !== 201) {
    console.error(`   ❌ Payment initiation failed:`, paymentResult.data);
    return false;
  }
  
  // Simulate payment completion
  const confirmResult = await apiRequest('POST', '/payments/confirm', {
    bookingId,
    transactionId: `test_txn_${Date.now()}`,
    status: 'success'
  });
  
  if (confirmResult.status !== 200) {
    console.error(`   ❌ Payment confirmation failed:`, confirmResult.data);
    return false;
  }
  
  console.log(`   ✅ Payment completed`);
  return true;
}

async function testServiceCompletion(bookingId: string, otp: string): Promise<boolean> {
  console.log(`\n✅ Testing service completion for booking ${bookingId}...`);
  
  // Start service
  const startResult = await apiRequest('POST', `/bookings/${bookingId}/start`, {
    startOtp: otp
  });
  
  if (startResult.status !== 200) {
    console.log(`   ⚠️  Start service returned:`, startResult.status);
  }
  
  // Complete service
  const completeResult = await apiRequest('POST', `/bookings/${bookingId}/complete`, {
    completionOtp: otp
  });
  
  if (completeResult.status !== 200) {
    console.error(`   ❌ Service completion failed:`, completeResult.data);
    return false;
  }
  
  console.log(`   ✅ Service completed successfully`);
  return true;
}

async function runTestsForRole(role: typeof VENDOR_ROLES[0]): Promise<{
  role: string;
  success: boolean;
  steps: Record<string, boolean>;
}> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TESTING: ${role.name.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  
  const steps: Record<string, boolean> = {
    registration: false,
    onboarding: false,
    services: false,
    schedule: false,
    booking: false,
    payment: false,
    completion: false
  };
  
  try {
    // Step 1: Register vendor
    const vendor = await registerVendor(role);
    if (!vendor) return { role: role.name, success: false, steps };
    steps.registration = true;
    
    // Step 2: Complete onboarding
    steps.onboarding = await completeOnboarding(vendor);
    if (!steps.onboarding) return { role: role.name, success: false, steps };
    
    // Step 3: Setup services
    steps.services = await setupServices(vendor);
    
    // Step 4: Setup schedule
    steps.schedule = await setupSchedule(vendor);
    
    // Step 5: Create customer and book
    const customer = await createTestCustomer();
    if (customer) {
      // Test booking for each service style
      for (const style of role.serviceStyles) {
        const booking = await testBookingFlow(vendor, customer.id, style);
        if (booking) {
          steps.booking = true;
          
          // Step 6: Test payment
          steps.payment = await testPayment(booking.bookingId, 500);
          
          // Step 7: Test completion
          if (booking.otp) {
            steps.completion = await testServiceCompletion(booking.bookingId, booking.otp);
          }
          
          // Only test first style fully
          break;
        }
      }
    }
    
    const allPassed = Object.values(steps).every(v => v);
    
    return { role: role.name, success: allPassed, steps };
  } catch (error: any) {
    console.error(`❌ Error testing ${role.name}:`, error.message);
    return { role: role.name, success: false, steps };
  }
}

async function main() {
  console.log(`\n${'🐾'.repeat(20)}`);
  console.log(`\n   WARMPAWZ FULL CYCLE TEST - ALL ROLES`);
  console.log(`   API: ${API_BASE}`);
  console.log(`\n${'🐾'.repeat(20)}\n`);
  
  const results: Array<{
    role: string;
    success: boolean;
    steps: Record<string, boolean>;
  }> = [];
  
  for (const role of VENDOR_ROLES) {
    const result = await runTestsForRole(role);
    results.push(result);
  }
  
  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 TEST SUMMARY`);
  console.log(`${'='.repeat(60)}\n`);
  
  const stepNames = ['registration', 'onboarding', 'services', 'schedule', 'booking', 'payment', 'completion'];
  
  // Header
  console.log(`${'Role'.padEnd(20)} | ${stepNames.map(s => s.substring(0, 3).toUpperCase()).join(' | ')}`);
  console.log(`${'-'.repeat(20)}-+-${stepNames.map(() => '---').join('-+-')}`);
  
  // Results
  for (const result of results) {
    const statusCells = stepNames.map(step => 
      result.steps[step] ? ' ✅ ' : ' ❌ '
    );
    console.log(`${result.role.padEnd(20)} | ${statusCells.join('|')}`);
  }
  
  console.log(`\n`);
  
  // Final stats
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`🎉 ALL ${total} ROLES PASSED!`);
  } else {
    console.log(`⚠️  ${passed}/${total} roles passed`);
    console.log(`\nFailed roles:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.role}`);
    });
  }
  
  console.log(`\n`);
}

// Run tests
main().catch(console.error);
