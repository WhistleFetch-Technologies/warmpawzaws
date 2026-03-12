/**
 * Migration 613: Allow Duplicate Phone Numbers When Deleted (Production)
 * Environment: Production
 * Method: AWS CLI with RDS Data API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REGION = 'ap-south-1';
const ENVIRONMENT = 'prod';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB_NAME = 'warmpawz';

// Cache cluster and secret info
let clusterArn = null;
let secretArn = null;

async function getClusterInfo() {
  if (clusterArn && secretArn) {
    return { clusterArn, secretArn };
  }
  
  // Get cluster ARN
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${CLUSTER_ID}`);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  clusterArn = cluster.DBClusterArn;
  
  if (!cluster.HttpEndpointEnabled) {
    throw new Error('RDS Data API is not enabled on this cluster');
  }
  
  // Get secret ARN
  const secretInfo = JSON.parse(execSync(
    `aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  secretArn = secretInfo.ARN;
  
  return { clusterArn, secretArn };
}

async function executeSQL(sql, expectResult = false) {
  try {
    const { clusterArn: resourceArn, secretArn: secret } = await getClusterInfo();
    
    // Write SQL to temp file to avoid shell escaping issues
    const tmpFile = path.join(__dirname, `_tmp_stmt_${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, sql, 'utf8');
    
    try {
      const result = execSync(
        `aws rds-data execute-statement --resource-arn "${resourceArn}" --secret-arn "${secret}" --database "${DB_NAME}" --sql file://${tmpFile.replace(/\\/g, '/')} --region ${REGION} --output json`,
        { encoding: 'utf8', stdio: expectResult ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'] }
      );
      
      return expectResult ? JSON.parse(result) : { success: true };
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    // Check if it's a "does not exist" error (which is OK)
    const errorOutput = error.stderr ? error.stderr.toString() : error.message || '';
    if (errorOutput.includes('does not exist') || 
        errorOutput.includes('not found')) {
      return { status: 'does_not_exist' };
    }
    throw error;
  }
}

async function checkConstraintExists(constraintName) {
  const sql = `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') as exists;`;
  
  try {
    const result = await executeSQL(sql, true);
    if (result.records && result.records.length > 0) {
      return result.records[0][0].booleanValue === true;
    }
    return false;
  } catch (error) {
    console.warn(`Error checking constraint existence: ${error.message}`);
    return false;
  }
}

async function checkIndexExists(indexName) {
  const sql = `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = '${indexName}') as exists;`;
  
  try {
    const result = await executeSQL(sql, true);
    if (result.records && result.records.length > 0) {
      return result.records[0][0].booleanValue === true;
    }
    return false;
  } catch (error) {
    console.warn(`Error checking index existence: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('MIGRATION 613: Allow Duplicate Phone Numbers When Deleted');
  console.log('Environment: PRODUCTION');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Verify is_deleted column exists
    console.log('📋 Step 1: Verifying is_deleted column in vendor_identity table...');
    const checkColumnSQL = `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'is_deleted') as exists;`;
    const columnResult = await executeSQL(checkColumnSQL, true);
    const hasColumn = columnResult.records && columnResult.records.length > 0 && columnResult.records[0][0].booleanValue === true;
    
    if (!hasColumn) {
      console.log('   ⚠️  Column does not exist. Adding is_deleted column...');
      await executeSQL('ALTER TABLE vendor_identity ADD COLUMN is_deleted BOOLEAN DEFAULT false NOT NULL;');
      console.log('   ✅ Column added successfully');
    } else {
      console.log('   ✅ Column already exists');
    }
    console.log('');

    // Step 2: Drop old unique constraint vendor_identity_phone_key
    console.log('📋 Step 2: Checking for old unique constraint vendor_identity_phone_key...');
    const hasConstraint = await checkConstraintExists('vendor_identity_phone_key');
    
    if (hasConstraint) {
      console.log('   ⚠️  Constraint exists. Dropping constraint...');
      await executeSQL('ALTER TABLE vendor_identity DROP CONSTRAINT IF EXISTS vendor_identity_phone_key;');
      console.log('   ✅ Constraint dropped successfully');
    } else {
      console.log('   ✅ Constraint does not exist (already dropped or never existed)');
    }
    console.log('');

    // Step 3: Drop old unique indexes if they exist
    console.log('📋 Step 3: Checking for old unique indexes...');
    const hasOldIndex1 = await checkIndexExists('vendor_identity_phone_key');
    const hasOldIndex2 = await checkIndexExists('idx_vendor_identity_phone_unique');
    
    if (hasOldIndex1 || hasOldIndex2) {
      console.log('   ⚠️  Old indexes exist. Dropping them...');
      if (hasOldIndex1) {
        await executeSQL('DROP INDEX IF EXISTS vendor_identity_phone_key;');
        console.log('   ✅ Dropped vendor_identity_phone_key index');
      }
      if (hasOldIndex2) {
        await executeSQL('DROP INDEX IF EXISTS idx_vendor_identity_phone_unique;');
        console.log('   ✅ Dropped idx_vendor_identity_phone_unique index');
      }
    } else {
      console.log('   ✅ Old indexes do not exist');
    }
    console.log('');

    // Step 4: Create new partial unique index
    console.log('📋 Step 4: Creating new partial unique index idx_vendor_identity_phone_unique_active...');
    const hasNewIndex = await checkIndexExists('idx_vendor_identity_phone_unique_active');
    
    if (!hasNewIndex) {
      console.log('   ⚠️  Index does not exist. Creating index...');
      await executeSQL('CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_identity_phone_unique_active ON vendor_identity (phone) WHERE (is_deleted = false OR is_deleted IS NULL);');
      console.log('   ✅ Index created successfully');
    } else {
      console.log('   ✅ Index already exists');
    }
    console.log('');

    // Step 5: Add comment to index
    console.log('📋 Step 5: Adding comment to index...');
    try {
      await executeSQL(`COMMENT ON INDEX idx_vendor_identity_phone_unique_active IS 'Ensures phone uniqueness only for non-deleted vendor identities - allows reuse when deleted';`);
      console.log('   ✅ Comment added successfully');
    } catch (error) {
      console.log('   ⚠️  Could not add comment (non-fatal):', error.message);
    }
    console.log('');

    // Step 6: Verify migration
    console.log('📋 Step 6: Verifying migration...');
    const finalColumnCheck = await executeSQL(checkColumnSQL, true);
    const hasColumnFinal = finalColumnCheck.records && finalColumnCheck.records.length > 0 && finalColumnCheck.records[0][0].booleanValue === true;
    const hasConstraintFinal = await checkConstraintExists('vendor_identity_phone_key');
    const hasOldIndex1Final = await checkIndexExists('vendor_identity_phone_key');
    const hasOldIndex2Final = await checkIndexExists('idx_vendor_identity_phone_unique');
    const hasNewIndexFinal = await checkIndexExists('idx_vendor_identity_phone_unique_active');
    
    console.log('');
    console.log('='.repeat(80));
    console.log('MIGRATION VERIFICATION');
    console.log('='.repeat(80));
    console.log(`vendor_identity.is_deleted column:              ${hasColumnFinal ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`vendor_identity_phone_key constraint:            ${hasConstraintFinal ? '⚠️  STILL EXISTS' : '✅ REMOVED'}`);
    console.log(`vendor_identity_phone_key index:                 ${hasOldIndex1Final ? '⚠️  STILL EXISTS' : '✅ REMOVED'}`);
    console.log(`idx_vendor_identity_phone_unique index:         ${hasOldIndex2Final ? '⚠️  STILL EXISTS' : '✅ REMOVED'}`);
    console.log(`idx_vendor_identity_phone_unique_active index:   ${hasNewIndexFinal ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log('='.repeat(80));
    
    if (hasColumnFinal && !hasConstraintFinal && !hasOldIndex1Final && !hasOldIndex2Final && hasNewIndexFinal) {
      console.log('');
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('');
    } else {
      console.log('');
      console.log('⚠️  MIGRATION INCOMPLETE - Some items need attention');
      console.log('');
      if (!hasColumnFinal) {
        console.log('   ❌ is_deleted column is missing');
      }
      if (hasConstraintFinal) {
        console.log('   ⚠️  Old constraint still exists');
      }
      if (hasOldIndex1Final || hasOldIndex2Final) {
        console.log('   ⚠️  Old indexes still exist');
      }
      if (!hasNewIndexFinal) {
        console.log('   ❌ New index is missing');
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ MIGRATION FAILED');
    console.error('='.repeat(80));
    console.error(error.message);
    if (error.stderr) {
      console.error('STDERR:', error.stderr.toString());
    }
    if (error.stdout) {
      console.error('STDOUT:', error.stdout.toString());
    }
    console.error('');
    process.exit(1);
  }
}

main();
