#!/usr/bin/env node
/**
 * Check booking address data in dev RDS
 * 
 * Usage:
 *   ENVIRONMENT=dev node scripts/check-booking-address.js <booking-id>
 */

const { query } = require('./rds-data-api-utils-dev');

const bookingId = process.argv[2];

if (!bookingId) {
  console.error('Usage: node scripts/check-booking-address.js <booking-id>');
  process.exit(1);
}

async function checkBooking() {
  console.log(`🔍 Checking booking: ${bookingId}`);
  console.log('');

  try {
    // Check booking record (only columns that exist)
    console.log('📋 Booking Record:');
    console.log('─────────────────');
    // RDS Data API doesn't support parameterized queries, use direct SQL
    const bookings = await query(`
      SELECT 
        id,
        customer_id,
        vendor_id,
        service_id,
        address,
        city,
        state,
        pincode,
        latitude,
        longitude,
        service_type,
        status,
        booking_date,
        booking_time
      FROM bookings
      WHERE id = '${bookingId}'
    `);

    if (bookings.length === 0) {
      console.log('❌ Booking not found');
      process.exit(1);
    }

    const booking = bookings[0];
    // Handle both object and array formats
    const getField = (record, fieldName, index) => {
      if (record[fieldName] !== undefined) return record[fieldName];
      if (Array.isArray(record) && record[index] !== undefined) return record[index];
      return null;
    };
    
    const bookingIdValue = getField(booking, 'id', 0);
    const customerIdValue = getField(booking, 'customer_id', 1);
    const vendorId = getField(booking, 'vendor_id', 2);
    const serviceId = getField(booking, 'service_id', 3);
    const address = getField(booking, 'address', 4);
    const city = getField(booking, 'city', 5);
    const state = getField(booking, 'state', 6);
    const pincode = getField(booking, 'pincode', 7);
    const latitude = getField(booking, 'latitude', 8);
    const longitude = getField(booking, 'longitude', 9);
    const serviceType = getField(booking, 'service_type', 10);
    const status = getField(booking, 'status', 11);
    
    console.log(`  ID: ${bookingIdValue || '(null)'}`);
    console.log(`  Customer ID: ${customerIdValue || '(null)'}`);
    console.log(`  Vendor ID: ${vendorId || '(null)'}`);
    console.log(`  Service ID: ${serviceId || '(null)'}`);
    console.log(`  Service Type: ${serviceType || '(null)'}`);
    console.log(`  Status: ${status || '(null)'}`);
    console.log(`  Address: ${address || '(null)'}`);
    console.log(`  City: ${city || '(null)'}`);
    console.log(`  State: ${state || '(null)'}`);
    console.log(`  Pincode: ${pincode || '(null)'}`);
    console.log(`  Latitude: ${latitude || '(null)'}`);
    console.log(`  Longitude: ${longitude || '(null)'}`);
    console.log('');
    
    // Store for later use
    booking._parsed = {
      id: bookingIdValue,
      customer_id: customerIdValue,
      vendor_id: vendorId,
      service_id: serviceId,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      service_type: serviceType,
      status
    };

    // Check customer addresses
    const customerIdForQuery = booking._parsed?.customer_id || booking.customer_id;
    let addresses = [];
    if (customerIdForQuery) {
      console.log('📍 Customer Addresses:');
      console.log('──────────────────────');
      addresses = await query(`
        SELECT 
          id,
          customer_id,
          coordinates,
          address_line1,
          city,
          state,
          pincode,
          is_default,
          created_at
        FROM customer_addresses
        WHERE customer_id = '${customerIdForQuery}'
        ORDER BY is_default DESC NULLS LAST, created_at DESC
        LIMIT 10
      `);

      if (addresses.length === 0) {
        console.log('  ⚠️  No customer addresses found');
      } else {
        console.log(`  Found ${addresses.length} address(es):`);
        addresses.forEach((addr, idx) => {
          const coords = addr.coordinates || (typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : null);
          const lat = coords?.lat || coords?.latitude || null;
          const lng = coords?.lng || coords?.longitude || null;
          
          console.log(`\n  [${idx + 1}] Address ID: ${addr.id}`);
          console.log(`      Address: ${addr.address_line1 || '(null)'}`);
          console.log(`      City: ${addr.city || '(null)'}`);
          console.log(`      State: ${addr.state || '(null)'}`);
          console.log(`      Pincode: ${addr.pincode || '(null)'}`);
          console.log(`      Coordinates (JSONB): ${addr.coordinates ? JSON.stringify(addr.coordinates) : '(null)'}`);
          console.log(`      Extracted Lat: ${lat || '(null)'}`);
          console.log(`      Extracted Lng: ${lng || '(null)'}`);
          console.log(`      Is Default: ${addr.is_default || false}`);
        });
      }
      console.log('');
    }

    // Summary
    console.log('📊 Summary:');
    console.log('───────────');
    const issues = [];
    const recommendations = [];

    const bookingLat = booking._parsed?.latitude || booking.latitude;
    const bookingLng = booking._parsed?.longitude || booking.longitude;
    const bookingAddr = booking._parsed?.address || booking.address;
    
    if (!bookingLat || !bookingLng) {
      issues.push('❌ Booking has no latitude/longitude');
      recommendations.push('Update booking with coordinates from customer_addresses or geocode the address');
    } else {
      console.log('✅ Booking has latitude/longitude');
    }

    if (bookingAddr) {
      console.log('✅ Booking has address text (can be geocoded)');
    } else {
      issues.push('❌ Booking has no address text');
    }

    if (customerIdForQuery) {
      const addrCount = addresses.length;
      if (addrCount === 0) {
        issues.push('❌ Customer has no addresses in customer_addresses table');
        recommendations.push('Create customer address record for this customer');
      } else {
        console.log(`✅ Customer has ${addrCount} address(es) in customer_addresses`);
        
        // Check if any address has coordinates
        const addrWithCoords = addresses.filter(addr => {
          if (!addr.coordinates) return false;
          const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
          const lat = coords?.lat || coords?.latitude;
          const lng = coords?.lng || coords?.longitude;
          return lat != null && lng != null && lat !== 0 && lng !== 0;
        });
        
        if (addrWithCoords.length === 0) {
          issues.push('⚠️  Customer addresses exist but none have coordinates');
          recommendations.push('Update customer_addresses with latitude/longitude or coordinates JSONB');
        } else {
          console.log(`✅ ${addrWithCoords.length} customer address(es) have coordinates`);
          recommendations.push(`Update booking ${bookingIdValue} with coordinates from customer address ${addrWithCoords[0].id}`);
        }
      }
    }

    console.log('');
    if (issues.length > 0) {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log('');
    }

    if (recommendations.length > 0) {
      console.log('Recommendations:');
      recommendations.forEach(rec => console.log(`  • ${rec}`));
      console.log('');
    }

    // Why the code might fail
    console.log('🔍 Why start-travel might fail:');
    console.log('────────────────────────────────');
    console.log('The code checks in this order:');
    console.log('  1. booking.latitude/longitude → ' + (bookingLat && bookingLng ? '✅ Available' : '❌ Missing'));
    console.log('  2. booking.delivery_latitude/longitude → ⚠️  Columns do not exist in table');
    console.log('  3. customer_addresses via address_id → ⚠️  address_id column does not exist in bookings table');
    console.log('  4. customer_addresses via customer_id → ' + (customerIdForQuery ? '✅ Has customer_id' : '❌ No customer_id'));
    if (booking.customer_id && addresses.length > 0) {
      const hasCoords = addresses.some(addr => 
        (addr.latitude != null && addr.longitude != null) || addr.coordinates != null
      );
      console.log('     → ' + (hasCoords ? '✅ Addresses with coordinates found' : '❌ No addresses with coordinates'));
    }
    console.log('  5. booking.address (geocoding) → ' + (bookingAddr ? '✅ Has address (requires geocoding, may be disabled in UAT)' : '❌ No address'));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkBooking();
