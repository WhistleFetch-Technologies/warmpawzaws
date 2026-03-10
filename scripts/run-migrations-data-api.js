#!/usr/bin/env node
/**
 * Run migrations on Production RDS via RDS Data API
 * Splits multi-statement SQL into individual statements.
 * No VPC/network access needed - uses AWS HTTP endpoint directly.
 *
 * Usage:
 *   node scripts/run-migrations-data-api.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const CLUSTER_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DATABASE = 'warmpawz';

const MIGRATIONS = [
  '536_cancellation_refund_policy_business_rules.sql',
  '541_add_missing_booking_columns.sql',
  '544_add_bookings_video_call_columns.sql',
  '560_ensure_vendor_profile_columns_prod.sql',
  '565_ensure_prescription_date_default_dev.sql',
  '600_add_vendor_available_for_instant_tele.sql',
  '600_tax_360_mapping.sql',
  '602_add_updated_at_to_vendor_documents.sql',
  '605_add_availability_configured_column.sql',
  '607_add_bookings_is_instant_tele.sql',
  '608_add_pharmacy_orders_columns.sql',
  '609_add_vendor_availability_v2_columns.sql',
  '610_add_vendor_identity_columns.sql',
  '611_add_vendors_metadata_column.sql',
  '612_add_onboarding_forms_sections.sql',
];

/**
 * Split SQL into individual statements, handling DO $$ ... $$; blocks
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;
  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip pure comment lines and empty lines
    if (trimmed.startsWith('--') || trimmed === '') {
      // But keep comments inside DO blocks
      if (inDollarBlock) {
        current += line + '\n';
      }
      continue;
    }

    // Detect start of DO $$ block
    if (!inDollarBlock && (trimmed.startsWith('DO $$') || trimmed.startsWith('DO $'))) {
      inDollarBlock = true;
      current += line + '\n';
      continue;
    }

    // Detect end of DO $$ block
    if (inDollarBlock) {
      current += line + '\n';
      // Check for closing $$; (with optional whitespace)
      if (/\$\$\s*;/.test(trimmed)) {
        inDollarBlock = false;
        const stmt = current.trim();
        if (stmt) statements.push(stmt);
        current = '';
      }
      continue;
    }

    // Regular line - accumulate until we hit a semicolon
    current += line + '\n';

    // Check if line ends with semicolon (outside DO block)
    if (trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
    }
  }

  // Any remaining content
  const remaining = current.trim();
  if (remaining) {
    statements.push(remaining);
  }

  return statements;
}

function executeSql(sql) {
  const inputFile = path.join(__dirname, '_tmp_input.json');
  try {
    const input = JSON.stringify({
      resourceArn: CLUSTER_ARN,
      secretArn: SECRET_ARN,
      database: DATABASE,
      sql: sql,
    });
    fs.writeFileSync(inputFile, input, 'utf8');

    const result = execSync(
      `aws rds-data execute-statement --cli-input-json file://${inputFile} --region ${REGION} --output json`,
      { encoding: 'utf8', timeout: 120000 }
    );

    try { fs.unlinkSync(inputFile); } catch (_) {}
    return { success: true, result };
  } catch (error) {
    try { fs.unlinkSync(inputFile); } catch (_) {}

    const msg = error.stderr ? error.stderr.toString() : error.message;
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      return { success: true, skipped: true, message: msg.substring(0, 150) };
    }
    return { success: false, message: msg.substring(0, 300) };
  }
}

function main() {
  console.log('==========================================================');
  console.log('  Running Production Migrations via RDS Data API');
  console.log('  (Statement-by-statement execution)');
  console.log('==========================================================');
  console.log(`Cluster: warmpawz-prod-cluster`);
  console.log(`Database: ${DATABASE}`);
  console.log(`Migrations: ${MIGRATIONS.length}`);
  console.log('');

  // Test connection
  console.log('Testing connection...');
  const testResult = executeSql('SELECT 1 as connection_test');
  if (!testResult.success) {
    console.error('Connection test failed:', testResult.message);
    process.exit(1);
  }
  console.log('Connection successful!');
  console.log('');

  const results = { successful: [], failed: [], skipped: [] };

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migration = MIGRATIONS[i];
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migration);

    console.log(`[${i + 1}/${MIGRATIONS.length}] ${migration}`);

    if (!fs.existsSync(migrationPath)) {
      console.log('   FILE NOT FOUND (skipped)');
      results.skipped.push(migration);
      continue;
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = splitStatements(sql);

    if (statements.length === 0) {
      console.log('   EMPTY (skipped)');
      results.skipped.push(migration);
      continue;
    }

    console.log(`   ${statements.length} statement(s) to execute`);

    let allSuccess = true;
    let allSkipped = true;
    let failMsg = '';

    for (let j = 0; j < statements.length; j++) {
      const stmt = statements[j];
      const preview = stmt.replace(/\s+/g, ' ').substring(0, 80);
      process.stdout.write(`   [${j + 1}/${statements.length}] ${preview}... `);

      const result = executeSql(stmt);

      if (result.success && !result.skipped) {
        console.log('OK');
        allSkipped = false;
      } else if (result.success && result.skipped) {
        console.log('SKIPPED');
      } else {
        console.log('FAILED');
        console.log(`         ${result.message}`);
        allSuccess = false;
        allSkipped = false;
        failMsg = result.message;
        // Continue with remaining statements (best-effort)
      }
    }

    if (allSuccess && !allSkipped) {
      results.successful.push(migration);
    } else if (allSuccess && allSkipped) {
      results.skipped.push(migration);
    } else if (allSuccess) {
      results.successful.push(migration);
    } else {
      results.failed.push({ migration, error: failMsg });
    }
    console.log('');
  }

  console.log('==========================================================');
  console.log('  Migration Summary');
  console.log('==========================================================');
  console.log(`  Successful: ${results.successful.length}`);
  console.log(`  Skipped:    ${results.skipped.length}`);
  console.log(`  Failed:     ${results.failed.length}`);
  console.log('');

  if (results.successful.length > 0) {
    console.log('Successful:');
    results.successful.forEach(m => console.log(`  + ${m}`));
    console.log('');
  }

  if (results.skipped.length > 0) {
    console.log('Skipped:');
    results.skipped.forEach(m => console.log(`  ~ ${m}`));
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('Failed:');
    results.failed.forEach(({ migration, error }) => {
      console.log(`  x ${migration}`);
      console.log(`    ${error}`);
    });
    console.log('');
  }

  // Verify critical columns
  console.log('==========================================================');
  console.log('  Verification');
  console.log('==========================================================');

  const verifyQueries = [
    { table: 'bookings', column: 'is_instant_tele', desc: 'Instant tele flag' },
    { table: 'vendors', column: 'available_for_instant_tele', desc: 'Vendor instant tele availability' },
    { table: 'vendors', column: 'availability_configured', desc: 'Vendor availability configured' },
    { table: 'bookings', column: 'video_call_meeting_id', desc: 'Video call meeting ID' },
    { table: 'bookings', column: 'customer_phone', desc: 'Customer phone on bookings' },
  ];

  for (const { table, column, desc } of verifyQueries) {
    const sql = `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`;
    const result = executeSql(sql);
    if (result.success) {
      try {
        const parsed = JSON.parse(result.result);
        if (parsed.records && parsed.records.length > 0) {
          console.log(`  + ${desc}: ${table}.${column} EXISTS`);
        } else {
          console.log(`  - ${desc}: ${table}.${column} NOT FOUND`);
        }
      } catch (_) {
        console.log(`  ? ${desc}: Could not parse result`);
      }
    } else {
      console.log(`  ? ${desc}: Verification failed`);
    }
  }

  console.log('');
  if (results.failed.length > 0) {
    console.log('Some migrations failed. Review errors above.');
    process.exit(1);
  } else {
    console.log('All migrations completed successfully!');
  }
}

main();
