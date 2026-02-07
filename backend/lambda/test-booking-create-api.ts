/**
 * Test booking creation API endpoint
 * Run: npx ts-node test-booking-create-api.ts
 */

const API_BASE_URL = process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

async function testBookingCreation() {
  console.log('\n═'.repeat(60));
  console.log('TESTING BOOKING CREATION API');
  console.log('═'.repeat(60));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('');

  const bookingPayload = {
    customerId: "39c84571-b26d-475a-bb38-94975cb8262d",
    vendorId: "c96058cb-6356-4e2b-9cf2-5149c6e9b942",
    serviceId: "03513ff5-284c-47c7-9382-1203f3b4af87",
    bookingDate: "2026-01-24",
    bookingTime: "18:00",
    serviceType: "at_center",
    amount: 3500,
    petId: "6e28df3a-3880-460a-b747-bd359330fc32",
    services: [{
      serviceId: "03513ff5-284c-47c7-9382-1203f3b4af87",
      serviceName: "Ultrasound",
      price: 2000,
      duration: 60
    }],
    totalDuration: 60,
    customerName: "Test Customer",
    customerPhone: "9611377119",
    petName: "Max",
    notes: ""
  };

  try {
    console.log('📤 Sending booking creation request...');
    console.log('Payload:', JSON.stringify(bookingPayload, null, 2));
    console.log('');

    const response = await fetch(`${API_BASE_URL}/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingPayload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    console.log(`📥 Response Status: ${response.status}`);
    console.log('📥 Response Body:');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ ✅ ✅ BOOKING CREATION SUCCESSFUL! ✅ ✅ ✅');
      if (responseData.bookingId || responseData.data?.bookingId) {
        console.log(`Booking ID: ${responseData.bookingId || responseData.data?.bookingId}`);
      }
      return true;
    } else {
      console.log('❌ ❌ ❌ BOOKING CREATION FAILED ❌ ❌ ❌');
      if (responseData.error) {
        console.log(`Error Code: ${responseData.error.code}`);
        console.log(`Error Message: ${responseData.error.message}`);
        if (responseData.error.details) {
          console.log('Error Details:', JSON.stringify(responseData.error.details, null, 2));
        }
        if (responseData.meta?.requestId) {
          console.log(`Request ID: ${responseData.meta.requestId}`);
          console.log(`Check CloudWatch logs for request ID: ${responseData.meta.requestId}`);
        }
      }
      return false;
    }
  } catch (error: any) {
    console.log('❌ ❌ ❌ REQUEST FAILED ❌ ❌ ❌');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run test
testBookingCreation()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
