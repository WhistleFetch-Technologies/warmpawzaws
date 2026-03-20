#!/usr/bin/env node
/**
 * Check bookings table schema
 */

const { query } = require('./rds-data-api-utils-dev');

async function checkSchema() {
  const { executeSQL, parseRecords } = require('./rds-data-api-utils-dev');
  
  const result = await executeSQL(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bookings'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `, true);
  
  const columns = parseRecords(result, ['column_name', 'data_type', 'is_nullable']);
  
  console.log('Bookings table columns:');
  console.log('───────────────────────');
  columns.forEach(col => {
    const colName = col.column_name || col[0] || '';
    const dataType = col.data_type || col[1] || '';
    const nullable = (col.is_nullable || col[2] || '') === 'YES' ? 'NULL' : 'NOT NULL';
    console.log(`  ${String(colName).padEnd(30)} ${String(dataType).padEnd(20)} ${nullable}`);
  });
  
  // Check for specific columns we care about
  console.log('');
  console.log('Location-related columns:');
  console.log('─────────────────────────');
  const locationCols = ['latitude', 'longitude', 'delivery_latitude', 'delivery_longitude', 'address_id', 'address', 'city', 'state', 'pincode'];
  locationCols.forEach(colName => {
    const found = columns.find(c => {
      const name = c.column_name || c[0] || '';
      return name === colName;
    });
    if (found) {
      const dataType = found.data_type || found[1] || '';
      console.log(`  ✅ ${colName.padEnd(25)} ${dataType}`);
    } else {
      console.log(`  ❌ ${colName.padEnd(25)} (does not exist)`);
    }
  });
}

checkSchema();
