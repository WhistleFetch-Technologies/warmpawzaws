#!/usr/bin/env node
/**
 * Check customer address coordinates
 * 
 * Usage:
 *   ENVIRONMENT=dev node scripts/check-customer-address-coordinates.js <customer-id>
 */

const { query } = require('./rds-data-api-utils-dev');

const customerId = process.argv[2];

if (!customerId) {
  console.error('Usage: node scripts/check-customer-address-coordinates.js <customer-id>');
  process.exit(1);
}

async function checkCoordinates() {
  console.log(`🔍 Checking customer addresses for customer: ${customerId}`);
  console.log('');

  try {
    const addresses = await query(`
      SELECT 
        id,
        customer_id,
        coordinates,
        address_line1,
        city,
        state,
        pincode,
        is_default,
        created_at,
        updated_at
      FROM customer_addresses
      WHERE customer_id = '${customerId}'
      ORDER BY is_default DESC NULLS LAST, created_at DESC
    `);

    if (addresses.length === 0) {
      console.log('❌ No addresses found for this customer');
      return;
    }

    console.log(`✅ Found ${addresses.length} address(es):`);
    console.log('');

    addresses.forEach((addr, idx) => {
      console.log(`[${idx + 1}] Address ID: ${addr.id || '(null)'}`);
      console.log(`    Customer ID: ${addr.customer_id || '(null)'}`);
      console.log(`    Address: ${addr.address_line1 || '(null)'}`);
      console.log(`    City: ${addr.city || '(null)'}`);
      console.log(`    State: ${addr.state || '(null)'}`);
      console.log(`    Pincode: ${addr.pincode || '(null)'}`);
      console.log(`    Is Default: ${addr.is_default || false}`);
      console.log(`    Created At: ${addr.created_at || '(null)'}`);
      console.log(`    Updated At: ${addr.updated_at || '(null)'}`);
      
      // Check coordinates
      console.log(`    Coordinates (raw): ${addr.coordinates ? JSON.stringify(addr.coordinates) : '(null)'}`);
      
      if (addr.coordinates) {
        let coords = addr.coordinates;
        
        // Handle string format
        if (typeof coords === 'string') {
          try {
            coords = JSON.parse(coords);
          } catch (e) {
            console.log(`    ⚠️  Coordinates is a string but not valid JSON: ${coords}`);
            console.log('');
            return;
          }
        }
        
        // Extract lat/lng
        const lat = coords?.lat ?? coords?.latitude ?? null;
        const lng = coords?.lng ?? coords?.longitude ?? null;
        
        if (lat != null && lng != null) {
          console.log(`    ✅ Coordinates found:`);
          console.log(`       Lat: ${lat}`);
          console.log(`       Lng: ${lng}`);
          
          // Check if it matches the expected format
          const expectedFormat = { lat: 12.9756425, lng: 77.6032208 };
          if (lat === expectedFormat.lat && lng === expectedFormat.lng) {
            console.log(`    ✅ Matches expected coordinates: ${JSON.stringify(expectedFormat)}`);
          } else {
            console.log(`    ℹ️  Different coordinates (expected: ${JSON.stringify(expectedFormat)})`);
          }
        } else {
          console.log(`    ⚠️  Coordinates object exists but lat/lng are missing`);
          console.log(`       Available keys: ${Object.keys(coords || {}).join(', ')}`);
        }
      } else {
        console.log(`    ❌ No coordinates field`);
      }
      
      console.log('');
    });

    // Summary
    console.log('📊 Summary:');
    console.log('───────────');
    const addressesWithCoords = addresses.filter(addr => {
      if (!addr.coordinates) return false;
      let coords = addr.coordinates;
      if (typeof coords === 'string') {
        try {
          coords = JSON.parse(coords);
        } catch {
          return false;
        }
      }
      const lat = coords?.lat ?? coords?.latitude ?? null;
      const lng = coords?.lng ?? coords?.longitude ?? null;
      return lat != null && lng != null;
    });

    console.log(`Total addresses: ${addresses.length}`);
    console.log(`Addresses with coordinates: ${addressesWithCoords.length}`);
    
    if (addressesWithCoords.length > 0) {
      console.log('');
      console.log('✅ Customer has addresses with coordinates');
      addressesWithCoords.forEach((addr, idx) => {
        let coords = addr.coordinates;
        if (typeof coords === 'string') coords = JSON.parse(coords);
        console.log(`  [${idx + 1}] Address ${addr.id}: lat=${coords.lat || coords.latitude}, lng=${coords.lng || coords.longitude}`);
      });
    } else {
      console.log('');
      console.log('❌ No addresses have coordinates');
      console.log('   Recommendation: Update customer_addresses with coordinates JSONB');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkCoordinates();
