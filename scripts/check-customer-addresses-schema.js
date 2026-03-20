#!/usr/bin/env node
/**
 * Check customer_addresses table schema
 */

const { executeSQL, parseRecords } = require('./rds-data-api-utils-dev');

async function checkSchema() {
  const result = await executeSQL(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'customer_addresses'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `, true);
  
  const columns = parseRecords(result, ['column_name', 'data_type', 'is_nullable']);
  
  console.log('Customer Addresses table columns:');
  console.log('──────────────────────────────────');
  columns.forEach(col => {
    const colName = col.column_name || col[0] || '';
    const dataType = col.data_type || col[1] || '';
    const nullable = (col.is_nullable || col[2] || '') === 'YES' ? 'NULL' : 'NOT NULL';
    console.log(`  ${String(colName).padEnd(30)} ${String(dataType).padEnd(20)} ${nullable}`);
  });
}

checkSchema();
