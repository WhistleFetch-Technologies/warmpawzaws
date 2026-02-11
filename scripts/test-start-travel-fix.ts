/**
 * Test script to verify start-travel endpoint fix
 * Tests vendor ID resolution and authorization
 */

const API_BASE = process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

async function testStartTravel() {
  const bookingId = '7424bc49-1c50-4d45-8bbb-6df3d42c208b';
  const vendorId = '5c673742-7cda-4c1b-ac62-7e8e6221c6a2';
  const startLocation = {
    latitude: 19.301687299943477,
    longitude: 72.87134888159865,
  };

  console.log('🧪 Testing start-travel endpoint fix...\n');
  console.log(`Booking ID: ${bookingId}`);
  console.log(`Vendor ID: ${vendorId}`);
  console.log(`Start Location: ${JSON.stringify(startLocation)}\n`);

  try {
    const response = await fetch(`${API_BASE}/vendor/bookings/${bookingId}/start-travel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vendorId,
        startLocation,
      }),
    });

    const data = await response.json();
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCCESS: Start travel request succeeded!');
      if (data.session) {
        console.log(`Session ID: ${data.session.id}`);
      }
    } else {
      console.log('\n❌ FAILED: Start travel request failed');
      if (data.debug) {
        console.log('\nDebug info:');
        console.log(`  Booking Vendor ID: ${data.debug.bookingVendorId}`);
        console.log(`  Requested Vendor ID: ${data.debug.requestedVendorId}`);
        console.log(`  Resolved Vendor ID: ${data.debug.resolvedVendorId}`);
        console.log(`  Comparison:`, data.debug.comparison);
      }
    }

    return { success: response.ok, data };
  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    throw error;
  }
}

// Run test
if (require.main === module) {
  testStartTravel()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { testStartTravel };
