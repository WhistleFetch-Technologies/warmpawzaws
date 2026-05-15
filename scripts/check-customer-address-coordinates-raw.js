#!/usr/bin/env node
/**
 * Check customer address coordinates (raw response)
 */

const { executeSQL, parseRecords } = require('./rds-data-api-utils-dev');

const customerId = process.argv[2] || '7cbfa58f-980a-4fe0-9f52-280db885956f';

async function checkCoordinates() {
  console.log(`🔍 Checking customer addresses for customer: ${customerId}`);
  console.log('');

  try {
    const result = await executeSQL(`
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
    `, true);

    console.log('Raw result structure:');
    console.log('  - Has records:', !!result.records);
    console.log('  - Records count:', result.records?.length || 0);
    console.log('  - Has columnMetadata:', !!result.columnMetadata);
    if (result.columnMetadata) {
      console.log('  - Column names:', result.columnMetadata.map(c => c.name).join(', '));
    }
    console.log('');

    if (!result.records || result.records.length === 0) {
      console.log('❌ No addresses found for this customer');
      return;
    }

    // Parse with column metadata
    const addresses = parseRecords(result);
    
    console.log(`✅ Found ${addresses.length} address(es):`);
    console.log('');

    addresses.forEach((addr, idx) => {
      console.log(`[${idx + 1}] Address Record:`);
      console.log(`    Type: ${Array.isArray(addr) ? 'Array' : 'Object'}`);
      
      if (Array.isArray(addr)) {
        console.log(`    Array length: ${addr.length}`);
        console.log(`    Values: ${JSON.stringify(addr)}`);
      } else {
        console.log(`    Keys: ${Object.keys(addr).join(', ')}`);
        console.log(`    Values: ${JSON.stringify(addr, null, 2)}`);
      }
      
      // Try to extract fields
      const id = addr.id || (Array.isArray(addr) ? addr[0] : null);
      const customerId = addr.customer_id || (Array.isArray(addr) ? addr[1] : null);
      const coordinates = addr.coordinates || (Array.isArray(addr) ? addr[2] : null);
      const addressLine1 = addr.address_line1 || (Array.isArray(addr) ? addr[3] : null);
      
      console.log(`    Extracted ID: ${id || '(null)'}`);
      console.log(`    Extracted Customer ID: ${customerId || '(null)'}`);
      console.log(`    Extracted Address: ${addressLine1 || '(null)'}`);
      console.log(`    Extracted Coordinates: ${coordinates ? JSON.stringify(coordinates) : '(null)'}`);
      
      // Check coordinates format
      if (coordinates) {
        let coords = coordinates;
        
        if (typeof coords === 'string') {
          try {
            coords = JSON.parse(coords);
          } catch (e) {
            console.log(`    ⚠️  Coordinates string is not valid JSON`);
            console.log('');
            return;
          }
        }
        
        const lat = coords?.lat ?? coords?.latitude ?? null;
        const lng = coords?.lng ?? coords?.longitude ?? null;
        
        if (lat != null && lng != null) {
          console.log(`    ✅ Coordinates found:`);
          console.log(`       Lat: ${lat}`);
          console.log(`       Lng: ${lng}`);
          
          // Check if it matches the expected format
          const expectedFormat = { lat: 12.9756425, lng: 77.6032208 };
          if (lat === expectedFormat.lat && lng === expectedFormat.lng) {
            console.log(`    ✅ MATCHES expected coordinates: ${JSON.stringify(expectedFormat)}`);
          } else {
            console.log(`    ℹ️  Different coordinates`);
            console.log(`       Expected: ${JSON.stringify(expectedFormat)}`);
            console.log(`       Actual: ${JSON.stringify({ lat, lng })}`);
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

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

checkCoordinates();
