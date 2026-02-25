#!/usr/bin/env node

/**
 * Run migration 602 via AWS RDS Data API
 * Properly handles dollar-quoted SQL blocks (DO $$ ... END $$;)
 *
 * Usage:
 *   ENVIRONMENT=dev  node scripts/run-migration-602.js
 *   ENVIRONMENT=prod node scripts/run-migration-602.js
 */

const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// The 4 individual SQL statements from migration 602, properly separated:
const STATEMENTS = [
  // 1. Add updated_at column if not exists
  `DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_documents' AND column_name = 'updated_at' ) THEN ALTER TABLE vendor_documents ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(); RAISE NOTICE 'Added updated_at column to vendor_documents table.'; ELSE RAISE NOTICE 'updated_at column already exists in vendor_documents table.'; END IF; END $$`,

  // 2. Add comment
  `COMMENT ON COLUMN vendor_documents.updated_at IS 'Timestamp when the document was last updated'`,

  // 3. Create or replace function
  `CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql`,

  // 4. Create trigger if not exists
  `DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_trigger WHERE tgname = 'update_vendor_documents_updated_at' ) THEN CREATE TRIGGER update_vendor_documents_updated_at BEFORE UPDATE ON vendor_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); RAISE NOTICE 'Created trigger to automatically update updated_at column.'; ELSE RAISE NOTICE 'Trigger update_vendor_documents_updated_at already exists.'; END IF; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Could not create trigger: %', SQLERRM; END $$`
];

async function main() {
  console.log(`\n🚀 Running Migration 602 on ${ENVIRONMENT.toUpperCase()} via RDS Data API...\n`);

  try {
    // Get cluster ARN
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    console.log(`📊 Getting RDS cluster info for: ${clusterId}...`);

    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));

    const cluster = clusterInfo.DBClusters[0];
    const clusterArn = cluster.DBClusterArn;
    const dbName = cluster.DatabaseName || 'warmpawz';

    let secretArn = cluster.MasterUserSecret?.SecretArn;
    if (!secretArn) {
      const secretName = ENVIRONMENT === 'prod'
        ? 'warmpawz-prod-rds-master-20260207201049162400000001'
        : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
      const describeSecret = JSON.parse(execSync(
        `aws secretsmanager describe-secret --secret-id "${secretName}" --region ${REGION} --output json`,
        { encoding: 'utf8' }
      ));
      secretArn = describeSecret.ARN;
    }

    console.log(`   Cluster ARN: ${clusterArn}`);
    console.log(`   Database:    ${dbName}`);
    console.log(`   Secret ARN:  ${secretArn}`);

    if (!cluster.HttpEndpointEnabled) {
      console.error('\n❌ RDS Data API is NOT enabled on this cluster.');
      console.error('   Enable it in RDS Console → Your cluster → Configuration → Data API');
      process.exit(1);
    }
    console.log(`   Data API:    Enabled ✅\n`);

    // Execute each statement
    for (let i = 0; i < STATEMENTS.length; i++) {
      const sql = STATEMENTS[i];
      const preview = sql.substring(0, 80).replace(/\n/g, ' ');
      console.log(`[${i + 1}/${STATEMENTS.length}] Executing: ${preview}...`);

      try {
        // Write SQL to temp file to avoid shell escaping issues
        const fs = require('fs');
        const tmpFile = require('path').join(__dirname, `_tmp_stmt_${i}.sql`);
        fs.writeFileSync(tmpFile, sql, 'utf8');

        execSync(
          `aws rds-data execute-statement --resource-arn "${clusterArn}" --secret-arn "${secretArn}" --database "${dbName}" --sql file://${tmpFile.replace(/\\/g, '/')} --region ${REGION}`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        // Clean up temp file
        fs.unlinkSync(tmpFile);

        console.log(`   ✅ Success`);
      } catch (error) {
        // Clean up temp file on error too
        try { require('fs').unlinkSync(require('path').join(__dirname, `_tmp_stmt_${i}.sql`)); } catch (_) {}

        const msg = error.stderr || error.message || '';
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          console.log(`   ⚠️  Already exists (OK)`);
        } else {
          console.error(`   ❌ Error: ${msg.substring(0, 200)}`);
        }
      }
    }

    // Verify the column was added
    console.log('\n🔍 Verifying migration...');
    const verifySql = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendor_documents' AND column_name = 'updated_at'`;
    const fs = require('fs');
    const tmpVerify = require('path').join(__dirname, '_tmp_verify.sql');
    fs.writeFileSync(tmpVerify, verifySql, 'utf8');

    try {
      const result = execSync(
        `aws rds-data execute-statement --resource-arn "${clusterArn}" --secret-arn "${secretArn}" --database "${dbName}" --sql file://${tmpVerify.replace(/\\/g, '/')} --region ${REGION} --output json`,
        { encoding: 'utf8' }
      );
      fs.unlinkSync(tmpVerify);

      const parsed = JSON.parse(result);
      if (parsed.records && parsed.records.length > 0) {
        console.log(`   ✅ Column 'updated_at' exists in 'vendor_documents'`);
      } else {
        console.log(`   ⚠️  Column not found - migration may have failed`);
      }
    } catch (e) {
      try { fs.unlinkSync(tmpVerify); } catch (_) {}
      console.log(`   ⚠️  Could not verify: ${(e.message || '').substring(0, 100)}`);
    }

    // Verify trigger
    const triggerSql = `SELECT tgname FROM pg_trigger WHERE tgname = 'update_vendor_documents_updated_at'`;
    const tmpTrigger = require('path').join(__dirname, '_tmp_trigger.sql');
    fs.writeFileSync(tmpTrigger, triggerSql, 'utf8');

    try {
      const result = execSync(
        `aws rds-data execute-statement --resource-arn "${clusterArn}" --secret-arn "${secretArn}" --database "${dbName}" --sql file://${tmpTrigger.replace(/\\/g, '/')} --region ${REGION} --output json`,
        { encoding: 'utf8' }
      );
      fs.unlinkSync(tmpTrigger);

      const parsed = JSON.parse(result);
      if (parsed.records && parsed.records.length > 0) {
        console.log(`   ✅ Trigger 'update_vendor_documents_updated_at' exists`);
      } else {
        console.log(`   ⚠️  Trigger not found - may have failed`);
      }
    } catch (e) {
      try { fs.unlinkSync(tmpTrigger); } catch (_) {}
      console.log(`   ⚠️  Could not verify trigger: ${(e.message || '').substring(0, 100)}`);
    }

    console.log('\n✅ Migration 602 complete!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();
