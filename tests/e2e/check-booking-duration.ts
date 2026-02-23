/**
 * Quick check to see what duration is stored for a booking
 */

const API_BASE = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const BOOKING_ID = '9af51028-cbee-47c9-87a1-80d3716d9f5c';

async function checkBooking() {
  const response = await fetch(`${API_BASE}/bookings/${BOOKING_ID}`);
  const data = await response.json();
  
  console.log('Booking details:');
  console.log(JSON.stringify(data, null, 2));
  
  const booking = data?.data?.booking || data?.booking || data;
  console.log('\nKey fields:');
  console.log(`  booking_time: ${booking.booking_time}`);
  console.log(`  duration_minutes: ${booking.duration_minutes}`);
  console.log(`  total_duration_minutes: ${booking.total_duration_minutes}`);
  console.log(`  service_type: ${booking.service_type}`);
  console.log(`  status: ${booking.status}`);
}

checkBooking().catch(console.error);
