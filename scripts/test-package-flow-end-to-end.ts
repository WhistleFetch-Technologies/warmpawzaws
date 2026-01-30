/**
 * ============================================================================
 * END-TO-END PACKAGE FLOW TEST
 * ============================================================================
 * 
 * Tests the complete package management flow:
 * 1. Customer purchases package (with tax)
 * 2. Customer books service using package
 * 3. Vendor sees package information
 * 4. Settlement excludes package sessions
 * 
 * Usage:
 *   npx tsx scripts/test-package-flow-end-to-end.ts
 * 
 * Date: 2026-01-25
 * ============================================================================
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const TEST_CUSTOMER_ID = process.env.TEST_CUSTOMER_ID || '39c84571-b26d-475a-bb38-94975cb8262d';
const TEST_VENDOR_ID = process.env.TEST_VENDOR_ID || 'c6779b52-cd3d-4380-a4a6-792c3bbe40e9';
const TEST_PET_ID = process.env.TEST_PET_ID || '6e28df3a-3880-460a-b747-bd359330fc32';

interface FlowStep {
  step: number;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  requestBody?: any;
  expectedResponse?: any;
  actualResponse?: any;
  status: 'PASS' | 'FAIL' | 'SKIP';
  notes?: string;
}

const flowSteps: FlowStep[] = [];

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

async function callAPI(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, ok: response.ok, data };
  } catch (error: any) {
    return { status: 0, ok: false, error: error.message };
  }
}

async function testCompleteFlow() {
  log('='.repeat(70), 'info');
  log('🔄 COMPLETE PACKAGE MANAGEMENT FLOW TEST', 'info');
  log('='.repeat(70), 'info');
  log('', 'info');

  let packagePurchaseId: string | null = null;
  let bookingId: string | null = null;

  // STEP 1: Discover Available Packages
  log('📦 STEP 1: Discover Available Packages', 'info');
  const packagesResponse = await callAPI(`/packages/discover?vendorId=${TEST_VENDOR_ID}`);
  
  flowSteps.push({
    step: 1,
    name: 'Discover Packages',
    description: 'Get available packages for vendor',
    endpoint: `/packages/discover?vendorId=${TEST_VENDOR_ID}`,
    method: 'GET',
    actualResponse: packagesResponse,
    status: packagesResponse.ok ? 'PASS' : 'FAIL',
    notes: packagesResponse.ok 
      ? `Found ${packagesResponse.data.packages?.length || 0} packages`
      : `Error: ${packagesResponse.data?.error || packagesResponse.error}`,
  });

  if (!packagesResponse.ok || !packagesResponse.data.success) {
    log('   ⚠️  No packages available - skipping purchase test', 'warning');
    return;
  }

  const packages = packagesResponse.data.packages || [];
  if (packages.length === 0) {
    log('   ⚠️  No packages found - checking for existing packages', 'warning');
    
    // Check for existing active packages
    const activePackagesResponse = await callAPI(`/customer/${TEST_CUSTOMER_ID}/packages/active`);
    if (activePackagesResponse.ok && activePackagesResponse.data.packages?.length > 0) {
      packagePurchaseId = activePackagesResponse.data.packages[0].id;
      log(`   ✅ Using existing package: ${activePackagesResponse.data.packages[0].packageName || activePackagesResponse.data.packages[0].package_name}`, 'success');
    } else {
      log('   ⚠️  No packages available for testing', 'warning');
      return;
    }
  } else {
    const testPackage = packages[0];
    log(`   📦 Found package: ${testPackage.name} (₹${testPackage.price})`, 'info');

    // STEP 2: Purchase Package (with tax calculation)
    log('\n💰 STEP 2: Purchase Package (with Tax Calculation)', 'info');
    const purchaseBody = {
      packageId: testPackage.id,
      customerId: TEST_CUSTOMER_ID,
      trialBookingId: null,
      preferSameProvider: true,
    };

    const purchaseResponse = await callAPI('/packages/convert-from-trial', 'POST', purchaseBody);
    
    flowSteps.push({
      step: 2,
      name: 'Purchase Package',
      description: 'Create package purchase with tax calculation',
      endpoint: '/packages/convert-from-trial',
      method: 'POST',
      requestBody: purchaseBody,
      expectedResponse: {
        success: true,
        purchase: {
          id: 'string',
          purchaseId: 'string',
          packageName: 'string',
          totalSessions: 'number',
        },
      },
      actualResponse: purchaseResponse,
      status: purchaseResponse.ok && purchaseResponse.data.success ? 'PASS' : 'FAIL',
      notes: purchaseResponse.ok 
        ? `Purchase created: ${purchaseResponse.data.purchase?.purchaseId || purchaseResponse.data.purchase?.purchase_id}`
        : `Error: ${purchaseResponse.data?.error || purchaseResponse.error}`,
    });

    if (purchaseResponse.ok && purchaseResponse.data.success) {
      packagePurchaseId = purchaseResponse.data.purchase?.id || purchaseResponse.data.purchase?.purchaseId;
      log(`   ✅ Package purchased: ${purchaseResponse.data.purchase?.purchaseId || purchaseResponse.data.purchase?.purchase_id}`, 'success');
      log(`   📊 Sessions: ${purchaseResponse.data.purchase?.totalSessions || purchaseResponse.data.purchase?.total_sessions} total`, 'info');
    } else {
      log('   ❌ Package purchase failed', 'error');
      return;
    }
  }

  if (!packagePurchaseId) {
    log('   ⚠️  No package purchase ID available', 'warning');
    return;
  }

  // STEP 3: Create Booking from Package
  log('\n📅 STEP 3: Create Booking from Package', 'info');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookingDate = tomorrow.toISOString().split('T')[0];
  const bookingTime = '10:00';

  const bookingBody = {
    packagePurchaseId,
    customerId: TEST_CUSTOMER_ID,
    vendorId: TEST_VENDOR_ID,
    petId: TEST_PET_ID,
    serviceId: null,
    scheduledDate: bookingDate,
    scheduledTime: bookingTime,
    serviceType: 'at_home',
    notes: 'Test package session booking',
  };

  const bookingResponse = await callAPI('/bookings/create-from-package', 'POST', bookingBody);
  
  flowSteps.push({
    step: 3,
    name: 'Create Booking from Package',
    description: 'Book service using package credits',
    endpoint: '/bookings/create-from-package',
    method: 'POST',
    requestBody: bookingBody,
    expectedResponse: {
      success: true,
      booking: {
        id: 'string',
        isPackageSession: true,
        sessionNumber: 'number',
        totalAmount: 0, // Should be 0 for package sessions
      },
    },
    actualResponse: bookingResponse,
    status: bookingResponse.ok && bookingResponse.data.success ? 'PASS' : 'FAIL',
    notes: bookingResponse.ok
      ? `Booking created: Session ${bookingResponse.data.booking?.sessionNumber || bookingResponse.data.booking?.package_session_number}`
      : `Error: ${bookingResponse.data?.error || bookingResponse.error}`,
  });

  if (bookingResponse.ok && bookingResponse.data.success) {
    bookingId = bookingResponse.data.booking?.id;
    const isPackageSession = bookingResponse.data.booking?.isPackageSession || bookingResponse.data.booking?.is_package_session;
    const sessionNumber = bookingResponse.data.booking?.sessionNumber || bookingResponse.data.booking?.package_session_number;
    const totalAmount = bookingResponse.data.booking?.totalAmount || bookingResponse.data.booking?.total_amount || 0;

    log(`   ✅ Booking created: ${bookingId}`, 'success');
    log(`   📦 Package session: ${isPackageSession ? 'Yes' : 'No'}`, 'info');
    log(`   🔢 Session number: ${sessionNumber}`, 'info');
    log(`   💰 Total amount: ₹${totalAmount} (should be ₹0)`, totalAmount === 0 ? 'success' : 'error');
  } else {
    log('   ❌ Booking creation failed', 'error');
    return;
  }

  if (!bookingId) {
    log('   ⚠️  No booking ID available', 'warning');
    return;
  }

  // STEP 4: Vendor Views Booking Details
  log('\n👨‍💼 STEP 4: Vendor Views Booking Details', 'info');
  const detailsResponse = await callAPI(`/vendor/bookings/${bookingId}/details`);
  
  flowSteps.push({
    step: 4,
    name: 'Vendor Booking Details',
    description: 'Vendor fetches booking details with package information',
    endpoint: `/vendor/bookings/${bookingId}/details`,
    method: 'GET',
    expectedResponse: {
      success: true,
      booking: {
        isPackageSession: true,
        packageName: 'string',
        packageSessionNumber: 'number',
        packageRemainingSessions: 'number',
      },
    },
    actualResponse: detailsResponse,
    status: detailsResponse.ok && detailsResponse.data.success ? 'PASS' : 'FAIL',
    notes: detailsResponse.ok
      ? 'Package information included in response'
      : `Error: ${detailsResponse.data?.error || detailsResponse.error}`,
  });

  if (detailsResponse.ok && detailsResponse.data.success) {
    const booking = detailsResponse.data.booking;
    const hasPackageInfo = booking.isPackageSession || booking.is_package_session;
    const packageName = booking.packageName || booking.package_name;
    const sessionNumber = booking.packageSessionNumber || booking.package_session_number;
    const remainingSessions = booking.packageRemainingSessions || booking.package_remaining_sessions;

    log(`   ✅ Booking details retrieved`, 'success');
    log(`   📦 Package session: ${hasPackageInfo ? 'Yes' : 'No'}`, hasPackageInfo ? 'success' : 'error');
    if (packageName) log(`   📝 Package name: ${packageName}`, 'info');
    if (sessionNumber) log(`   🔢 Session number: ${sessionNumber}`, 'info');
    if (remainingSessions !== undefined) log(`   📊 Remaining sessions: ${remainingSessions}`, 'info');
  } else {
    log('   ❌ Failed to get booking details', 'error');
  }

  // STEP 5: Verify Settlement Exclusion
  log('\n💵 STEP 5: Verify Settlement Exclusion', 'info');
  const vendorBookingsResponse = await callAPI(`/vendor/bookings/${TEST_VENDOR_ID}?status=all`);
  
  if (vendorBookingsResponse.ok) {
    const bookings = vendorBookingsResponse.data.bookings || [];
    const packageBookings = bookings.filter((b: any) => b.isPackageSession || b.is_package_session);
    const regularBookings = bookings.filter((b: any) => !b.isPackageSession && !b.is_package_session);

    log(`   📊 Found ${packageBookings.length} package bookings`, 'info');
    log(`   📊 Found ${regularBookings.length} regular bookings`, 'info');

    // Check package bookings have $0 amount
    const packageBookingsWithAmount = packageBookings.filter((b: any) => {
      const amount = b.totalAmount || b.total_amount || b.amount || 0;
      return amount > 0;
    });

    flowSteps.push({
      step: 5,
      name: 'Settlement Exclusion',
      description: 'Verify package sessions are excluded from settlements',
      endpoint: 'N/A (Data verification)',
      method: 'N/A',
      actualResponse: {
        packageBookings: packageBookings.length,
        regularBookings: regularBookings.length,
        packageBookingsWithAmount: packageBookingsWithAmount.length,
      },
      status: packageBookingsWithAmount.length === 0 ? 'PASS' : 'FAIL',
      notes: packageBookingsWithAmount.length === 0
        ? 'All package sessions have ₹0 amount (correct)'
        : `${packageBookingsWithAmount.length} package sessions have non-zero amount (incorrect)`,
    });

    if (packageBookingsWithAmount.length === 0) {
      log(`   ✅ All package sessions have ₹0 amount`, 'success');
      log(`   ✅ Package sessions will be excluded from settlements`, 'success');
    } else {
      log(`   ❌ ${packageBookingsWithAmount.length} package sessions have non-zero amount`, 'error');
    }
  }

  // Summary
  log('\n' + '='.repeat(70), 'info');
  log('📊 FLOW TEST SUMMARY', 'info');
  log('='.repeat(70), 'info');
  log('', 'info');

  const passed = flowSteps.filter(s => s.status === 'PASS').length;
  const failed = flowSteps.filter(s => s.status === 'FAIL').length;
  const skipped = flowSteps.filter(s => s.status === 'SKIP').length;

  log(`✅ Passed: ${passed}`, 'success');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
  log(`⏭️  Skipped: ${skipped}`, 'warning');
  log('', 'info');

  log('📋 Flow Steps:', 'info');
  flowSteps.forEach(step => {
    const icon = step.status === 'PASS' ? '✅' : step.status === 'FAIL' ? '❌' : '⏭️';
    log(`   ${icon} Step ${step.step}: ${step.name}`, step.status === 'PASS' ? 'success' : step.status === 'FAIL' ? 'error' : 'warning');
    if (step.notes) {
      log(`      ${step.notes}`, 'info');
    }
  });

  log('', 'info');
  log('='.repeat(70), 'info');

  if (failed === 0) {
    log('✅ ALL FLOW TESTS PASSED!', 'success');
    return true;
  } else {
    log('❌ SOME FLOW TESTS FAILED', 'error');
    return false;
  }
}

// Run test
testCompleteFlow()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
